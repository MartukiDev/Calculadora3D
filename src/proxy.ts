import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Refresca la sesión de Supabase y protege todo lo que no sea ruta pública. */
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Todo excepto estáticos e imágenes.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
