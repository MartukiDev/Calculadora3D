import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GlassPanel } from "@/components/GlassPanel";
import { Alert, EmptyState, StatusBadge } from "@/components/ui";
import { formatCLP, formatDate, formatHoras } from "@/lib/format";
import type { Filament, Print, Printer, PrintStatus } from "@/lib/types";
import { HistoryFilters } from "./HistoryFilters";

type SearchParams = {
  status?: string;
  q?: string;
  desde?: string;
  hasta?: string;
  printer?: string;
};

export default async function CalculosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("prints")
    .select("*")
    .order("created_at", { ascending: false });

  if (params.status === "borrador" || params.status === "lanzada") {
    query = query.eq("status", params.status);
  }
  if (params.q?.trim()) {
    query = query.ilike("nombre_proyecto", `%${params.q.trim()}%`);
  }
  if (params.desde) {
    query = query.gte("created_at", `${params.desde}T00:00:00`);
  }
  if (params.hasta) {
    query = query.lte("created_at", `${params.hasta}T23:59:59`);
  }
  if (params.printer) {
    query = query.eq("printer_id", params.printer);
  }

  const [printsRes, filamentsRes, printersRes] = await Promise.all([
    query,
    supabase.from("filaments").select("id, color_hex, marca, color_nombre"),
    supabase.from("printers").select("*").order("nombre", { ascending: true }),
  ]);

  const prints = (printsRes.data ?? []) as Print[];
  const printers = (printersRes.data ?? []) as Printer[];
  const printersPorId = new Map(printers.map((p) => [p.id, p]));
  const colores = new Map(
    ((filamentsRes.data ?? []) as Pick<
      Filament,
      "id" | "color_hex" | "marca" | "color_nombre"
    >[]).map((f) => [f.id, f]),
  );

  const totalLanzado = prints
    .filter((p) => p.status === "lanzada")
    .reduce((acc, p) => acc + Number(p.precio_final_con_iva), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white/95">Historial</h1>
          <p className="mt-1 text-sm text-muted">
            {prints.length} cálculo(s) · {formatCLP(totalLanzado)} en impresiones
            lanzadas
          </p>
        </div>
        <Link href="/dashboard/calculos/nuevo" className="btn-primary">
          Nuevo cálculo
        </Link>
      </div>

      <HistoryFilters
        status={(params.status as PrintStatus | "todos") ?? "todos"}
        q={params.q ?? ""}
        desde={params.desde ?? ""}
        hasta={params.hasta ?? ""}
        printer={params.printer ?? ""}
        impresoras={printers}
      />

      {printsRes.error && (
        <Alert>No pudimos cargar el historial: {printsRes.error.message}</Alert>
      )}

      <GlassPanel className="!p-4 sm:!p-5">
        {prints.length === 0 ? (
          <EmptyState
            title="Sin resultados"
            description="No hay cálculos que coincidan con los filtros aplicados."
          />
        ) : (
          <ul className="space-y-2">
            {prints.map((print) => (
              <li key={print.id}>
                <Link
                  href={`/dashboard/calculos/${print.id}`}
                  className="glass-row flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition hover:bg-white/[0.08]"
                >
                  <div className="flex -space-x-1.5">
                    {(print.filamentos_usados ?? []).map((fu, i) => (
                      <span
                        key={`${fu.filament_id}-${i}`}
                        className="h-6 w-6 rounded-full border border-white/25"
                        style={{
                          backgroundColor:
                            colores.get(fu.filament_id)?.color_hex ??
                            "rgba(255,255,255,0.15)",
                        }}
                        title={
                          colores.get(fu.filament_id)
                            ? `${colores.get(fu.filament_id)!.marca} · ${colores.get(fu.filament_id)!.color_nombre}`
                            : "Filamento eliminado"
                        }
                      />
                    ))}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white/90">
                      {print.nombre_proyecto}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      {print.printer_id && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full border border-white/25"
                          style={{
                            backgroundColor:
                              printersPorId.get(print.printer_id)?.color_hex ??
                              "rgba(255,255,255,0.15)",
                          }}
                          aria-hidden
                        />
                      )}
                      <span className="truncate">
                        {printersPorId.get(print.printer_id ?? "")?.nombre ??
                          "Sin impresora"}{" "}
                        · {formatDate(print.created_at)} ·{" "}
                        {formatHoras(print.tiempo_impresion_horas)}
                      </span>
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-muted">Costo</p>
                    <p className="num text-sm text-white/80">
                      {formatCLP(print.costo_total)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-muted">
                      IVA ({Number(print.iva_pct)}%)
                    </p>
                    <p className="num text-sm text-white/80">
                      {formatCLP(
                        Number(print.precio_final_con_iva) -
                          Number(print.precio_neto),
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-muted">Precio final</p>
                    <p className="num text-sm font-semibold text-white/95">
                      {formatCLP(print.precio_final_con_iva)}
                    </p>
                  </div>

                  <StatusBadge status={print.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
}
