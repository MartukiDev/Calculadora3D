-- ============================================================
-- Calculadora de Costos de Impresión 3D — esquema completo
-- Ejecutar en el SQL Editor de Supabase (una sola vez).
-- ============================================================

-- ------------------------------------------------------------
-- Tablas
-- ------------------------------------------------------------

-- Configuración global por usuario (costo de luz, mano de obra, etc.)
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tarifa_luz_clp_kwh numeric(10,2) not null default 0,
  consumo_impresora_w numeric(10,2) not null default 0,
  tarifa_mano_obra_clp_hora numeric(10,2) not null default 0,
  costo_depreciacion_clp_hora numeric(10,2) not null default 0,
  desperdicio_pct_default numeric(5,2) not null default 0,
  iva_pct numeric(5,2) not null default 19,
  updated_at timestamptz not null default now()
);

-- Inventario de filamentos
create table if not exists public.filaments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  marca text not null,
  material text not null, -- PLA, ABS, PETG, TPU, ASA, Nylon, PC, etc
  color_nombre text not null,
  color_hex text not null default '#000000',
  costo_clp_kg numeric(10,2) not null,
  stock_gramos numeric(10,2) not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cálculos / impresiones
create table if not exists public.prints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre_proyecto text not null,
  status text not null default 'borrador' check (status in ('borrador','lanzada')),
  tiempo_impresion_horas numeric(10,2) not null,
  filamentos_usados jsonb not null default '[]', -- [{filament_id, gramos}], máx 4
  costo_filamento numeric(10,2) not null default 0,
  costo_luz numeric(10,2) not null default 0,
  costo_mano_obra numeric(10,2) not null default 0,
  costo_depreciacion numeric(10,2) not null default 0,
  desperdicio_pct numeric(5,2) not null default 0,
  iva_pct numeric(5,2) not null default 19,
  margen_pct numeric(5,2) not null default 0 check (margen_pct >= 0 and margen_pct <= 500),
  costo_total numeric(10,2) not null default 0,
  precio_neto numeric(10,2) not null default 0,
  precio_final_con_iva numeric(10,2) not null default 0,
  notas text,
  fecha_lanzamiento timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prints_user_status_idx on public.prints (user_id, status);
create index if not exists filaments_user_activo_idx on public.filaments (user_id, activo);

-- ------------------------------------------------------------
-- RLS — aislamiento total por usuario
-- ------------------------------------------------------------

alter table public.user_settings enable row level security;
alter table public.filaments enable row level security;
alter table public.prints enable row level security;

drop policy if exists "user_settings_isolation" on public.user_settings;
create policy "user_settings_isolation" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "filaments_isolation" on public.filaments;
create policy "filaments_isolation" on public.filaments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "prints_isolation" on public.prints;
create policy "prints_isolation" on public.prints
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Trigger: crear user_settings al registrarse
-- ------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- RPC: lanzar impresión y descontar stock (atómico)
-- ------------------------------------------------------------

create or replace function public.lanzar_impresion(p_print_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_filamentos jsonb;
  v_item jsonb;
  v_stock_actual numeric;
begin
  select user_id, filamentos_usados into v_user_id, v_filamentos
  from public.prints
  where id = p_print_id and status = 'borrador'
  for update;

  if v_user_id is null or v_user_id != auth.uid() then
    raise exception 'No autorizado o impresión no encontrada/ya lanzada';
  end if;

  for v_item in select * from jsonb_array_elements(v_filamentos)
  loop
    select stock_gramos into v_stock_actual
    from public.filaments
    where id = (v_item->>'filament_id')::uuid and user_id = v_user_id
    for update;

    if v_stock_actual is null then
      raise exception 'Filamento % no encontrado', v_item->>'filament_id';
    end if;

    update public.filaments
    set stock_gramos = stock_gramos - (v_item->>'gramos')::numeric,
        updated_at = now()
    where id = (v_item->>'filament_id')::uuid and user_id = v_user_id;
  end loop;

  update public.prints
  set status = 'lanzada', fecha_lanzamiento = now(), updated_at = now()
  where id = p_print_id;
end;
$$;

revoke all on function public.lanzar_impresion(uuid) from public;
grant execute on function public.lanzar_impresion(uuid) to authenticated;
