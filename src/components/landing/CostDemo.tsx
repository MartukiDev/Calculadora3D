"use client";

import { useEffect, useRef, useState } from "react";
import { CostLayerStack } from "@/components/CostLayerStack";
import { FilamentChip } from "@/components/FilamentChip";
import { calcularCostos, type CostBreakdown } from "@/lib/calc";

const FILAMENTOS = [
  { id: "f1", marca: "eSun", material: "PETG", color: "Negro carbón", hex: "#1c1f24", costo_clp_kg: 14990 },
  { id: "f2", marca: "Bambu", material: "PLA", color: "Naranja hotend", hex: "#ff7a3d", costo_clp_kg: 16990 },
  { id: "f3", marca: "Polymaker", material: "PLA", color: "Teal frío", hex: "#4fd1c5", costo_clp_kg: 15990 },
];

const USADOS = [
  { filament_id: "f1", gramos: 42 },
  { filament_id: "f2", gramos: 14 },
  { filament_id: "f3", gramos: 6 },
];

const TARGET = calcularCostos({
  tiempoImpresionHoras: 6.5,
  filamentosUsados: USADOS,
  filamentos: FILAMENTOS,
  tarifaLuzClpKwh: 130,
  consumoImpresoraW: 250,
  tarifaManoObraClpHora: 1500,
  costoDepreciacionClpHora: 300,
  desperdicioPct: 8,
  ivaPct: 19,
  margenPct: 180,
});

const scale = (b: CostBreakdown, p: number): CostBreakdown => ({
  costoFilamento: b.costoFilamento * p,
  costoLuz: b.costoLuz * p,
  costoManoObra: b.costoManoObra * p,
  costoDepreciacion: b.costoDepreciacion * p,
  subtotal: b.subtotal * p,
  costoTotal: b.costoTotal * p,
  precioNeto: b.precioNeto * p,
  precioFinalConIva: b.precioFinalConIva * p,
});

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function CostDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let raf = 0;
    const duration = 1100;
    const start = performance.now() + 250; // deja respirar el stagger de las capas
    const tick = (now: number) => {
      const t = Math.min(Math.max((now - start) / duration, 0), 1);
      setProgress(easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started]);

  const breakdown = scale(TARGET, progress);

  return (
    <div ref={ref} className="glass-panel animate-panel-in w-full max-w-md p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            Ejemplo en vivo
          </p>
          <h3 className="mt-1 font-display text-base font-semibold text-white/95">
            Llavero multicolor
          </h3>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="num rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-white/60">
            6.5 h
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-white/50">
            <span
              className="h-2 w-2 rounded-full border border-white/25 bg-accent-2"
              aria-hidden
            />
            Bambu P1S
          </span>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILAMENTOS.map((f, i) => {
          const usado = USADOS.find((u) => u.filament_id === f.id);
          return (
            <div
              key={f.id}
              className={started ? "animate-layer-rise" : "opacity-0"}
              style={{ animationDelay: started ? `${i * 90}ms` : undefined }}
            >
              <FilamentChip
                colorHex={f.hex}
                label={`${f.marca} ${f.material}`}
                sublabel={f.color}
                gramos={usado?.gramos}
                size="sm"
              />
            </div>
          );
        })}
      </div>

      <CostLayerStack
        breakdown={breakdown}
        desperdicioPct={8}
        margenPct={180}
        ivaPct={19}
        animateIn={started}
      />
    </div>
  );
}
