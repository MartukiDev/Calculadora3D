import type { Filament, FilamentoUsado } from "./types";

export type CostInputs = {
  tiempoImpresionHoras: number;
  filamentosUsados: FilamentoUsado[];
  /** Catálogo para resolver costo_clp_kg de cada filamento usado */
  filamentos: Pick<Filament, "id" | "costo_clp_kg">[];
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

  const subtotal =
    costoFilamento + costoLuz + costoManoObra + costoDepreciacion;
  const costoTotal = subtotal * (1 + n(input.desperdicioPct) / 100);
  const precioNeto = costoTotal * (1 + n(input.margenPct) / 100);
  const precioFinalConIva = precioNeto * (1 + n(input.ivaPct) / 100);

  return {
    costoFilamento,
    costoLuz,
    costoManoObra,
    costoDepreciacion,
    subtotal,
    costoTotal,
    precioNeto,
    precioFinalConIva,
  };
}
