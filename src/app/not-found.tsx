import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="glass-panel animate-panel-in max-w-md p-8 text-center">
        <p className="num text-4xl font-semibold text-accent">404</p>
        <h1 className="mt-3 text-lg font-semibold text-white/95">
          No encontramos esta página
        </h1>
        <p className="mt-2 text-sm text-muted">
          El cálculo o la ruta que buscas no existe, o ya no está disponible.
        </p>
        <Link href="/dashboard" className="btn-primary mt-6">
          Volver al panel
        </Link>
      </div>
    </main>
  );
}
