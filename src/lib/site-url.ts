import { headers } from "next/headers";

const normalize = (value: string) => {
  const withProtocol = value.startsWith("http") ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, "");
};

/**
 * URL pública de la app, para armar los `redirectTo` de los emails de Supabase.
 *
 * Detrás de un proxy (Vercel, Netlify) las cabeceras `host`/`origin` pueden
 * apuntar al host interno, así que la variable explícita manda siempre.
 * Define NEXT_PUBLIC_SITE_URL en producción con el dominio del deploy.
 */
export async function getSiteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return normalize(process.env.NEXT_PUBLIC_SITE_URL);
  }
  // Dominio estable de producción en Vercel (no cambia por deploy).
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return normalize(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  }
  if (process.env.VERCEL_URL) {
    return normalize(process.env.VERCEL_URL);
  }

  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host");
  const host = forwardedHost ?? h.get("host");

  if (host) {
    const proto =
      h.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    return `${proto}://${host}`.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}
