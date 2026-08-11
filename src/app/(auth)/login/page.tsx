import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="glass-panel animate-panel-in p-7">
      <h1 className="text-xl font-semibold text-white/95">Iniciar sesión</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Accede a tus cálculos e inventario.
      </p>

      <LoginForm next={next ?? "/dashboard"} initialError={error} />

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link href="/reset-password" className="text-muted hover:text-white/80">
          Olvidé mi contraseña
        </Link>
        <Link href="/signup" className="text-accent hover:brightness-110">
          Crear cuenta
        </Link>
      </div>
    </div>
  );
}
