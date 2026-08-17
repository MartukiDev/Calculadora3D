import { formatCLP } from "@/lib/format";
import type { ProjectBreakdown } from "@/lib/project";

/**
 * Desglose de un proyecto en dos bloques: la receta de una unidad y el lote.
 *
 * Comparte el lenguaje de capas de `CostLayerStack`, pero el eje acá es la
 * multiplicación por cantidad y no el apilado de componentes de costo — por eso
 * son dos bloques y no una sola pila.
 */
export function ProjectCostStack({
  breakdown,
  margenPct,
  ivaPct,
}: {
  breakdown: ProjectBreakdown;
  margenPct: number;
  ivaPct: number;
}) {
  return (
    <div className="space-y-1">
      <p className="mb-2 text-xs tracking-wide text-muted uppercase">
        Una unidad
      </p>
      <div className="space-y-[-4px]">
        <Layer
          label="Pieza impresa"
          value={breakdown.costoPiezaUnitario}
          index={0}
        />
        <Layer
          label="Insumos de armado"
          value={breakdown.costoInsumosUnitario}
          index={1}
        />
      </div>

      <div className="flex items-center justify-between px-4 pt-4 pb-1 text-sm">
        <span className="text-muted">Costo unitario</span>
        <span className="num font-medium text-white/90">
          {formatCLP(breakdown.costoUnitario)}
        </span>
      </div>
      <div className="flex items-center justify-between px-4 pb-1 text-sm">
        <span className="text-muted">Precio neto c/u (margen {margenPct}%)</span>
        <span className="num text-white/80">
          {formatCLP(breakdown.precioNetoUnitario)}
        </span>
      </div>
      <div className="flex items-center justify-between px-4 pb-3 text-sm">
        <span className="text-muted">Precio c/u con IVA ({ivaPct}%)</span>
        <span className="num text-white/80">
          {formatCLP(breakdown.precioFinalUnitario)}
        </span>
      </div>

      {/* Capa superior: más opaca, con el acento primario */}
      <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4 backdrop-blur-xl">
        <p className="mb-2 text-xs tracking-wide text-white/60 uppercase">
          Lote de {breakdown.cantidad}
        </p>
        <Row label="Costo del lote" value={formatCLP(breakdown.costoTotal)} />
        <Row label="Precio neto" value={formatCLP(breakdown.precioNeto)} />
        <Row label="Ganancia" value={formatCLP(breakdown.ganancia)} />
        <div className="my-3 h-px bg-white/12" />
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-white/85">
            Total con IVA
          </span>
          <span className="num text-2xl font-semibold text-accent">
            {formatCLP(breakdown.precioFinalConIva)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Layer({
  label,
  value,
  index,
}: {
  label: string;
  value: number;
  index: number;
}) {
  return (
    <div
      className={`relative flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 ${
        index === 0 ? "backdrop-blur-[3px]" : "backdrop-blur-[9px]"
      }`}
      style={{ marginLeft: `${index * 6}px`, zIndex: index + 1 }}
    >
      <span className="text-sm text-white/75">{label}</span>
      <span className="num text-sm text-white/90">{formatCLP(value)}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-white/70">{label}</span>
      <span className="num text-sm text-white/85">{value}</span>
    </div>
  );
}
