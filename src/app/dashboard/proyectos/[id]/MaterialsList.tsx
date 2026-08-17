import { FilamentChip } from "@/components/FilamentChip";
import { formatCantidad, formatCLP, formatGramos } from "@/lib/format";
import type { MaterialesProyecto, OrigenInsumo } from "@/lib/project";

const ORIGEN_LABEL: Record<OrigenInsumo, string> = {
  impresion: "En la pieza",
  armado: "Armado",
  ambos: "Pieza + armado",
};

/**
 * Lista de materiales del lote completo, con el stock actual al lado.
 *
 * Es la vista que no existe en ninguna otra pantalla: el cálculo sabe lo que
 * lleva una pieza y el inventario sabe lo que hay, pero solo acá se cruzan
 * multiplicados por la cantidad del proyecto.
 */
export function MaterialsList({
  materiales,
  cantidad,
}: {
  materiales: MaterialesProyecto;
  cantidad: number;
}) {
  if (
    materiales.filamentos.length === 0 &&
    materiales.insumos.length === 0
  ) {
    return (
      <p className="text-sm text-muted">
        Sin materiales todavía. Asocia un cálculo o agrega insumos de armado.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Para las {cantidad} unidades. El stock es una foto de ahora: otro
        proyecto en borrador puede estar contando con el mismo material.
      </p>

      {materiales.filamentos.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs tracking-wide text-muted uppercase">
            Filamento
          </h3>
          {materiales.filamentos.map((f) => (
            <div key={f.filament_id} className="glass-row px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <FilamentChip
                  colorHex={f.filamento?.color_hex ?? "#6b7280"}
                  label={
                    f.filamento
                      ? `${f.filamento.marca} ${f.filamento.material}`
                      : "Filamento eliminado"
                  }
                  sublabel={f.filamento?.color_nombre}
                  size="sm"
                />
                <div className="text-right">
                  <p className="num text-sm text-white/90">
                    {formatGramos(f.gramosConDesperdicio)}
                  </p>
                  <p className="num text-[11px] text-muted">
                    {formatGramos(f.gramos)} netos
                  </p>
                </div>
              </div>
              <StockBar
                requerido={f.gramosConDesperdicio}
                stock={f.stock}
                falta={f.falta}
                etiquetaStock={formatGramos(f.stock)}
                etiquetaFalta={formatGramos(f.falta)}
              />
            </div>
          ))}
        </section>
      )}

      {materiales.insumos.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs tracking-wide text-muted uppercase">Insumos</h3>
          {materiales.insumos.map((i) => {
            const unidad = i.item?.unidad ?? "u";
            return (
              <div key={i.item_id} className="glass-row px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-8 w-8 shrink-0 rounded-lg border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]"
                      style={{
                        backgroundColor:
                          i.item?.color_hex ?? "rgba(255,255,255,0.08)",
                      }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white/90">
                        {i.item?.nombre ?? "Insumo eliminado"}
                      </p>
                      <span className="badge mt-1 border-white/15 bg-white/[0.06] text-white/70">
                        {ORIGEN_LABEL[i.origen]}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="num text-sm text-white/90">
                      {formatCantidad(i.cantidad, unidad)}
                    </p>
                    <p className="num text-[11px] text-muted">
                      {formatCLP(i.costoTotal)}
                    </p>
                  </div>
                </div>
                <StockBar
                  requerido={i.cantidad}
                  stock={i.stock}
                  falta={i.falta}
                  etiquetaStock={formatCantidad(i.stock, unidad)}
                  etiquetaFalta={formatCantidad(i.falta, unidad)}
                />
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

/**
 * Barra de cobertura: cuánto del requerido cubre el stock. Teal si alcanza,
 * naranja si no — el mismo par de acentos que el resto de la app.
 */
function StockBar({
  requerido,
  stock,
  falta,
  etiquetaStock,
  etiquetaFalta,
}: {
  requerido: number;
  stock: number;
  falta: number;
  etiquetaStock: string;
  etiquetaFalta: string;
}) {
  const cobertura =
    requerido > 0 ? Math.min(100, (stock / requerido) * 100) : 100;
  const alcanza = falta <= 0;

  return (
    <div className="mt-3">
      <div
        className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
        role="img"
        aria-label={
          alcanza
            ? `Stock suficiente: ${etiquetaStock}`
            : `Faltan ${etiquetaFalta}`
        }
      >
        <div
          className={`h-full rounded-full ${
            alcanza ? "bg-accent-2/70" : "bg-accent/70"
          }`}
          style={{ width: `${cobertura}%` }}
        />
      </div>
      <p className="mt-1.5 flex justify-between text-[11px]">
        <span className="text-muted">
          En stock <span className="num">{etiquetaStock}</span>
        </span>
        {alcanza ? (
          <span className="text-accent-2">Alcanza</span>
        ) : (
          <span className="text-accent">
            Faltan <span className="num">{etiquetaFalta}</span>
          </span>
        )}
      </p>
    </div>
  );
}
