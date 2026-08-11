import type { NextRequest } from "next/server";
import { handleAuthCallback } from "@/lib/auth-callback";

/** Destino de los enlaces de recuperación de contraseña. */
export async function GET(request: NextRequest) {
  return handleAuthCallback(request, "/actualizar-password");
}
