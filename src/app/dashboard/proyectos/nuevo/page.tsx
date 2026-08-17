import { cargarOpcionesProyecto } from "../data";
import { ProjectForm } from "../ProjectForm";

export default async function NuevoProyectoPage({
  searchParams,
}: {
  searchParams: Promise<{ calculo?: string }>;
}) {
  // `?calculo=` llega desde el detalle de un cálculo, para no obligar a
  // buscarlo de nuevo en el selector.
  const { calculo } = await searchParams;
  const { prints, insumos, ivaDefault } = await cargarOpcionesProyecto();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white/95">Nuevo proyecto</h1>
        <p className="mt-1 text-sm text-muted">
          Un cálculo repetido las veces que necesites, más lo que lleva el
          armado. El costo unitario y el del lote salen solos.
        </p>
      </div>

      <ProjectForm
        prints={prints}
        insumos={insumos}
        ivaDefault={ivaDefault}
        printIdInicial={
          calculo && prints.some((p) => p.id === calculo) ? calculo : undefined
        }
      />
    </div>
  );
}
