import Link from "next/link";
import { ResetForm } from "./ResetForm";

export default function ResetPasswordPage() {
  return (
    <div className="glass-panel animate-panel-in p-7">
      <h1 className="text-xl font-semibold text-white/95">
        Restablecer contraseña
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Te enviamos un enlace para definir una nueva.
      </p>

      <ResetForm />

      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-muted hover:text-white/80">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
