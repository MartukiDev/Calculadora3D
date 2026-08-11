import { createClient } from "@/lib/supabase/server";
import type { Printer } from "@/lib/types";
import { PrintersManager } from "./PrintersManager";

export default async function ImpresorasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [printersRes, settingsRes] = await Promise.all([
    supabase
      .from("printers")
      .select("*")
      .order("es_default", { ascending: false })
      .order("activo", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("user_settings").select("tarifa_luz_clp_kwh").maybeSingle(),
  ]);

  return (
    <PrintersManager
      printers={(printersRes.data ?? []) as Printer[]}
      tarifaLuzClpKwh={Number(settingsRes.data?.tarifa_luz_clp_kwh ?? 0)}
      userId={user?.id ?? ""}
      loadError={printersRes.error?.message ?? null}
    />
  );
}
