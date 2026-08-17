# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Qué es

Calculadora de costos de impresión 3D: multi-usuario, multi-impresora, con
inventario de filamentos, inventario de insumos de taller (NFC, argollas,
boquillas), proyectos que producen un mismo cálculo en cantidad, y descuento de
stock al lanzar.
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase.

El documento funcional y de diseño original está en
`docs/prompt-calculadora-3d.md`; el README cubre la puesta en marcha
(Supabase, Redirect URLs, SMTP con Resend).

## Comandos

```bash
pnpm dev      # desarrollo (Turbopack)
pnpm build    # build de producción — corre TypeScript, es la verificación más completa
pnpm lint     # eslint

pnpm exec tsc --noEmit    # typecheck solo
```

**No hay suite de tests.** La verificación es `tsc` + `eslint` + `pnpm build`, y
recorrer el flujo en el navegador.

El esquema **no se aplica con ninguna herramienta de migraciones**: hay que pegar
`supabase/schema.sql` en el SQL Editor de Supabase. Por eso ese archivo tiene que
quedar siempre **idempotente y re-ejecutable** (`create ... if not exists`,
`alter ... if exists`, bloques `do $$` que chequean `information_schema`). Al
cambiar el esquema, edita ese archivo, no escribas una migración suelta.

## Arquitectura

### Supabase es la única fuente de verdad

`localStorage` es solo caché de lectura y borrador en progreso (`src/lib/cache.ts`):
`settings_cache:`, `filaments_cache:`, `printers_cache:`, `inventory_cache:`,
`projects_cache:`, `calc_draft:`, todos por `userId`. **Solo se escribe con lo que Supabase ya confirmó**, nunca con el estado
del formulario. Se usa como fallback cuando la carga falla, mostrando `CacheBadge`.

Cabo suelto conocido: `clearAllCache` no está conectado a nada. `logout` es una
server action y no puede tocar `localStorage`, así que la caché sobrevive al cierre
de sesión; hay que llamarla desde el cliente si esto llega a importar.

### Tres clientes de Supabase

`src/lib/supabase/` tiene `server.ts` (Server Components y actions), `client.ts`
(navegador) y `middleware.ts` (refresco de sesión). `env.ts` expone
`isSupabaseConfigured`: sin credenciales la app **no revienta**, `/` muestra un panel
de configuración.

### `src/proxy.ts` es el middleware

Next 16 lo renombró de `middleware` a `proxy`. Ahí vive la protección de rutas:
todo lo que no sea `/`, `/login`, `/signup`, `/reset-password` o `/auth/*` exige
sesión. `/` es **pública** (landing) y solo redirige a `/dashboard` si hay usuario.

Todo `/dashboard/*` es `force-dynamic` (declarado en su layout): depende de la sesión
y de datos por usuario, nunca se prerenderiza.

Las constantes de dominio (`MAX_FILAMENTOS = 4`, `MAX_INSUMOS = 8`,
`STOCK_BAJO_GRAMOS = 50`, `UNIDADES`) viven en `src/lib/types.ts`, junto a los tipos
de fila. No las hardcodees.

### Dónde vive cada costo

Repartición deliberada, no accidental:

- **`user_settings`** — solo `tarifa_luz_clp_kwh` e `iva_pct`: lo que no depende de
  la máquina.
- **`printers`** — `consumo_w`, `tarifa_mano_obra_clp_hora`,
  `costo_depreciacion_clp_hora`, `desperdicio_pct_default`: distinto en cada máquina.

Al elegir impresora en la calculadora, esos cuatro valores se precargan y siguen
siendo editables **solo para ese cálculo**; cambiar de impresora los vuelve a
precargar. La fórmula está en `src/lib/calc.ts` y no depende de dónde vengan los
números.

### Inventario de insumos

`inventory_items` es el inventario de todo lo que no es filamento: tags NFC,
argollas, imanes, boquillas. Dos banderas por ítem deciden cómo participa:

- **`usa_en_calculo`** — los repuestos de taller (boquillas, correas) se controlan
  igual que el resto pero no son parte del producto, así que no aparecen en el
  selector de la calculadora.
- **`aplica_desperdicio`** — el `%` de desperdicio modela fallas de impresión: un
  NFC embebido se pierde con la pieza, una bolsa de embalaje no. Por eso lo decide
  el ítem y no la fórmula.

