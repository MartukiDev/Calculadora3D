import Link from "next/link";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#14171C]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-accent">
            <LayersIcon />
          </span>
          <span className="font-display text-base font-semibold tracking-tight text-white/95">
            Calculadora 3D
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted sm:flex">
          <a href="#como-funciona" className="transition hover:text-white/85">
            Cómo funciona
          </a>
          <a href="#funciones" className="transition hover:text-white/85">
            Funciones
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-muted transition hover:text-white/85"
          >
            Iniciar sesión
          </Link>
          <Link href="/signup" className="btn-primary !py-2 text-sm">
            Crear cuenta
          </Link>
        </div>
      </div>
    </header>
  );
}

function LayersIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  );
}
