"use client";

import { useEffect, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { PrintStatus, ProjectStatus } from "@/lib/types";

export function SubmitButton({
  children,
  pendingLabel = "Guardando…",
  className = "btn-primary",
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function StatusBadge({ status }: { status: PrintStatus }) {
  if (status === "lanzada") {
    return (
      <span className="badge border-accent-2/30 bg-accent-2/12 text-accent-2">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-2" /> Lanzada
      </span>
    );
  }
  return (
    <span className="badge border-white/15 bg-white/[0.06] text-white/70">
      <span className="h-1.5 w-1.5 rounded-full bg-white/40" /> Borrador
    </span>
  );
}

/**
 * Marca un cálculo que no se vende. Convive con el StatusBadge en vez de
 * reemplazarlo: un cálculo personal también puede estar en borrador o lanzado.
 */
export function UsoPersonalBadge() {
  return (
    <span className="badge border-white/15 bg-white/[0.06] text-white/70">
      Para mí
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  if (status === "lanzado") {
    return (
      <span className="badge border-accent-2/30 bg-accent-2/12 text-accent-2">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-2" /> Lanzado
      </span>
    );
  }
  return (
    <span className="badge border-white/15 bg-white/[0.06] text-white/70">
      <span className="h-1.5 w-1.5 rounded-full bg-white/40" /> Borrador
    </span>
  );
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "info" | "warn" | "success";
  children: ReactNode;
}) {
  // Un solo matiz en dos intensidades: `warn` pide acción y va en lima pleno,
  // `success` ya está resuelto y va apagado. `info` no pide nada, así que se
  // queda en gris. `error` es el único que sale del verde.
  const tones = {
    error: "border-rose-400/30 bg-rose-500/10 text-rose-200",
    warn: "border-accent/35 bg-accent-soft text-accent",
    info: "border-white/15 bg-white/[0.06] text-white/75",
    success: "border-accent-2/30 bg-accent-2/12 text-accent-2",
  } as const;

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

/** Badge de datos servidos desde localStorage cuando Supabase no respondió. */
export function CacheBadge() {
  return (
    <span className="badge-accent">
      Datos en caché · puede no estar actualizado
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    // overflow-y-auto + min-h-full: un formulario más alto que la pantalla
    // scrollea en vez de quedar cortado, y si cabe sigue centrado.
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className="glass-panel w-full max-w-md p-5 sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="mb-3 text-lg font-semibold text-white/95">{title}</h3>
          {children}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/12 px-6 py-14 text-center">
      <p className="font-display text-base text-white/85">{title}</p>
      <p className="max-w-sm text-sm text-muted">{description}</p>
      {action}
    </div>
  );
}
