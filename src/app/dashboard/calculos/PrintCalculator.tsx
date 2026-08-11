"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { savePrint, type ActionState } from "@/app/dashboard/actions";
import { CostLayerStack } from "@/components/CostLayerStack";
import { FilamentChip } from "@/components/FilamentChip";
import { GlassPanel } from "@/components/GlassPanel";
import { Alert, EmptyState, SubmitButton } from "@/components/ui";
import { calcularCostos } from "@/lib/calc";
import { clearDraft, getDraft, setDraft } from "@/lib/cache";
import { formatCLP, formatGramos } from "@/lib/format";
import {
  MAX_FILAMENTOS,
  type Filament,
  type FilamentoUsado,
  type Print,
  type UserSettings,
} from "@/lib/types";

type Draft = {
  nombre: string;
  horas: string;
  notas: string;
  seleccion: { filament_id: string; gramos: string }[];
  overrides: {
    tarifa_luz_clp_kwh: string;
    consumo_impresora_w: string;
    tarifa_mano_obra_clp_hora: string;
    costo_depreciacion_clp_hora: string;
    desperdicio_pct: string;
    iva_pct: string;
  };
  margen: string;
};

function draftFromSettings(settings: UserSettings): Draft {
  return {
    nombre: "",
    horas: "",
    notas: "",
    seleccion: [{ filament_id: "", gramos: "" }],
    overrides: {
      tarifa_luz_clp_kwh: String(settings.tarifa_luz_clp_kwh ?? 0),
      consumo_impresora_w: String(settings.consumo_impresora_w ?? 0),
      tarifa_mano_obra_clp_hora: String(settings.tarifa_mano_obra_clp_hora ?? 0),
      costo_depreciacion_clp_hora: String(
        settings.costo_depreciacion_clp_hora ?? 0,
      ),
      desperdicio_pct: String(settings.desperdicio_pct_default ?? 0),
      iva_pct: String(settings.iva_pct ?? 19),
    },
    margen: "0",
  };
}

function draftFromPrint(print: Print, settings: UserSettings): Draft {
  return {
    nombre: print.nombre_proyecto,
    horas: String(print.tiempo_impresion_horas),
    notas: print.notas ?? "",
    seleccion:
      print.filamentos_usados?.length > 0
        ? print.filamentos_usados.map((f) => ({
            filament_id: f.filament_id,
            gramos: String(f.gramos),
          }))
        : [{ filament_id: "", gramos: "" }],
    overrides: {
      // Los costos por hora no se persisten en prints: reconstruimos desde settings.
      tarifa_luz_clp_kwh: String(settings.tarifa_luz_clp_kwh ?? 0),
      consumo_impresora_w: String(settings.consumo_impresora_w ?? 0),
      tarifa_mano_obra_clp_hora:
        Number(print.tiempo_impresion_horas) > 0
          ? String(
              Number(print.costo_mano_obra) /
                Number(print.tiempo_impresion_horas),
            )
          : String(settings.tarifa_mano_obra_clp_hora ?? 0),
      costo_depreciacion_clp_hora:
        Number(print.tiempo_impresion_horas) > 0
          ? String(
              Number(print.costo_depreciacion) /
                Number(print.tiempo_impresion_horas),
            )
          : String(settings.costo_depreciacion_clp_hora ?? 0),
      desperdicio_pct: String(print.desperdicio_pct),
      iva_pct: String(print.iva_pct),
    },
    margen: String(print.margen_pct),
  };
}

