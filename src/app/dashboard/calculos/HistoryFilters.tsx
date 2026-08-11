"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PrintStatus } from "@/lib/types";

const STATUSES: { value: PrintStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "borrador", label: "Borradores" },
  { value: "lanzada", label: "Lanzadas" },
];

export function HistoryFilters({
  status,
  q,
  desde,
  hasta,
}: {
  status: PrintStatus | "todos";
  q: string;
  desde: string;
  hasta: string;
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState(q);

  const push = (patch: Record<string, string>) => {
    const params = new URLSearchParams();
    const next = { status, q: busqueda, desde, hasta, ...patch };
    Object.entries(next).forEach(([key, value]) => {
      if (value && value !== "todos") params.set(key, value);
    });
    const qs = params.toString();
    router.push(qs ? `/dashboard/calculos?${qs}` : "/dashboard/calculos");
  };

  // Búsqueda con debounce para no disparar una consulta por tecla.
  useEffect(() => {
    if (busqueda === q) return;
    const t = setTimeout(() => push({ q: busqueda }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  const hayFiltros = status !== "todos" || q || desde || hasta;

  return (
    <div className="glass-panel flex flex-wrap items-end gap-3 !p-4">
      <div className="flex gap-1">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => push({ status: s.value })}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              status === s.value
                ? "bg-white/10 text-white"
                : "text-muted hover:bg-white/[0.06] hover:text-white/85"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="min-w-[12rem] flex-1">
        <label className="field-label" htmlFor="q">
          Buscar
        </label>
        <input
          id="q"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="field-input !py-2"
          placeholder="Nombre del proyecto"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="desde">
          Desde
        </label>
        <input
          id="desde"
          type="date"
          value={desde}
          onChange={(e) => push({ desde: e.target.value })}
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
          onChange={(e) => push({ hasta: e.target.value })}
          className="field-input !py-2"
        />
      </div>

      {hayFiltros && (
        <button
          type="button"
          onClick={() => {
            setBusqueda("");
            router.push("/dashboard/calculos");
          }}
          className="btn-ghost !py-2 text-xs"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
