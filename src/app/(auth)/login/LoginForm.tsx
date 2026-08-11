"use client";

import { useActionState } from "react";
import { login, type AuthState } from "@/app/auth/actions";
import { Alert, SubmitButton } from "@/components/ui";

export function LoginForm({
  next,
  initialError,
}: {
  next: string;
  initialError?: string;
}) {
  const [state, formAction] = useActionState<AuthState, FormData>(login, {});
  const error = state.error ?? initialError;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

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
          autoComplete="current-password"
          required
          className="field-input"
          placeholder="••••••••"
        />
      </div>

      {error && <Alert>{error}</Alert>}

      <SubmitButton pendingLabel="Entrando…" className="btn-primary w-full">
        Entrar
      </SubmitButton>
    </form>
  );
}
