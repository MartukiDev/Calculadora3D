import { createClient } from "@/lib/supabase/server";
import type { Filament } from "@/lib/types";
import { FilamentsManager } from "./FilamentsManager";

export default async function FilamentosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("filaments")
    .select("*")
    .order("activo", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <FilamentsManager
      filaments={(data ?? []) as Filament[]}
      userId={user?.id ?? ""}
      loadError={error?.message ?? null}
    />
  );
}
