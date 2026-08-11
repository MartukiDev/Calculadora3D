"use client";

import { useActionState } from "react";
import { updatePassword, type AuthState } from "@/app/auth/actions";
import { Alert, SubmitButton } from "@/components/ui";

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    updatePassword,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="field-label" htmlFor="password">
          Nueva contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="field-input"
          placeholder="Mínimo 8 caracteres"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="confirm">
          Repetir contraseña
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="field-input"
          placeholder="••••••••"
        />
      </div>

      {state.error && <Alert>{state.error}</Alert>}

      <SubmitButton pendingLabel="Guardando…" className="btn-primary w-full">
        Guardar contraseña
      </SubmitButton>
    </form>
  );
}
