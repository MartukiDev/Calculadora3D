import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.08] px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-muted">
          Calculadora 3D — hecha para makers que cobran lo justo.
        </p>
        <div className="flex items-center gap-5 text-xs text-muted">
          <Link href="/login" className="transition hover:text-white/85">
            Iniciar sesión
          </Link>
          <Link href="/signup" className="transition hover:text-white/85">
            Crear cuenta
          </Link>
        </div>
      </div>
    </footer>
  );
}
