"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  deletePrint,
  lanzarImpresion,
  type ActionState,
} from "@/app/dashboard/actions";
import { Alert, Modal, SubmitButton } from "@/components/ui";
import type { PrintStatus } from "@/lib/types";

export function PrintActions({
  printId,
  status,
  stockInsuficiente,
}: {
  printId: string;
  status: PrintStatus;
  stockInsuficiente: boolean;
}) {
  const [confirmLanzar, setConfirmLanzar] = useState(false);
  const [confirmBorrar, setConfirmBorrar] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    lanzarImpresion,
    {},
  );

  // Al confirmarse el lanzamiento el modal se cierra solo: no hace falta un efecto.
  const modalLanzarAbierto = confirmLanzar && !state.ok;

  if (status === "lanzada") {
    return (
      <div className="flex gap-2">
        <Link href="/dashboard/calculos/nuevo" className="btn-ghost">
          Nuevo cálculo
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/dashboard/calculos/${printId}/editar`} className="btn-ghost">
        Editar
      </Link>
      <button
        type="button"
        className="btn-danger"
        onClick={() => setConfirmBorrar(true)}
      >
        Eliminar
      </button>
      <button
        type="button"
        className="btn-primary"
        onClick={() => setConfirmLanzar(true)}
      >
        Lanzar impresión
      </button>

      {state.error && (
        <div className="w-full">
          <Alert>{state.error}</Alert>
        </div>
      )}

      <Modal
        open={modalLanzarAbierto}
        onClose={() => setConfirmLanzar(false)}
        title="Lanzar impresión"
      >
        <p className="text-sm text-white/75">
          Se descontará del inventario los gramos de cada filamento de este
          cálculo y la impresión pasará a estado <strong>lanzada</strong>. Esta
          acción no se puede deshacer.
        </p>

        {stockInsuficiente && (
          <div className="mt-4">
            <Alert tone="warn">
              Algún filamento quedará con stock negativo. Revisa el inventario
              antes de continuar.
            </Alert>
          </div>
        )}

        {state.error && (
          <div className="mt-4">
            <Alert>{state.error}</Alert>
          </div>
        )}

        <form action={formAction} className="mt-5 flex justify-end gap-2">
          <input type="hidden" name="id" value={printId} />
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setConfirmLanzar(false)}
          >
            Cancelar
          </button>
          <SubmitButton pendingLabel="Lanzando…">
            Sí, lanzar y descontar
          </SubmitButton>
        </form>
      </Modal>

      <Modal
        open={confirmBorrar}
        onClose={() => setConfirmBorrar(false)}
        title="Eliminar cálculo"
      >
        <p className="text-sm text-white/75">
          Se eliminará este borrador de forma permanente. No afecta el stock,
          porque todavía no fue lanzado.
        </p>
        <form action={deletePrint} className="mt-5 flex justify-end gap-2">
          <input type="hidden" name="id" value={printId} />
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setConfirmBorrar(false)}
          >
            Cancelar
          </button>
          <button type="submit" className="btn-danger">
            Eliminar
          </button>
        </form>
      </Modal>
    </div>
  );
}
