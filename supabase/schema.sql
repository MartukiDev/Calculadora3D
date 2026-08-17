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

-- Inventario de insumos que no son filamento: NFC, argollas, imanes, boquillas.
--
-- La unidad se elige por ítem porque un taller mezcla piezas contables con
-- material a granel, y por lo mismo el umbral de stock bajo también es por ítem:
-- 10 argollas es poco, 10 metros de cadena no.
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  -- Texto libre a propósito: cada taller nombra sus cosas distinto y una lista
  -- cerrada obligaría a editar el código cada vez que aparece un insumo nuevo.
  categoria text not null default '',
  unidad text not null default 'u' check (unidad <> ''),
  color_hex text not null default '#3ddad7',
  costo_clp_unidad numeric(10,2) not null default 0,
  stock numeric(10,2) not null default 0,
  stock_minimo numeric(10,2) not null default 0 check (stock_minimo >= 0),
  -- Los repuestos de taller (boquillas, correas) se controlan igual que el resto
  -- pero no son parte del producto, así que no aparecen en la calculadora.
  usa_en_calculo boolean not null default true,
  -- El % de desperdicio modela fallas de impresión: un NFC embebido se pierde
  -- con la pieza, una bolsa de embalaje no. Lo decide el ítem, no la fórmula.
  aplica_desperdicio boolean not null default false,
  nota text,
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

-- Insumos consumidos por el cálculo. Cada línea congela costo_unitario y
-- aplica_desperdicio: si mañana sube el precio de las argollas, el cálculo viejo
-- tiene que seguir contando lo que costó ese día.
alter table public.prints
  add column if not exists insumos_usados jsonb not null default '[]';
alter table public.prints
  add column if not exists costo_insumos numeric(10,2) not null default 0;

-- Impresión para uso propio: no se vende, así que no lleva margen ni IVA y solo
-- cuesta lo que cuesta producirla. Es una columna y no un margen_pct = 0 porque
-- los reportes tienen que poder separar lo vendido del consumo propio: con solo
-- el margen en cero, una pieza regalada y otra vendida al costo son idénticas.
alter table public.prints
  add column if not exists uso_personal boolean not null default false;

-- Proyectos: un producto vendible con su propio margen.
--
-- Un proyecto es UN cálculo repetido `cantidad` veces más los insumos de armado
-- y embalaje que no pertenecen a la impresión (pegamento, caja, manual). Todo lo
-- que declara es la receta de UNA unidad y `cantidad` multiplica la receta
-- completa: así el mismo proyecto entrega costo unitario y costo del lote sin
-- que el usuario tenga que multiplicar nada a mano.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  descripcion text,
  color_hex text not null default '#ff7a3d',
  -- Un solo cálculo por proyecto: el proyecto es un producto en cantidad, no un
  -- ensamblaje de piezas distintas. Nullable para poder crear el proyecto antes
  -- que el cálculo, y para que borrar el cálculo no se lleve el proyecto puesto.
  print_id uuid references public.prints(id) on delete set null,
  cantidad numeric(10,2) not null default 1 check (cantidad > 0),
  -- Mismo shape que prints.insumos_usados y por la misma razón: cada línea
  -- congela costo_unitario para que subir el precio de las argollas no reescriba
  -- proyectos viejos.
  insumos_usados jsonb not null default '[]',
  -- El margen es del proyecto, no del cálculo: la pieza cuesta, el proyecto
  -- vende. El margen_pct del print se ignora acá y solo sirve como referencia
  -- de cuánto valdría venderlo suelto.
  margen_pct numeric(5,2) not null default 0
    check (margen_pct >= 0 and margen_pct <= 500),
  iva_pct numeric(5,2) not null default 19,
  status text not null default 'borrador' check (status in ('borrador','lanzado')),
  notas text,
  -- Congelados al lanzar. Mientras es borrador el costo se deriva en vivo del
  -- cálculo asociado; una vez lanzado tiene que sobrevivir a que ese cálculo se
  -- edite o se elimine, igual que hacen las filas de prints.
  costo_pieza_unitario numeric(12,2) not null default 0,
  costo_insumos_unitario numeric(12,2) not null default 0,
  costo_unitario numeric(12,2) not null default 0,
  costo_total numeric(12,2) not null default 0,
  precio_neto numeric(12,2) not null default 0,
  precio_final_con_iva numeric(12,2) not null default 0,
  fecha_lanzamiento timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prints_user_status_idx on public.prints (user_id, status);
