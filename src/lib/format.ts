const clpFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatCLP(value: number | string | null | undefined): string {
  const num = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return clpFormatter.format(Number.isFinite(num) ? num : 0);
}

export function formatNumber(value: number | string | null | undefined): string {
  const num = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return numberFormatter.format(Number.isFinite(num) ? num : 0);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : dateFormatter.format(d);
}

export function formatGramos(value: number | string | null | undefined): string {
  return `${formatNumber(value)} g`;
}

export function formatHoras(value: number | string | null | undefined): string {
  return `${formatNumber(value)} h`;
}

/** Cantidad de un insumo con su unidad: la unidad la define el ítem, no el código. */
export function formatCantidad(
  value: number | string | null | undefined,
  unidad: string,
): string {
  return `${formatNumber(value)} ${unidad}`;
}

/**
 * Fecha de hoy como YYYY-MM-DD en horario de Chile.
 *
 * El servidor corre en UTC, así que `new Date()` a fin de mes puede caer en el
 * mes siguiente y arruinar el rango por defecto de los reportes. "en-CA" produce
 * justo el formato ISO que esperan los <input type="date">.
 */
const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function hoyISO(): string {
  return isoFormatter.format(new Date());
}

export function inicioDeMesISO(): string {
  return `${hoyISO().slice(0, 7)}-01`;
}
