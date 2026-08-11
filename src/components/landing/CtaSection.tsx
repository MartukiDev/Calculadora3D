import Link from "next/link";
import { Reveal } from "@/components/landing/Reveal";

export function CtaSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <Reveal>
        <div className="glass-panel relative overflow-hidden p-10 text-center sm:p-14">
          <div
            className="animate-pulse-glow pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,122,61,0.16),transparent_60%)]"
            aria-hidden
          />
          <div className="relative">
            <h2 className="font-display text-3xl font-semibold text-white/95 sm:text-4xl">
              ¿Listo para dejar de adivinar tus precios?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted">
              Crea tu cuenta, carga tus tarifas y tu primer filamento, y en
              menos de dos minutos vas a tener el desglose completo de tu
              próxima impresión.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/signup" className="btn-primary px-6 py-3 text-sm">
                Crear cuenta gratis
              </Link>
              <Link href="/login" className="btn-ghost px-6 py-3 text-sm">
                Iniciar sesión
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
