"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alert, CacheBadge, EmptyState, ProjectStatusBadge } from "@/components/ui";
import { projectsCache } from "@/lib/cache";
import { formatCLP, formatDate } from "@/lib/format";
import type { Project } from "@/lib/types";

/**
 * Fila ya resuelta en el servidor: el costo de un proyecto en borrador depende
 * del cálculo asociado, y no queremos una consulta por fila desde el cliente.
 */
export type ProjectListItem = {
  project: Project;
  printNombre: string | null;
  costoTotal: number;
  precioFinal: number;
};

export function ProjectsManager({
  items,
  userId,
  loadError,
}: {
  items: ProjectListItem[];
  userId: string;
  loadError: string | null;
}) {
  const [mostrarLanzados, setMostrarLanzados] = useState(false);

  // Fallback offline: si la carga desde Supabase falló, servimos la caché. Los
  // borradores pierden su costo porque se deriva del cálculo, que no cacheamos;
  // los lanzados lo tienen congelado en la fila y sobreviven completos.
  const cached = useMemo(() => {
    if (!loadError || !userId) return null;
    const guardados = projectsCache.get(userId)?.data;
    if (!guardados) return null;
    return guardados.map<ProjectListItem>((project) => ({
      project,
      printNombre: null,
      costoTotal: Number(project.costo_total),
      precioFinal: Number(project.precio_final_con_iva),
    }));
  }, [loadError, userId]);

  const lista = cached ?? items;

  useEffect(() => {
    if (!loadError && userId)
      projectsCache.set(
        userId,
        items.map((i) => i.project),
      );
  }, [loadError, userId, items]);

  const borradores = lista.filter((i) => i.project.status === "borrador");
  const lanzados = lista.filter((i) => i.project.status === "lanzado");
  const visibles = mostrarLanzados ? lanzados : borradores;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white/95">Proyectos</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            Un cálculo en cantidad, con sus insumos de armado y su propio margen
            {cached && <CacheBadge />}
          </p>
        </div>
        <Link href="/dashboard/proyectos/nuevo" className="btn-primary">
          Nuevo proyecto
        </Link>
      </div>

      {loadError && !cached && (
        <Alert>No pudimos cargar tus proyectos: {loadError}</Alert>
      )}

      <div className="flex gap-1">
        <TabButton
          active={!mostrarLanzados}
          onClick={() => setMostrarLanzados(false)}
        >
          Borradores ({borradores.length})
        </TabButton>
        <TabButton
          active={mostrarLanzados}
          onClick={() => setMostrarLanzados(true)}
        >
          Lanzados ({lanzados.length})
        </TabButton>
      </div>

      {visibles.length === 0 ? (
        <EmptyState
          title={
            mostrarLanzados
              ? "Todavía no lanzaste ningún proyecto"
              : "No tienes proyectos en borrador"
          }
          description="Un proyecto toma un cálculo, lo multiplica por las unidades que vas a producir y le suma lo que lleva el armado. Te dice cuánto material necesitas y a qué precio vender."
          action={
            !mostrarLanzados ? (
              <Link href="/dashboard/proyectos/nuevo" className="btn-primary mt-2">
                Crear proyecto
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {visibles.map(({ project, printNombre, costoTotal, precioFinal }) => (
            <li key={project.id}>
              <Link
                href={`/dashboard/proyectos/${project.id}`}
                className="glass-row flex flex-wrap items-center gap-4 px-4 py-4 transition hover:bg-white/[0.07]"
              >
                <span
                  className="h-10 w-10 shrink-0 rounded-xl border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]"
                  style={{ backgroundColor: project.color_hex }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-white/95">
                    <span className="truncate">{project.nombre}</span>
                    <ProjectStatusBadge status={project.status} />
                  </p>
                  <p className="truncate text-xs text-muted">
                    <span className="num">{Number(project.cantidad)}</span>{" "}
                    unidades
                    {printNombre ? ` · ${printNombre}` : " · sin cálculo"} ·{" "}
                    {formatDate(project.fecha_lanzamiento ?? project.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-sm font-semibold text-accent">
                    {formatCLP(precioFinal)}
                  </p>
                  <p className="num text-[11px] text-muted">
                    costo {formatCLP(costoTotal)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm transition ${
        active
          ? "bg-accent-soft text-accent shadow-[inset_0_0_0_1px_rgba(196,245,60,0.28)]"
          : "text-muted hover:bg-white/[0.06] hover:text-white/85"
      }`}
    >
      {children}
    </button>
  );
}
