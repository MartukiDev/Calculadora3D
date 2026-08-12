import type { Print } from "./types";

export type ReportTotals = {
  impresiones: number;
  gramos: number;
  filamento: number;
  luz: number;
  manoObra: number;
  depreciacion: number;
  subtotal: number;
  desperdicio: number;
  costoTotal: number;
  neto: number;
  iva: number;
  ingresos: number;
  ganancia: number;
};

const n = (v: unknown): number => {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const gramosDe = (print: Print): number =>
  (print.filamentos_usados ?? []).reduce((acc, f) => acc + n(f.gramos), 0);

const vacio = (): ReportTotals => ({
  impresiones: 0,
  gramos: 0,
  filamento: 0,
  luz: 0,
  manoObra: 0,
  depreciacion: 0,
  subtotal: 0,
  desperdicio: 0,
  costoTotal: 0,
  neto: 0,
  iva: 0,
  ingresos: 0,
  ganancia: 0,
});

/**
 * Suma un conjunto de impresiones ya lanzadas.
 *
 * Nada se recalcula: cada `print` guarda sus costos congelados al guardarse, así
 * que un cambio posterior de tarifas no reescribe la historia. El desperdicio y
 * el IVA no se almacenan, se derivan — el desperdicio es lo que el costo total
 * agrega sobre la suma de los cuatro componentes, y el IVA lo que el precio final
 * agrega sobre el neto.
 */
export function acumular(prints: Print[]): ReportTotals {
  return prints.reduce<ReportTotals>((acc, print) => {
    const filamento = n(print.costo_filamento);
    const luz = n(print.costo_luz);
    const manoObra = n(print.costo_mano_obra);
    const depreciacion = n(print.costo_depreciacion);
    const subtotal = filamento + luz + manoObra + depreciacion;
    const costoTotal = n(print.costo_total);
    const neto = n(print.precio_neto);
    const final = n(print.precio_final_con_iva);

    acc.impresiones += 1;
    acc.gramos += gramosDe(print);
    acc.filamento += filamento;
    acc.luz += luz;
    acc.manoObra += manoObra;
    acc.depreciacion += depreciacion;
    acc.subtotal += subtotal;
    acc.desperdicio += costoTotal - subtotal;
    acc.costoTotal += costoTotal;
    acc.neto += neto;
    acc.iva += final - neto;
    acc.ingresos += final;
    acc.ganancia += neto - costoTotal;
    return acc;
  }, vacio());
}

/** Agrupa por impresora, de mayor a menor costo. `null` = impresora eliminada. */
export function acumularPorImpresora(
  prints: Print[],
): { printerId: string | null; totales: ReportTotals }[] {
  const grupos = new Map<string | null, Print[]>();

  for (const print of prints) {
    const key = print.printer_id ?? null;
    const actual = grupos.get(key);
    if (actual) actual.push(print);
    else grupos.set(key, [print]);
  }

  return [...grupos.entries()]
    .map(([printerId, lista]) => ({ printerId, totales: acumular(lista) }))
    .sort((a, b) => b.totales.costoTotal - a.totales.costoTotal);
}
