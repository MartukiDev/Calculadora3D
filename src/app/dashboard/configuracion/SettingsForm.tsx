"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { saveSettings, type ActionState } from "@/app/dashboard/actions";
import { GlassPanel } from "@/components/GlassPanel";
import { Alert, SubmitButton } from "@/components/ui";
import { settingsCache } from "@/lib/cache";
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

  // La caché local se escribe con lo que Supabase confirmó, nunca con el borrador.
  useEffect(() => {
    if (userId) settingsCache.set(userId, settings);
  }, [userId, settings]);

  return (
    <form action={formAction} className="space-y-6">
      <GlassPanel
        title="Costos base"
        description="Lo que no depende de la máquina: la tarifa la fija tu distribuidora y el IVA, el país."
      >
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
                  defaultValue={String(settings[field.name] ?? 0)}
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
              Consumo, mano de obra, depreciación y desperdicio
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Ahora viven en cada impresora, porque no cuestan lo mismo en todas.
            </p>
          </div>
          <Link href="/dashboard/impresoras" className="btn-ghost text-sm">
            Ir a impresoras
          </Link>
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
