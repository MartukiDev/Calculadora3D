"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Printer, PrintStatus } from "@/lib/types";

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
  printer,
  impresoras,
}: {
  status: PrintStatus | "todos";
  q: string;
  desde: string;
  hasta: string;
  printer: string;
  impresoras: Printer[];
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState(q);

  const push = (patch: Record<string, string>) => {
    const params = new URLSearchParams();
    const next = { status, q: busqueda, desde, hasta, printer, ...patch };
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

  const hayFiltros = status !== "todos" || q || desde || hasta || printer;

  return (
    <div className="glass-panel space-y-3 !p-4 sm:flex sm:flex-wrap sm:items-end sm:gap-3 sm:space-y-0">
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

      <div className="sm:min-w-[12rem] sm:flex-1">
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

      {/* sm:contents disuelve la grilla en desktop y devuelve los campos al flex. */}
      <div className="grid grid-cols-2 gap-3 sm:contents">
        {impresoras.length > 1 && (
          <div className="col-span-2 sm:min-w-[10rem]">
            <label className="field-label" htmlFor="printer">
              Impresora
            </label>
            <select
              id="printer"
              value={printer}
              onChange={(e) => push({ printer: e.target.value })}
              className="field-input !py-2"
            >
              <option value="" className="bg-[#1a1e25]">
                Todas
              </option>
              {impresoras.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#1a1e25]">
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

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
      </div>

      {hayFiltros && (
        <button
          type="button"
          onClick={() => {
            setBusqueda("");
            router.push("/dashboard/calculos");
          }}
          className="btn-ghost w-full !py-2 text-xs sm:w-auto"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
