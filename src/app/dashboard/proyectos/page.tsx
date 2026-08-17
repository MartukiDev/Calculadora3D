import { createClient } from "@/lib/supabase/server";
import { breakdownDeProyecto } from "@/lib/project";
import type { Print, Project } from "@/lib/types";
import { ProjectsManager, type ProjectListItem } from "./ProjectsManager";

export default async function ProyectosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  const projects = (data ?? []) as Project[];

  // Los borradores derivan su costo del cálculo asociado, así que los traemos
  // todos de una en vez de consultar por fila.
  const printIds = projects
    .map((p) => p.print_id)
    .filter((id): id is string => Boolean(id));

  const { data: printsData } = printIds.length
    ? await supabase.from("prints").select("*").in("id", printIds)
    : { data: [] };

  const printsPorId = new Map(
    ((printsData ?? []) as Print[]).map((p) => [p.id, p]),
  );

  const items: ProjectListItem[] = projects.map((project) => {
    const print = project.print_id
      ? (printsPorId.get(project.print_id) ?? null)
      : null;
    const breakdown = breakdownDeProyecto(project, print);
    return {
      project,
      printNombre: print?.nombre_proyecto ?? null,
      costoTotal: breakdown.costoTotal,
      precioFinal: breakdown.precioFinalConIva,
    };
  });

  return (
    <ProjectsManager
      items={items}
      userId={user?.id ?? ""}
      loadError={error?.message ?? null}
    />
  );
}
