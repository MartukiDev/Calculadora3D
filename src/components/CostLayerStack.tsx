import type { CostBreakdown } from "@/lib/calc";
import { formatCLP } from "@/lib/format";

type Props = {
  breakdown: CostBreakdown;
  desperdicioPct: number;
  margenPct: number;
  ivaPct: number;
  /** Anima la entrada capa por capa (uso en landing / demos); no aplica en el flujo real del formulario. */
  animateIn?: boolean;
};

const LAYER_BLUR = [
  "backdrop-blur-[2px]",
  "backdrop-blur-[5px]",
  "backdrop-blur-[9px]",
  "backdrop-blur-[14px]",
  "backdrop-blur-[20px]",
];

/**
 * Desglose renderizado como capas de vidrio apiladas con offset y blur creciente:
 * la impresión se construye capa por capa, el costo también.
 */
export function CostLayerStack({
  breakdown,
  desperdicioPct,
  margenPct,
  ivaPct,
  animateIn = false,
}: Props) {
  // Los insumos solo aparecen si el cálculo los usa: la mayoría de las
  // impresiones no lleva, y una capa en $0 fija sería ruido.
  const layers = [
    { label: "Filamento", value: breakdown.costoFilamento },
    { label: "Luz", value: breakdown.costoLuz },
    { label: "Mano de obra", value: breakdown.costoManoObra },
    { label: "Depreciación", value: breakdown.costoDepreciacion },
    ...(breakdown.costoInsumos > 0
      ? [{ label: "Insumos", value: breakdown.costoInsumos }]
      : []),
  ];

  return (
    <div className="space-y-1">
      <div className="space-y-[-4px]">
        {layers.map((layer, i) => (
          <div
            key={layer.label}
            className={`relative flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 ${LAYER_BLUR[i]} ${animateIn ? "animate-layer-rise" : ""}`}
            style={{
              marginLeft: `${i * 6}px`,
              zIndex: i + 1,
              animationDelay: animateIn ? `${i * 110}ms` : undefined,
            }}
          >
            <span className="text-sm text-white/75">{layer.label}</span>
            <span className="num text-sm text-white/90">
              {formatCLP(layer.value)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-4 pt-4 pb-1 text-sm">
        <span className="text-muted">Subtotal</span>
        <span className="num text-white/80">{formatCLP(breakdown.subtotal)}</span>
      </div>
      <div className="flex items-center justify-between px-4 pb-3 text-sm">
        <span className="text-muted">Desperdicio ({desperdicioPct}%)</span>
        <span className="num text-white/80">
          + {formatCLP(breakdown.costoTotal - breakdown.subtotal)}
        </span>
      </div>

      {/* Capa superior: más opaca, con el acento primario */}
      <div
        className={`rounded-2xl border border-accent/30 bg-accent-soft p-4 backdrop-blur-xl ${animateIn ? "animate-layer-rise" : ""}`}
        style={{ animationDelay: animateIn ? `${layers.length * 110}ms` : undefined }}
      >
        <Row
          label="Costo total"
          value={formatCLP(breakdown.costoTotal)}
          tone="strong"
        />
        <Row
          label={`Precio neto (margen ${margenPct}%)`}
          value={formatCLP(breakdown.precioNeto)}
        />
        {/* El IVA no se guarda: es exactamente lo que el precio final agrega sobre el neto. */}
        <Row
          label={`IVA (${ivaPct}%)`}
          value={`+ ${formatCLP(breakdown.precioFinalConIva - breakdown.precioNeto)}`}
        />
        <div className="my-3 h-px bg-white/12" />
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-white/85">Precio final</span>
          <span className="num text-2xl font-semibold text-accent">
            {formatCLP(breakdown.precioFinalConIva)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "strong";
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={tone === "strong" ? "text-sm text-white/90" : "text-sm text-white/70"}>
        {label}
      </span>
      <span
        className={`num ${tone === "strong" ? "text-base font-semibold text-white" : "text-sm text-white/85"}`}
      >
        {value}
      </span>
    </div>
  );
}
