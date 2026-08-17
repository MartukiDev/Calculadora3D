"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { savePrint, type ActionState } from "@/app/dashboard/actions";
import { CostLayerStack } from "@/components/CostLayerStack";
import { FilamentChip } from "@/components/FilamentChip";
import { GlassPanel } from "@/components/GlassPanel";
import { Alert, EmptyState, SubmitButton } from "@/components/ui";
import { calcularCostos } from "@/lib/calc";
import { clearDraft, getDraft, setDraft } from "@/lib/cache";
import { formatCantidad, formatCLP, formatGramos } from "@/lib/format";
import {
  MAX_FILAMENTOS,
  MAX_INSUMOS,
  type Filament,
  type FilamentoUsado,
  type InsumoUsado,
  type InventoryItem,
  type Print,
  type Printer,
  type UserSettings,
} from "@/lib/types";

type Draft = {
  nombre: string;
  horas: string;
  notas: string;
  printer_id: string;
  /** Para uno mismo: sin margen ni IVA, solo el costo de producirla. */
  usoPersonal: boolean;
  seleccion: { filament_id: string; gramos: string }[];
  insumos: { item_id: string; cantidad: string }[];
  overrides: {
    tarifa_luz_clp_kwh: string;
    consumo_impresora_w: string;
    tarifa_mano_obra_clp_hora: string;
    costo_depreciacion_clp_hora: string;
    desperdicio_pct: string;
    iva_pct: string;
  };
  margen: string;
};

/** La impresora manda en los costos de máquina; settings solo en luz e IVA. */
function overridesDe(
  settings: UserSettings,
  printer: Printer | undefined,
): Draft["overrides"] {
  return {
    tarifa_luz_clp_kwh: String(settings.tarifa_luz_clp_kwh ?? 0),
    consumo_impresora_w: String(printer?.consumo_w ?? 0),
    tarifa_mano_obra_clp_hora: String(printer?.tarifa_mano_obra_clp_hora ?? 0),
    costo_depreciacion_clp_hora: String(
      printer?.costo_depreciacion_clp_hora ?? 0,
    ),
    desperdicio_pct: String(printer?.desperdicio_pct_default ?? 0),
    iva_pct: String(settings.iva_pct ?? 19),
  };
}

function elegirDefault(printers: Printer[]): Printer | undefined {
  return printers.find((p) => p.es_default) ?? printers[0];
}

function draftInicial(settings: UserSettings, printers: Printer[]): Draft {
  const printer = elegirDefault(printers);
  return {
    nombre: "",
    horas: "",
    notas: "",
    printer_id: printer?.id ?? "",
    usoPersonal: false,
    seleccion: [{ filament_id: "", gramos: "" }],
    // Vacío a propósito: la mayoría de las impresiones no lleva insumos y una
    // fila en blanco de más solo estorba.
    insumos: [],
    overrides: overridesDe(settings, printer),
    margen: "0",
  };
}

function draftFromPrint(
  print: Print,
  settings: UserSettings,
  printers: Printer[],
): Draft {
  const printer =
    printers.find((p) => p.id === print.printer_id) ?? elegirDefault(printers);

  return {
    nombre: print.nombre_proyecto,
    horas: String(print.tiempo_impresion_horas),
    notas: print.notas ?? "",
    printer_id: printer?.id ?? "",
    usoPersonal: Boolean(print.uso_personal),
    seleccion:
      print.filamentos_usados?.length > 0
        ? print.filamentos_usados.map((f) => ({
            filament_id: f.filament_id,
            gramos: String(f.gramos),
          }))
        : [{ filament_id: "", gramos: "" }],
    insumos: (print.insumos_usados ?? []).map((i) => ({
      item_id: i.item_id,
      cantidad: String(i.cantidad),
    })),
    overrides: {
      // Los costos por hora no se persisten en prints: los reconstruimos
      // dividiendo el monto guardado por las horas, y el resto sale de la máquina.
      tarifa_luz_clp_kwh: String(settings.tarifa_luz_clp_kwh ?? 0),
      consumo_impresora_w: String(printer?.consumo_w ?? 0),
      tarifa_mano_obra_clp_hora:
        Number(print.tiempo_impresion_horas) > 0
          ? String(
              Number(print.costo_mano_obra) /
                Number(print.tiempo_impresion_horas),
            )
          : String(printer?.tarifa_mano_obra_clp_hora ?? 0),
      costo_depreciacion_clp_hora:
        Number(print.tiempo_impresion_horas) > 0
          ? String(
              Number(print.costo_depreciacion) /
                Number(print.tiempo_impresion_horas),
            )
          : String(printer?.costo_depreciacion_clp_hora ?? 0),
      desperdicio_pct: String(print.desperdicio_pct),
      // Un cálculo de uso personal se guardó con IVA 0: si acá lo destildan,
      // tiene que reaparecer el IVA del usuario y no un cero heredado.
      iva_pct: String(
        print.uso_personal ? (settings.iva_pct ?? 19) : print.iva_pct,
      ),
    },
    margen: String(print.margen_pct),
  };
}

