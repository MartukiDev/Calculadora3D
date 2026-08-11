# Calculadora de Costos de Impresión 3D — Prompt para Claude Code

## Contexto

Construir una app web personal para calcular el costo real de cada impresión 3D, guardar el desglose de costos, gestionar inventario de filamentos (impresora multi-color, hasta 4 filamentos por impresión) y descontar stock automáticamente al "lanzar" una impresión. Multi-usuario con aislamiento total de datos por usuario (RBAC simple vía RLS).

## Stack

- **Next.js 14+** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase**: Auth (email/password) + Postgres + Row Level Security → **fuente de verdad**
- **localStorage**: solo caché de lectura y borradores en progreso, nunca fuente de verdad. Se invalida/reescribe en cada escritura confirmada a Supabase.

## Supuestos tomados (ajustables antes de ejecutar el prompt)

- Depreciación de impresora: se define como un monto fijo CLP/hora **por impresora** (no amortización por vida útil ni valor de compra). Si prefieres el modelo de amortización, avísame y lo cambiamos.
- Multi-impresora: cada usuario administra su parque en la tabla `printers`. Consumo en watts, mano de obra, depreciación y desperdicio default son **por máquina**; en `user_settings` solo quedan la tarifa de luz y el IVA, que no dependen de la impresora. Cada cálculo guarda con qué impresora se hizo (`prints.printer_id`).
- No se incluyó empaque/envío en el desglose (no lo seleccionaste). Se puede agregar después como campo opcional.
- IVA (19% default, editable) se aplica sobre el precio neto con margen, no sobre el costo — refleja cómo se calcula un precio de venta final en Chile.
- Gramos usados por filamento en cada impresión se ingresan manualmente (no hay integración con slicer/G-code).

## Modelo de datos (Supabase / Postgres)

```sql
-- Configuración global por usuario (costo de luz, mano de obra, etc. — se guarda una sola vez)
create table public.user_settings (
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
create table public.filaments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  marca text not null,
  material text not null, -- PLA, ABS, PETG, TPU, ASA, Nylon, PC, etc (select + "otro")
  color_nombre text not null,
  color_hex text not null default '#000000',
  costo_clp_kg numeric(10,2) not null,
  stock_gramos numeric(10,2) not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cálculos / impresiones
create table public.prints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre_proyecto text not null,
  status text not null default 'borrador' check (status in ('borrador','lanzada')),
  tiempo_impresion_horas numeric(10,2) not null,
  filamentos_usados jsonb not null default '[]', -- [{filament_id, gramos}], máx 4 elementos
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

create index prints_user_status_idx on public.prints (user_id, status);
create index filaments_user_activo_idx on public.filaments (user_id, activo);
```

## RLS (aislamiento simple por usuario)

