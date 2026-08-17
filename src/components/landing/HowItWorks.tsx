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
    titulo: "Registra tu inventario",
    descripcion:
      "Filamentos con marca, material, color y costo por kilo. Y todo lo que no es filamento —tags NFC, argollas, imanes— con su propia unidad y su umbral de aviso.",
    icon: SpoolIcon,
  },
  {
    numero: "03",
    titulo: "Arma el cálculo, capa por capa",
    descripcion:
      "Eliges la impresora y sus costos se precargan solos. Sumas tiempo, un filamento por cada color que lleve la pieza —sin tope— y los insumos que use; el desglose se construye en tiempo real.",
    icon: LayersIcon,
  },
  {
    numero: "04",
    titulo: "Conviértelo en un proyecto",
    descripcion:
      "Dile cuántas unidades vas a producir y súmale lo que lleva el armado: pegamento, caja, manual. Ves el costo de una unidad, el del lote y la lista de materiales cruzada contra tu stock.",
    icon: BoxesIcon,
  },
  {
    numero: "05",
    titulo: "Ajusta el margen y lanza",
    descripcion:
      "Un slider de 0% a 500% de margen y el IVA dan el precio de venta sugerido. ¿La pieza es para ti? Marca la casilla y se queda en su costo, sin margen ni IVA. Al lanzar, el filamento y los insumos de todas las unidades se descuentan en una sola operación.",
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
          De la tarifa eléctrica al precio final, en cinco pasos.
        </h2>
        <p className="mt-4 text-base text-muted">
          Nada de hojas de cálculo sueltas. La calculadora conecta tu
          configuración, tu inventario, cada impresión y cada pedido en un solo
          flujo.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        {PASOS.map((paso, i) => (
          // Con un número impar de pasos el último quedaría solo a media fila:
          // que ocupe el ancho completo lo cierra como culminación del flujo.
          <Reveal
            key={paso.numero}
            delay={i * 90}
            className={
              i === PASOS.length - 1 && PASOS.length % 2 === 1
                ? "lg:col-span-2"
                : ""
            }
          >
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

function BoxesIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="13" width="8" height="8" rx="1.2" />
      <rect x="13" y="13" width="8" height="8" rx="1.2" />
      <rect x="8" y="3" width="8" height="8" rx="1.2" />
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
