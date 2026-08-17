import { Reveal } from "@/components/landing/Reveal";

const FEATURES = [
  {
    titulo: "Todas tus impresoras, cada una a su costo",
    descripcion:
      "Registra cuantas máquinas quieras con su propio consumo, mano de obra, depreciación y desperdicio. Eliges una y el cálculo se precarga solo.",
  },
  {
    titulo: "Proyectos: un producto en cantidad",
    descripcion:
      "Toma un cálculo, dile cuántas unidades vas a producir y súmale lo que lleva el armado. Te devuelve el costo de una y el del lote completo.",
  },
  {
    titulo: "La lista de materiales, ya cruzada",
    descripcion:
      "Cuánto filamento y cuántos insumos necesita el lote entero, comparado contra tu stock. Sabes qué comprar antes de encender la impresora.",
  },
  {
    titulo: "Inventario más allá del filamento",
    descripcion:
      "Tags NFC, argollas, imanes, boquillas. Cada insumo con su unidad, su costo y su propio umbral de aviso — 10 argollas es poco, 10 metros de cadena no.",
  },
  {
    titulo: "Multicolor, hasta 4 filamentos",
    descripcion:
      "Cada impresión puede combinar hasta cuatro colores. El costo de material se prorratea por gramo exacto de cada uno.",
  },
  {
    titulo: "Historial con filtros",
    descripcion:
      "Busca por nombre, filtra por impresora, estado o rango de fechas. Cada cálculo guarda su desglose completo, no solo el total.",
  },
  {
    titulo: "Alertas de stock bajo",
    descripcion:
      "Cuando un filamento o un insumo cae bajo su umbral, aparece marcado en tu panel antes de que te quedes a mitad de una producción.",
  },
  {
    titulo: "Borradores con autoguardado",
    descripcion:
      "Si cierras la pestaña a mitad de un cálculo, lo recuperas donde lo dejaste — se guarda solo en tu navegador.",
  },
  {
    titulo: "Descuento de stock atómico",
    descripcion:
      "Al lanzar, los gramos de cada filamento y las cantidades de cada insumo se descuentan en una sola operación — sin dejar el inventario a medias.",
  },
  {
    titulo: "Datos aislados por usuario",
    descripcion:
      "Row Level Security en Postgres: nadie más ve tus tarifas, tu inventario ni tus precios, ni tú los de otro usuario.",
  },
] as const;

export function FeatureGrid() {
  return (
    <section id="funciones" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <Reveal className="max-w-2xl">
        <p className="text-xs font-semibold tracking-widest text-accent-2 uppercase">
          Funciones
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-white/95 sm:text-4xl">
          Todo lo que rodea al número final.
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.titulo} delay={(i % 3) * 90}>
            <div className="glass-row h-full p-5">
              <h3 className="font-display text-sm font-semibold text-white/95">
                {f.titulo}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {f.descripcion}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
