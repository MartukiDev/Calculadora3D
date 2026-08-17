import Link from "next/link";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <div className="glass-panel animate-panel-in p-7">
      <h1 className="text-xl font-semibold text-white/95">Crear cuenta</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Tus datos quedan aislados: nadie más ve tus filamentos ni tus costos.
      </p>

      <SignupForm />

      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-accent transition hover:text-accent-2">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