create index if not exists prints_user_printer_idx on public.prints (user_id, printer_id);
create index if not exists filaments_user_activo_idx on public.filaments (user_id, activo);
create index if not exists printers_user_activo_idx on public.printers (user_id, activo);
create index if not exists inventory_items_user_activo_idx
  on public.inventory_items (user_id, activo);

create index if not exists projects_user_status_idx on public.projects (user_id, status);

-- Una sola impresora predeterminada por usuario, garantizado por el motor.
create unique index if not exists printers_user_default_idx
  on public.printers (user_id) where es_default;

-- Un cálculo pertenece a lo sumo a un proyecto. Sin esto, dos proyectos podrían
-- apuntar al mismo cálculo y descontar su stock dos veces.
create unique index if not exists projects_print_idx
  on public.projects (print_id) where print_id is not null;

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
alter table public.inventory_items enable row level security;
alter table public.projects enable row level security;

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

drop policy if exists "inventory_items_isolation" on public.inventory_items;
create policy "inventory_items_isolation" on public.inventory_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "projects_isolation" on public.projects;
create policy "projects_isolation" on public.projects
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
-- Descuento de stock — helpers internos
--
-- Los extraemos porque hay dos formas de consumir stock (lanzar una impresión
-- suelta y lanzar un proyecto de N unidades) y tienen que descontar exactamente
-- igual. El multiplicador es lo único que cambia entre una y otra.
--
-- Van sin `security definer` a propósito, aunque los llame quien sí lo es: como
-- reciben el user_id por parámetro, ser definer significaría que cualquier fuga
-- de execute deja descontar el stock de otro usuario. Como invoker, llamarlos
-- directo desde el cliente no pasa de la RLS. Llamados desde los RPC de abajo
-- corren igual con los privilegios del definer, así que no cambia nada.
-- ------------------------------------------------------------

create or replace function public.descontar_insumos(
  p_user_id uuid,
  p_insumos jsonb,
  p_multiplicador numeric
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_item jsonb;
  v_stock_actual numeric;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p_insumos, '[]'::jsonb))
  loop
    select stock into v_stock_actual
    from public.inventory_items
    where id = (v_item->>'item_id')::uuid and user_id = p_user_id
    for update;

    if v_stock_actual is null then
      raise exception 'Insumo % no encontrado', v_item->>'item_id';
    end if;

    update public.inventory_items
    set stock = stock - (v_item->>'cantidad')::numeric * p_multiplicador,
        updated_at = now()
    where id = (v_item->>'item_id')::uuid and user_id = p_user_id;
  end loop;
end;
$$;

revoke all on function public.descontar_insumos(uuid, jsonb, numeric) from public;

