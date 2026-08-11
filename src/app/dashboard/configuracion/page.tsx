import { createClient } from "@/lib/supabase/server";
import type { UserSettings } from "@/lib/types";
import { SettingsForm } from "./SettingsForm";

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("user_settings")
    .select("*")
    .maybeSingle();

  const settings: UserSettings = data ?? {
    user_id: user?.id ?? "",
    tarifa_luz_clp_kwh: 0,
    iva_pct: 19,
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white/95">Configuración</h1>
        <p className="mt-1 text-sm text-muted">
          Estos valores precargan cada cálculo. Puedes ajustarlos por impresión
          sin cambiar el default. Los costos de máquina están en cada impresora.
        </p>
      </div>

      <SettingsForm settings={settings} userId={user?.id ?? ""} />
    </div>
  );
}
