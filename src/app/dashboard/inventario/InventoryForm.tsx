"use client";

import { useActionState, useEffect, useState } from "react";
import { saveInventoryItem, type ActionState } from "@/app/dashboard/actions";
import { Alert, SubmitButton } from "@/components/ui";
import { UNIDADES, type InventoryItem } from "@/lib/types";

export function InventoryForm({
  item,
  categorias,
  onDone,
}: {
  item: InventoryItem | null;
  /** Categorías ya usadas: el campo es libre, pero sugerirlas evita duplicados por typo. */
  categorias: string[];
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveInventoryItem,
    {},
  );
  const [colorHex, setColorHex] = useState(item?.color_hex ?? "#3ddad7");
  const [unidad, setUnidad] = useState(item?.unidad ?? "u");
  const [usaEnCalculo, setUsaEnCalculo] = useState(item?.usa_en_calculo ?? true);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {item && <input type="hidden" name="id" value={item.id} />}

      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div>
          <label className="field-label" htmlFor="nombre">
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            defaultValue={item?.nombre ?? ""}
            className="field-input"
            placeholder="Tag NFC 13.56 MHz"
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
          <label className="field-label" htmlFor="categoria">
            Categoría
          </label>
          <input
            id="categoria"
            name="categoria"
            list="categorias-insumo"
            defaultValue={item?.categoria ?? ""}
            className="field-input"
            placeholder="NFC, boquillas, argollas…"
          />
          <datalist id="categorias-insumo">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="field-label" htmlFor="unidad">
            Unidad
          </label>
          <select
            id="unidad"
            name="unidad"
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
            className="field-input"
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u} className="bg-[#1a1e25]">
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="field-label" htmlFor="costo_clp_unidad">
            Costo
          </label>
          <div className="relative">
            <input
              id="costo_clp_unidad"
              name="costo_clp_unidad"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={item ? String(item.costo_clp_unidad) : ""}
              className="field-input-num pr-14"
              placeholder="120"
            />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-white/40">
              /{unidad}
            </span>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="stock">
            Stock
          </label>
          <div className="relative">
            <input
              id="stock"
              name="stock"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={item ? String(item.stock) : ""}
              className="field-input-num pr-10"
              placeholder="50"
            />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-white/40">
              {unidad}
            </span>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="stock_minimo">
            Avisar bajo
          </label>
          <div className="relative">
            <input
              id="stock_minimo"
              name="stock_minimo"
              type="number"
              step="0.01"
              min="0"
              defaultValue={item ? String(item.stock_minimo) : "0"}
              className="field-input-num pr-10"
              placeholder="0"
            />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-white/40">
              {unidad}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
        <Check
          name="usa_en_calculo"
          checked={usaEnCalculo}
          onChange={setUsaEnCalculo}
          label="Se usa en los cálculos"
          hint="Aparece en el selector de la calculadora y se descuenta al lanzar. Desmárcalo para repuestos de taller (boquillas, correas)."
        />

        {usaEnCalculo && (
          <Check
            name="aplica_desperdicio"
            defaultChecked={item?.aplica_desperdicio ?? false}
            label="Le aplica el % de desperdicio"
            hint="Márcalo si se pierde cuando la impresión falla, como un NFC embebido. Una bolsa de embalaje no."
          />
        )}
      </div>

      <div>
        <label className="field-label" htmlFor="nota">
          Nota
        </label>
        <textarea
          id="nota"
          name="nota"
          rows={2}
          defaultValue={item?.nota ?? ""}
          className="field-input resize-y"
          placeholder="Proveedor, medida, dónde está guardado…"
        />
      </div>

      {state.error && <Alert>{state.error}</Alert>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancelar
        </button>
        <SubmitButton>{item ? "Guardar cambios" : "Crear"}</SubmitButton>
      </div>
    </form>
  );
}

function Check({
  name,
  label,
  hint,
  checked,
  defaultChecked,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer gap-3">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#FF7A3D]"
      />
      <span className="leading-tight">
        <span className="text-sm text-white/85">{label}</span>
        <span className="mt-0.5 block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
}
