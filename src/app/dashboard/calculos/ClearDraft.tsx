"use client";

import { useEffect } from "react";
import { clearDraft } from "@/lib/cache";

/** El borrador local deja de tener sentido una vez que Supabase confirmó el guardado. */
export function ClearDraft({ userId }: { userId: string }) {
  useEffect(() => {
    if (userId) clearDraft(userId);
  }, [userId]);
  return null;
}
