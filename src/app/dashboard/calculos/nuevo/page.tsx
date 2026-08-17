import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui";
import type {
  Filament,
  InventoryItem,
  Printer,
  UserSettings,
} from "@/lib/types";
import { PrintCalculator } from "../PrintCalculator";

export default async function NuevoCalculoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [settingsRes, filamentsRes, printersRes, insumosRes] = await Promise.all([
    supabase.from("user_settings").select("*").maybeSingle(),
    supabase
      .from("filaments")
      .select("*")
      .eq("activo", true)
      .order("marca", { ascending: true }),
    supabase
      .from("printers")
      .select("*")
      .eq("activo", true)
      .order("es_default", { ascending: false })
      .order("nombre", { ascending: true }),
    // Los repuestos de taller quedan fuera: no son parte de la pieza.
    supabase
      .from("inventory_items")
      .select("*")
      .eq("activo", true)
      .eq("usa_en_calculo", true)
      .order("categoria", { ascending: true })
      .order("nombre", { ascending: true }),
  ]);

  const settings: UserSettings = settingsRes.data ?? {
    user_id: user?.id ?? "",
    tarifa_luz_clp_kwh: 0,
    iva_pct: 19,
    updated_at: new Date().toISOString(),
  };

  const impresoras = (printersRes.data ?? []) as Printer[];

  const sinTarifaLuz = Number(settings.tarifa_luz_clp_kwh) === 0;
  const sinCostosMaquina = impresoras.every(
    (p) =>
      Number(p.consumo_w) === 0 &&
      Number(p.tarifa_mano_obra_clp_hora) === 0 &&
      Number(p.costo_depreciacion_clp_hora) === 0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white/95">Nuevo cálculo</h1>
        <p className="mt-1 text-sm text-muted">
          El desglose se actualiza mientras escribes. Se guarda como borrador.
        </p>
      </div>

      {impresoras.length > 0 && sinCostosMaquina && (
        <Alert tone="warn">
          Tus impresoras tienen todos sus costos en cero, así que solo se contará
          el filamento.{" "}
          <Link href="/dashboard/impresoras" className="underline">
            Configurar impresoras
          </Link>
        </Alert>
      )}

      {sinTarifaLuz && (
        <Alert tone="warn">
          Tu tarifa de luz está en cero: el costo eléctrico saldrá $0.{" "}
          <Link href="/dashboard/configuracion" className="underline">
            Configurar tarifa
          </Link>
        </Alert>
      )}

      <PrintCalculator
        settings={settings}
        filamentos={(filamentsRes.data ?? []) as Filament[]}
        impresoras={impresoras}
        insumos={(insumosRes.data ?? []) as InventoryItem[]}
        userId={user?.id ?? ""}
      />
    </div>
  );
}
