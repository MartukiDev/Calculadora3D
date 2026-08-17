import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GlassPanel } from "@/components/GlassPanel";
import { Alert, EmptyState } from "@/components/ui";
import {
  formatCLP,
  formatDate,
  formatGramos,
  hoyISO,
  inicioDeMesISO,
} from "@/lib/format";
import {
  acumular,
  acumularPorImpresora,
  gramosDe,
  separarUsoPersonal,
} from "@/lib/report";
import type { Print, Printer } from "@/lib/types";
import { ReportFilters } from "./ReportFilters";

const LAYER_BLUR = [
  "backdrop-blur-[2px]",
  "backdrop-blur-[5px]",
  "backdrop-blur-[9px]",
  "backdrop-blur-[14px]",
  "backdrop-blur-[20px]",
];

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const params = await searchParams;

  // Un parámetro ausente cae al mes actual; uno vacío significa "sin límite".
  const desde = params.desde ?? inicioDeMesISO();
  const hasta = params.hasta ?? hoyISO();

  const supabase = await createClient();

  let query = supabase
    .from("prints")
    .select("*")
    .eq("status", "lanzada")
    .order("fecha_lanzamiento", { ascending: false });

  if (desde) query = query.gte("fecha_lanzamiento", `${desde}T00:00:00`);
  if (hasta) query = query.lte("fecha_lanzamiento", `${hasta}T23:59:59`);

  const [printsRes, printersRes] = await Promise.all([
    query,
    supabase.from("printers").select("*"),
  ]);

  const prints = (printsRes.data ?? []) as Print[];
  const printers = (printersRes.data ?? []) as Printer[];
  const printersPorId = new Map(printers.map((p) => [p.id, p]));

  // Los dos mundos se reportan por separado: lo vendido tiene ingresos, IVA y
  // ganancia; lo propio solo tiene costo.
  const { venta, personal } = separarUsoPersonal(prints);

  const t = acumular(venta);
  const tPersonal = acumular(personal);
  const porImpresora = acumularPorImpresora(venta);

  const capas = [
    { label: "Filamento", value: t.filamento, extra: formatGramos(t.gramos) },
    { label: "Electricidad", value: t.luz },
    { label: "Mano de obra", value: t.manoObra },
    { label: "Depreciación", value: t.depreciacion },
    // Solo si el período llevó insumos: una capa en $0 no dice nada.
    ...(t.insumos > 0 ? [{ label: "Insumos", value: t.insumos }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white/95">Reportes</h1>
        <p className="mt-1 text-sm text-muted">
          Solo impresiones lanzadas, contadas por su fecha de lanzamiento — el
          día en que realmente se consumió el material. Lo que imprimiste para
          ti va aparte: cuesta, pero no vende.
        </p>
      </div>

      <ReportFilters desde={desde} hasta={hasta} />

      {printsRes.error && (
        <Alert>No pudimos cargar el reporte: {printsRes.error.message}</Alert>
      )}

      {prints.length === 0 && (
        <GlassPanel>
          <EmptyState
            title="Sin impresiones lanzadas en el período"
            description="Los cálculos en borrador no cuentan: solo suman las impresiones que lanzaste, porque son las que consumieron filamento."
            action={
              <Link href="/dashboard/calculos" className="btn-ghost mt-2">
                Ver historial
              </Link>
            }
          />
        </GlassPanel>
      )}

      {/* Un período puede tener solo impresiones para uno mismo: ahí no hay
          ventas que resumir, pero sí material consumido que mostrar abajo. */}
      {venta.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Impresiones" value={String(t.impresiones)} />
            <Stat label="Ingresos" value={formatCLP(t.ingresos)} />
            <Stat label="Costo total" value={formatCLP(t.costoTotal)} />
            <Stat
              label="Ganancia"
              value={formatCLP(t.ganancia)}
              tone={t.ganancia >= 0 ? "accent" : "warn"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <GlassPanel
              title="En qué se fue el dinero"
              description="Costos reales del período, sin margen ni IVA."
            >
              <div className="space-y-1">
                <div className="space-y-[-4px]">
                  {capas.map((capa, i) => (
                    <div
                      key={capa.label}
                      className={`relative flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 ${LAYER_BLUR[i]}`}
                      style={{ marginLeft: `${i * 6}px`, zIndex: i + 1 }}
                    >
                      <span className="text-sm text-white/75">
                        {capa.label}
                        {capa.extra && (
                          <span className="num ml-2 text-xs text-white/40">
                            {capa.extra}
                          </span>
                        )}
                      </span>
                      <span className="num text-sm text-white/90">
                        {formatCLP(capa.value)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between px-4 pt-4 pb-1 text-sm">
                  <span className="text-muted">Subtotal</span>
                  <span className="num text-white/80">
                    {formatCLP(t.subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 pb-3 text-sm">
                  <span className="text-muted">Desperdicio</span>
                  <span className="num text-white/80">
                    + {formatCLP(t.desperdicio)}
                  </span>
                </div>

                <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4 backdrop-blur-xl">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-white/90">Costo total</span>
                    <span className="num text-base font-semibold text-white">
                      {formatCLP(t.costoTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-white/70">Ganancia</span>
                    <span className="num text-sm text-white/85">
                      {formatCLP(t.ganancia)}
                    </span>
                  </div>
                  <div className="my-3 h-px bg-white/12" />
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-white/85">
                      Ingresos
                    </span>
                    <span className="num text-2xl font-semibold text-accent">
                      {formatCLP(t.ingresos)}
                    </span>
                  </div>
                </div>
              </div>
            </GlassPanel>

            <div className="space-y-6">
              <GlassPanel
                title="IVA del período"
                description="Recaudado sobre el precio neto de lo lanzado."
              >
                <p className="num text-3xl font-semibold text-accent-2">
                  {formatCLP(t.iva)}
                </p>
                <div className="mt-4 space-y-2 border-t border-white/[0.08] pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Neto facturado</span>
                    <span className="num text-white/85">
                      {formatCLP(t.neto)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Total con IVA</span>
                    <span className="num text-white/85">
                      {formatCLP(t.ingresos)}
                    </span>
                  </div>
                </div>
              </GlassPanel>

              <GlassPanel title="Por impresora">
                <ul className="space-y-2">
                  {porImpresora.map(({ printerId, totales }) => {
                    const printer = printerId
                      ? printersPorId.get(printerId)
                      : undefined;
                    return (
                      <li
                        key={printerId ?? "sin-impresora"}
                        className="glass-row flex items-center gap-3 px-4 py-3"
                      >
                        <span
                          className="h-8 w-8 shrink-0 rounded-lg border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]"
                          style={{
                            backgroundColor:
                              printer?.color_hex ?? "rgba(255,255,255,0.08)",
                          }}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white/90">
                            {printer?.nombre ?? "Sin impresora"}
                          </p>
                          <p className="num mt-0.5 text-xs text-muted">
                            {totales.impresiones} impresión(es) ·{" "}
                            {formatGramos(totales.gramos)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted">Costo</p>
                          <p className="num text-sm text-white/90">
                            {formatCLP(totales.costoTotal)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </GlassPanel>
            </div>
          </div>

          <GlassPanel title={`Impresiones lanzadas (${venta.length})`}>
            <ul className="space-y-2">
              {venta.map((print) => {
                const printer = print.printer_id
                  ? printersPorId.get(print.printer_id)
                  : undefined;
                const iva =
                  Number(print.precio_final_con_iva) - Number(print.precio_neto);

                return (
                  <li key={print.id}>
                    <Link
                      href={`/dashboard/calculos/${print.id}`}
                      className="glass-row flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition hover:bg-white/[0.08]"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/25"
                        style={{
                          backgroundColor:
                            printer?.color_hex ?? "rgba(255,255,255,0.15)",
                        }}
                        aria-hidden
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white/90">
                          {print.nombre_proyecto}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {formatDate(print.fecha_lanzamiento)} ·{" "}
                          {printer?.nombre ?? "Sin impresora"} ·{" "}
                          {formatGramos(gramosDe(print))}
                        </p>
                      </div>

                      <div className="grid w-full grid-cols-3 gap-2 border-t border-white/[0.06] pt-3 sm:flex sm:w-auto sm:gap-4 sm:border-0 sm:pt-0">
                        <div className="text-left sm:text-right">
                          <p className="text-xs text-muted">Costo</p>
                          <p className="num text-sm text-white/80">
                            {formatCLP(print.costo_total)}
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <p className="text-xs text-muted">
                            IVA ({Number(print.iva_pct)}%)
                          </p>
                          <p className="num text-sm text-white/80">
                            {formatCLP(iva)}
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <p className="text-xs text-muted">Total</p>
                          <p className="num text-sm font-semibold text-white/95">
                            {formatCLP(print.precio_final_con_iva)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </GlassPanel>
        </>
      )}

      {personal.length > 0 && (
        <GlassPanel
          title={`Uso propio (${personal.length})`}
          description="Lo que imprimiste para ti. No genera ingreso ni IVA: solo consume material y horas de máquina."
        >
          <div className="grid grid-cols-3 gap-3">
            <MiniStat
              label="Impresiones"
              value={String(tPersonal.impresiones)}
            />
            <MiniStat label="Material" value={formatGramos(tPersonal.gramos)} />
            <MiniStat
              label="Costo"
              value={formatCLP(tPersonal.costoTotal)}
              tone="accent"
            />
          </div>

          <ul className="mt-4 space-y-2">
            {personal.map((print) => {
              const printer = print.printer_id
                ? printersPorId.get(print.printer_id)
                : undefined;

              return (
                <li key={print.id}>
                  <Link
                    href={`/dashboard/calculos/${print.id}`}
                    className="glass-row flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition hover:bg-white/[0.08]"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/25"
                      style={{
                        backgroundColor:
                          printer?.color_hex ?? "rgba(255,255,255,0.15)",
                      }}
                      aria-hidden
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white/90">
                        {print.nombre_proyecto}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {formatDate(print.fecha_lanzamiento)} ·{" "}
                        {printer?.nombre ?? "Sin impresora"} ·{" "}
                        {formatGramos(gramosDe(print))}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-muted">Costo</p>
                      <p className="num text-sm font-semibold text-white/95">
                        {formatCLP(print.costo_total)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </GlassPanel>
      )}
    </div>
  );
}

/** Versión compacta del Stat, para vivir dentro de un panel y no en la grilla. */
function MiniStat({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "accent";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p
        className={`num mt-1 text-base font-semibold ${
          tone === "accent" ? "text-accent" : "text-white/95"
        }`}
      >
        {value}
      </p>
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
  tone?: "normal" | "accent" | "warn";
}) {
  const color =
    tone === "accent"
      ? "text-accent-2"
      : tone === "warn"
        ? "text-accent"
        : "text-white/95";

  return (
    <div className="glass-panel px-4 py-3.5 sm:px-5 sm:py-4">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className={`num mt-1.5 text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
