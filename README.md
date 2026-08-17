# Calculadora de Costos de Impresión 3D

App web personal para calcular el costo real de cada impresión 3D, administrar
varias impresoras con sus propios costos, gestionar el inventario de filamentos
(hasta 4 por impresión, multi-color) y de insumos de taller (tags NFC, argollas,
imanes, boquillas), armar proyectos que producen un mismo cálculo en cantidad y
descontar stock automáticamente al lanzar. Lo que imprimes para ti se marca como
uso personal y se reporta aparte, al costo.

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

En el **SQL Editor** de Supabase, corre [`supabase/schema.sql`](supabase/schema.sql).
Crea las tablas (`user_settings`, `printers`, `filaments`, `inventory_items`,
`prints`, `projects`), las políticas RLS de aislamiento por usuario, el trigger que
al registrarse deja lista la configuración y una primera impresora, y las funciones
`lanzar_impresion`, `lanzar_proyecto` y `set_impresora_default`.

El archivo es **idempotente**: se puede volver a correr sin romper nada, y así se
aplican los cambios de esquema (no hay herramienta de migraciones). Si vienes de
una versión anterior a multi-impresora, esa misma corrida migra tus datos: crea una
impresora "Mi impresora" con los costos que tenías en `user_settings`, le asigna tus
cálculos previos y recién entonces borra las columnas viejas.

### 3. Auth y enlaces por email

En **Authentication → URL Configuration** de Supabase:

- **Site URL**: el dominio del deploy (ej. `https://tu-app.vercel.app`). Es el
  destino al que Supabase cae cuando el `redirectTo` que pide la app no está
  autorizado — si queda en `http://localhost:3000`, los correos de recuperación
  apuntarán a localhost.
- **Redirect URLs**: lo más simple es autorizar ambos orígenes con comodín, así
  no hay que enumerar cada ruta:

  ```
  http://localhost:3000/**
  https://tu-app.vercel.app/**
  ```

  Las rutas que la app usa son `/auth/callback` (confirmación de cuenta) y
  `/auth/recovery` (recuperación de contraseña). Ninguna lleva query string,
  justamente para que el match contra esta lista sea inequívoco.

Si un enlace de email llega a la raíz con `?code=...`, significa que el
`redirectTo` no estaba autorizado y Supabase cayó al Site URL. La app reencamina
ese código para no perder la sesión, pero es una red de seguridad: corrige la
configuración igual.

En el hosting, define además `NEXT_PUBLIC_SITE_URL` con el dominio público. Las
cabeceras `host`/`origin` pueden apuntar al host interno detrás del proxy, así
que esa variable es la que manda al construir los enlaces.

### 4. SMTP con Resend

El servicio de email integrado de Supabase permite **2 correos por hora** en todo
el proyecto y no es apto para producción: basta probar dos veces "olvidé mi
contraseña" para toparse con `email rate limit exceeded`. La solución es SMTP
propio.

**En Resend:**

1. **Domains → Add Domain**, y agrega en tu DNS los registros que te entrega
   (DKIM y SPF). Sin dominio verificado solo puedes enviar desde
   `onboarding@resend.dev` y únicamente a tu propio correo — sirve para probar,
   no para usuarios reales.
2. **API Keys → Create API Key** con permiso de envío. Guarda el valor `re_...`:
   se muestra una sola vez.

**En Supabase → Authentication → SMTP Settings**, activa *Enable Custom SMTP*:

