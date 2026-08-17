import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CostLayerStack } from "@/components/CostLayerStack";
import { FilamentChip } from "@/components/FilamentChip";
import { GlassPanel } from "@/components/GlassPanel";
import { Alert, StatusBadge, UsoPersonalBadge } from "@/components/ui";
import {
  formatCantidad,
  formatCLP,
  formatDate,
  formatGramos,
  formatHoras,
} from "@/lib/format";
import type {
  Filament,
  InventoryItem,
  Print,
  Printer,
  Project,
} from "@/lib/types";
import { ClearDraft } from "../ClearDraft";
import { PrintActions } from "./PrintActions";

export default async function CalculoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ guardado?: string; lanzada?: string }>;
}) {
  const { id } = await params;
  const { guardado } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("prints")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const print = data as Print;

  const filamentIds = (print.filamentos_usados ?? []).map((f) => f.filament_id);
  const insumoIds = (print.insumos_usados ?? []).map((i) => i.item_id);

  const [
    { data: filamentsData },
    { data: printerData },
    { data: itemsData },
    { data: projectData },
  ] = await Promise.all([
    filamentIds.length
      ? supabase.from("filaments").select("*").in("id", filamentIds)
      : Promise.resolve({ data: [] }),
    print.printer_id
      ? supabase
          .from("printers")
          .select("*")
          .eq("id", print.printer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    insumoIds.length
      ? supabase.from("inventory_items").select("*").in("id", insumoIds)
      : Promise.resolve({ data: [] }),
    // Si el cálculo está dentro de un proyecto, el stock se descuenta desde ahí:
    // el proyecto es el que sabe cuántas unidades se van a producir.
    supabase
      .from("projects")
      .select("id, nombre, cantidad")
      .eq("print_id", id)
      .maybeSingle(),
  ]);

  const impresora = printerData as Printer | null;
  const proyecto = projectData as Pick<
    Project,
    "id" | "nombre" | "cantidad"
  > | null;

  const filamentos = new Map(
    ((filamentsData ?? []) as Filament[]).map((f) => [f.id, f]),
  );

  const insumos = new Map(
    ((itemsData ?? []) as InventoryItem[]).map((i) => [i.id, i]),
  );

  const breakdown = {
    costoFilamento: Number(print.costo_filamento),
    costoLuz: Number(print.costo_luz),
    costoManoObra: Number(print.costo_mano_obra),
    costoDepreciacion: Number(print.costo_depreciacion),
    costoInsumos: Number(print.costo_insumos),
    subtotal:
      Number(print.costo_filamento) +
      Number(print.costo_luz) +
      Number(print.costo_mano_obra) +
      Number(print.costo_depreciacion) +
      Number(print.costo_insumos),
    costoTotal: Number(print.costo_total),
    precioNeto: Number(print.precio_neto),
    precioFinalConIva: Number(print.precio_final_con_iva),
  };

  const filamentoInsuficiente = (print.filamentos_usados ?? []).filter((fu) => {
    const f = filamentos.get(fu.filament_id);
    return f && Number(fu.gramos) > Number(f.stock_gramos);
  });

  const insumoInsuficiente = (print.insumos_usados ?? []).filter((iu) => {
    const item = insumos.get(iu.item_id);
    return item && Number(iu.cantidad) > Number(item.stock);
  });

  const stockInsuficiente = [...filamentoInsuficiente, ...insumoInsuficiente];

  return (
    <div className="space-y-6">
      {guardado && <ClearDraft userId={user?.id ?? ""} />}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/dashboard/calculos"
            className="text-sm text-muted hover:text-white/85"
          >
            ← Historial
          </Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-semibold text-white/95">
            <span className="break-words">{print.nombre_proyecto}</span>
            <StatusBadge status={print.status} />
            {print.uso_personal && <UsoPersonalBadge />}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Creado el {formatDate(print.created_at)}
            {print.fecha_lanzamiento &&
              ` · Lanzado el ${formatDate(print.fecha_lanzamiento)}`}
          </p>
        </div>

        <PrintActions
          printId={print.id}
          status={print.status}
          stockInsuficiente={stockInsuficiente.length > 0}
          enProyecto={Boolean(proyecto)}
        />
      </div>

      {guardado && <Alert tone="success">Cálculo guardado como borrador.</Alert>}

      {proyecto && (
        <Alert tone="info">
          Este cálculo es parte del proyecto{" "}
          <Link
            href={`/dashboard/proyectos/${proyecto.id}`}
            className="font-medium underline"
          >
            {proyecto.nombre}
          </Link>
          {print.status === "borrador" && (
            <>
              {" "}
              ({Number(proyecto.cantidad)} unidades). El stock se descuenta al
              lanzar el proyecto, no desde acá.
            </>
          )}
        </Alert>
      )}

      {/* Un cálculo de uso propio no se ofrece para proyecto: el proyecto le
          aplicaría su margen a algo declarado sin precio. */}
      {!proyecto && !print.uso_personal && print.status === "borrador" && (
        <p className="text-sm text-muted">
          ¿Vas a producir varias unidades?{" "}
          <Link
            href={`/dashboard/proyectos/nuevo?calculo=${print.id}`}
            className="underline hover:text-white/85"
          >
            Crear un proyecto con este cálculo
          </Link>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <GlassPanel title="Impresión">
            <div className="mb-5 flex items-center gap-3 border-b border-white/[0.08] pb-4">
              <span
                className="h-9 w-9 shrink-0 rounded-xl border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]"
                style={{
                  backgroundColor: impresora?.color_hex ?? "rgba(255,255,255,0.08)",
                }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-xs text-muted">Impresora</p>
                <p className="truncate text-sm font-medium text-white/90">
                  {impresora?.nombre ?? "Sin impresora asociada"}
                </p>
                {impresora && (impresora.marca || impresora.modelo) && (
                  <p className="truncate text-xs text-muted">
                    {[impresora.marca, impresora.modelo]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                )}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-5 text-sm">
              <div>
                <dt className="text-xs text-muted">Tiempo</dt>
                <dd className="num mt-1 text-white/90">
                  {formatHoras(print.tiempo_impresion_horas)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Material total</dt>
                <dd className="num mt-1 text-white/90">
                  {formatGramos(
                    (print.filamentos_usados ?? []).reduce(
                      (acc, f) => acc + Number(f.gramos),
                      0,
                    ),
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Desperdicio</dt>
                <dd className="num mt-1 text-white/90">
                  {print.desperdicio_pct}%
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Margen</dt>
                <dd className="num mt-1 text-white/90">
                  {print.uso_personal ? "—" : `${print.margen_pct}%`}
                </dd>
              </div>
            </dl>

            {print.notas && (
              <div className="mt-5 border-t border-white/[0.08] pt-4">
                <p className="text-xs text-muted">Notas</p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-white/80">
                  {print.notas}
                </p>
              </div>
            )}
          </GlassPanel>

          <GlassPanel title="Filamentos usados">
            {(print.filamentos_usados ?? []).length === 0 ? (
              <p className="text-sm text-muted">Sin filamentos registrados.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {print.filamentos_usados.map((fu, i) => {
                  const f = filamentos.get(fu.filament_id);
                  return (
                    <li key={`${fu.filament_id}-${i}`}>
                      <FilamentChip
                        colorHex={f?.color_hex ?? "#6b7280"}
                        label={
                          f ? `${f.marca} ${f.material}` : "Filamento eliminado"
                        }
                        sublabel={f?.color_nombre}
                        gramos={Number(fu.gramos)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}

            {print.status === "borrador" && filamentoInsuficiente.length > 0 && (
              <div className="mt-4">
                <Alert tone="warn">
                  El stock actual no alcanza para todos los filamentos de este
                  cálculo. Si lanzas igual, el stock quedará negativo.
                </Alert>
              </div>
            )}
          </GlassPanel>

          {(print.insumos_usados ?? []).length > 0 && (
            <GlassPanel title="Insumos usados">
              <ul className="space-y-2">
                {print.insumos_usados.map((iu, i) => {
                  const item = insumos.get(iu.item_id);
                  return (
                    <li
                      key={`${iu.item_id}-${i}`}
                      className="glass-row flex items-center gap-3 px-4 py-3"
                    >
                      <span
                        className="h-8 w-8 shrink-0 rounded-lg border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]"
                        style={{
                          backgroundColor:
                            item?.color_hex ?? "rgba(255,255,255,0.08)",
                        }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white/90">
                          {item?.nombre ?? "Insumo eliminado"}
                        </p>
                        <p className="num mt-0.5 text-xs text-muted">
                          {formatCantidad(iu.cantidad, item?.unidad ?? "u")} ×{" "}
                          {formatCLP(iu.costo_unitario)}
                        </p>
                      </div>
                      <span className="num text-sm text-white/90">
                        {formatCLP(
                          Number(iu.cantidad) * Number(iu.costo_unitario),
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {print.status === "borrador" && insumoInsuficiente.length > 0 && (
                <div className="mt-4">
                  <Alert tone="warn">
                    El stock actual no alcanza para todos los insumos de este
                    cálculo. Si lanzas igual, el stock quedará negativo.
                  </Alert>
                </div>
              )}
            </GlassPanel>
          )}
        </div>

        <GlassPanel title="Desglose de costos">
          <CostLayerStack
            breakdown={breakdown}
            desperdicioPct={Number(print.desperdicio_pct)}
            margenPct={Number(print.margen_pct)}
            ivaPct={Number(print.iva_pct)}
            usoPersonal={print.uso_personal}
          />
        </GlassPanel>
      </div>
    </div>
  );
}
