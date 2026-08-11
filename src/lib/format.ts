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
