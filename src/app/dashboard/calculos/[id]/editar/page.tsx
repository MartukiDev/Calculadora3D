import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Filament, Print, Printer, UserSettings } from "@/lib/types";
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

  const [printRes, settingsRes, filamentsRes, printersRes] = await Promise.all([
    supabase.from("prints").select("*").eq("id", id).maybeSingle(),
    supabase.from("user_settings").select("*").maybeSingle(),
    supabase
      .from("filaments")
      .select("*")
      .eq("activo", true)
      .order("marca", { ascending: true }),
    supabase
      .from("printers")
      .select("*")
      .order("es_default", { ascending: false })
      .order("nombre", { ascending: true }),
  ]);

  if (!printRes.data) notFound();
  const print = printRes.data as Print;

  // Una impresión lanzada ya movió stock: es registro histórico, no se edita.
  if (print.status === "lanzada") redirect(`/dashboard/calculos/${id}`);

  const settings: UserSettings = settingsRes.data ?? {
    user_id: user?.id ?? "",
    tarifa_luz_clp_kwh: 0,
    iva_pct: 19,
    updated_at: new Date().toISOString(),
  };

  // Se ofrecen las activas, más la del cálculo aunque esté archivada: si no,
  // editar cualquier campo lo movería en silencio a otra máquina.
  const impresoras = ((printersRes.data ?? []) as Printer[]).filter(
    (p) => p.activo || p.id === print.printer_id,
  );

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
        impresoras={impresoras}
        userId={user?.id ?? ""}
        print={print}
      />
    </div>
  );
}
