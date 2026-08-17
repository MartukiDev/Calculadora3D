import Link from "next/link";
import { CostDemo } from "@/components/landing/CostDemo";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28">
      <div
        className="animate-drift pointer-events-none absolute -top-24 -left-32 h-96 w-96 rounded-full bg-accent/18 blur-[110px]"
        aria-hidden
      />
      <div
        className="animate-drift-slow pointer-events-none absolute top-40 -right-24 h-80 w-80 rounded-full bg-accent-2/12 blur-[110px]"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
        <div className="animate-panel-in">
          <span className="badge-accent">
            <span className="animate-pulse-glow h-1.5 w-1.5 rounded-full bg-accent" />
            Costeo de impresión 3D
          </span>

          <h1 className="mt-5 font-display text-4xl leading-[1.08] font-semibold text-white/95 sm:text-5xl lg:text-[3.25rem]">
            Deja de regalar impresiones.
            <br />
            <span className="text-accent">Cobra lo que realmente cuestan.</span>
          </h1>

          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
            Filamento, luz, mano de obra, depreciación e insumos — tu costo
            real, capa por capa, calculado en segundos. Y cuando el pedido son
            veinte unidades, el precio del lote sale solo.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/signup" className="btn-primary px-6 py-3 text-sm">
              Crear cuenta gratis
            </Link>
            <Link href="/login" className="btn-ghost px-6 py-3 text-sm">
              Ya tengo cuenta
            </Link>
          </div>

          <p className="mt-5 text-xs text-muted">
            Sin tarjeta de crédito. Tus datos quedan aislados: nadie más ve tu
            inventario ni tus precios.
          </p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <CostDemo />
        </div>
      </div>
    </section>
  );
}