/* Descuenta filamentos e insumos de un cálculo, multiplicados por p_multiplicador. */
create or replace function public.descontar_stock_print(
  p_print_id uuid,
  p_user_id uuid,
  p_multiplicador numeric
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_filamentos jsonb;
  v_insumos jsonb;
  v_item jsonb;
  v_stock_actual numeric;
begin
  select filamentos_usados, coalesce(insumos_usados, '[]'::jsonb)
    into v_filamentos, v_insumos
  from public.prints
  where id = p_print_id and user_id = p_user_id
  for update;

  if v_filamentos is null then
    raise exception 'Cálculo % no encontrado', p_print_id;
  end if;

  for v_item in select * from jsonb_array_elements(v_filamentos)
  loop
    select stock_gramos into v_stock_actual
    from public.filaments
    where id = (v_item->>'filament_id')::uuid and user_id = p_user_id
    for update;

    if v_stock_actual is null then
      raise exception 'Filamento % no encontrado', v_item->>'filament_id';
    end if;

    update public.filaments
    set stock_gramos = stock_gramos
                     - (v_item->>'gramos')::numeric * p_multiplicador,
        updated_at = now()
    where id = (v_item->>'filament_id')::uuid and user_id = p_user_id;
  end loop;

  perform public.descontar_insumos(p_user_id, v_insumos, p_multiplicador);
end;
$$;

revoke all on function public.descontar_stock_print(uuid, uuid, numeric) from public;

-- ------------------------------------------------------------
-- RPC: lanzar impresión y descontar stock (atómico)
--
-- Los descuentos y el cambio de estado ocurren en la misma transacción.
-- ------------------------------------------------------------

create or replace function public.lanzar_impresion(p_print_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
  from public.prints
  where id = p_print_id and status = 'borrador'
  for update;

  if v_user_id is null or v_user_id != auth.uid() then
    raise exception 'No autorizado o impresión no encontrada/ya lanzada';
  end if;

  -- Un cálculo dentro de un proyecto se lanza desde el proyecto, que sabe la
  -- cantidad. Permitir las dos vías descontaría el stock dos veces.
  if exists (select 1 from public.projects where print_id = p_print_id) then
    raise exception 'Este cálculo pertenece a un proyecto: lánzalo desde ahí';
  end if;

  perform public.descontar_stock_print(p_print_id, v_user_id, 1);

  update public.prints
  set status = 'lanzada', fecha_lanzamiento = now(), updated_at = now()
  where id = p_print_id;
end;
$$;

revoke all on function public.lanzar_impresion(uuid) from public;
grant execute on function public.lanzar_impresion(uuid) to authenticated;

-- ------------------------------------------------------------
-- RPC: lanzar proyecto (atómico)
--
-- Descuenta la receta completa multiplicada por la cantidad —el cálculo, sus
-- insumos y los insumos de armado del proyecto— y congela los costos.
--
-- El congelado ocurre acá y no en la server action porque los montos tienen que
-- calcularse sobre las mismas filas que se acaban de bloquear: si el precio de
-- un insumo cambia entre el cálculo y el descuento, el proyecto guardaría un
-- costo que no corresponde al stock que consumió.
-- ------------------------------------------------------------

create or replace function public.lanzar_proyecto(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_print_id uuid;
  v_cantidad numeric;
  v_insumos jsonb;
  v_margen numeric;
  v_iva numeric;
  v_costo_pieza numeric;
  v_costo_insumos numeric;
  v_costo_unitario numeric;
  v_costo_total numeric;
  v_precio_neto numeric;
begin
  select user_id, print_id, cantidad, coalesce(insumos_usados, '[]'::jsonb),
         margen_pct, iva_pct
    into v_user_id, v_print_id, v_cantidad, v_insumos, v_margen, v_iva
  from public.projects
  where id = p_project_id and status = 'borrador'
  for update;

  if v_user_id is null or v_user_id != auth.uid() then
    raise exception 'No autorizado o proyecto no encontrado/ya lanzado';
  end if;

  if v_print_id is null then
    raise exception 'El proyecto no tiene un cálculo asociado';
  end if;

  select costo_total into v_costo_pieza
  from public.prints
  where id = v_print_id and user_id = v_user_id and status = 'borrador'
  for update;

  if v_costo_pieza is null then
    raise exception 'El cálculo del proyecto no existe o ya fue lanzado';
  end if;

  perform public.descontar_stock_print(v_print_id, v_user_id, v_cantidad);
  perform public.descontar_insumos(v_user_id, v_insumos, v_cantidad);

  -- Los insumos de armado no pasan por el % de desperdicio: ese porcentaje
  -- modela fallas de impresión y ya está cobrado dentro de costo_total del
  -- cálculo. Una caja de embalaje no se pierde porque falle una pieza.
  select coalesce(
    sum((i->>'cantidad')::numeric * (i->>'costo_unitario')::numeric), 0)
    into v_costo_insumos
  from jsonb_array_elements(v_insumos) as i;

  v_costo_unitario := v_costo_pieza + v_costo_insumos;
  v_costo_total := v_costo_unitario * v_cantidad;
  v_precio_neto := v_costo_total * (1 + v_margen / 100);

  update public.prints
  set status = 'lanzada', fecha_lanzamiento = now(), updated_at = now()
  where id = v_print_id;

  update public.projects
  set status = 'lanzado',
      fecha_lanzamiento = now(),
      costo_pieza_unitario = round(v_costo_pieza, 2),
      costo_insumos_unitario = round(v_costo_insumos, 2),
      costo_unitario = round(v_costo_unitario, 2),
      costo_total = round(v_costo_total, 2),
      precio_neto = round(v_precio_neto, 2),
      precio_final_con_iva = round(v_precio_neto * (1 + v_iva / 100), 2),
      updated_at = now()
  where id = p_project_id;
end;
$$;

revoke all on function public.lanzar_proyecto(uuid) from public;
grant execute on function public.lanzar_proyecto(uuid) to authenticated;

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
