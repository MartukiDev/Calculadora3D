"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  deleteProject,
  lanzarProyecto,
  type ActionState,
} from "@/app/dashboard/actions";
import { Alert, Modal, SubmitButton } from "@/components/ui";
import type { ProjectStatus } from "@/lib/types";

export function ProjectActions({
  projectId,
  status,
  cantidad,
  sinCalculo,
  hayFaltantes,
}: {
  projectId: string;
  status: ProjectStatus;
  cantidad: number;
  sinCalculo: boolean;
  hayFaltantes: boolean;
}) {
  const [confirmLanzar, setConfirmLanzar] = useState(false);
  const [confirmBorrar, setConfirmBorrar] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    lanzarProyecto,
    {},
  );

  // Al confirmarse el lanzamiento el modal se cierra solo: no hace falta un efecto.
  const modalLanzarAbierto = confirmLanzar && !state.ok;

  if (status === "lanzado") {
    return (
      <Link href="/dashboard/proyectos/nuevo" className="btn-ghost">
        Nuevo proyecto
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/dashboard/proyectos/${projectId}/editar`}
        className="btn-ghost"
      >
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
        disabled={sinCalculo}
        title={sinCalculo ? "Asocia un cálculo antes de lanzar" : undefined}
        onClick={() => setConfirmLanzar(true)}
      >
        Lanzar proyecto
      </button>

      {state.error && (
        <div className="w-full">
          <Alert>{state.error}</Alert>
        </div>
      )}

      <Modal
        open={modalLanzarAbierto}
        onClose={() => setConfirmLanzar(false)}
        title="Lanzar proyecto"
      >
        <p className="text-sm text-white/75">
          Se descontará del inventario la receta completa{" "}
          <strong>multiplicada por {cantidad}</strong>: los filamentos y los
          insumos del cálculo, más los insumos de armado. El cálculo pasará a{" "}
          <strong>lanzada</strong> y el proyecto quedará cerrado con sus costos
          congelados. Esta acción no se puede deshacer.
        </p>

        {hayFaltantes && (
          <div className="mt-4">
            <Alert tone="warn">
              A algún material no le alcanza el stock para las {cantidad}{" "}
              unidades y quedará negativo. Revisa la lista de materiales antes de
              continuar.
            </Alert>
          </div>
        )}

        {state.error && (
          <div className="mt-4">
            <Alert>{state.error}</Alert>
          </div>
        )}

        <form action={formAction} className="mt-5 flex justify-end gap-2">
          <input type="hidden" name="id" value={projectId} />
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
        title="Eliminar proyecto"
      >
        <p className="text-sm text-white/75">
          Se eliminará este borrador de forma permanente. No afecta el stock ni
          el cálculo asociado: ese queda libre para usarse en otro proyecto.
        </p>
        <form action={deleteProject} className="mt-5 flex justify-end gap-2">
          <input type="hidden" name="id" value={projectId} />
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
