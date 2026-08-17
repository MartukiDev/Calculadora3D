"use client";

import { useActionState, useEffect, useState } from "react";
import { savePrinter, type ActionState } from "@/app/dashboard/actions";
import { Alert, SubmitButton } from "@/components/ui";
import { formatCLP } from "@/lib/format";
import type { Printer } from "@/lib/types";

export function PrinterForm({
  printer,
  tarifaLuzClpKwh,
  onDone,
}: {
  printer: Printer | null;
  tarifaLuzClpKwh: number;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    savePrinter,
    {},
  );
  const [colorHex, setColorHex] = useState(printer?.color_hex ?? "#C4F53C");
  const [consumoW, setConsumoW] = useState(
    printer ? String(printer.consumo_w) : "",
  );
  const [manoObra, setManoObra] = useState(
    printer ? String(printer.tarifa_mano_obra_clp_hora) : "",
  );
  const [depreciacion, setDepreciacion] = useState(
    printer ? String(printer.costo_depreciacion_clp_hora) : "",
  );

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const toNum = (v: string) => {
    const parsed = parseFloat(v);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Mismo cálculo que usa la calculadora, para dimensionar la máquina al vuelo.
  const costoHora =
    tarifaLuzClpKwh * (toNum(consumoW) / 1000) +
    toNum(manoObra) +
    toNum(depreciacion);

  return (
    <form action={formAction} className="space-y-4">
      {printer && <input type="hidden" name="id" value={printer.id} />}

      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div>
          <label className="field-label" htmlFor="nombre">
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            defaultValue={printer?.nombre ?? ""}
            className="field-input"
            placeholder="La del taller"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="color_hex">
            Tono
          </label>
          <input
            id="color_hex"
            name="color_hex"
            type="color"
            value={colorHex}
            onChange={(e) => setColorHex(e.target.value)}
            className="h-[46px] w-16 cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] p-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="marca">
            Marca
          </label>
          <input
            id="marca"
            name="marca"
            defaultValue={printer?.marca ?? ""}
            className="field-input"
            placeholder="Bambu Lab"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="modelo">
            Modelo
          </label>
          <input
            id="modelo"
            name="modelo"
            defaultValue={printer?.modelo ?? ""}
            className="field-input"
            placeholder="P1S"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="consumo_w">
            Consumo
          </label>
          <div className="relative">
            <input
              id="consumo_w"
              name="consumo_w"
              type="number"
              step="1"
              min="0"
              required
              value={consumoW}
              onChange={(e) => setConsumoW(e.target.value)}
              className="field-input-num pr-10"
              placeholder="250"
            />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-white/40">
              W
            </span>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="desperdicio_pct_default">
            Desperdicio
          </label>
          <div className="relative">
            <input
              id="desperdicio_pct_default"
              name="desperdicio_pct_default"
              type="number"
              step="0.1"
              min="0"
              max="100"
              required
              defaultValue={printer ? String(printer.desperdicio_pct_default) : "0"}
              className="field-input-num pr-10"
            />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-white/40">
              %
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="tarifa_mano_obra_clp_hora">
            Mano de obra
          </label>
          <div className="relative">
            <input
              id="tarifa_mano_obra_clp_hora"
              name="tarifa_mano_obra_clp_hora"
              type="number"
              step="1"
              min="0"
              required
              value={manoObra}
              onChange={(e) => setManoObra(e.target.value)}
              className="field-input-num pr-20"
              placeholder="1500"
            />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-white/40">
              CLP/hora
            </span>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="costo_depreciacion_clp_hora">
            Depreciación
          </label>
          <div className="relative">
            <input
              id="costo_depreciacion_clp_hora"
              name="costo_depreciacion_clp_hora"
              type="number"
              step="1"
              min="0"
              required
              value={depreciacion}
              onChange={(e) => setDepreciacion(e.target.value)}
              className="field-input-num pr-20"
              placeholder="300"
            />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-white/40">
              CLP/hora
            </span>
          </div>
        </div>
      </div>

      <div className="glass-row flex items-center justify-between gap-4 px-4 py-3">
        <div>
          <p className="text-sm text-white/85">Costo fijo por hora</p>
          <p className="mt-0.5 text-xs text-muted">
            Luz + mano de obra + depreciación, sin filamento.
          </p>
        </div>
        <span className="num text-base font-semibold text-accent-2">
          {formatCLP(costoHora)}
        </span>
      </div>

      {state.error && <Alert>{state.error}</Alert>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancelar
        </button>
        <SubmitButton>{printer ? "Guardar cambios" : "Crear"}</SubmitButton>
      </div>
    </form>
  );
}
