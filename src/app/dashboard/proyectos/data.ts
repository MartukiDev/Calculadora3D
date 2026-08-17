import { createClient } from "@/lib/supabase/server";
import type { InventoryItem, Print } from "@/lib/types";

/**
 * Opciones del formulario de proyecto: qué cálculos se pueden asociar y qué
 * insumos se pueden sumar al armado.
 *
 * Un cálculo está disponible si es borrador y no lo tomó otro proyecto. El
 * filtro se hace en memoria y no con un `not.in` porque la lista de tomados
 * puede venir vacía, y `in.()` sin elementos es sintaxis inválida en PostgREST.
 */
export async function cargarOpcionesProyecto(projectId?: string) {
  const supabase = await createClient();

  const [printsRes, insumosRes, settingsRes, tomadosRes] = await Promise.all([
    supabase
      .from("prints")
      .select("*")
      .eq("status", "borrador")
      .order("created_at", { ascending: false }),
    // Los repuestos de taller quedan fuera: no son parte del producto.
    supabase
      .from("inventory_items")
      .select("*")
      .eq("activo", true)
      .eq("usa_en_calculo", true)
      .order("categoria", { ascending: true })
      .order("nombre", { ascending: true }),
    supabase.from("user_settings").select("iva_pct").maybeSingle(),
    supabase.from("projects").select("id, print_id").not("print_id", "is", null),
  ]);

  const tomados = new Set(
    (tomadosRes.data ?? [])
      // El cálculo del proyecto que se está editando sí tiene que seguir listado.
      .filter((p) => p.id !== projectId)
      .map((p) => p.print_id as string),
  );

  return {
    prints: ((printsRes.data ?? []) as Print[]).filter(
      (p) => !tomados.has(p.id),
    ),
    insumos: (insumosRes.data ?? []) as InventoryItem[],
    ivaDefault: Number(settingsRes.data?.iva_pct ?? 19),
  };
}
