import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GlassPanel } from "@/components/GlassPanel";
import { FilamentChip } from "@/components/FilamentChip";
import { StatusBadge, EmptyState, Alert } from "@/components/ui";
import { formatCLP, formatDate, formatGramos } from "@/lib/format";
import { STOCK_BAJO_GRAMOS, type Filament, type Print } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [settingsRes, filamentsRes, printsRes] = await Promise.all([
    supabase.from("user_settings").select("*").maybeSingle(),
    supabase.from("filaments").select("*").eq("activo", true),
    supabase
      .from("prints")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const settings = settingsRes.data;
  const filaments = (filamentsRes.data ?? []) as Filament[];
  const prints = (printsRes.data ?? []) as Print[];

  const stockBajo = filaments.filter(
    (f) => Number(f.stock_gramos) < STOCK_BAJO_GRAMOS,
  );
  const stockTotal = filaments.reduce(
    (acc, f) => acc + Number(f.stock_gramos),
    0,
  );
  const lanzadas = prints.filter((p) => p.status === "lanzada");
  const valorInventario = filaments.reduce(
    (acc, f) => acc + (Number(f.stock_gramos) / 1000) * Number(f.costo_clp_kg),
    0,
  );

  const sinConfigurar =
    !settings ||
    (Number(settings.tarifa_luz_clp_kwh) === 0 &&
      Number(settings.consumo_impresora_w) === 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white/95">Panel</h1>
          <p className="mt-1 text-sm text-muted">
            Costos, inventario y últimas impresiones.
          </p>
        </div>
        <Link href="/dashboard/calculos/nuevo" className="btn-primary">
          Nuevo cálculo
        </Link>
      </div>

      {sinConfigurar && (
        <Alert tone="warn">
          Aún no configuraste tarifas de luz ni consumo de la impresora — los
          costos saldrán incompletos.{" "}
          <Link href="/dashboard/configuracion" className="underline">
            Ir a configuración
          </Link>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Filamentos activos" value={String(filaments.length)} />
        <Stat label="Stock total" value={formatGramos(stockTotal)} />
        <Stat label="Valor inventario" value={formatCLP(valorInventario)} />
        <Stat
          label="Stock bajo"
          value={String(stockBajo.length)}
          tone={stockBajo.length > 0 ? "warn" : "normal"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <GlassPanel
          title="Últimos cálculos"
          actions={
            <Link
              href="/dashboard/calculos"
              className="text-sm text-muted hover:text-white/85"
            >
              Ver todo
            </Link>
          }
        >
          {prints.length === 0 ? (
            <EmptyState
              title="Todavía no hay cálculos"
              description="Crea tu primer cálculo para ver el desglose de costos y el precio sugerido."
              action={
                <Link href="/dashboard/calculos/nuevo" className="btn-ghost mt-2">
                  Calcular impresión
                </Link>
              }
            />
          ) : (
            <ul className="space-y-2">
              {prints.map((print) => (
                <li key={print.id}>
                  <Link
                    href={`/dashboard/calculos/${print.id}`}
                    className="glass-row flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-white/[0.08]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white/90">
                        {print.nombre_proyecto}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatDate(print.created_at)} ·{" "}
                        {print.filamentos_usados?.length ?? 0} filamento(s)
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="num text-sm text-white/90">
                        {formatCLP(print.precio_final_con_iva)}
                      </span>
                      <StatusBadge status={print.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {lanzadas.length > 0 && (
            <p className="mt-4 text-xs text-muted">
              {lanzadas.length} de los últimos {prints.length} ya fueron lanzados.
            </p>
          )}
        </GlassPanel>

        <GlassPanel
          title="Stock bajo"
          description={`Menos de ${STOCK_BAJO_GRAMOS} g disponibles`}
        >
          {stockBajo.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Todo tu inventario está sobre el umbral.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {stockBajo.map((f) => (
                <li key={f.id}>
                  <FilamentChip
                    colorHex={f.color_hex}
                    label={`${f.marca} ${f.material}`}
                    sublabel={f.color_nombre}
                    gramos={Number(f.stock_gramos)}
                    size="sm"
                  />
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/dashboard/filamentos"
            className="btn-ghost mt-5 w-full text-sm"
          >
            Gestionar filamentos
          </Link>
        </GlassPanel>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "warn";
}) {
  return (
    <div className="glass-panel px-5 py-4">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p
        className={`num mt-1.5 text-xl font-semibold ${
          tone === "warn" ? "text-accent" : "text-white/95"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
