"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calcularCostos } from "@/lib/calc";
import {
  MAX_CANTIDAD_PROYECTO,
  MAX_FILAMENTOS,
  MAX_INSUMOS,
  type FilamentoUsado,
  type InsumoUsado,
} from "@/lib/types";

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
  const tarifaLuz = num(formData, "tarifa_luz_clp_kwh");

  if (ivaPct < 0 || ivaPct > 100)
    return { error: "El IVA debe estar entre 0 y 100%." };
  if (tarifaLuz < 0) return { error: "Los valores no pueden ser negativos." };

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      tarifa_luz_clp_kwh: tarifaLuz,
      iva_pct: ivaPct,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Configuración guardada." };
}

// ------------------------------------------------------------
// Impresoras
// ------------------------------------------------------------

export async function savePrinter(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const id = str(formData, "id");
  const nombre = str(formData, "nombre");
  const colorHex = str(formData, "color_hex") || "#ff7a3d";
  const consumoW = num(formData, "consumo_w");
  const manoObra = num(formData, "tarifa_mano_obra_clp_hora");
  const depreciacion = num(formData, "costo_depreciacion_clp_hora");
  const desperdicio = num(formData, "desperdicio_pct_default");

  if (!nombre) return { error: "El nombre de la impresora es obligatorio." };
  if (!/^#[0-9a-fA-F]{6}$/.test(colorHex))
    return { error: "El color debe ser un hex válido (#RRGGBB)." };
  if (desperdicio < 0 || desperdicio > 100)
    return { error: "El desperdicio debe estar entre 0 y 100%." };
  if ([consumoW, manoObra, depreciacion].some((v) => v < 0))
    return { error: "Los valores no pueden ser negativos." };

  const payload = {
    nombre,
    marca: str(formData, "marca"),
    modelo: str(formData, "modelo"),
    color_hex: colorHex.toLowerCase(),
    consumo_w: consumoW,
    tarifa_mano_obra_clp_hora: manoObra,
    costo_depreciacion_clp_hora: depreciacion,
    desperdicio_pct_default: desperdicio,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase
      .from("printers")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    // La primera impresora del usuario queda como predeterminada sola.
    const { count } = await supabase
      .from("printers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    const { error } = await supabase.from("printers").insert({
      ...payload,
      user_id: user.id,
      es_default: (count ?? 0) === 0,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: id ? "Impresora actualizada." : "Impresora creada." };
}

export async function togglePrinterActivo(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(formData, "id");
  const activo = str(formData, "activo") === "true";

  // Archivar la predeterminada dejaría los cálculos nuevos sin máquina base.
  if (activo) {
    const { data } = await supabase
      .from("printers")
      .select("es_default")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (data?.es_default) return;
  }

  await supabase
    .from("printers")
    .update({ activo: !activo, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/dashboard", "layout");
}

export async function setDefaultPrinter(formData: FormData) {
  const { supabase } = await requireUser();
  const id = str(formData, "id");
  if (!id) return;

  await supabase.rpc("set_impresora_default", { p_printer_id: id });

  revalidatePath("/dashboard", "layout");
}

export async function deletePrinter(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(formData, "id");

  await supabase.from("printers").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/dashboard", "layout");
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
// Inventario de insumos
// ------------------------------------------------------------

export async function saveInventoryItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const id = str(formData, "id");
  const nombre = str(formData, "nombre");
  const unidad = str(formData, "unidad") || "u";
  const colorHex = str(formData, "color_hex") || "#3ddad7";
  const costo = num(formData, "costo_clp_unidad");
  const stock = num(formData, "stock");
  const stockMinimo = num(formData, "stock_minimo");

  if (!nombre) return { error: "El nombre del insumo es obligatorio." };
  if (!/^#[0-9a-fA-F]{6}$/.test(colorHex))
    return { error: "El color debe ser un hex válido (#RRGGBB)." };
  if (costo < 0) return { error: "El costo no puede ser negativo." };
  if (stock < 0) return { error: "El stock no puede ser negativo." };
  if (stockMinimo < 0) return { error: "El stock mínimo no puede ser negativo." };

  const payload = {
    nombre,
    categoria: str(formData, "categoria"),
    unidad,
    color_hex: colorHex.toLowerCase(),
    costo_clp_unidad: costo,
    stock,
    stock_minimo: stockMinimo,
    usa_en_calculo: str(formData, "usa_en_calculo") === "on",
    aplica_desperdicio: str(formData, "aplica_desperdicio") === "on",
    nota: str(formData, "nota") || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase
        .from("inventory_items")
        .update(payload)
        .eq("id", id)
        .eq("user_id", user.id)
    : await supabase
        .from("inventory_items")
        .insert({ ...payload, user_id: user.id });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/inventario");
  revalidatePath("/dashboard/calculos/nuevo");
  return { ok: true, message: id ? "Insumo actualizado." : "Insumo creado." };
}

/**
 * Ajuste rápido de stock desde la tarjeta (compra o merma).
 *
 * Lee y escribe en dos pasos a propósito: el inventario lo mueve una sola
 * persona desde una sola pantalla, y el único descuento que sí necesita ser
 * atómico —el de lanzar una impresión— vive en el RPC `lanzar_impresion`.
 */
export async function ajustarStockInsumo(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(formData, "id");
  const delta = num(formData, "delta");
  if (!id || delta === 0) return;

  const { data } = await supabase
    .from("inventory_items")
    .select("stock")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return;

  await supabase
    .from("inventory_items")
    .update({
      // Un ajuste manual nunca deja el stock negativo: eso solo puede pasar al
      // lanzar una impresión con más consumo del que hay registrado.
      stock: Math.max(0, Number(data.stock) + delta),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/dashboard/inventario");
  revalidatePath("/dashboard");
}

export async function toggleInventoryItemActivo(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(formData, "id");
  const activo = str(formData, "activo") === "true";

  await supabase
    .from("inventory_items")
    .update({ activo: !activo, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/dashboard/inventario");
  revalidatePath("/dashboard/calculos/nuevo");
}

export async function deleteInventoryItem(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(formData, "id");

  await supabase
    .from("inventory_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/dashboard/inventario");
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

/** Del cliente solo llegan qué insumo y cuánto: el precio lo pone el servidor. */
function parseInsumosSeleccionados(
  raw: string,
): { item_id: string; cantidad: number }[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const o = item as Record<string, unknown>;
        return {
          item_id: String(o.item_id ?? ""),
          cantidad: Number(o.cantidad ?? 0),
        };
      })
      .filter(
        (i) => i.item_id && Number.isFinite(i.cantidad) && i.cantidad > 0,
      );
  } catch {
    return [];
  }
}

/**
 * Convierte "qué insumo y cuánto" en líneas con el costo real de la base.
 *
 * El costo unitario y el comportamiento frente al desperdicio salen siempre de
 * `inventory_items`, nunca del formulario, y quedan congelados en la línea: el
 * cliente solo previsualiza.
 */
async function resolverInsumos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  seleccionados: { item_id: string; cantidad: number }[],
): Promise<{ insumos: InsumoUsado[]; error?: string }> {
  if (seleccionados.length === 0) return { insumos: [] };

  const { data: items, error } = await supabase
    .from("inventory_items")
    .select("id, costo_clp_unidad, aplica_desperdicio, usa_en_calculo")
    .eq("user_id", userId)
    .in(
      "id",
      seleccionados.map((i) => i.item_id),
    );

  if (error) return { insumos: [], error: error.message };

  // Contra los ids únicos y no contra las líneas: repetir un insumo en dos
  // filas es válido (se suman), y comparar largos daría un error engañoso.
  const porId = new Map((items ?? []).map((i) => [i.id, i]));
  const idsPedidos = new Set(seleccionados.map((i) => i.item_id));
  if (porId.size !== idsPedidos.size)
    return {
      insumos: [],
      error: "Alguno de los insumos seleccionados ya no existe.",
    };

  const insumos: InsumoUsado[] = [];

  for (const seleccion of seleccionados) {
    const item = porId.get(seleccion.item_id)!;
    if (!item.usa_en_calculo)
      return {
        insumos: [],
        error: "Uno de los insumos está marcado como repuesto de taller.",
      };

    insumos.push({
      item_id: seleccion.item_id,
      cantidad: seleccion.cantidad,
      costo_unitario: Number(item.costo_clp_unidad),
      aplica_desperdicio: Boolean(item.aplica_desperdicio),
    });
  }

  return { insumos };
}

export async function savePrint(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const id = str(formData, "id");
  const nombre = str(formData, "nombre_proyecto");
  const horas = num(formData, "tiempo_impresion_horas");
  const printerId = str(formData, "printer_id");
  const filamentosUsados = parseFilamentosUsados(
    String(formData.get("filamentos_usados") ?? "[]"),
  );
  const insumosSeleccionados = parseInsumosSeleccionados(
    String(formData.get("insumos_usados") ?? "[]"),
  );

  if (!nombre) return { error: "El nombre del proyecto es obligatorio." };
  if (horas <= 0) return { error: "El tiempo de impresión debe ser mayor a 0." };
  if (!printerId) return { error: "Selecciona la impresora que vas a usar." };
  if (filamentosUsados.length === 0)
    return { error: "Agrega al menos un filamento con gramos." };
  if (filamentosUsados.length > MAX_FILAMENTOS)
    return { error: `Máximo ${MAX_FILAMENTOS} filamentos por impresión.` };
  if (insumosSeleccionados.length > MAX_INSUMOS)
    return { error: `Máximo ${MAX_INSUMOS} insumos por impresión.` };

  // La impresora tiene que ser del usuario: el id viaja en un campo oculto.
  const { data: printer } = await supabase
    .from("printers")
    .select("id")
    .eq("id", printerId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!printer) return { error: "La impresora seleccionada ya no existe." };

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

  const resueltos = await resolverInsumos(
    supabase,
    user.id,
    insumosSeleccionados,
  );
  if (resueltos.error) return { error: resueltos.error };
  const insumosUsados = resueltos.insumos;

  const desperdicioPct = num(formData, "desperdicio_pct");
  const ivaPct = num(formData, "iva_pct", 19);

  const breakdown = calcularCostos({
    tiempoImpresionHoras: horas,
    filamentosUsados,
    filamentos,
    insumosUsados,
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
    printer_id: printerId,
    tiempo_impresion_horas: horas,
    filamentos_usados: filamentosUsados,
    insumos_usados: insumosUsados,
    costo_filamento: round(breakdown.costoFilamento),
    costo_insumos: round(breakdown.costoInsumos),
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
  revalidatePath("/dashboard/proyectos");
  revalidatePath("/dashboard");
  redirect("/dashboard/calculos");
}

// ------------------------------------------------------------
// Proyectos
// ------------------------------------------------------------

export async function saveProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const id = str(formData, "id");
  const nombre = str(formData, "nombre");
  const colorHex = str(formData, "color_hex") || "#ff7a3d";
  const printId = str(formData, "print_id");
  const cantidad = num(formData, "cantidad", 1);
  const margenPct = num(formData, "margen_pct");
  const ivaPct = num(formData, "iva_pct", 19);
  const insumosSeleccionados = parseInsumosSeleccionados(
    String(formData.get("insumos_usados") ?? "[]"),
  );

  if (!nombre) return { error: "El nombre del proyecto es obligatorio." };
  if (!/^#[0-9a-fA-F]{6}$/.test(colorHex))
    return { error: "El color debe ser un hex válido (#RRGGBB)." };
  if (cantidad <= 0) return { error: "La cantidad debe ser mayor a 0." };
  if (cantidad > MAX_CANTIDAD_PROYECTO)
    return { error: `La cantidad máxima por proyecto es ${MAX_CANTIDAD_PROYECTO}.` };
  if (margenPct < 0 || margenPct > 500)
    return { error: "El margen debe estar entre 0 y 500%." };
  if (ivaPct < 0 || ivaPct > 100)
    return { error: "El IVA debe estar entre 0 y 100%." };
  if (insumosSeleccionados.length > MAX_INSUMOS)
    return { error: `Máximo ${MAX_INSUMOS} insumos de armado por proyecto.` };

  // Un proyecto lanzado ya descontó stock y congeló sus costos: no se reedita.
  if (id) {
    const { data: existente } = await supabase
      .from("projects")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existente) return { error: "El proyecto no existe." };
    if (existente.status === "lanzado")
      return { error: "No puedes editar un proyecto ya lanzado." };
  }

  if (printId) {
    const { data: print } = await supabase
      .from("prints")
      .select("id, status")
      .eq("id", printId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!print) return { error: "El cálculo seleccionado ya no existe." };
    // Un cálculo lanzado ya consumió su stock por la vía individual; meterlo a
    // un proyecto lo descontaría una segunda vez.
    if (print.status !== "borrador")
      return {
        error: "Ese cálculo ya fue lanzado y no puede asociarse a un proyecto.",
      };

    // El índice único lo garantiza igual, pero atrapado acá el mensaje sirve.
    const { data: ocupado } = await supabase
      .from("projects")
      .select("id, nombre")
      .eq("user_id", user.id)
      .eq("print_id", printId)
      .neq("id", id || "00000000-0000-0000-0000-000000000000")
      .maybeSingle();

    if (ocupado)
      return { error: `Ese cálculo ya pertenece al proyecto "${ocupado.nombre}".` };
  }

  const resueltos = await resolverInsumos(
    supabase,
    user.id,
    insumosSeleccionados,
  );
  if (resueltos.error) return { error: resueltos.error };

  const payload = {
    nombre,
    descripcion: str(formData, "descripcion") || null,
    color_hex: colorHex.toLowerCase(),
    // Vacío significa "todavía sin cálculo", no cadena vacía: la columna es uuid.
    print_id: printId || null,
    cantidad,
    insumos_usados: resueltos.insumos,
    margen_pct: margenPct,
    iva_pct: ivaPct,
    notas: str(formData, "notas") || null,
    updated_at: new Date().toISOString(),
  };

  let projectId = id;

  if (id) {
    const { error } = await supabase
      .from("projects")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("projects")
      .insert({ ...payload, user_id: user.id, status: "borrador" })
      .select("id")
      .single();
    if (error) return { error: error.message };
    projectId = data.id;
  }

  revalidatePath("/dashboard/proyectos");
  revalidatePath("/dashboard");
  redirect(`/dashboard/proyectos/${projectId}?guardado=1`);
}

export async function lanzarProyecto(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = str(formData, "id");
  if (!id) return { error: "Falta el identificador del proyecto." };

  const { error } = await supabase.rpc("lanzar_proyecto", { p_project_id: id });
  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Proyecto lanzado y stock descontado." };
}

export async function deleteProject(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(formData, "id");

  // Solo borradores: un proyecto lanzado es el registro de lo que se produjo.
  // El cálculo asociado no se toca, solo deja de estar tomado.
  await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "borrador");

  revalidatePath("/dashboard/proyectos");
  revalidatePath("/dashboard/calculos");
  revalidatePath("/dashboard");
  redirect("/dashboard/proyectos");
}
