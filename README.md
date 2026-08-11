# Calculadora de Costos de Impresión 3D

App web personal para calcular el costo real de cada impresión 3D, gestionar el
inventario de filamentos (hasta 4 por impresión, multi-color) y descontar stock
automáticamente al lanzar una impresión.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase
(Auth + Postgres + RLS). El detalle funcional y de diseño está en
[`docs/prompt-calculadora-3d.md`](docs/prompt-calculadora-3d.md).

## Puesta en marcha

```bash
pnpm install
cp .env.local.example .env.local   # completa URL y anon key
pnpm dev
```

### 1. Crear el proyecto en Supabase

En **Project Settings → API** copia la URL y la `anon key` a `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

No se usa `SERVICE_ROLE_KEY`: todo pasa por RLS, y el descuento de stock por un
RPC `security definer`.

### 2. Ejecutar el esquema

En el **SQL Editor** de Supabase, corre [`supabase/schema.sql`](supabase/schema.sql)
una vez. Crea las tablas (`user_settings`, `filaments`, `prints`), las políticas
RLS de aislamiento por usuario, el trigger que crea la configuración al
registrarse y la función `lanzar_impresion`.

### 3. Auth y enlaces por email

En **Authentication → URL Configuration** de Supabase:

- **Site URL**: el dominio del deploy (ej. `https://tu-app.vercel.app`). Es el
  destino al que Supabase cae cuando el `redirectTo` que pide la app no está
  autorizado — si queda en `http://localhost:3000`, los correos de recuperación
  apuntarán a localhost.
- **Redirect URLs**: agrega tanto `http://localhost:3000/auth/callback` como
  `https://tu-app.vercel.app/auth/callback`.

En el hosting, define además `NEXT_PUBLIC_SITE_URL` con el dominio público. Las
cabeceras `host`/`origin` pueden apuntar al host interno detrás del proxy, así
que esa variable es la que manda al construir los enlaces.

## Cómo funciona

**Fuente de verdad: Supabase.** `localStorage` es solo caché de lectura
(`settings_cache:{userId}`, `filaments_cache:{userId}`) y autoguardado del
formulario en progreso (`calc_draft:{userId}`), que se limpia al confirmar el
guardado.

**Costeo** (`src/lib/calc.ts`):

```
costo_filamento    = Σ (gramos_i / 1000 × costo_clp_kg_i)
costo_luz          = tarifa_luz_clp_kwh × (consumo_w / 1000) × horas
costo_mano_obra    = tarifa_mano_obra_clp_hora × horas
costo_depreciacion = costo_depreciacion_clp_hora × horas

costo_total = (suma de lo anterior) × (1 + desperdicio_pct / 100)
precio_neto = costo_total × (1 + margen_pct / 100)
precio_final = precio_neto × (1 + iva_pct / 100)
```

La configuración global precarga cada cálculo, pero es editable por impresión
sin tocar el default. El cliente calcula en tiempo real solo para previsualizar:
el servidor **recalcula** con los precios reales antes de guardar.

**Lanzar una impresión** llama al RPC `lanzar_impresion`, que en una sola
transacción descuenta los gramos de cada filamento y cambia el estado a
`lanzada`. Es irreversible sobre el stock, por eso pide confirmación explícita y
los cálculos lanzados ya no se pueden editar.

## Estructura

```
src/
  app/
    (auth)/          login · signup · reset-password · actualizar-password
    auth/            server actions + callback de los enlaces por email
    dashboard/
      configuracion/ costos base del usuario
      filamentos/    CRUD de inventario
      calculos/      calculadora, historial y detalle
  components/        GlassPanel · CostLayerStack · FilamentChip · ui
  lib/               calc · format · cache · types · supabase/
  proxy.ts           refresco de sesión y protección de rutas
supabase/schema.sql  tablas, RLS, trigger y RPC
```

## Scripts

```bash
pnpm dev      # desarrollo
pnpm build    # build de producción
pnpm lint     # eslint
```