const toNum = (v: string) => {
  const parsed = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function PrintCalculator({
  settings,
  filamentos,
  impresoras,
  insumos,
  userId,
  print,
}: {
  settings: UserSettings;
  filamentos: Filament[];
  impresoras: Printer[];
  /** Solo los activos marcados como usables en cálculos. */
  insumos: InventoryItem[];
  userId: string;
  print?: Print;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    savePrint,
    {},
  );
  const isEdit = Boolean(print);

  const [draft, setDraftState] = useState<Draft>(() =>
    print
      ? draftFromPrint(print, settings, impresoras)
      : draftInicial(settings, impresoras),
  );
  const [draftRestaurado, setDraftRestaurado] = useState(false);
  const [mostrarOverrides, setMostrarOverrides] = useState(false);

  // Recuperar borrador en progreso (solo para cálculos nuevos). localStorage no
  // existe en el servidor, así que la lectura tiene que ocurrir tras montar:
  // hacerlo en el initializer de useState rompería la hidratación.
  useEffect(() => {
    if (isEdit || !userId) return;
    const saved = getDraft<Draft>(userId);
    if (saved?.nombre || saved?.horas) {
      // Un borrador guardado antes de multi-impresora no trae printer_id, y uno
      // viejo puede apuntar a una máquina ya eliminada: caemos a la default.
      const printerValido = impresoras.some((p) => p.id === saved.printer_id);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización inicial desde un sistema externo (localStorage)
      setDraftState({
        ...saved,
        // Los borradores anteriores al inventario no traen esta lista.
        insumos: saved.insumos ?? [],
        // Ni los anteriores al uso personal, esta bandera.
        usoPersonal: saved.usoPersonal ?? false,
        printer_id: printerValido
          ? saved.printer_id
          : (elegirDefault(impresoras)?.id ?? ""),
      });
      setDraftRestaurado(true);
    }
  }, [isEdit, userId, impresoras]);

  // Autoguardado del formulario no enviado.
  useEffect(() => {
    if (isEdit || !userId) return;
    if (!draft.nombre && !draft.horas) return;
    const t = setTimeout(() => setDraft(userId, draft), 400);
    return () => clearTimeout(t);
  }, [draft, isEdit, userId]);

  // Al guardar con éxito la acción redirige, pero si vuelve un error mantenemos el borrador.
  useEffect(() => {
    if (state.ok && userId) clearDraft(userId);
  }, [state.ok, userId]);

  const filamentosPorId = useMemo(
    () => new Map(filamentos.map((f) => [f.id, f])),
    [filamentos],
  );

  const insumosPorId = useMemo(
    () => new Map(insumos.map((i) => [i.id, i])),
    [insumos],
  );

  const impresoraActual = impresoras.find((p) => p.id === draft.printer_id);

  // Cambiar de máquina reemplaza sus cuatro costos; luz e IVA son del usuario.
  const cambiarImpresora = (printerId: string) =>
    setDraftState((prev) => {
      const printer = impresoras.find((p) => p.id === printerId);
      return {
        ...prev,
        printer_id: printerId,
        overrides: {
          ...prev.overrides,
          consumo_impresora_w: String(printer?.consumo_w ?? 0),
          tarifa_mano_obra_clp_hora: String(
            printer?.tarifa_mano_obra_clp_hora ?? 0,
          ),
          costo_depreciacion_clp_hora: String(
            printer?.costo_depreciacion_clp_hora ?? 0,
          ),
          desperdicio_pct: String(printer?.desperdicio_pct_default ?? 0),
        },
      };
    });

  const seleccionValida: FilamentoUsado[] = draft.seleccion
    .filter((s) => s.filament_id && toNum(s.gramos) > 0)
    .map((s) => ({ filament_id: s.filament_id, gramos: toNum(s.gramos) }));

  // La previsualización resuelve el costo desde el catálogo; al guardar, el
  // servidor lo vuelve a buscar y es ese el que queda congelado.
  const insumosValidos: InsumoUsado[] = draft.insumos.flatMap((s) => {
    const item = insumosPorId.get(s.item_id);
    const cantidad = toNum(s.cantidad);
    if (!item || cantidad <= 0) return [];
    return [
      {
        item_id: item.id,
        cantidad,
        costo_unitario: Number(item.costo_clp_unidad),
        aplica_desperdicio: item.aplica_desperdicio,
      },
    ];
  });

  // Lo que se cobra de más solo existe si hay a quién cobrárselo: para uso
  // propio el margen y el IVA valen 0 en la previsualización, igual que después
  // los va a forzar el servidor. Los valores del formulario se conservan para
  // que destildar la casilla los devuelva tal como estaban.
  const margenEfectivo = draft.usoPersonal ? 0 : toNum(draft.margen);
  const ivaEfectivo = draft.usoPersonal
    ? 0
    : toNum(draft.overrides.iva_pct);

  const breakdown = calcularCostos({
    tiempoImpresionHoras: toNum(draft.horas),
    filamentosUsados: seleccionValida,
    filamentos,
    insumosUsados: insumosValidos,
    tarifaLuzClpKwh: toNum(draft.overrides.tarifa_luz_clp_kwh),
    consumoImpresoraW: toNum(draft.overrides.consumo_impresora_w),
    tarifaManoObraClpHora: toNum(draft.overrides.tarifa_mano_obra_clp_hora),
    costoDepreciacionClpHora: toNum(
      draft.overrides.costo_depreciacion_clp_hora,
    ),
    desperdicioPct: toNum(draft.overrides.desperdicio_pct),
    ivaPct: ivaEfectivo,
    margenPct: margenEfectivo,
  });

  const excesos = draft.seleccion
    .map((s) => {
      const f = filamentosPorId.get(s.filament_id);
      if (!f) return null;
      const gramos = toNum(s.gramos);
      return gramos > Number(f.stock_gramos)
        ? { filament: f, gramos, stock: Number(f.stock_gramos) }
        : null;
    })
    .filter(Boolean) as { filament: Filament; gramos: number; stock: number }[];

  const excesosInsumos = draft.insumos
    .map((s) => {
      const item = insumosPorId.get(s.item_id);
      if (!item) return null;
      const cantidad = toNum(s.cantidad);
      return cantidad > Number(item.stock) ? { item, cantidad } : null;
    })
    .filter(Boolean) as { item: InventoryItem; cantidad: number }[];

  const idsUsados = draft.seleccion.map((s) => s.filament_id).filter(Boolean);
  const duplicados = idsUsados.length !== new Set(idsUsados).size;

  const idsInsumos = draft.insumos.map((s) => s.item_id).filter(Boolean);
  const duplicadosInsumos = idsInsumos.length !== new Set(idsInsumos).size;

  const update = (patch: Partial<Draft>) =>
    setDraftState((prev) => ({ ...prev, ...patch }));

  const updateOverride = (key: keyof Draft["overrides"], value: string) =>
    setDraftState((prev) => ({
      ...prev,
      overrides: { ...prev.overrides, [key]: value },
    }));

  const updateSeleccion = (
    index: number,
    patch: Partial<{ filament_id: string; gramos: string }>,
  ) =>
    setDraftState((prev) => ({
      ...prev,
      seleccion: prev.seleccion.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    }));

  const updateInsumo = (
    index: number,
    patch: Partial<{ item_id: string; cantidad: string }>,
  ) =>
    setDraftState((prev) => ({
      ...prev,
      insumos: prev.insumos.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    }));

  if (impresoras.length === 0) {
    return (
      <GlassPanel>
        <EmptyState
          title="Necesitas al menos una impresora activa"
          description="Cada impresora aporta su consumo, mano de obra, depreciación y desperdicio al cálculo."
          action={
            <Link href="/dashboard/impresoras" className="btn-primary mt-2">
              Agregar impresora
            </Link>
          }
        />
      </GlassPanel>
    );
  }

  if (filamentos.length === 0) {
    return (
      <GlassPanel>
        <EmptyState
          title="Necesitas al menos un filamento activo"
          description="La calculadora usa el costo por kilo de tus filamentos para estimar el costo de material."
          action={
            <Link href="/dashboard/filamentos" className="btn-primary mt-2">
              Agregar filamento
            </Link>
          }
        />
      </GlassPanel>
    );
  }

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      {print && <input type="hidden" name="id" value={print.id} />}
      <input type="hidden" name="printer_id" value={draft.printer_id} />
      {/* Va como hidden y no como checkbox con `name`: uno destildado no viaja
          en el FormData y el servidor no podría distinguirlo de un campo ausente. */}
      <input
        type="hidden"
        name="uso_personal"
        value={String(draft.usoPersonal)}
      />
      <input
        type="hidden"
        name="filamentos_usados"
        value={JSON.stringify(seleccionValida)}
      />
      {/* Solo qué y cuánto: el precio lo resuelve el servidor contra la base. */}
      <input
        type="hidden"
        name="insumos_usados"
        value={JSON.stringify(
          insumosValidos.map(({ item_id, cantidad }) => ({
            item_id,
            cantidad,
          })),
        )}
      />
      {(
        Object.keys(draft.overrides) as (keyof Draft["overrides"])[]
      ).map((key) => (
        <input
          key={key}
          type="hidden"
          name={key}
          value={draft.overrides[key]}
        />
      ))}
      <input type="hidden" name="margen_pct" value={draft.margen} />

      <div className="space-y-6">
        {draftRestaurado && (
          <Alert tone="info">
            Recuperamos un borrador que habías dejado sin guardar.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => {
                setDraftState(draftInicial(settings, impresoras));
                clearDraft(userId);
                setDraftRestaurado(false);
              }}
            >
              Empezar de cero
            </button>
          </Alert>
        )}

        <GlassPanel title="Proyecto">
          <div className="grid gap-5 sm:grid-cols-[1.5fr_1fr]">
            <div>
              <label className="field-label" htmlFor="nombre_proyecto">
                Nombre del proyecto
              </label>
              <input
                id="nombre_proyecto"
                name="nombre_proyecto"
                required
                value={draft.nombre}
                onChange={(e) => update({ nombre: e.target.value })}
                className="field-input"
                placeholder="Soporte de audífonos v2"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="tiempo_impresion_horas">
                Tiempo de impresión
              </label>
              <div className="relative">
                <input
                  id="tiempo_impresion_horas"
                  name="tiempo_impresion_horas"
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={draft.horas}
                  onChange={(e) => update({ horas: e.target.value })}
                  className="field-input-num pr-12"
                  placeholder="4.5"
                />
                <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-white/40">
                  h
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-white/[0.08] pt-5">
            <label className="field-label" htmlFor="impresora">
              Impresora
            </label>
            <div className="grid grid-cols-[auto_1fr] items-center gap-3">
              <span
                className="h-9 w-9 shrink-0 rounded-xl border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]"
                style={{
                  backgroundColor:
                    impresoraActual?.color_hex ?? "rgba(255,255,255,0.08)",
                }}
                aria-hidden
              />
              <select
                id="impresora"
                value={draft.printer_id}
                onChange={(e) => cambiarImpresora(e.target.value)}
                className="field-input"
              >
                {impresoras.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#1a1e25]">
                    {p.nombre}
                    {p.marca || p.modelo
                      ? ` · ${[p.marca, p.modelo].filter(Boolean).join(" ")}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Aporta consumo, mano de obra, depreciación y desperdicio. Puedes
              ajustarlos abajo solo para este cálculo.
            </p>
          </div>
        </GlassPanel>

        <GlassPanel
          title="Filamentos"
          description={`Hasta ${MAX_FILAMENTOS} por impresión (multi-color)`}
          actions={
            draft.seleccion.length < MAX_FILAMENTOS ? (
              <button
                type="button"
                className="btn-ghost !py-2 text-xs"
                onClick={() =>
                  update({
                    seleccion: [
                      ...draft.seleccion,
                      { filament_id: "", gramos: "" },
                    ],
                  })
                }
              >
                + Agregar
              </button>
            ) : null
          }
        >
          <div className="space-y-3">
            {draft.seleccion.map((slot, index) => {
              const f = filamentosPorId.get(slot.filament_id);
              return (
                // En mobile los gramos bajan a una fila propia: con el select y
                // el input en la misma línea, el nombre del filamento no entra.
                <div
                  key={index}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:grid-cols-[auto_1fr_7rem_auto]"
                >
                  <span
                    className="h-9 w-9 rounded-full border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]"
                    style={{
                      backgroundColor: f?.color_hex ?? "rgba(255,255,255,0.08)",
                    }}
                    aria-hidden
                  />
                  <select
                    value={slot.filament_id}
                    onChange={(e) =>
                      updateSeleccion(index, { filament_id: e.target.value })
                    }
                    className="field-input min-w-0"
                    aria-label={`Filamento ${index + 1}`}
                  >
                    <option value="" className="bg-[#1a1e25]">
                      Seleccionar filamento…
                    </option>
                    {filamentos.map((opt) => (
                      <option
                        key={opt.id}
                        value={opt.id}
                        className="bg-[#1a1e25]"
                      >
                        {opt.marca} {opt.material} · {opt.color_nombre} (
                        {formatGramos(opt.stock_gramos)})
                      </option>
                    ))}
                  </select>
                  <div className="relative col-span-3 row-start-2 sm:col-span-1 sm:col-start-3 sm:row-start-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={slot.gramos}
                      onChange={(e) =>
                        updateSeleccion(index, { gramos: e.target.value })
                      }
                      className="field-input-num pr-8"
                      placeholder="0"
                      aria-label={`Gramos filamento ${index + 1}`}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-white/40">
                      g
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        seleccion:
                          draft.seleccion.length === 1
                            ? [{ filament_id: "", gramos: "" }]
                            : draft.seleccion.filter((_, i) => i !== index),
                      })
                    }
                    className="col-start-3 row-start-1 rounded-lg px-2 py-2 text-muted transition hover:bg-white/[0.06] hover:text-white/85 sm:col-start-4"
                    aria-label="Quitar filamento"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          {duplicados && (
            <div className="mt-4">
              <Alert tone="warn">
                Hay un filamento repetido en la selección. Súmalos en una sola
                fila para que el descuento de stock sea correcto.
              </Alert>
            </div>
          )}

          {excesos.length > 0 && (
            <div className="mt-4">
              <Alert tone="warn">
                Estás usando más de lo que tienes en stock:{" "}
                {excesos
                  .map(
                    (e) =>
                      `${e.filament.marca} ${e.filament.color_nombre} (${formatGramos(e.gramos)} de ${formatGramos(e.stock)})`,
                  )
                  .join(", ")}
                . Puedes guardar igual, pero el stock quedará negativo al lanzar.
              </Alert>
            </div>
          )}

          {seleccionValida.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.08] pt-4">
              {seleccionValida.map((s) => {
                const f = filamentosPorId.get(s.filament_id);
                if (!f) return null;
                return (
                  <FilamentChip
                    key={s.filament_id}
                    colorHex={f.color_hex}
                    label={`${f.marca} ${f.material}`}
                    sublabel={f.color_nombre}
                    gramos={s.gramos}
                    size="sm"
                  />
                );
              })}
            </div>
          )}
        </GlassPanel>

        <GlassPanel
          title="Insumos"
          description="NFC, argollas, imanes… suman al costo y se descuentan al lanzar"
          actions={
            insumos.length > 0 && draft.insumos.length < MAX_INSUMOS ? (
              <button
                type="button"
                className="btn-ghost !py-2 text-xs"
                onClick={() =>
                  update({
                    insumos: [...draft.insumos, { item_id: "", cantidad: "1" }],
                  })
                }
              >
                + Agregar
              </button>
            ) : null
          }
        >
          {insumos.length === 0 ? (
            <p className="text-sm text-muted">
              No tienes insumos marcados como usables en cálculos.{" "}
              <Link href="/dashboard/inventario" className="underline">
                Ir al inventario
              </Link>
            </p>
          ) : draft.insumos.length === 0 ? (
            <p className="text-sm text-muted">
              Esta impresión no lleva insumos. Agrégalos si la pieza incluye un
              tag NFC, una argolla o cualquier otra cosa del inventario.
            </p>
          ) : (
            <div className="space-y-3">
              {draft.insumos.map((slot, index) => {
                const item = insumosPorId.get(slot.item_id);
                return (
                  // Mismo patrón que los filamentos: en mobile la cantidad baja
                  // a su propia fila para que el nombre del insumo no se corte.
                  <div
                    key={index}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:grid-cols-[auto_1fr_7rem_auto]"
                  >
                    <span
                      className="h-9 w-9 rounded-xl border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]"
                      style={{
                        backgroundColor:
                          item?.color_hex ?? "rgba(255,255,255,0.08)",
                      }}
                      aria-hidden
                    />
                    <select
                      value={slot.item_id}
                      onChange={(e) =>
                        updateInsumo(index, { item_id: e.target.value })
                      }
                      className="field-input min-w-0"
                      aria-label={`Insumo ${index + 1}`}
                    >
                      <option value="" className="bg-[#1a1e25]">
                        Seleccionar insumo…
                      </option>
                      {insumos.map((opt) => (
                        <option
                          key={opt.id}
                          value={opt.id}
                          className="bg-[#1a1e25]"
                        >
                          {opt.nombre} ({formatCantidad(opt.stock, opt.unidad)})
                        </option>
                      ))}
                    </select>
                    <div className="relative col-span-3 row-start-2 sm:col-span-1 sm:col-start-3 sm:row-start-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={slot.cantidad}
                        onChange={(e) =>
                          updateInsumo(index, { cantidad: e.target.value })
                        }
                        className="field-input-num pr-10"
                        placeholder="0"
                        aria-label={`Cantidad insumo ${index + 1}`}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-white/40">
                        {item?.unidad ?? ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        update({
                          insumos: draft.insumos.filter((_, i) => i !== index),
                        })
                      }
                      className="col-start-3 row-start-1 rounded-lg px-2 py-2 text-muted transition hover:bg-white/[0.06] hover:text-white/85 sm:col-start-4"
                      aria-label="Quitar insumo"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {duplicadosInsumos && (
            <div className="mt-4">
              <Alert tone="warn">
                Hay un insumo repetido. Súmalo en una sola fila para que el
                descuento de stock sea correcto.
              </Alert>
            </div>
          )}

          {excesosInsumos.length > 0 && (
            <div className="mt-4">
              <Alert tone="warn">
                Estás usando más de lo que tienes:{" "}
                {excesosInsumos
                  .map(
                    (e) =>
                      `${e.item.nombre} (${formatCantidad(e.cantidad, e.item.unidad)} de ${formatCantidad(e.item.stock, e.item.unidad)})`,
                  )
                  .join(", ")}
                . Puedes guardar igual, pero el stock quedará negativo al lanzar.
              </Alert>
            </div>
          )}

          {insumosValidos.length > 0 && (
            <div className="mt-5 flex items-center justify-between border-t border-white/[0.08] pt-4 text-sm">
              <span className="text-muted">Total insumos</span>
              <span className="num text-white/90">
                {formatCLP(breakdown.costoInsumos)}
              </span>
            </div>
          )}
        </GlassPanel>

        <GlassPanel
          title="Ajustes de esta impresión"
          description="Sobrescriben tu configuración global solo para este cálculo"
          actions={
            <button
              type="button"
              className="btn-ghost !py-2 text-xs"
              onClick={() => setMostrarOverrides((v) => !v)}
            >
              {mostrarOverrides ? "Ocultar" : "Mostrar"}
            </button>
          }
        >
          {/* La casilla vive acá y no arriba porque lo que hace es apagar los dos
              controles que le siguen: el IVA y el margen. */}
          <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 transition hover:bg-white/[0.07]">
            <input
              type="checkbox"
              checked={draft.usoPersonal}
              onChange={(e) => update({ usoPersonal: e.target.checked })}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF7A3D]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-white/90">
                Es para mí
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                Sin margen ni IVA: solo lo que te cuesta imprimirla. El
                desperdicio se sigue contando y el stock se descuenta igual al
                lanzar.
              </span>
            </span>
          </label>

          {mostrarOverrides && (
            <div className="mb-6 grid gap-5 sm:grid-cols-2">
              <OverrideField
                label="Tarifa de luz"
                suffix="CLP/kWh"
                step="0.01"
                value={draft.overrides.tarifa_luz_clp_kwh}
                onChange={(v) => updateOverride("tarifa_luz_clp_kwh", v)}
              />
              <OverrideField
                label="Consumo impresora"
                suffix="W"
                step="1"
                value={draft.overrides.consumo_impresora_w}
                onChange={(v) => updateOverride("consumo_impresora_w", v)}
              />
              <OverrideField
                label="Mano de obra"
                suffix="CLP/hora"
                step="1"
                value={draft.overrides.tarifa_mano_obra_clp_hora}
                onChange={(v) => updateOverride("tarifa_mano_obra_clp_hora", v)}
              />
              <OverrideField
                label="Depreciación"
                suffix="CLP/hora"
                step="1"
                value={draft.overrides.costo_depreciacion_clp_hora}
                onChange={(v) =>
                  updateOverride("costo_depreciacion_clp_hora", v)
                }
              />
              <OverrideField
                label="Desperdicio"
                suffix="%"
                step="0.1"
                max="100"
                value={draft.overrides.desperdicio_pct}
                onChange={(v) => updateOverride("desperdicio_pct", v)}
              />
              {!draft.usoPersonal && (
                <OverrideField
                  label="IVA"
                  suffix="%"
                  step="0.1"
                  max="100"
                  value={draft.overrides.iva_pct}
                  onChange={(v) => updateOverride("iva_pct", v)}
                />
              )}
            </div>
          )}

          {draft.usoPersonal ? (
            <p className="text-sm text-muted">
              Esta impresión es para ti, así que no lleva margen ni IVA. Su
              precio final es su costo.
            </p>
          ) : (
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label className="field-label !mb-0" htmlFor="margen">
                  Margen de ganancia
                </label>
                <span className="num text-sm font-semibold text-accent">
                  {toNum(draft.margen)}%
                </span>
              </div>
              <input
                id="margen"
                type="range"
                min="0"
                max="500"
                step="5"
                value={draft.margen}
                onChange={(e) => update({ margen: e.target.value })}
                className="w-full accent-[#FF7A3D]"
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted">
                <span>0%</span>
                <span>250%</span>
                <span>500%</span>
              </div>
            </div>
          )}

          <div className="mt-5">
            <label className="field-label" htmlFor="notas">
              Notas
            </label>
            <textarea
              id="notas"
              name="notas"
              rows={2}
              value={draft.notas}
              onChange={(e) => update({ notas: e.target.value })}
              className="field-input resize-y"
              placeholder="Boquilla 0.4, relleno 15%, cliente…"
            />
          </div>
        </GlassPanel>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <GlassPanel title="Desglose de costos">
          <CostLayerStack
            breakdown={breakdown}
            desperdicioPct={toNum(draft.overrides.desperdicio_pct)}
            margenPct={margenEfectivo}
            ivaPct={ivaEfectivo}
            usoPersonal={draft.usoPersonal}
          />

          <div className="mt-5 space-y-3 border-t border-white/[0.08] pt-5">
            {!draft.usoPersonal && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Ganancia estimada</span>
                <span className="num text-white/90">
                  {formatCLP(breakdown.precioNeto - breakdown.costoTotal)}
                </span>
              </div>
            )}

            {state.error && <Alert>{state.error}</Alert>}

            <SubmitButton className="btn-primary w-full">
              {isEdit ? "Guardar cambios" : "Guardar como borrador"}
            </SubmitButton>
            <p className="text-center text-xs text-muted">
              Se guarda como borrador. El stock se descuenta al lanzar la
              impresión.
            </p>
          </div>
        </GlassPanel>
      </div>
    </form>
  );
}

function OverrideField({
  label,
  suffix,
  step,
  max,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  step: string;
  max?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="relative">
        <input
          type="number"
          step={step}
          min="0"
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field-input-num pr-20"
        />
        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-white/40">
          {suffix}
        </span>
      </div>
    </div>
  );
}
