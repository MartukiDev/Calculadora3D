"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthState } from "@/app/auth/actions";
import { Alert, SubmitButton } from "@/components/ui";

export function ResetForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="field-input"
          placeholder="tu@correo.cl"
        />
      </div>

      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <SubmitButton pendingLabel="Enviando…" className="btn-primary w-full">
        Enviar enlace
      </SubmitButton>
    </form>
  );
}
