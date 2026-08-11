"use client";

import { useActionState, useEffect, useState } from "react";
import { saveSettings, type ActionState } from "@/app/dashboard/actions";
import { GlassPanel } from "@/components/GlassPanel";
import { Alert, SubmitButton } from "@/components/ui";
import { settingsCache } from "@/lib/cache";
import { formatCLP } from "@/lib/format";
import type { UserSettings } from "@/lib/types";

type NumericField = Exclude<keyof UserSettings, "user_id" | "updated_at">;

const FIELDS: {
  name: NumericField;
  label: string;
  hint: string;
  step: string;
  suffix: string;
  max?: number;
}[] = [
  {
    name: "tarifa_luz_clp_kwh",
    label: "Tarifa de luz",
    hint: "Lo que cobra tu distribuidora por kWh.",
    step: "0.01",
    suffix: "CLP/kWh",
  },
  {
    name: "consumo_impresora_w",
    label: "Consumo de la impresora",
    hint: "Consumo promedio en watts durante la impresión.",
    step: "1",
    suffix: "W",
  },
  {
    name: "tarifa_mano_obra_clp_hora",
    label: "Mano de obra",
    hint: "Cuánto vale tu hora de supervisión y post-proceso.",
    step: "1",
    suffix: "CLP/hora",
  },
  {
    name: "costo_depreciacion_clp_hora",
    label: "Depreciación",
    hint: "Monto fijo por hora imputado al desgaste de la máquina.",
    step: "1",
    suffix: "CLP/hora",
  },
  {
    name: "desperdicio_pct_default",
    label: "Desperdicio por defecto",
    hint: "Purgas, fallas y soportes, como % sobre el subtotal.",
    step: "0.1",
    suffix: "%",
    max: 100,
  },
  {
    name: "iva_pct",
    label: "IVA",
    hint: "Se aplica sobre el precio neto con margen.",
    step: "0.1",
    suffix: "%",
    max: 100,
  },
];

export function SettingsForm({
  settings,
  userId,
}: {
  settings: UserSettings;
  userId: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveSettings,
    {},
  );

  const [values, setValues] = useState<Record<NumericField, string>>(() => ({
    tarifa_luz_clp_kwh: String(settings.tarifa_luz_clp_kwh ?? 0),
    consumo_impresora_w: String(settings.consumo_impresora_w ?? 0),
    tarifa_mano_obra_clp_hora: String(settings.tarifa_mano_obra_clp_hora ?? 0),
    costo_depreciacion_clp_hora: String(
      settings.costo_depreciacion_clp_hora ?? 0,
    ),
    desperdicio_pct_default: String(settings.desperdicio_pct_default ?? 0),
    iva_pct: String(settings.iva_pct ?? 19),
  }));

  // La caché local se escribe con lo que Supabase confirmó, nunca con el borrador.
  useEffect(() => {
    if (userId) settingsCache.set(userId, settings);
  }, [userId, settings]);

  const num = (key: NumericField) => {
    const parsed = parseFloat(values[key]);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const costoHoraFija =
    num("tarifa_luz_clp_kwh") * (num("consumo_impresora_w") / 1000) +
    num("tarifa_mano_obra_clp_hora") +
    num("costo_depreciacion_clp_hora");

  return (
    <form action={formAction} className="space-y-6">
      <GlassPanel title="Costos base">
        <div className="grid gap-5 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.name}>
              <label className="field-label" htmlFor={field.name}>
                {field.label}
              </label>
              <div className="relative">
                <input
                  id={field.name}
                  name={field.name}
                  type="number"
                  step={field.step}
                  min="0"
                  max={field.max}
                  required
                  value={values[field.name]}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [field.name]: e.target.value,
                    }))
                  }
                  className="field-input-num pr-20"
                />
                <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-white/40">
                  {field.suffix}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted">{field.hint}</p>
            </div>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel className="!p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white/90">
              Costo fijo por hora de impresión
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Luz + mano de obra + depreciación, sin filamento ni desperdicio.
            </p>
          </div>
          <span className="num text-lg font-semibold text-accent-2">
            {formatCLP(costoHoraFija)}
          </span>
        </div>
      </GlassPanel>

      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <div className="flex justify-end">
        <SubmitButton>Guardar configuración</SubmitButton>
      </div>
    </form>
  );
}
