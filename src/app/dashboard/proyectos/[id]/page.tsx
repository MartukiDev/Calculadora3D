import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlassPanel } from "@/components/GlassPanel";
import { ProjectCostStack } from "@/components/ProjectCostStack";
import { Alert, ProjectStatusBadge } from "@/components/ui";
import { formatCLP, formatDate, formatHoras } from "@/lib/format";
import { breakdownDeProyecto, consolidarMateriales } from "@/lib/project";
import type {
  Filament,
  InventoryItem,
  Print,
  Printer,
  Project,
} from "@/lib/types";
import { MaterialsList } from "./MaterialsList";
import { ProjectActions } from "./ProjectActions";

export default async function ProyectoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ guardado?: string }>;
}) {
  const { id } = await params;
  const { guardado } = await searchParams;

  const supabase = await createClient();

  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const project = data as Project;

  const { data: printData } = project.print_id
    ? await supabase
        .from("prints")
        .select("*")
        .eq("id", project.print_id)
        .maybeSingle()
    : { data: null };

  const print = printData as Print | null;

  // Los ids a resolver salen del cálculo y de los insumos de armado juntos: la
  // lista consolidada los mezcla en una sola fila por material.
  const filamentIds = (print?.filamentos_usados ?? []).map(
    (f) => f.filament_id,
  );
  const insumoIds = [
    ...new Set([
      ...(print?.insumos_usados ?? []).map((i) => i.item_id),
      ...(project.insumos_usados ?? []).map((i) => i.item_id),
    ]),
  ];

  const [{ data: filamentsData }, { data: itemsData }, { data: printerData }] =
    await Promise.all([
      filamentIds.length
        ? supabase.from("filaments").select("*").in("id", filamentIds)
        : Promise.resolve({ data: [] }),
      insumoIds.length
        ? supabase.from("inventory_items").select("*").in("id", insumoIds)
        : Promise.resolve({ data: [] }),
      print?.printer_id
        ? supabase
            .from("printers")
            .select("*")
            .eq("id", print.printer_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const impresora = printerData as Printer | null;

  const breakdown = breakdownDeProyecto(project, print);

  const materiales = consolidarMateriales({
    print,
    insumosProyecto: project.insumos_usados ?? [],
    cantidad: Number(project.cantidad),
    filamentos: (filamentsData ?? []) as Filament[],
    items: (itemsData ?? []) as InventoryItem[],
  });

  const lanzado = project.status === "lanzado";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/dashboard/proyectos"
            className="text-sm text-muted hover:text-white/85"
          >
            ← Proyectos
          </Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-semibold text-white/95">
            <span
              className="h-7 w-7 shrink-0 rounded-lg border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]"
              style={{ backgroundColor: project.color_hex }}
              aria-hidden
            />
            <span className="break-words">{project.nombre}</span>
            <ProjectStatusBadge status={project.status} />
          </h1>
          {project.descripcion && (
            <p className="mt-1 text-sm text-white/70">{project.descripcion}</p>
          )}
          <p className="mt-1 text-sm text-muted">
            Creado el {formatDate(project.created_at)}
            {project.fecha_lanzamiento &&
              ` · Lanzado el ${formatDate(project.fecha_lanzamiento)}`}
          </p>
        </div>

        <ProjectActions
          projectId={project.id}
          status={project.status}
          cantidad={Number(project.cantidad)}
          sinCalculo={!print}
          hayFaltantes={materiales.hayFaltantes}
        />
      </div>

      {guardado && <Alert tone="success">Proyecto guardado como borrador.</Alert>}

      {lanzado && (
        <Alert tone="info">
          Este proyecto ya descontó su stock y tiene los costos congelados. Editar
          el cálculo de ahora en adelante no lo modifica.
        </Alert>
      )}

      {!lanzado && materiales.hayFaltantes && (
        <Alert tone="warn">
          El stock actual no alcanza para producir las {Number(project.cantidad)}{" "}
          unidades. Puedes lanzar igual, pero el inventario quedará negativo.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <GlassPanel title="Producto">
            {print ? (
              <Link
                href={`/dashboard/calculos/${print.id}`}
                className="glass-row mb-5 flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.07]"
              >
                <span
                  className="h-9 w-9 shrink-0 rounded-xl border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]"
                  style={{
                    backgroundColor:
                      impresora?.color_hex ?? "rgba(255,255,255,0.08)",
                  }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white/90">
                    {print.nombre_proyecto}
                  </p>
                  <p className="num truncate text-xs text-muted">
                    {formatHoras(print.tiempo_impresion_horas)} ·{" "}
                    {impresora?.nombre ?? "Sin impresora"}
                  </p>
                </div>
                <span className="num text-sm text-white/90">
                  {formatCLP(print.costo_total)}
                </span>
              </Link>
            ) : (
              <div className="mb-5">
                <Alert tone="warn">
                  Este proyecto no tiene cálculo asociado, así que solo se cuentan
                  los insumos de armado.{" "}
                  {!lanzado && (
                    <Link
                      href={`/dashboard/proyectos/${project.id}/editar`}
                      className="underline"
                    >
                      Asociar uno
                    </Link>
                  )}
                </Alert>
              </div>
            )}

            <dl className="grid grid-cols-2 gap-5 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted">Unidades</dt>
                <dd className="num mt-1 text-white/90">
                  {Number(project.cantidad)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Costo c/u</dt>
                <dd className="num mt-1 text-white/90">
                  {formatCLP(breakdown.costoUnitario)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Margen</dt>
                <dd className="num mt-1 text-white/90">{project.margen_pct}%</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">IVA</dt>
                <dd className="num mt-1 text-white/90">{project.iva_pct}%</dd>
              </div>
            </dl>

            {project.notas && (
              <div className="mt-5 border-t border-white/[0.08] pt-4">
                <p className="text-xs text-muted">Notas</p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-white/80">
                  {project.notas}
                </p>
              </div>
            )}
          </GlassPanel>

          <GlassPanel
            title="Materiales"
            description="Todo lo que consume el lote, en una sola lista"
          >
            <MaterialsList
              materiales={materiales}
              cantidad={Number(project.cantidad)}
            />
          </GlassPanel>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <GlassPanel title="Costo y precio">
            <ProjectCostStack
              breakdown={breakdown}
              margenPct={Number(project.margen_pct)}
              ivaPct={Number(project.iva_pct)}
            />
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
