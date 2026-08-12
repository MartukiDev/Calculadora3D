"use client";

import { useRouter } from "next/navigation";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

/** Presets calculados con la fecha local del navegador, que es la del usuario. */
function presets() {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = hoy.getMonth();

  return [
    {
      label: "Mes actual",
      desde: iso(new Date(año, mes, 1)),
      hasta: iso(hoy),
    },
    {
      label: "Mes anterior",
      desde: iso(new Date(año, mes - 1, 1)),
      // Día 0 del mes actual = último día del anterior.
      hasta: iso(new Date(año, mes, 0)),
    },
    {
      label: "Este año",
      desde: iso(new Date(año, 0, 1)),
      hasta: iso(hoy),
    },
    { label: "Todo", desde: "", hasta: "" },
  ];
}

export function ReportFilters({
  desde,
  hasta,
}: {
  desde: string;
  hasta: string;
}) {
  const router = useRouter();

  const push = (next: { desde: string; hasta: string }) => {
    // Los vacíos viajan explícitos: "sin parámetro" significa "mes actual".
    const params = new URLSearchParams({
      desde: next.desde,
      hasta: next.hasta,
    });
    router.push(`/dashboard/reportes?${params}`);
  };

  const opciones = presets();
  const activo = opciones.find((p) => p.desde === desde && p.hasta === hasta);

  return (
    <div className="glass-panel space-y-3 !p-4 sm:flex sm:flex-wrap sm:items-end sm:gap-3 sm:space-y-0">
      <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
        {opciones.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => push(p)}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              activo?.label === p.label
                ? "bg-white/10 text-white"
                : "text-muted hover:bg-white/[0.06] hover:text-white/85"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:ml-auto sm:flex sm:items-end">
        <div>
          <label className="field-label" htmlFor="desde">
            Desde
          </label>
          <input
            id="desde"
            type="date"
            value={desde}
            onChange={(e) => push({ desde: e.target.value, hasta })}
            className="field-input !py-2"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="hasta">
            Hasta
          </label>
          <input
            id="hasta"
            type="date"
            value={hasta}
            onChange={(e) => push({ desde, hasta: e.target.value })}
            className="field-input !py-2"
          />
        </div>
      </div>
    </div>
  );
}
