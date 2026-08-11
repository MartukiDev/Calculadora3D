"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="glass-panel animate-panel-in max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold text-white/95">
          Algo se rompió
        </h1>
        <p className="mt-2 text-sm text-muted">
          {error.message || "Ocurrió un error inesperado."}
        </p>
        <button type="button" onClick={reset} className="btn-primary mt-6">
          Reintentar
        </button>
      </div>
    </main>
  );
}
