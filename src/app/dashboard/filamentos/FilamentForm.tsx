"use client";

import { useActionState, useEffect, useState } from "react";
import { saveFilament, type ActionState } from "@/app/dashboard/actions";
import { Alert, SubmitButton } from "@/components/ui";
import { MATERIALES, type Filament } from "@/lib/types";

export function FilamentForm({
  filament,
  onDone,
}: {
  filament: Filament | null;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveFilament,
    {},
  );
  const [colorHex, setColorHex] = useState(filament?.color_hex ?? "#ff7a3d");
  const [material, setMaterial] = useState(() => {
    const m = filament?.material ?? "PLA";
    return MATERIALES.includes(m as (typeof MATERIALES)[number]) ? m : "Otro";
  });
  const [materialOtro, setMaterialOtro] = useState(
    filament && !MATERIALES.includes(filament.material as (typeof MATERIALES)[number])
      ? filament.material
      : "",
  );

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {filament && <input type="hidden" name="id" value={filament.id} />}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="marca">
            Marca
          </label>
          <input
            id="marca"
            name="marca"
            required
            defaultValue={filament?.marca ?? ""}
            className="field-input"
            placeholder="Bambu Lab, Esun…"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="material">
            Material
          </label>
          <select
            id="material"
            name={material === "Otro" ? "material_select" : "material"}
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            className="field-input"
          >
            {MATERIALES.map((m) => (
              <option key={m} value={m} className="bg-[#1a1e25]">
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {material === "Otro" && (
        <div>
          <label className="field-label" htmlFor="material_otro">
            ¿Qué material?
          </label>
          <input
            id="material_otro"
            name="material"
            required
            value={materialOtro}
            onChange={(e) => setMaterialOtro(e.target.value)}
            className="field-input"
            placeholder="PA-CF, PPS…"
          />
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div>
          <label className="field-label" htmlFor="color_nombre">
            Color
          </label>
          <input
            id="color_nombre"
            name="color_nombre"
            required
            defaultValue={filament?.color_nombre ?? ""}
            className="field-input"
            placeholder="Naranjo translúcido"
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="costo_clp_kg">
            Costo por kilo
          </label>
          <div className="relative">
            <input
              id="costo_clp_kg"
              name="costo_clp_kg"
              type="number"
              step="1"
              min="1"
              required
              defaultValue={filament ? String(filament.costo_clp_kg) : ""}
              className="field-input-num pr-14"
              placeholder="18000"
            />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-white/40">
              CLP
            </span>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="stock_gramos">
            Stock disponible
          </label>
          <div className="relative">
            <input
              id="stock_gramos"
              name="stock_gramos"
              type="number"
              step="1"
              min="0"
              required
              defaultValue={filament ? String(filament.stock_gramos) : ""}
              className="field-input-num pr-10"
              placeholder="1000"
            />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-white/40">
              g
            </span>
          </div>
        </div>
      </div>

      {state.error && <Alert>{state.error}</Alert>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancelar
        </button>
        <SubmitButton>{filament ? "Guardar cambios" : "Crear"}</SubmitButton>
      </div>
    </form>
  );
}
