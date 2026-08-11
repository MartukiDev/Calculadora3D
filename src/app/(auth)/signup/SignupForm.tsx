"use client";

import { useActionState } from "react";
import { signup, type AuthState } from "@/app/auth/actions";
import { Alert, SubmitButton } from "@/components/ui";

export function SignupForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(signup, {});

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

      <div>
        <label className="field-label" htmlFor="password">
          Contraseña
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
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <SubmitButton pendingLabel="Creando…" className="btn-primary w-full">
        Crear cuenta
      </SubmitButton>
    </form>
  );
}
