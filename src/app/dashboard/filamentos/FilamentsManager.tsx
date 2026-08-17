"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deleteFilament,
  toggleFilamentActivo,
} from "@/app/dashboard/actions";
import { Alert, CacheBadge, EmptyState, Modal } from "@/components/ui";
import { filamentsCache } from "@/lib/cache";
import { formatCLP, formatGramos } from "@/lib/format";
import { STOCK_BAJO_GRAMOS, type Filament } from "@/lib/types";
import { FilamentForm } from "./FilamentForm";

export function FilamentsManager({
  filaments,
  userId,
  loadError,
}: {
  filaments: Filament[];
  userId: string;
  loadError: string | null;
}) {
  const [editing, setEditing] = useState<Filament | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Filament | null>(null);
  const [mostrarArchivados, setMostrarArchivados] = useState(false);

  // Fallback offline: si la carga desde Supabase falló, servimos la caché.
  const cached = useMemo(() => {
    if (!loadError || !userId) return null;
    return filamentsCache.get(userId)?.data ?? null;
  }, [loadError, userId]);

  const lista = cached ?? filaments;

  useEffect(() => {
    if (!loadError && userId) filamentsCache.set(userId, filaments);
  }, [loadError, userId, filaments]);

  const activos = lista.filter((f) => f.activo);
  const archivados = lista.filter((f) => !f.activo);
  const visibles = mostrarArchivados ? archivados : activos;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white/95">Filamentos</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            {activos.length} activo(s) · {archivados.length} archivado(s)
            {cached && <CacheBadge />}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
        >
          Agregar filamento
        </button>
      </div>

      {loadError && !cached && (
        <Alert>No pudimos cargar tus filamentos: {loadError}</Alert>
      )}

      <div className="flex gap-1">
        <TabButton
          active={!mostrarArchivados}
          onClick={() => setMostrarArchivados(false)}
        >
          Activos ({activos.length})
        </TabButton>
        <TabButton
          active={mostrarArchivados}
          onClick={() => setMostrarArchivados(true)}
        >
          Archivados ({archivados.length})
        </TabButton>
      </div>

      {visibles.length === 0 ? (
        <EmptyState
          title={
            mostrarArchivados
              ? "No hay filamentos archivados"
              : "Sin filamentos en inventario"
          }
          description="Registra marca, material, color, costo por kilo y stock disponible para poder calcular impresiones."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((f) => (
            <FilamentCard
              key={f.id}
              filament={f}
              onEdit={() => {
                setCreating(false);
                setEditing(f);
              }}
              onDelete={() => setConfirmDelete(f)}
            />
          ))}
        </div>
      )}

      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? "Editar filamento" : "Nuevo filamento"}
      >
        <FilamentForm
          filament={editing}
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Eliminar filamento"
      >
        <p className="text-sm text-white/75">
          Vas a eliminar{" "}
          <span className="font-medium text-white/90">
            {confirmDelete?.marca} {confirmDelete?.material} ·{" "}
            {confirmDelete?.color_nombre}
          </span>
          . Los cálculos que lo usaron quedarán sin poder mostrar su detalle. Si
          solo se te acabó, mejor archívalo.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setConfirmDelete(null)}
          >
            Cancelar
          </button>
          <form
            action={deleteFilament}
            onSubmit={() => setConfirmDelete(null)}
          >
            <input type="hidden" name="id" value={confirmDelete?.id ?? ""} />
            <button type="submit" className="btn-danger">
              Eliminar
            </button>
          </form>
        </div>
      </Modal>
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

function FilamentCard({
  filament,
  onEdit,
  onDelete,
}: {
  filament: Filament;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const stock = Number(filament.stock_gramos);
  const bajo = stock < STOCK_BAJO_GRAMOS;

  return (
    <article
      className={`glass-panel flex flex-col gap-4 p-5 ${
        filament.activo ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className="h-11 w-11 shrink-0 rounded-full border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]"
          style={{ backgroundColor: filament.color_hex }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white/95">
            {filament.marca}
          </h3>
          <p className="truncate text-xs text-muted">
            {filament.material} · {filament.color_nombre}
          </p>
        </div>
        {bajo && filament.activo && (
          <span className="badge-accent">
            Stock bajo
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Stock</dt>
          <dd
            className={`num mt-0.5 font-medium ${
              bajo ? "font-semibold text-accent" : "text-white/90"
            }`}
          >
            {formatGramos(stock)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Costo</dt>
          <dd className="num mt-0.5 font-medium text-white/90">
            {formatCLP(filament.costo_clp_kg)}
            <span className="text-xs text-muted">/kg</span>
          </dd>
        </div>
      </dl>

      <div className="flex gap-2 border-t border-white/[0.08] pt-3">
        <button type="button" onClick={onEdit} className="btn-ghost flex-1 !py-2 text-xs">
          Editar
        </button>
        <form action={toggleFilamentActivo} className="flex-1">
          <input type="hidden" name="id" value={filament.id} />
          <input
            type="hidden"
            name="activo"
            value={String(filament.activo)}
          />
          <button type="submit" className="btn-ghost w-full !py-2 text-xs">
            {filament.activo ? "Archivar" : "Reactivar"}
          </button>
        </form>
        <button
          type="button"
          onClick={onDelete}
          className="btn-danger !px-3 !py-2 text-xs"
          aria-label="Eliminar filamento"
        >
          ✕
        </button>
      </div>
    </article>
  );
}
