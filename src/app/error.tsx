"use client";

/**
 * Tras un despliegue nuevo, una pestaña abierta desde antes sigue pidiendo IDs
 * de Server Actions que ya no existen en el build actual. No es un fallo de la
 * app: se resuelve recargando, así que lo tratamos aparte del error genérico.
 */
function esVersionDesactualizada(error: Error): boolean {
  return /server action|server reference|not found on the server/i.test(
    error.message,
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const desactualizada = esVersionDesactualizada(error);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="glass-panel animate-panel-in max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold text-white/95">
          {desactualizada ? "Hay una versión nueva" : "Algo se rompió"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {desactualizada
            ? "La app se actualizó mientras tenías esta página abierta. Recarga para continuar; no se guardó nada de lo que enviaste."
            : error.message || "Ocurrió un error inesperado."}
        </p>
        <button
          type="button"
          onClick={() => (desactualizada ? window.location.reload() : reset())}
          className="btn-primary mt-6"
        >
          {desactualizada ? "Recargar" : "Reintentar"}
        </button>
      </div>
    </main>
  );
}
