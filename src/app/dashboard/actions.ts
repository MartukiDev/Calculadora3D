"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calcularCostos } from "@/lib/calc";
import { MAX_FILAMENTOS, type FilamentoUsado } from "@/lib/types";

export type ActionState = { error?: string; message?: string; ok?: boolean };

const num = (fd: FormData, key: string, fallback = 0): number => {
  const raw = String(fd.get(key) ?? "").replace(",", ".");
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const str = (fd: FormData, key: string): string =>
  String(fd.get(key) ?? "").trim();

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// ------------------------------------------------------------
// Configuración global
// ------------------------------------------------------------

export async function saveSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const ivaPct = num(formData, "iva_pct", 19);
  const desperdicioPct = num(formData, "desperdicio_pct_default");

  if (ivaPct < 0 || ivaPct > 100)
    return { error: "El IVA debe estar entre 0 y 100%." };
  if (desperdicioPct < 0 || desperdicioPct > 100)
    return { error: "El desperdicio debe estar entre 0 y 100%." };

  const payload = {
    user_id: user.id,
    tarifa_luz_clp_kwh: num(formData, "tarifa_luz_clp_kwh"),
    consumo_impresora_w: num(formData, "consumo_impresora_w"),
    tarifa_mano_obra_clp_hora: num(formData, "tarifa_mano_obra_clp_hora"),
    costo_depreciacion_clp_hora: num(formData, "costo_depreciacion_clp_hora"),
    desperdicio_pct_default: desperdicioPct,
    iva_pct: ivaPct,
    updated_at: new Date().toISOString(),
  };

  if (Object.values(payload).some((v) => typeof v === "number" && v < 0))
    return { error: "Los valores no pueden ser negativos." };

  const { error } = await supabase
    .from("user_settings")
    .upsert(payload, { onConflict: "user_id" });

  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Configuración guardada." };
}

// ------------------------------------------------------------
// Filamentos
// ------------------------------------------------------------

