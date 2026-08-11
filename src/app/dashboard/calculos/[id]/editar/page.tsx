import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Filament, Print, UserSettings } from "@/lib/types";
import { PrintCalculator } from "../../PrintCalculator";

export default async function EditarCalculoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [printRes, settingsRes, filamentsRes] = await Promise.all([
    supabase.from("prints").select("*").eq("id", id).maybeSingle(),
    supabase.from("user_settings").select("*").maybeSingle(),
    supabase
      .from("filaments")
      .select("*")
      .eq("activo", true)
      .order("marca", { ascending: true }),
  ]);

  if (!printRes.data) notFound();
  const print = printRes.data as Print;

  // Una impresión lanzada ya movió stock: es registro histórico, no se edita.
  if (print.status === "lanzada") redirect(`/dashboard/calculos/${id}`);

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

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/calculos/${id}`}
          className="text-sm text-muted hover:text-white/85"
        >
          ← Volver al detalle
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white/95">
          Editar cálculo
        </h1>
        <p className="mt-1 text-sm text-muted">{print.nombre_proyecto}</p>
      </div>

      <PrintCalculator
        settings={settings}
        filamentos={(filamentsRes.data ?? []) as Filament[]}
        userId={user?.id ?? ""}
        print={print}
      />
    </div>
  );
}
