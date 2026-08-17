import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GlassPanel } from "@/components/GlassPanel";
import { FilamentChip } from "@/components/FilamentChip";
import {
  StatusBadge,
  EmptyState,
  Alert,
  UsoPersonalBadge,
} from "@/components/ui";
import { formatCantidad, formatCLP, formatDate } from "@/lib/format";
import {
  STOCK_BAJO_GRAMOS,
  stockBajoInsumo,
  type Filament,
  type InventoryItem,
  type Print,
  type Printer,
} from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [settingsRes, filamentsRes, printsRes, printersRes, itemsRes] =
    await Promise.all([
      supabase.from("user_settings").select("*").maybeSingle(),
      supabase.from("filaments").select("*").eq("activo", true),
      supabase
        .from("prints")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("printers").select("*").eq("activo", true),
      supabase.from("inventory_items").select("*").eq("activo", true),
    ]);

  const settings = settingsRes.data;
  const filaments = (filamentsRes.data ?? []) as Filament[];
  const prints = (printsRes.data ?? []) as Print[];
  const printers = (printersRes.data ?? []) as Printer[];
  const items = (itemsRes.data ?? []) as InventoryItem[];
  const printersPorId = new Map(printers.map((p) => [p.id, p]));

  const stockBajo = filaments.filter(
    (f) => Number(f.stock_gramos) < STOCK_BAJO_GRAMOS,
  );
  const insumosBajos = items.filter(stockBajoInsumo);
  const lanzadas = prints.filter((p) => p.status === "lanzada");

  // El inventario es uno solo aunque viva en dos tablas: filamento por gramo,
  // insumos por unidad.
  const valorInventario =
    filaments.reduce(
      (acc, f) => acc + (Number(f.stock_gramos) / 1000) * Number(f.costo_clp_kg),
      0,
    ) +
    items.reduce(
      (acc, i) => acc + Number(i.stock) * Number(i.costo_clp_unidad),
      0,
    );

  const sinImpresoras = printers.length === 0;
  const sinConfigurar =
    !sinImpresoras &&
    (!settings || Number(settings.tarifa_luz_clp_kwh) === 0) &&
    printers.every((p) => Number(p.consumo_w) === 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white/95">Panel</h1>
          <p className="mt-1 text-sm text-muted">
            Costos, inventario y últimas impresiones.
          </p>
        </div>
        <Link href="/dashboard/calculos/nuevo" className="btn-primary">
          Nuevo cálculo
        </Link>
      </div>

      {sinImpresoras && (
        <Alert tone="warn">
          No tienes ninguna impresora activa — sin una no se puede costear nada.{" "}
          <Link href="/dashboard/impresoras" className="underline">
            Agregar impresora
          </Link>
        </Alert>
      )}

      {sinConfigurar && (
        <Alert tone="warn">
          Aún no configuraste la tarifa de luz ni el consumo de tus impresoras —
          los costos saldrán incompletos.{" "}
          <Link href="/dashboard/configuracion" className="underline">
            Ir a configuración
          </Link>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Impresoras activas" value={String(printers.length)} />
        <Stat label="Filamentos activos" value={String(filaments.length)} />
        <Stat label="Valor inventario" value={formatCLP(valorInventario)} />
        <Stat
          label="Stock bajo"
          value={String(stockBajo.length + insumosBajos.length)}
          tone={stockBajo.length + insumosBajos.length > 0 ? "warn" : "normal"}
        />
      </div>

      {/* min-w-0 en el hijo: una columna de grid es min-content por defecto y
          se ensancha más allá del contenedor si el contenido no puede encoger. */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <GlassPanel
          className="min-w-0"
          title="Últimos cálculos"
          actions={
            <Link
              href="/dashboard/calculos"
              className="text-sm text-muted hover:text-white/85"
            >
              Ver todo
            </Link>
          }
        >
          {prints.length === 0 ? (
            <EmptyState
              title="Todavía no hay cálculos"
              description="Crea tu primer cálculo para ver el desglose de costos y el precio sugerido."
              action={
                <Link href="/dashboard/calculos/nuevo" className="btn-ghost mt-2">
                  Calcular impresión
                </Link>
              }
            />
          ) : (
            <ul className="space-y-2">
              {prints.map((print) => (
                <li key={print.id}>
                  <Link
                    href={`/dashboard/calculos/${print.id}`}
                    className="glass-row flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-white/[0.08]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white/90">
                        {print.nombre_proyecto}
                      </p>
                      {/* min-w-0: es flex, y sin esto el span interno impone su
                          ancho de min-content y ensancha todo el panel. */}
                      <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
                        {print.printer_id && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full border border-white/25"
                            style={{
                              backgroundColor:
                                printersPorId.get(print.printer_id)
                                  ?.color_hex ?? "rgba(255,255,255,0.15)",
                            }}
                            aria-hidden
                          />
                        )}
                        <span className="truncate">
                          {printersPorId.get(print.printer_id ?? "")?.nombre ??
                            "Sin impresora"}{" "}
                          · {formatDate(print.created_at)}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                      {/* Sin el badge, el monto de un cálculo personal se lee
                          como precio de venta cuando es su costo. */}
                      <span className="num text-sm text-white/90">
                        {formatCLP(print.precio_final_con_iva)}
                      </span>
                      {print.uso_personal && <UsoPersonalBadge />}
                      <StatusBadge status={print.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {lanzadas.length > 0 && (
            <p className="mt-4 text-xs text-muted">
              {lanzadas.length} de los últimos {prints.length} ya fueron lanzados.
            </p>
          )}
        </GlassPanel>

        <GlassPanel
          title="Stock bajo"
          description={`Filamento bajo ${STOCK_BAJO_GRAMOS} g e insumos en su mínimo`}
        >
          {stockBajo.length === 0 && insumosBajos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Todo tu inventario está sobre el umbral.
            </p>
          ) : (
            <div className="space-y-4">
              {stockBajo.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {stockBajo.map((f) => (
                    <li key={f.id}>
                      <FilamentChip
                        colorHex={f.color_hex}
                        label={`${f.marca} ${f.material}`}
                        sublabel={f.color_nombre}
                        gramos={Number(f.stock_gramos)}
                        size="sm"
                      />
                    </li>
                  ))}
                </ul>
              )}

              {insumosBajos.length > 0 && (
                <ul className="space-y-2">
                  {insumosBajos.map((i) => (
                    <li
                      key={i.id}
                      className="glass-row flex items-center gap-3 px-3.5 py-2.5"
                    >
                      <span
                        className="h-6 w-6 shrink-0 rounded-lg border border-white/20 shadow-[inset_0_1px_2px_rgba(255,255,255,0.3)]"
                        style={{ backgroundColor: i.color_hex }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-white/85">
                        {i.nombre}
                      </span>
                      <span className="num text-sm text-accent">
                        {formatCantidad(i.stock, i.unidad)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <Link href="/dashboard/filamentos" className="btn-ghost flex-1 text-sm">
              Filamentos
            </Link>
            <Link href="/dashboard/inventario" className="btn-ghost flex-1 text-sm">
              Inventario
            </Link>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "warn";
}) {
  return (
    <div className="glass-panel px-4 py-3.5 sm:px-5 sm:py-4">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p
        className={`num mt-1.5 text-xl font-semibold ${
          tone === "warn" ? "text-accent" : "text-white/95"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