export async function saveFilament(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const id = str(formData, "id");
  const marca = str(formData, "marca");
  const material = str(formData, "material");
  const colorNombre = str(formData, "color_nombre");
  const colorHex = str(formData, "color_hex") || "#000000";
  const costoKg = num(formData, "costo_clp_kg");
  const stock = num(formData, "stock_gramos");

  if (!marca) return { error: "La marca es obligatoria." };
  if (!material) return { error: "El material es obligatorio." };
  if (!colorNombre) return { error: "El nombre del color es obligatorio." };
  if (!/^#[0-9a-fA-F]{6}$/.test(colorHex))
    return { error: "El color debe ser un hex válido (#RRGGBB)." };
  if (costoKg <= 0) return { error: "El costo por kilo debe ser mayor a 0." };
  if (stock < 0) return { error: "El stock no puede ser negativo." };

  const payload = {
    marca,
    material,
    color_nombre: colorNombre,
    color_hex: colorHex.toLowerCase(),
    costo_clp_kg: costoKg,
    stock_gramos: stock,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase
        .from("filaments")
        .update(payload)
        .eq("id", id)
        .eq("user_id", user.id)
    : await supabase.from("filaments").insert({ ...payload, user_id: user.id });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/filamentos");
  revalidatePath("/dashboard/calculos/nuevo");
  return { ok: true, message: id ? "Filamento actualizado." : "Filamento creado." };
}

export async function toggleFilamentActivo(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(formData, "id");
  const activo = str(formData, "activo") === "true";

  await supabase
    .from("filaments")
    .update({ activo: !activo, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/dashboard/filamentos");
  revalidatePath("/dashboard/calculos/nuevo");
}

export async function deleteFilament(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(formData, "id");

  await supabase.from("filaments").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/dashboard/filamentos");
  revalidatePath("/dashboard/calculos/nuevo");
}

// ------------------------------------------------------------
// Cálculos / impresiones
// ------------------------------------------------------------

function parseFilamentosUsados(raw: string): FilamentoUsado[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const o = item as Record<string, unknown>;
        return {
          filament_id: String(o.filament_id ?? ""),
          gramos: Number(o.gramos ?? 0),
        };
      })
      .filter((f) => f.filament_id && Number.isFinite(f.gramos) && f.gramos > 0);
  } catch {
    return [];
  }
}

export async function savePrint(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const id = str(formData, "id");
  const nombre = str(formData, "nombre_proyecto");
  const horas = num(formData, "tiempo_impresion_horas");
  const filamentosUsados = parseFilamentosUsados(
    String(formData.get("filamentos_usados") ?? "[]"),
  );

  if (!nombre) return { error: "El nombre del proyecto es obligatorio." };
  if (horas <= 0) return { error: "El tiempo de impresión debe ser mayor a 0." };
  if (filamentosUsados.length === 0)
    return { error: "Agrega al menos un filamento con gramos." };
  if (filamentosUsados.length > MAX_FILAMENTOS)
    return { error: `Máximo ${MAX_FILAMENTOS} filamentos por impresión.` };

  const margenPct = num(formData, "margen_pct");
  if (margenPct < 0 || margenPct > 500)
    return { error: "El margen debe estar entre 0 y 500%." };

  // Recalculamos en servidor con los precios reales: el cliente solo previsualiza.
  const { data: filamentos, error: filamentosError } = await supabase
    .from("filaments")
    .select("id, costo_clp_kg")
    .eq("user_id", user.id)
    .in(
      "id",
      filamentosUsados.map((f) => f.filament_id),
    );

  if (filamentosError) return { error: filamentosError.message };
  if (!filamentos || filamentos.length !== filamentosUsados.length)
    return { error: "Alguno de los filamentos seleccionados ya no existe." };

  const desperdicioPct = num(formData, "desperdicio_pct");
  const ivaPct = num(formData, "iva_pct", 19);

  const breakdown = calcularCostos({
    tiempoImpresionHoras: horas,
    filamentosUsados,
    filamentos,
    tarifaLuzClpKwh: num(formData, "tarifa_luz_clp_kwh"),
    consumoImpresoraW: num(formData, "consumo_impresora_w"),
    tarifaManoObraClpHora: num(formData, "tarifa_mano_obra_clp_hora"),
    costoDepreciacionClpHora: num(formData, "costo_depreciacion_clp_hora"),
    desperdicioPct,
    ivaPct,
    margenPct,
  });

  const round = (v: number) => Math.round(v * 100) / 100;

  const payload = {
    nombre_proyecto: nombre,
    tiempo_impresion_horas: horas,
    filamentos_usados: filamentosUsados,
    costo_filamento: round(breakdown.costoFilamento),
    costo_luz: round(breakdown.costoLuz),
    costo_mano_obra: round(breakdown.costoManoObra),
    costo_depreciacion: round(breakdown.costoDepreciacion),
    desperdicio_pct: desperdicioPct,
    iva_pct: ivaPct,
    margen_pct: margenPct,
    costo_total: round(breakdown.costoTotal),
    precio_neto: round(breakdown.precioNeto),
    precio_final_con_iva: round(breakdown.precioFinalConIva),
    notas: str(formData, "notas") || null,
    updated_at: new Date().toISOString(),
  };

  let printId = id;

  if (id) {
    // Una impresión lanzada ya descontó stock: no se reedita.
    const { data: existing } = await supabase
      .from("prints")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!existing) return { error: "El cálculo no existe." };
    if (existing.status === "lanzada")
      return { error: "No puedes editar una impresión ya lanzada." };

    const { error } = await supabase
      .from("prints")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("prints")
      .insert({ ...payload, user_id: user.id, status: "borrador" })
      .select("id")
      .single();
    if (error) return { error: error.message };
    printId = data.id;
  }

  revalidatePath("/dashboard/calculos");
  revalidatePath("/dashboard");
  redirect(`/dashboard/calculos/${printId}?guardado=1`);
}

export async function lanzarImpresion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = str(formData, "id");
  if (!id) return { error: "Falta el identificador del cálculo." };

  const { error } = await supabase.rpc("lanzar_impresion", { p_print_id: id });
  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Impresión lanzada y stock descontado." };
}

export async function deletePrint(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(formData, "id");

  // Solo borradores: lanzada es registro histórico del stock ya consumido.
  await supabase
    .from("prints")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "borrador");

  revalidatePath("/dashboard/calculos");
  revalidatePath("/dashboard");
  redirect("/dashboard/calculos");
}
