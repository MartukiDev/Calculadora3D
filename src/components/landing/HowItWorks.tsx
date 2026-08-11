import { GlassPanel } from "@/components/GlassPanel";
import { Reveal } from "@/components/landing/Reveal";

const PASOS = [
  {
    numero: "01",
    titulo: "Registra tus impresoras",
    descripcion:
      "Cada máquina guarda su consumo en watts, mano de obra, depreciación y desperdicio. Una Ender y una X1C no cuestan lo mismo por hora, y la calculadora lo sabe.",
    icon: PrinterIcon,
  },
  {
    numero: "02",
    titulo: "Registra tu inventario de filamentos",
    descripcion:
      "Marca, material, color y costo por kilo. La calculadora descuenta el stock real cuando lanzas una impresión — y te avisa cuando un color se está por acabar.",
    icon: SpoolIcon,
  },
  {
    numero: "03",
    titulo: "Arma el cálculo, capa por capa",
    descripcion:
      "Eliges la impresora y sus costos se precargan solos. Sumas tiempo y hasta 4 filamentos para piezas multicolor, y el desglose se construye en tiempo real, sin recargar nada.",
    icon: LayersIcon,
  },
  {
    numero: "04",
    titulo: "Ajusta el margen y lanza",
    descripcion:
      "Un slider de 0% a 500% de margen y el IVA se aplican al final para el precio de venta sugerido. Al lanzar la impresión, el stock de cada filamento se descuenta solo.",
    icon: SparkIcon,
  },
] as const;

export function HowItWorks() {
  return (
    <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <Reveal className="max-w-2xl">
        <p className="text-xs font-semibold tracking-widest text-accent-2 uppercase">
          Cómo funciona
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-white/95 sm:text-4xl">
          De la tarifa eléctrica al precio final, en cuatro pasos.
        </h2>
        <p className="mt-4 text-base text-muted">
          Nada de hojas de cálculo sueltas. La calculadora conecta tu
          configuración, tu inventario y cada impresión en un solo flujo.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        {PASOS.map((paso, i) => (
          <Reveal key={paso.numero} delay={i * 90}>
            <GlassPanel className="h-full">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent-soft text-accent">
                  <paso.icon />
                </span>
                <div>
                  <span className="num text-xs text-white/35">
                    {paso.numero}
                  </span>
                  <h3 className="mt-1 font-display text-lg font-semibold text-white/95">
                    {paso.titulo}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {paso.descripcion}
                  </p>
                </div>
              </div>
            </GlassPanel>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function iconProps() {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

function PrinterIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 4h16v9H4z" />
      <path d="M7 13v7h10v-7" />
      <path d="M9 17h6" />
      <path d="M12 4v4" />
    </svg>
  );
}

function SpoolIcon() {
  return (
    <svg {...iconProps()}>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <ellipse cx="12" cy="18" rx="7" ry="3" />
      <path d="M5 6v12" />
      <path d="M19 6v12" />
      <ellipse cx="12" cy="12" rx="3.2" ry="1.4" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg {...iconProps()}>
      <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" />
      <path d="m4 12 8 4.5 8-4.5" />
      <path d="m4 16.5 8 4.5 8-4.5" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <path d="m5.6 5.6 2.8 2.8" />
      <path d="m15.6 15.6 2.8 2.8" />
      <path d="m18.4 5.6-2.8 2.8" />
      <path d="m8.4 15.6-2.8 2.8" />
    </svg>
  );
}