const toNum = (v: string) => {
  const parsed = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function PrintCalculator({
  settings,
  filamentos,
  userId,
  print,
}: {
  settings: UserSettings;
  filamentos: Filament[];
  userId: string;
  print?: Print;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    savePrint,
    {},
  );
  const isEdit = Boolean(print);

  const [draft, setDraftState] = useState<Draft>(() =>
    print ? draftFromPrint(print, settings) : draftFromSettings(settings),
  );
  const [draftRestaurado, setDraftRestaurado] = useState(false);
  const [mostrarOverrides, setMostrarOverrides] = useState(false);

  // Recuperar borrador en progreso (solo para cálculos nuevos). localStorage no
  // existe en el servidor, así que la lectura tiene que ocurrir tras montar:
  // hacerlo en el initializer de useState rompería la hidratación.
  useEffect(() => {
    if (isEdit || !userId) return;
    const saved = getDraft<Draft>(userId);
    if (saved?.nombre || saved?.horas) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización inicial desde un sistema externo (localStorage)
      setDraftState(saved);
      setDraftRestaurado(true);
    }
  }, [isEdit, userId]);

  // Autoguardado del formulario no enviado.
  useEffect(() => {
    if (isEdit || !userId) return;
    if (!draft.nombre && !draft.horas) return;
    const t = setTimeout(() => setDraft(userId, draft), 400);
    return () => clearTimeout(t);
  }, [draft, isEdit, userId]);

  // Al guardar con éxito la acción redirige, pero si vuelve un error mantenemos el borrador.
  useEffect(() => {
    if (state.ok && userId) clearDraft(userId);
  }, [state.ok, userId]);

  const filamentosPorId = useMemo(
    () => new Map(filamentos.map((f) => [f.id, f])),
    [filamentos],
  );

  const seleccionValida: FilamentoUsado[] = draft.seleccion
    .filter((s) => s.filament_id && toNum(s.gramos) > 0)
    .map((s) => ({ filament_id: s.filament_id, gramos: toNum(s.gramos) }));

  const breakdown = calcularCostos({
    tiempoImpresionHoras: toNum(draft.horas),
    filamentosUsados: seleccionValida,
    filamentos,
    tarifaLuzClpKwh: toNum(draft.overrides.tarifa_luz_clp_kwh),
    consumoImpresoraW: toNum(draft.overrides.consumo_impresora_w),
    tarifaManoObraClpHora: toNum(draft.overrides.tarifa_mano_obra_clp_hora),
    costoDepreciacionClpHora: toNum(
      draft.overrides.costo_depreciacion_clp_hora,
    ),
    desperdicioPct: toNum(draft.overrides.desperdicio_pct),
    ivaPct: toNum(draft.overrides.iva_pct),
    margenPct: toNum(draft.margen),
  });

  const excesos = draft.seleccion
    .map((s) => {
      const f = filamentosPorId.get(s.filament_id);
      if (!f) return null;
      const gramos = toNum(s.gramos);
      return gramos > Number(f.stock_gramos)
        ? { filament: f, gramos, stock: Number(f.stock_gramos) }
        : null;
    })
    .filter(Boolean) as { filament: Filament; gramos: number; stock: number }[];

  const idsUsados = draft.seleccion.map((s) => s.filament_id).filter(Boolean);
  const duplicados = idsUsados.length !== new Set(idsUsados).size;

  const update = (patch: Partial<Draft>) =>
    setDraftState((prev) => ({ ...prev, ...patch }));

  const updateOverride = (key: keyof Draft["overrides"], value: string) =>
    setDraftState((prev) => ({
      ...prev,
      overrides: { ...prev.overrides, [key]: value },
    }));

  const updateSeleccion = (
    index: number,
    patch: Partial<{ filament_id: string; gramos: string }>,
  ) =>
    setDraftState((prev) => ({
      ...prev,
      seleccion: prev.seleccion.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    }));

  if (filamentos.length === 0) {
    return (
      <GlassPanel>
        <EmptyState
          title="Necesitas al menos un filamento activo"
          description="La calculadora usa el costo por kilo de tus filamentos para estimar el costo de material."
          action={
            <Link href="/dashboard/filamentos" className="btn-primary mt-2">
              Agregar filamento
            </Link>
          }
        />
      </GlassPanel>
    );
  }

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      {print && <input type="hidden" name="id" value={print.id} />}
      <input
        type="hidden"
        name="filamentos_usados"
        value={JSON.stringify(seleccionValida)}
      />
      {(
        Object.keys(draft.overrides) as (keyof Draft["overrides"])[]
      ).map((key) => (
        <input
          key={key}
          type="hidden"
          name={key}
          value={draft.overrides[key]}
        />
      ))}
      <input type="hidden" name="margen_pct" value={draft.margen} />

      <div className="space-y-6">
        {draftRestaurado && (
          <Alert tone="info">
            Recuperamos un borrador que habías dejado sin guardar.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => {
                setDraftState(draftFromSettings(settings));
                clearDraft(userId);
                setDraftRestaurado(false);
              }}
            >
              Empezar de cero
            </button>
          </Alert>
        )}

        <GlassPanel title="Proyecto">
          <div className="grid gap-5 sm:grid-cols-[1.5fr_1fr]">
            <div>
              <label className="field-label" htmlFor="nombre_proyecto">
                Nombre del proyecto
              </label>
              <input
                id="nombre_proyecto"
                name="nombre_proyecto"
                required
                value={draft.nombre}
                onChange={(e) => update({ nombre: e.target.value })}
                className="field-input"
                placeholder="Soporte de audífonos v2"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="tiempo_impresion_horas">
                Tiempo de impresión
              </label>
              <div className="relative">
                <input
                  id="tiempo_impresion_horas"
                  name="tiempo_impresion_horas"
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={draft.horas}
                  onChange={(e) => update({ horas: e.target.value })}
                  className="field-input-num pr-12"
                  placeholder="4.5"
                />
                <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-white/40">
                  h
                </span>
              </div>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel
          title="Filamentos"
          description={`Hasta ${MAX_FILAMENTOS} por impresión (multi-color)`}
          actions={
            draft.seleccion.length < MAX_FILAMENTOS ? (
              <button
                type="button"
                className="btn-ghost !py-2 text-xs"
                onClick={() =>
                  update({
                    seleccion: [
                      ...draft.seleccion,
                      { filament_id: "", gramos: "" },
                    ],
                  })
                }
              >
                + Agregar
              </button>
            ) : null
          }
        >
          <div className="space-y-3">
            {draft.seleccion.map((slot, index) => {
              const f = filamentosPorId.get(slot.filament_id);
              return (
                <div
                  key={index}
                  className="grid grid-cols-[auto_1fr_7rem_auto] items-center gap-3"
                >
                  <span
                    className="h-9 w-9 rounded-full border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]"
                    style={{
                      backgroundColor: f?.color_hex ?? "rgba(255,255,255,0.08)",
                    }}
                    aria-hidden
                  />
                  <select
                    value={slot.filament_id}
                    onChange={(e) =>
                      updateSeleccion(index, { filament_id: e.target.value })
                    }
                    className="field-input"
                    aria-label={`Filamento ${index + 1}`}
                  >
                    <option value="" className="bg-[#1a1e25]">
                      Seleccionar filamento…
                    </option>
                    {filamentos.map((opt) => (
                      <option
                        key={opt.id}
                        value={opt.id}
                        className="bg-[#1a1e25]"
                      >
                        {opt.marca} {opt.material} · {opt.color_nombre} (
                        {formatGramos(opt.stock_gramos)})
                      </option>
                    ))}
                  </select>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={slot.gramos}
                      onChange={(e) =>
                        updateSeleccion(index, { gramos: e.target.value })
                      }
                      className="field-input-num pr-8"
                      placeholder="0"
                      aria-label={`Gramos filamento ${index + 1}`}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-white/40">
                      g
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        seleccion:
                          draft.seleccion.length === 1
                            ? [{ filament_id: "", gramos: "" }]
                            : draft.seleccion.filter((_, i) => i !== index),
                      })
                    }
                    className="rounded-lg px-2 py-2 text-muted transition hover:bg-white/[0.06] hover:text-white/85"
                    aria-label="Quitar filamento"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          {duplicados && (
            <div className="mt-4">
              <Alert tone="warn">
                Hay un filamento repetido en la selección. Súmalos en una sola
                fila para que el descuento de stock sea correcto.
              </Alert>
            </div>
          )}

          {excesos.length > 0 && (
            <div className="mt-4">
              <Alert tone="warn">
                Estás usando más de lo que tienes en stock:{" "}
                {excesos
                  .map(
                    (e) =>
                      `${e.filament.marca} ${e.filament.color_nombre} (${formatGramos(e.gramos)} de ${formatGramos(e.stock)})`,
                  )
                  .join(", ")}
                . Puedes guardar igual, pero el stock quedará negativo al lanzar.
              </Alert>
            </div>
          )}

          {seleccionValida.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.08] pt-4">
              {seleccionValida.map((s) => {
                const f = filamentosPorId.get(s.filament_id);
                if (!f) return null;
                return (
                  <FilamentChip
                    key={s.filament_id}
                    colorHex={f.color_hex}
                    label={`${f.marca} ${f.material}`}
                    sublabel={f.color_nombre}
                    gramos={s.gramos}
                    size="sm"
                  />
                );
              })}
            </div>
          )}
        </GlassPanel>

        <GlassPanel
          title="Ajustes de esta impresión"
          description="Sobrescriben tu configuración global solo para este cálculo"
          actions={
            <button
              type="button"
              className="btn-ghost !py-2 text-xs"
              onClick={() => setMostrarOverrides((v) => !v)}
            >
              {mostrarOverrides ? "Ocultar" : "Mostrar"}
            </button>
          }
        >
          {mostrarOverrides && (
            <div className="mb-6 grid gap-5 sm:grid-cols-2">
              <OverrideField
                label="Tarifa de luz"
                suffix="CLP/kWh"
                step="0.01"
                value={draft.overrides.tarifa_luz_clp_kwh}
                onChange={(v) => updateOverride("tarifa_luz_clp_kwh", v)}
              />
              <OverrideField
                label="Consumo impresora"
                suffix="W"
                step="1"
                value={draft.overrides.consumo_impresora_w}
                onChange={(v) => updateOverride("consumo_impresora_w", v)}
              />
              <OverrideField
                label="Mano de obra"
                suffix="CLP/hora"
                step="1"
                value={draft.overrides.tarifa_mano_obra_clp_hora}
                onChange={(v) => updateOverride("tarifa_mano_obra_clp_hora", v)}
              />
              <OverrideField
                label="Depreciación"
                suffix="CLP/hora"
                step="1"
                value={draft.overrides.costo_depreciacion_clp_hora}
                onChange={(v) =>
                  updateOverride("costo_depreciacion_clp_hora", v)
                }
              />
              <OverrideField
                label="Desperdicio"
                suffix="%"
                step="0.1"
                max="100"
                value={draft.overrides.desperdicio_pct}
                onChange={(v) => updateOverride("desperdicio_pct", v)}
              />
              <OverrideField
                label="IVA"
                suffix="%"
                step="0.1"
                max="100"
                value={draft.overrides.iva_pct}
                onChange={(v) => updateOverride("iva_pct", v)}
              />
            </div>
          )}

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <label className="field-label !mb-0" htmlFor="margen">
                Margen de ganancia
              </label>
              <span className="num text-sm font-semibold text-accent">
                {toNum(draft.margen)}%
              </span>
            </div>
            <input
              id="margen"
              type="range"
              min="0"
              max="500"
              step="5"
              value={draft.margen}
              onChange={(e) => update({ margen: e.target.value })}
              className="w-full accent-[#FF7A3D]"
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted">
              <span>0%</span>
              <span>250%</span>
              <span>500%</span>
            </div>
          </div>

          <div className="mt-5">
            <label className="field-label" htmlFor="notas">
              Notas
            </label>
            <textarea
              id="notas"
              name="notas"
              rows={2}
              value={draft.notas}
              onChange={(e) => update({ notas: e.target.value })}
              className="field-input resize-y"
              placeholder="Boquilla 0.4, relleno 15%, cliente…"
            />
          </div>
        </GlassPanel>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <GlassPanel title="Desglose de costos">
          <CostLayerStack
            breakdown={breakdown}
            desperdicioPct={toNum(draft.overrides.desperdicio_pct)}
            margenPct={toNum(draft.margen)}
            ivaPct={toNum(draft.overrides.iva_pct)}
          />

          <div className="mt-5 space-y-3 border-t border-white/[0.08] pt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Ganancia estimada</span>
              <span className="num text-white/90">
                {formatCLP(breakdown.precioNeto - breakdown.costoTotal)}
              </span>
            </div>

            {state.error && <Alert>{state.error}</Alert>}

            <SubmitButton className="btn-primary w-full">
              {isEdit ? "Guardar cambios" : "Guardar como borrador"}
            </SubmitButton>
            <p className="text-center text-xs text-muted">
              Se guarda como borrador. El stock se descuenta al lanzar la
              impresión.
            </p>
          </div>
        </GlassPanel>
      </div>
    </form>
  );
}

function OverrideField({
  label,
  suffix,
  step,
  max,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  step: string;
  max?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="relative">
        <input
          type="number"
          step={step}
          min="0"
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field-input-num pr-20"
        />
        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-white/40">
          {suffix}
        </span>
      </div>
    </div>
  );
}
