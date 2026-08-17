import { createClient } from "@/lib/supabase/server";
import type { InventoryItem } from "@/lib/types";
import { InventoryManager } from "./InventoryManager";

export default async function InventarioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .order("activo", { ascending: false })
    .order("categoria", { ascending: true })
    .order("nombre", { ascending: true });

  return (
    <InventoryManager
      items={(data ?? []) as InventoryItem[]}
      userId={user?.id ?? ""}
      loadError={error?.message ?? null}
    />
  );
}
