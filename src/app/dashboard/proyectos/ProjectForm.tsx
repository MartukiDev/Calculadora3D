"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { saveProject, type ActionState } from "@/app/dashboard/actions";
import { GlassPanel } from "@/components/GlassPanel";
import { ProjectCostStack } from "@/components/ProjectCostStack";
import { Alert, EmptyState, SubmitButton } from "@/components/ui";
import { formatCantidad, formatCLP } from "@/lib/format";
import { calcularProyecto } from "@/lib/project";
import {
  MAX_CANTIDAD_PROYECTO,
  MAX_INSUMOS,
  type InsumoUsado,
  type InventoryItem,
  type Print,
  type Project,
} from "@/lib/types";

const toNum = (v: string) => {
  const parsed = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function ProjectForm({
  project,
  prints,
  insumos,
  ivaDefault,
  printIdInicial,
}: {
  project?: Project;
  /** Cálculos en borrador que no están tomados por otro proyecto. */
  prints: Print[];
  /** Solo los activos marcados como usables en cálculos. */
  insumos: InventoryItem[];
  ivaDefault: number;
  /** Preselección al llegar desde un cálculo con «Crear proyecto». */
  printIdInicial?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveProject,
    {},
  );
  const isEdit = Boolean(project);

  const [nombre, setNombre] = useState(project?.nombre ?? "");
  const [colorHex, setColorHex] = useState(project?.color_hex ?? "#C4F53C");
  const [printId, setPrintId] = useState(
    project?.print_id ?? printIdInicial ?? "",
  );
  const [cantidad, setCantidad] = useState(
    project ? String(project.cantidad) : "1",
  );
  const [margen, setMargen] = useState(
    project ? String(project.margen_pct) : "0",
  );
  const [iva, setIva] = useState(
    String(project?.iva_pct ?? ivaDefault ?? 19),
  );
  const [lineas, setLineas] = useState<{ item_id: string; cantidad: string }[]>(
    () =>
      (project?.insumos_usados ?? []).map((i) => ({
        item_id: i.item_id,
        cantidad: String(i.cantidad),
      })),
  );

  const insumosPorId = useMemo(
    () => new Map(insumos.map((i) => [i.id, i])),
    [insumos],
  );

  const printActual = prints.find((p) => p.id === printId);

  // Previsualización: el servidor vuelve a buscar los costos reales al guardar.
  const insumosValidos: InsumoUsado[] = lineas.flatMap((l) => {
    const item = insumosPorId.get(l.item_id);
    const cant = toNum(l.cantidad);
    if (!item || cant <= 0) return [];
    return [
      {
        item_id: item.id,
        cantidad: cant,
        costo_unitario: Number(item.costo_clp_unidad),
        aplica_desperdicio: item.aplica_desperdicio,
      },
    ];
  });

  const breakdown = calcularProyecto({
    costoPiezaUnitario: Number(printActual?.costo_total ?? 0),
    insumosUsados: insumosValidos,
    cantidad: toNum(cantidad),
    margenPct: toNum(margen),
    ivaPct: toNum(iva),
  });

  const idsUsados = lineas.map((l) => l.item_id).filter(Boolean);
  const duplicados = idsUsados.length !== new Set(idsUsados).size;

  const updateLinea = (
    index: number,
    patch: Partial<{ item_id: string; cantidad: string }>,
  ) =>
    setLineas((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );

  if (!isEdit && prints.length === 0) {
    return (
      <GlassPanel>
        <EmptyState
          title="No tienes cálculos disponibles"
          description="Un proyecto necesita un cálculo en borrador, que no esté ya tomado por otro proyecto y que no sea de uso personal. Crea uno con la calculadora y vuelve."
          action={
            <Link href="/dashboard/calculos/nuevo" className="btn-primary mt-2">
              Ir a la calculadora
            </Link>
          }
        />
      </GlassPanel>
    );
  }

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      {project && <input type="hidden" name="id" value={project.id} />}
      <input type="hidden" name="color_hex" value={colorHex} />
      <input type="hidden" name="print_id" value={printId} />
      <input type="hidden" name="margen_pct" value={margen} />
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

      <div className="space-y-6">
        <GlassPanel title="Proyecto">
          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div>
              <label className="field-label" htmlFor="nombre">
                Nombre
              </label>
              <input
                id="nombre"
                name="nombre"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="field-input"
                placeholder="Llaveros NFC · pedido marzo"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="color">
                Tono
              </label>
              <input
                id="color"
                type="color"
                value={colorHex}
                onChange={(e) => setColorHex(e.target.value)}
                className="h-[46px] w-16 cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] p-1"
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="field-label" htmlFor="descripcion">
              Descripción
            </label>
            <input
              id="descripcion"
              name="descripcion"
              defaultValue={project?.descripcion ?? ""}
              className="field-input"
              placeholder="Para la feria, entrega 12 de abril"
            />
          </div>
        </GlassPanel>

        <GlassPanel
          title="Producto"
          description="El cálculo que se imprime y cuántas unidades vas a producir"
        >
          <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
            <div>
              <label className="field-label" htmlFor="print">
                Cálculo
              </label>
              <select
                id="print"
                value={printId}
                onChange={(e) => setPrintId(e.target.value)}
                className="field-input"
              >
                <option value="" className="bg-base-elevated">
                  Sin cálculo por ahora…
                </option>
                {prints.map((p) => (
                  <option key={p.id} value={p.id} className="bg-base-elevated">
                    {p.nombre_proyecto} · {formatCLP(p.costo_total)}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-muted">
                Solo cálculos en borrador que no estén tomados por otro proyecto.
                Su margen se ignora: el que manda es el del proyecto.
              </p>
            </div>
            <div>
              <label className="field-label" htmlFor="cantidad">
                Unidades
              </label>
              <input
                id="cantidad"
                name="cantidad"
                type="number"
                step="1"
                min="1"
                max={MAX_CANTIDAD_PROYECTO}
                required
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="field-input-num"
              />
            </div>
          </div>
        </GlassPanel>

        <GlassPanel
          title="Insumos de armado"
          description="Lo que lleva UNA unidad además de la impresión: pegamento, caja, manual"
          actions={
            insumos.length > 0 && lineas.length < MAX_INSUMOS ? (
              <button
                type="button"
                className="btn-ghost !py-2 text-xs"
                onClick={() =>
                  setLineas([...lineas, { item_id: "", cantidad: "1" }])
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
          ) : lineas.length === 0 ? (
            <p className="text-sm text-muted">
              Agrega solo lo que el cálculo todavía no contempla. Lo que ya está
              dentro de la impresión —un NFC embebido, por ejemplo— se suma solo.
            </p>
          ) : (
            <div className="space-y-3">
              {lineas.map((linea, index) => {
                const item = insumosPorId.get(linea.item_id);
                return (
                  // Mismo patrón que la calculadora: en mobile la cantidad baja
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
                      value={linea.item_id}
                      onChange={(e) =>
                        updateLinea(index, { item_id: e.target.value })
                      }
                      className="field-input min-w-0"
                      aria-label={`Insumo ${index + 1}`}
                    >
                      <option value="" className="bg-base-elevated">
                        Seleccionar insumo…
                      </option>
                      {insumos.map((opt) => (
                        <option
                          key={opt.id}
                          value={opt.id}
                          className="bg-base-elevated"
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
                        value={linea.cantidad}
                        onChange={(e) =>
                          updateLinea(index, { cantidad: e.target.value })
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
                        setLineas(lineas.filter((_, i) => i !== index))
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

          {duplicados && (
            <div className="mt-4">
              <Alert tone="warn">
                Hay un insumo repetido. Súmalo en una sola fila para que el
                descuento de stock sea correcto.
              </Alert>
            </div>
          )}
        </GlassPanel>

        <GlassPanel
          title="Precio de venta"
          description="El margen del proyecto reemplaza al del cálculo"
        >
          <div className="mb-2 flex items-baseline justify-between">
            <label className="field-label !mb-0" htmlFor="margen">
              Margen de ganancia
            </label>
            <span className="num text-sm font-semibold text-accent">
              {toNum(margen)}%
            </span>
          </div>
          <input
            id="margen"
            type="range"
            min="0"
            max="500"
            step="5"
            value={margen}
            onChange={(e) => setMargen(e.target.value)}
            className="w-full accent-[var(--color-accent)]"
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted">
            <span>0%</span>
            <span>250%</span>
            <span>500%</span>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="iva_pct">
                IVA
              </label>
              <div className="relative">
                <input
                  id="iva_pct"
                  name="iva_pct"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={iva}
                  onChange={(e) => setIva(e.target.value)}
                  className="field-input-num pr-8"
                />
                <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-white/40">
                  %
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <label className="field-label" htmlFor="notas">
              Notas
            </label>
            <textarea
              id="notas"
              name="notas"
              rows={2}
              defaultValue={project?.notas ?? ""}
              className="field-input resize-y"
              placeholder="Cliente, fecha de entrega, condiciones…"
            />
          </div>
        </GlassPanel>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <GlassPanel title="Costo y precio">
          {!printActual && (
            <div className="mb-5">
              <Alert tone="info">
                Sin cálculo asociado solo se cuentan los insumos de armado.
                Puedes asociarlo después.
              </Alert>
            </div>
          )}

          <ProjectCostStack
            breakdown={breakdown}
            margenPct={toNum(margen)}
            ivaPct={toNum(iva)}
          />

          <div className="mt-5 space-y-3 border-t border-white/[0.08] pt-5">
            {state.error && <Alert>{state.error}</Alert>}

            <SubmitButton className="btn-primary w-full">
              {isEdit ? "Guardar cambios" : "Crear proyecto"}
            </SubmitButton>
            <p className="text-center text-xs text-muted">
              Se guarda como borrador. El stock se descuenta al lanzar el
              proyecto.
            </p>
          </div>
        </GlassPanel>
      </div>
    </form>
  );
}

