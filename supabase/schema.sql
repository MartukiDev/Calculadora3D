-- ============================================================
-- Calculadora de Costos de Impresión 3D — esquema completo
-- Ejecutar en el SQL Editor de Supabase (una sola vez).
-- ============================================================

-- ------------------------------------------------------------
-- Tablas
-- ------------------------------------------------------------

-- Configuración global por usuario. Solo lo que NO depende de la máquina:
-- la tarifa eléctrica la fija la distribuidora y el IVA, el país.
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tarifa_luz_clp_kwh numeric(10,2) not null default 0,
  iva_pct numeric(5,2) not null default 19,
  updated_at timestamptz not null default now()
);

-- Parque de impresoras. Todo costo que varía según la máquina vive acá.
create table if not exists public.printers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  marca text not null default '',
  modelo text not null default '',
  color_hex text not null default '#ff7a3d',
  consumo_w numeric(10,2) not null default 0,
  tarifa_mano_obra_clp_hora numeric(10,2) not null default 0,
  costo_depreciacion_clp_hora numeric(10,2) not null default 0,
  desperdicio_pct_default numeric(5,2) not null default 0
    check (desperdicio_pct_default >= 0 and desperdicio_pct_default <= 100),
  activo boolean not null default true,
  es_default boolean not null default false,
  created_at timestamptz not null default now(),
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
  -- Nullable a propósito: las impresoras se archivan, pero si alguna se borra
  -- de verdad el cálculo sigue siendo histórico válido (ya guarda sus costos).
  printer_id uuid references public.printers(id) on delete set null,
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

-- En bases ya creadas el "create table if not exists" de arriba es un no-op,
-- así que la columna nueva se agrega explícitamente.
alter table public.prints
  add column if not exists printer_id uuid references public.printers(id) on delete set null;

create index if not exists prints_user_status_idx on public.prints (user_id, status);
create index if not exists prints_user_printer_idx on public.prints (user_id, printer_id);
create index if not exists filaments_user_activo_idx on public.filaments (user_id, activo);
create index if not exists printers_user_activo_idx on public.printers (user_id, activo);

-- Una sola impresora predeterminada por usuario, garantizado por el motor.
create unique index if not exists printers_user_default_idx
  on public.printers (user_id) where es_default;

-- ------------------------------------------------------------
-- Migración a multi-impresora (idempotente)
--
-- Los costos por hora dejaron de vivir en user_settings. Antes de borrar esas
-- columnas, cada usuario estrena una impresora con los valores que ya tenía,
-- y sus cálculos previos quedan asignados a ella.
-- ------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_settings'
      and column_name = 'consumo_impresora_w'
  ) then
    insert into public.printers (
      user_id, nombre, consumo_w, tarifa_mano_obra_clp_hora,
      costo_depreciacion_clp_hora, desperdicio_pct_default, es_default
    )
    select s.user_id,
           'Mi impresora',
           s.consumo_impresora_w,
           s.tarifa_mano_obra_clp_hora,
           s.costo_depreciacion_clp_hora,
           s.desperdicio_pct_default,
           true
    from public.user_settings s
    where not exists (
      select 1 from public.printers p where p.user_id = s.user_id
    );

    update public.prints p
    set printer_id = d.id
    from public.printers d
    where d.user_id = p.user_id
      and d.es_default
      and p.printer_id is null;
  end if;
end $$;

alter table public.user_settings drop column if exists consumo_impresora_w;
alter table public.user_settings drop column if exists tarifa_mano_obra_clp_hora;
alter table public.user_settings drop column if exists costo_depreciacion_clp_hora;
alter table public.user_settings drop column if exists desperdicio_pct_default;

-- ------------------------------------------------------------
-- RLS — aislamiento total por usuario
-- ------------------------------------------------------------

alter table public.user_settings enable row level security;
alter table public.filaments enable row level security;
alter table public.prints enable row level security;
alter table public.printers enable row level security;

drop policy if exists "user_settings_isolation" on public.user_settings;
create policy "user_settings_isolation" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "printers_isolation" on public.printers;
create policy "printers_isolation" on public.printers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "filaments_isolation" on public.filaments;
create policy "filaments_isolation" on public.filaments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "prints_isolation" on public.prints;
create policy "prints_isolation" on public.prints
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Trigger: crear user_settings y la primera impresora al registrarse
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

  -- Sin impresora no se puede costear nada: se crea una en cero para que el
  -- usuario entre y la edite, en vez de toparse con un estado vacío.
  insert into public.printers (user_id, nombre, es_default)
  select new.id, 'Mi impresora', true
  where not exists (
    select 1 from public.printers where user_id = new.id
  );

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

-- ------------------------------------------------------------
-- RPC: marcar impresora predeterminada (atómico)
--
-- El índice único parcial impide dos defaults a la vez, así que desmarcar y
-- marcar tienen que ocurrir en la misma transacción o la segunda falla.
-- ------------------------------------------------------------

create or replace function public.set_impresora_default(p_printer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
  from public.printers
  where id = p_printer_id
  for update;

  if v_user_id is null or v_user_id != auth.uid() then
    raise exception 'No autorizado o impresora no encontrada';
  end if;

  update public.printers
  set es_default = false, updated_at = now()
  where user_id = v_user_id and es_default and id <> p_printer_id;

  -- Una impresora archivada no puede quedar como predeterminada.
  update public.printers
  set es_default = true, activo = true, updated_at = now()
  where id = p_printer_id;
end;
$$;

revoke all on function public.set_impresora_default(uuid) from public;
grant execute on function public.set_impresora_default(uuid) to authenticated;