```sql
alter table public.user_settings enable row level security;
alter table public.filaments enable row level security;
alter table public.prints enable row level security;

create policy "user_settings_isolation" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "filaments_isolation" on public.filaments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "prints_isolation" on public.prints
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## Función RPC: lanzar impresión y descontar stock (atómico)

```sql
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
  where id = p_print_id and status = 'borrador';

  if v_user_id is null or v_user_id != auth.uid() then
    raise exception 'No autorizado o impresión no encontrada/ya lanzada';
  end if;

  for v_item in select * from jsonb_array_elements(v_filamentos)
  loop
    select stock_gramos into v_stock_actual
    from public.filaments
    where id = (v_item->>'filament_id')::uuid and user_id = v_user_id;

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
```

## Autenticación

- Supabase Auth con email + password.
- Páginas: `/login`, `/signup`, `/reset-password`.
- Middleware de Next.js protegiendo todas las rutas bajo `/dashboard/*`, redirige a `/login` si no hay sesión.
- Al crear cuenta, insertar fila default en `user_settings` (trigger o server action en el signup).

## Lógica de costeo (fórmulas)

```
costo_filamento   = Σ (gramos_i / 1000 * costo_clp_kg_i)   para cada filamento usado (hasta 4)
costo_luz         = tarifa_luz_clp_kwh * (consumo_impresora_w / 1000) * tiempo_impresion_horas
costo_mano_obra   = tarifa_mano_obra_clp_hora * tiempo_impresion_horas
costo_depreciacion= costo_depreciacion_clp_hora * tiempo_impresion_horas

subtotal          = costo_filamento + costo_luz + costo_mano_obra + costo_depreciacion
costo_total       = subtotal * (1 + desperdicio_pct / 100)

precio_neto            = costo_total * (1 + margen_pct / 100)     // margen_pct: 0–500
precio_final_con_iva    = precio_neto * (1 + iva_pct / 100)
```

La tarifa de luz y el IVA se precargan desde `user_settings`; el consumo en watts, la mano de obra, la depreciación y el desperdicio default salen de la impresora seleccionada. Todos son editables por impresión sin modificar el default guardado, y cambiar de impresora vuelve a precargar sus cuatro valores.

## Dirección visual: Glassmorphism

Paleta (base oscura para que el vidrio se lea bien, sin caer en el típico glass morado sobre gradiente):

- Fondo base: `#14171C` — grafito oscuro, guiño a filamento de carbono / la Centauri Carbon
- Panel de vidrio: `rgba(255,255,255,0.06)` + `backdrop-filter: blur(20px)`, borde `rgba(255,255,255,0.12)`
- Acento primario (glow de hotend): `#FF7A3D`
- Acento secundario (filamento translúcido frío, ej. PETG): `#4FD1C5`
- Texto primario: `#F5F6F8` — texto secundario/muted: `#9AA3AF`

Tipografía:

- Display / headings: **Space Grotesk** — geométrica, con carácter técnico, apropiada para una herramienta de taller
- Body / UI: **Inter**
- Cifras y montos CLP: **JetBrains Mono** con `font-variant-numeric: tabular-nums` — los montos deben alinearse en columna como en una consola/hoja de cálculo, no usar la fuente de UI para números

Layout:

- Fondo con grid punteado sutil (`radial-gradient` de puntos cada 24px, opacidad ~4%), referencia directa a la grilla de cama de impresión / vista de slicer — no un blob de gradiente genérico
- Los paneles de vidrio flotan sobre ese grid, nunca sobre un fondo plano de un solo color (el efecto no lee bien sin algo de profundidad detrás)

Elemento firma — "stack de capas de costo":

- El desglose (`costo_filamento`, `costo_luz`, `costo_mano_obra`, `costo_depreciacion`) se renderiza como capas de vidrio apiladas con offset vertical de ~4px y blur creciente, imitando cómo se construye una impresión capa por capa. `costo_total` → `precio_neto` → `precio_final_con_iva` es la capa superior: más opaca, con el acento primario.
- Los filamentos seleccionados (hasta 4) se muestran como chips circulares translúcidos usando el `color_hex` real de cada filamento como tinte del vidrio — el propio material (PETG y varios PLA son semi-translúcidos) es la referencia natural del efecto, no una decoración añadida.

Notas técnicas de implementación (Tailwind):

- Definir `.glass-panel` como componente reutilizable (`backdrop-blur-xl`, `bg-white/5` a `bg-white/10`, `border border-white/10`, `shadow-[0_8px_32px_rgba(0,0,0,0.4)]`) en vez de repetir clases en cada card
- Contraste: sobre vidrio de baja opacidad, los valores de costo van en `text-white/90`–`/100`; nunca bajar de `/70` para texto legible
- `backdrop-filter` es costoso en mobile con muchos paneles a la vez — limitarlo a paneles visibles (configuración, calculadora, breakdown); en la tabla de historial fila por fila usar un glass más liviano o directamente `bg-white/5` sin blur
- Respetar `prefers-reduced-motion` en las animaciones de entrada de los paneles
- Fallback sin soporte de `backdrop-filter`: degradar a `bg-white/10` sólido sin blur, para no dejar el vidrio visualmente "roto"

## Fases de desarrollo

### Fase 1 — Setup
Next.js + TS + Tailwind + Supabase client (`@supabase/ssr`), estructura de carpetas, variables de entorno, cliente Supabase server/browser.

### Fase 2 — Autenticación
Login/signup/logout, middleware de protección de rutas, creación automática de `user_settings` al registrarse.

### Fase 3 — Configuración global (`/dashboard/configuracion`)
Formulario para tarifa de luz (CLP/kWh), consumo de impresora (W), tarifa mano de obra (CLP/hora), depreciación (CLP/hora), % desperdicio default, % IVA default. Guarda en `user_settings`, cachea en localStorage tras guardar.

### Fase 4 — CRUD de filamentos (`/dashboard/filamentos`)
Listado (cards con color_hex como swatch), crear/editar/archivar filamento, alerta visual de stock bajo (umbral configurable o fijo ej. <50g).

### Fase 5 — Calculadora de impresión (`/dashboard/calculos/nuevo`)
Formulario: nombre proyecto, tiempo de impresión, selector de hasta 4 filamentos (dropdown filtrado a `activo=true`, con gramos por cada uno), overrides opcionales de mano de obra/depreciación/desperdicio/IVA, slider de margen 0–500%. Cálculo en tiempo real (client-side) mostrando desglose completo antes de guardar. Guarda como `status='borrador'`.

### Fase 6 — Lanzar impresión
Desde el detalle de un cálculo en borrador, botón "Lanzar impresión" que llama al RPC `lanzar_impresion`, descuenta stock de cada filamento involucrado y cambia status a `lanzada`. Confirmación explícita (modal) antes de ejecutar, ya que es irreversible sobre el stock.

### Fase 7 — Historial (`/dashboard/calculos`)
Tabla/lista de cálculos con filtros por status (borrador/lanzada), rango de fechas, búsqueda por nombre. Vista de detalle con desglose completo y precio sugerido.

### Fase 8 — Caché local (localStorage)
- `settings_cache:{userId}` — copia de `user_settings`, se actualiza al guardar o al cargar exitosamente desde Supabase.
- `filaments_cache:{userId}` — copia de la lista de filamentos activos, para lectura rápida y fallback offline.
- `calc_draft:{userId}` — autoguardado del formulario de cálculo en progreso (no enviado), para no perder trabajo si se recarga la página. Se limpia al guardar exitosamente en Supabase.
- Patrón: fetch a Supabase primero → si falla (offline), usar caché con badge visual "datos en caché, puede no estar actualizado".

### Fase 9 — Pulido UI
Aplicar el sistema de diseño Glassmorphism definido arriba (paleta, tipografía, `.glass-panel`, stack de capas de costo, chips de filamento translúcidos). Formateo CLP con `Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })` usando la fuente monoespaciada para montos, estados de carga/error, validación de máximo 4 filamentos y de que gramos no excedan stock disponible (warning no bloqueante).

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

(No se requiere `SERVICE_ROLE_KEY` en cliente; todo pasa por RLS + RPC con `security definer` para el descuento de stock.)
