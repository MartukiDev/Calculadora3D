import type { Filament, FilamentoUsado, InsumoUsado } from "./types";

export type CostInputs = {
  tiempoImpresionHoras: number;
  filamentosUsados: FilamentoUsado[];
  /** Catálogo para resolver costo_clp_kg de cada filamento usado */
  filamentos: Pick<Filament, "id" | "costo_clp_kg">[];
  /** Cada línea ya trae su costo unitario congelado, no hay catálogo que mirar. */
  insumosUsados?: InsumoUsado[];
  tarifaLuzClpKwh: number;
  consumoImpresoraW: number;
  tarifaManoObraClpHora: number;
  costoDepreciacionClpHora: number;
  desperdicioPct: number;
  ivaPct: number;
  margenPct: number;
};

export type CostBreakdown = {
  costoFilamento: number;
  costoLuz: number;
  costoManoObra: number;
  costoDepreciacion: number;
  costoInsumos: number;
  /** Suma de las cinco capas. `costoTotal - subtotal` sigue siendo el desperdicio. */
  subtotal: number;
  costoTotal: number;
  precioNeto: number;
  precioFinalConIva: number;
};

const n = (v: number | string | null | undefined): number => {
  const parsed = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function calcularCostos(input: CostInputs): CostBreakdown {
  const horas = n(input.tiempoImpresionHoras);

  const precioPorId = new Map(
    input.filamentos.map((f) => [f.id, n(f.costo_clp_kg)]),
  );

  const costoFilamento = input.filamentosUsados.reduce((acc, item) => {
    const costoKg = precioPorId.get(item.filament_id) ?? 0;
    return acc + (n(item.gramos) / 1000) * costoKg;
  }, 0);

  const costoLuz =
    n(input.tarifaLuzClpKwh) * (n(input.consumoImpresoraW) / 1000) * horas;
  const costoManoObra = n(input.tarifaManoObraClpHora) * horas;
  const costoDepreciacion = n(input.costoDepreciacionClpHora) * horas;

  // Cada insumo declara si el desperdicio lo afecta: un NFC embebido se pierde
  // con la pieza fallada, una bolsa de embalaje se vuelve a usar.
  const insumos = input.insumosUsados ?? [];
  const totalInsumos = (soloConDesperdicio: boolean) =>
    insumos
      .filter((i) => Boolean(i.aplica_desperdicio) === soloConDesperdicio)
      .reduce((acc, i) => acc + n(i.cantidad) * n(i.costo_unitario), 0);

  const insumosConDesperdicio = totalInsumos(true);
  const insumosSinDesperdicio = totalInsumos(false);
  const costoInsumos = insumosConDesperdicio + insumosSinDesperdicio;

  const base = costoFilamento + costoLuz + costoManoObra + costoDepreciacion;

  // El subtotal incluye todos los insumos aunque a algunos no se les aplique el
  // desperdicio: así `costoTotal - subtotal` sigue siendo exactamente el recargo
  // por desperdicio, que es lo que muestran el desglose y los reportes.
  const subtotal = base + costoInsumos;
  const costoTotal =
    (base + insumosConDesperdicio) * (1 + n(input.desperdicioPct) / 100) +
    insumosSinDesperdicio;
  const precioNeto = costoTotal * (1 + n(input.margenPct) / 100);
  const precioFinalConIva = precioNeto * (1 + n(input.ivaPct) / 100);

  return {
    costoFilamento,
    costoLuz,
    costoManoObra,
    costoDepreciacion,
    costoInsumos,
    subtotal,
    costoTotal,
    precioNeto,
    precioFinalConIva,
  };
}