| Campo | Valor |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` (SSL implícito) o `587` (STARTTLS) |
| Username | `resend` |
| Password | tu API key de Resend (`re_...`) |
| Sender email | una dirección de tu dominio verificado, ej. `no-reply@tudominio.cl` |
| Sender name | `Calculadora 3D` |

**Después de guardar**, ve a **Authentication → Rate Limits** y sube el límite de
correos por hora: el tope de 2/hora existe solo por el servicio compartido.

El plan gratuito de Resend da 3.000 correos al mes con tope de 100 diarios. Nada
de esto toca el código de la app: es configuración de dashboard.

## Cómo funciona

**Fuente de verdad: Supabase.** `localStorage` es solo caché de lectura
(`settings_cache:{userId}`, `printers_cache:{userId}`, `filaments_cache:{userId}`)
y autoguardado del formulario en progreso (`calc_draft:{userId}`), que se limpia al
confirmar el guardado.

**Los costos se reparten según de qué dependan.** La tarifa de luz y el IVA son del
usuario y viven en `user_settings`. El consumo en watts, la mano de obra, la
depreciación por hora y el desperdicio default son de cada máquina y viven en
`printers`: una Ender y una X1C no cuestan lo mismo por hora.

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

Al elegir una impresora en la calculadora, sus cuatro valores se precargan y
quedan editables **solo para ese cálculo**, sin tocar el default; cambiar de
impresora los vuelve a precargar. Cada cálculo guarda con qué máquina se hizo, así
que el historial se puede filtrar por impresora.

El cliente calcula en tiempo real solo para previsualizar: el servidor **recalcula**
con los precios reales antes de guardar.

**Las impresoras se archivan, no se borran.** Una archivada desaparece del selector
pero sus cálculos siguen mostrándola. Siempre hay una marcada como predeterminada
—la que se preselecciona al calcular— y por eso no se puede archivar sin antes
pasarle ese rol a otra. Eliminarlas de verdad también se puede: los cálculos
conservan sus costos y quedan sin impresora asociada.

**Lanzar una impresión** llama al RPC `lanzar_impresion`, que en una sola
transacción descuenta los gramos de cada filamento y cambia el estado a
`lanzada`. Es irreversible sobre el stock, por eso pide confirmación explícita y
los cálculos lanzados ya no se pueden editar.

**Una impresión puede ser para uno mismo.** La casilla *Es para mí* del cálculo
guarda `uso_personal` y lo deja **sin margen y sin IVA**: su precio final es su
costo. El desperdicio se le sigue aplicando y el stock se descuenta igual al
lanzar — una impresión fallida consume filamento sea para un cliente o para el
propio taller. Los reportes las cuentan en una sección aparte, con su material y
su costo, para que no diluyan el margen ni inventen IVA. Un cálculo así no puede
asociarse a un proyecto, que por definición vende.

**Un proyecto es un producto vendible**: toma un cálculo, lo repite las unidades
que vayas a producir y le suma los insumos que lleva el armado y no la impresión
(pegamento, caja, manual). Todo lo que declara es la **receta de una unidad**, así
que entrega costo unitario y costo del lote a la vez:

```
costo_unitario = costo_total_del_calculo + Σ (cantidad_i × costo_unitario_i)
costo_lote     = costo_unitario × unidades
precio_neto    = costo_lote × (1 + margen_pct / 100)     ← margen del PROYECTO
precio_final   = precio_neto × (1 + iva_pct / 100)
```

El margen del cálculo se ignora dentro del proyecto: la pieza cuesta, el proyecto
vende. La pantalla de materiales cruza los filamentos e insumos del cálculo con los
de armado, los suma en una fila por material × unidades y los compara contra el
stock, para que sepas qué comprar antes de empezar.

**Lanzar el proyecto** (`lanzar_proyecto`) descuenta esa receta completa × unidades
y congela los costos. Un cálculo que pertenece a un proyecto no se lanza suelto: lo
descontaría dos veces.

## Estructura

```
src/
  app/
    page.tsx         landing pública (y rescate de enlaces de email)
    (auth)/          login · signup · reset-password · actualizar-password
    auth/            server actions + callback de los enlaces por email
    dashboard/
      configuracion/ tarifa de luz e IVA
      impresoras/    CRUD del parque de máquinas
      filamentos/    CRUD de inventario de filamento
      inventario/    CRUD de insumos (NFC, argollas, boquillas…)
      calculos/      calculadora, historial y detalle
      proyectos/     producto en cantidad, materiales y precio de venta
      reportes/      totales por período e impresora
  components/        GlassPanel · CostLayerStack · ProjectCostStack ·
                     FilamentChip · ui
    landing/         secciones de la portada
  lib/               calc · project · report · format · cache · types · supabase/
  proxy.ts           refresco de sesión y protección de rutas
supabase/schema.sql  tablas, RLS, trigger y RPC
```

`proxy.ts` es el middleware: Next 16 lo renombró. La raíz es pública; todo
`/dashboard/*` exige sesión.

## Scripts

```bash
pnpm dev      # desarrollo
pnpm build    # build de producción
pnpm lint     # eslint
```
