"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deletePrinter,
  setDefaultPrinter,
  togglePrinterActivo,
} from "@/app/dashboard/actions";
import { Alert, CacheBadge, EmptyState, Modal } from "@/components/ui";
import { printersCache } from "@/lib/cache";
import { formatCLP } from "@/lib/format";
import type { Printer } from "@/lib/types";
import { PrinterForm } from "./PrinterForm";

export function PrintersManager({
  printers,
  tarifaLuzClpKwh,
  userId,
  loadError,
}: {
  printers: Printer[];
  tarifaLuzClpKwh: number;
  userId: string;
  loadError: string | null;
}) {
  const [editing, setEditing] = useState<Printer | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Printer | null>(null);
  const [mostrarArchivadas, setMostrarArchivadas] = useState(false);

  // Fallback offline: si la carga desde Supabase falló, servimos la caché.
  const cached = useMemo(() => {
    if (!loadError || !userId) return null;
    return printersCache.get(userId)?.data ?? null;
  }, [loadError, userId]);

  const lista = cached ?? printers;

  useEffect(() => {
    if (!loadError && userId) printersCache.set(userId, printers);
  }, [loadError, userId, printers]);

  const activas = lista.filter((p) => p.activo);
  const archivadas = lista.filter((p) => !p.activo);
  const visibles = mostrarArchivadas ? archivadas : activas;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white/95">Impresoras</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            {activas.length} activa(s) · {archivadas.length} archivada(s)
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
          Agregar impresora
        </button>
      </div>

      {loadError && !cached && (
        <Alert>No pudimos cargar tus impresoras: {loadError}</Alert>
      )}

      {tarifaLuzClpKwh === 0 && (
        <Alert tone="warn">
          Tu tarifa de luz está en cero, así que el costo eléctrico saldrá $0 sin
          importar el consumo que cargues acá.
        </Alert>
      )}

      <div className="flex gap-1">
        <TabButton
          active={!mostrarArchivadas}
          onClick={() => setMostrarArchivadas(false)}
        >
          Activas ({activas.length})
        </TabButton>
        <TabButton
          active={mostrarArchivadas}
          onClick={() => setMostrarArchivadas(true)}
        >
          Archivadas ({archivadas.length})
        </TabButton>
      </div>

      {visibles.length === 0 ? (
        <EmptyState
          title={
            mostrarArchivadas
              ? "No hay impresoras archivadas"
              : "Sin impresoras registradas"
          }
          description="Cada impresora guarda su consumo, mano de obra, depreciación y desperdicio. La calculadora los precarga al elegirla."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((p) => (
            <PrinterCard
              key={p.id}
              printer={p}
              tarifaLuzClpKwh={tarifaLuzClpKwh}
              onEdit={() => {
                setCreating(false);
                setEditing(p);
              }}
              onDelete={() => setConfirmDelete(p)}
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
        title={editing ? "Editar impresora" : "Nueva impresora"}
      >
        <PrinterForm
          printer={editing}
          tarifaLuzClpKwh={tarifaLuzClpKwh}
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Eliminar impresora"
      >
        <p className="text-sm text-white/75">
          Vas a eliminar{" "}
          <span className="font-medium text-white/90">
            {confirmDelete?.nombre}
          </span>
          . Los cálculos hechos con ella conservan sus costos, pero quedarán sin
          impresora asociada. Si solo dejaste de usarla, mejor archívala.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setConfirmDelete(null)}
          >
            Cancelar
          </button>
          <form action={deletePrinter} onSubmit={() => setConfirmDelete(null)}>
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

function PrinterCard({
  printer,
  tarifaLuzClpKwh,
  onEdit,
  onDelete,
}: {
  printer: Printer;
  tarifaLuzClpKwh: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const costoHora =
    tarifaLuzClpKwh * (Number(printer.consumo_w) / 1000) +
    Number(printer.tarifa_mano_obra_clp_hora) +
    Number(printer.costo_depreciacion_clp_hora);

  const subtitulo = [printer.marca, printer.modelo].filter(Boolean).join(" ");

  return (
    <article
      className={`glass-panel flex flex-col gap-4 p-5 ${
        printer.activo ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className="h-11 w-11 shrink-0 rounded-xl border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]"
          style={{ backgroundColor: printer.color_hex }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white/95">
            {printer.nombre}
          </h3>
          <p className="truncate text-xs text-muted">
            {subtitulo || "Sin marca ni modelo"}
          </p>
        </div>
        {printer.es_default && (
          <span className="badge border-accent-2/30 bg-accent-2/12 text-accent-2">
            Predeterminada
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Consumo</dt>
          <dd className="num mt-0.5 font-medium text-white/90">
            {Number(printer.consumo_w)} W
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Costo/hora</dt>
          <dd className="num mt-0.5 font-medium text-white/90">
            {formatCLP(costoHora)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Depreciación</dt>
          <dd className="num mt-0.5 font-medium text-white/90">
            {formatCLP(printer.costo_depreciacion_clp_hora)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Desperdicio</dt>
          <dd className="num mt-0.5 font-medium text-white/90">
            {Number(printer.desperdicio_pct_default)}%
          </dd>
        </div>
      </dl>

      {!printer.es_default && printer.activo && (
        <form action={setDefaultPrinter}>
          <input type="hidden" name="id" value={printer.id} />
          <button type="submit" className="btn-ghost w-full !py-2 text-xs">
            Marcar como predeterminada
          </button>
        </form>
      )}

      <div className="flex gap-2 border-t border-white/[0.08] pt-3">
        <button
          type="button"
          onClick={onEdit}
          className="btn-ghost flex-1 !py-2 text-xs"
        >
          Editar
        </button>
        <form action={togglePrinterActivo} className="flex-1">
          <input type="hidden" name="id" value={printer.id} />
          <input type="hidden" name="activo" value={String(printer.activo)} />
          <button
            type="submit"
            className="btn-ghost w-full !py-2 text-xs"
            disabled={printer.es_default && printer.activo}
            title={
              printer.es_default && printer.activo
                ? "Marca otra como predeterminada antes de archivar esta"
                : undefined
            }
          >
            {printer.activo ? "Archivar" : "Reactivar"}
          </button>
        </form>
        <button
          type="button"
          onClick={onDelete}
          className="btn-danger !px-3 !py-2 text-xs"
          aria-label="Eliminar impresora"
        >
          ✕
        </button>
      </div>
    </article>
  );
}
