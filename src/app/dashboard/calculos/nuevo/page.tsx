import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui";
import type { Filament, UserSettings } from "@/lib/types";
import { PrintCalculator } from "../PrintCalculator";

export default async function NuevoCalculoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [settingsRes, filamentsRes] = await Promise.all([
    supabase.from("user_settings").select("*").maybeSingle(),
    supabase
      .from("filaments")
      .select("*")
      .eq("activo", true)
      .order("marca", { ascending: true }),
  ]);

  const settings: UserSettings = settingsRes.data ?? {
    user_id: user?.id ?? "",
    tarifa_luz_clp_kwh: 0,
    consumo_impresora_w: 0,
    tarifa_mano_obra_clp_hora: 0,
    costo_depreciacion_clp_hora: 0,
    desperdicio_pct_default: 0,
    iva_pct: 19,
    updated_at: new Date().toISOString(),
  };

  const sinConfigurar =
    Number(settings.tarifa_luz_clp_kwh) === 0 &&
    Number(settings.consumo_impresora_w) === 0 &&
    Number(settings.tarifa_mano_obra_clp_hora) === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white/95">Nuevo cálculo</h1>
        <p className="mt-1 text-sm text-muted">
          El desglose se actualiza mientras escribes. Se guarda como borrador.
        </p>
      </div>

      {sinConfigurar && (
        <Alert tone="warn">
          Tu configuración global está en cero, así que solo se contará el
          filamento.{" "}
          <Link href="/dashboard/configuracion" className="underline">
            Configurar costos base
          </Link>
        </Alert>
      )}

      <PrintCalculator
        settings={settings}
        filamentos={(filamentsRes.data ?? []) as Filament[]}
        userId={user?.id ?? ""}
      />
    </div>
  );
}