La **unidad es por ítem** (`u`, `g`, `ml`, `m`…) porque un taller mezcla piezas
contables con material a granel, y por lo mismo el umbral de stock bajo es
`stock_minimo` por ítem (`0` = sin alerta), no una constante global como en
filamentos. La `categoria` es texto libre, con las ya usadas ofrecidas en un
`datalist`.

En `calcularCostos`, `subtotal` incluye **todos** los insumos aunque a algunos no
se les aplique el desperdicio. Es deliberado: así `costoTotal - subtotal` sigue
siendo exactamente el recargo por desperdicio, que es lo que derivan el desglose
(`CostLayerStack`) y los reportes (`src/lib/report.ts`). El costo real es
`(base + insumosConDesperdicio) × (1 + d) + insumosSinDesperdicio`.

### Proyectos

Un proyecto es un **producto vendible**: un cálculo repetido `cantidad` veces más
los insumos de armado y embalaje que no pertenecen a la impresión. Es **un solo
cálculo por proyecto** (índice único parcial sobre `print_id`) porque el caso real
es un mismo producto en cantidad, no un ensamblaje de piezas distintas.

Dos reglas sostienen todo lo demás:

- **La pieza cuesta, el proyecto vende.** El proyecto suma el `costo_total` ya
  congelado del cálculo y aplica **su propio** margen; el `margen_pct` del `print`
  se ignora dentro del proyecto. Aplicar los dos sería margen sobre margen.
- **Todo lo declarado es la receta de UNA unidad**, y `cantidad` multiplica la
  receta completa. Por eso el mismo proyecto entrega costo unitario y costo del
  lote sin que nadie multiplique a mano.

Los insumos del proyecto **no** pasan por el `%` de desperdicio: ese porcentaje
modela fallas de impresión y ya viene cobrado dentro del `costo_total` del cálculo.
Una caja de embalaje no se pierde porque falle una pieza.

Mientras es `borrador` el costo se **deriva en vivo** del cálculo asociado, así que
editarlo se refleja en el proyecto. Al lanzar, `lanzar_proyecto` **congela** las
seis columnas de costo: el cálculo puede editarse o borrarse después y el proyecto
ya cobró lo que cobró. Esa bifurcación vive en `breakdownDeProyecto`
(`src/lib/project.ts`), no repartida por las páginas.

`consolidarMateriales` (mismo archivo) es la razón de ser de la sección: cruza los
filamentos e insumos del cálculo con los insumos de armado, **los suma en una fila
por material** ×`cantidad` y los compara contra el stock. El cálculo sabe qué lleva
una pieza y el inventario sabe qué hay, pero solo acá se cruzan. El faltante es una
foto, no una reserva: dos borradores pueden reclamar el mismo carrete y los dos se
ven en verde.

Un cálculo dentro de un proyecto **no se lanza solo** — el botón desaparece y
`lanzar_impresion` lo rechaza. Si no, el stock se descontaría dos veces, una por
unidad y otra por lote.

Cabo suelto conocido: `src/lib/report.ts` cuenta cada `print` **una vez**, así que
un proyecto de 20 unidades aparece en los reportes como una sola impresión y con
el precio del cálculo, no con el del proyecto. Falta decidir si los reportes suman
proyectos o impresiones antes de tocar `acumular`.

### El cliente previsualiza, el servidor recalcula

`PrintCalculator` calcula en tiempo real para mostrar el desglose, pero
`savePrint` (`src/app/dashboard/actions.ts`) **vuelve a consultar los precios reales
de los filamentos y de los insumos y recalcula con `calcularCostos` antes de
guardar**. Del formulario solo llega qué se usó y cuánto; nunca confíes en los
montos.

Los costos quedan **congelados** en la fila de `prints` — no se re-derivan al leer.
Cada línea de `insumos_usados` guarda además su `costo_unitario` y su
`aplica_desperdicio` del momento, para que subir el precio de las argollas no
reescriba cálculos viejos. Por eso al editar, `draftFromPrint` reconstruye las
tarifas por hora dividiendo el monto guardado por las horas.

`saveProject` sigue la misma regla, y las dos comparten `resolverInsumos`
(`actions.ts`): convierte "qué insumo y cuánto" en líneas con el costo real de la
base. Cualquier formulario nuevo que acepte insumos tiene que pasar por ahí, no
leer los montos del `FormData`.

### Operaciones atómicas vía RPC

