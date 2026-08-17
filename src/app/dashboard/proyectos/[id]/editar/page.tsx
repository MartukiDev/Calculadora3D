import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";
import { cargarOpcionesProyecto } from "../../data";
import { ProjectForm } from "../../ProjectForm";

export default async function EditarProyectoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const project = data as Project;

  // Un proyecto lanzado ya descontó stock y congeló sus costos.
  if (project.status === "lanzado") redirect(`/dashboard/proyectos/${id}`);

  const { prints, insumos, ivaDefault } = await cargarOpcionesProyecto(id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/proyectos/${id}`}
          className="text-sm text-muted hover:text-white/85"
        >
          ← Volver al proyecto
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white/95">
          Editar proyecto
        </h1>
      </div>

      <ProjectForm
        project={project}
        prints={prints}
        insumos={insumos}
        ivaDefault={ivaDefault}
      />
    </div>
  );
}
