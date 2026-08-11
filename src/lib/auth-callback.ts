import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Canjea el código de un enlace de email de Supabase por una sesión.
 * Soporta el flujo PKCE (`code`) y el de `token_hash`.
 *
 * `destino` va fijo por ruta y no en la query, porque la lista blanca de
 * Redirect URLs de Supabase compara la URL completa: un `?next=` de más puede
 * hacer que descarte el redirectTo y caiga al Site URL del proyecto.
 */
export async function handleAuthCallback(
  request: NextRequest,
  destino: string,
): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // request.nextUrl.origin puede ser el host interno detrás del proxy del hosting.
  const origin = await getSiteUrl();
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      // En un enlace de recuperación mandamos a cambiar la contraseña, venga por donde venga.
      const final = type === "recovery" ? "/actualizar-password" : destino;
      return NextResponse.redirect(`${origin}${final}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("El enlace es inválido o expiró.")}`,
  );
}