- **`lanzar_impresion`** — descuenta el stock de un cálculo suelto (×1) y lo marca
  `lanzada` en una transacción. Rechaza los cálculos que pertenecen a un proyecto.
- **`lanzar_proyecto`** — descuenta la receta ×`cantidad` (filamentos e insumos del
  cálculo, más los insumos de armado), marca el cálculo `lanzada` y congela los
  costos del proyecto. El congelado ocurre **dentro del RPC** y no en la server
  action porque los montos tienen que salir de las mismas filas recién bloqueadas.
- **`descontar_insumos` / `descontar_stock_print`** — los dos anteriores comparten
  el descuento vía estos helpers; el multiplicador es lo único que cambia. Van sin
  `security definer` a propósito: reciben el `user_id` por parámetro, así que como
  definer una fuga de execute dejaría vaciar el stock ajeno. Llamados desde los RPC
  corren igual con los privilegios del definer.
- **`set_impresora_default`** — un índice único parcial impide dos predeterminadas
  por usuario, así que desmarcar y marcar tienen que ir en la misma transacción.

Los tres primeros son irreversibles: piden confirmación explícita, y lo lanzado ya
no se edita ni se borra. (El `±` del inventario sí lee y escribe en dos pasos: es
un ajuste manual de una sola persona, no necesita ser atómico.)

### RLS

Toda tabla tiene una política `auth.uid() = user_id`, así que un `select` sin filtro
ya devuelve solo lo del usuario. Aun así las escrituras encadenan `.eq("user_id",
user.id)` como defensa en profundidad — mantén ese patrón.

### Enlaces de email

Los `redirectTo` **no llevan query string** a propósito: Supabase compara la URL
completa contra su lista blanca y un `?next=` de más hace que la descarte y caiga al
Site URL. Por eso el destino va fijo por ruta (`/auth/callback`, `/auth/recovery`).
`getSiteUrl()` (`src/lib/site-url.ts`) prioriza `NEXT_PUBLIC_SITE_URL` sobre las
cabeceras, que detrás de un proxy apuntan al host interno. Si un código igual cae en
`/`, `src/app/page.tsx` lo reencamina en vez de perderlo.

## Convenciones

**Todo en español**: UI, comentarios, mensajes de error, commits. Mantenlo.

Los comentarios explican **por qué**, no qué hace el código. Si algo parece raro
(un `nullable` a propósito, un índice parcial, un orden de operaciones), el
comentario justifica la decisión. Sigue ese estilo.

**Server actions** devuelven `ActionState` (`{ error?, message?, ok? }`) y se
consumen con `useActionState`. `SubmitButton` (`src/components/ui.tsx`) ya maneja el
estado pendiente con `useFormStatus` — no reinventes el disabled.

### Diseño — glassmorphism sobre grafito

Los tokens viven en el bloque `@theme` de `src/app/globals.css`, no en un
`tailwind.config`. Usa las clases de componente ya definidas en vez de repetir
utilidades:

- `.glass-panel` — paneles con blur.
- `.glass-row` — variante **sin** `backdrop-filter` para listas largas: un blur por
  fila mata el scroll en mobile.
- `.num` — obligatoria en todo monto o cifra (JetBrains Mono + `tabular-nums`); los
  números nunca van con la fuente de UI.
- `.field-input` / `.field-input-num` / `.btn-primary` / `.btn-ghost` / `.btn-danger` / `.badge`.

Acentos: `accent` (naranja, hotend) y `accent-2` (teal, filamento frío). Sobre vidrio,
el texto no baja de `text-white/70`.

Elementos firma que conviene reutilizar antes de crear otra cosa:

- `CostLayerStack` — el desglose de un cálculo como capas apiladas con blur
  creciente, imitando la impresión capa por capa.
- `ProjectCostStack` — el desglose de un proyecto. Son **dos bloques** (una unidad
  y el lote) y no una sola pila porque el eje acá es la multiplicación por
  cantidad, no el apilado de componentes de costo.
- `FilamentChip` — chip tintado con el `color_hex` real del material.
- La barra de cobertura de `MaterialsList` — teal si el stock alcanza, naranja si
  falta. Es el patrón para cualquier "requerido vs. disponible".

Las impresoras y los proyectos usan el mismo lenguaje visual con su propio
`color_hex`.

Respeta `prefers-reduced-motion` — ya hay un override global en `globals.css`.
