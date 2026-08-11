import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token_hash?: string; type?: string }>;
}) {
  const params = await searchParams;

  // Si el redirectTo no está en la lista blanca, Supabase manda el enlace al
  // Site URL (la raíz) con el código pegado. Lo reencaminamos en vez de perderlo.
  if (params.code || (params.token_hash && params.type)) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][],
    );
    const ruta = params.type === "recovery" ? "/auth/recovery" : "/auth/callback";
    redirect(`${ruta}?${query}`);
  }

  if (isSupabaseConfigured) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="glass-panel animate-panel-in w-full max-w-lg p-7">
        <h1 className="text-xl font-semibold text-white/95">
          Falta conectar Supabase
        </h1>
        <p className="mt-2 text-sm text-muted">
          Crea un archivo <code className="text-accent-2">.env.local</code> en la
          raíz del proyecto con las credenciales de tu proyecto Supabase y
          reinicia el servidor de desarrollo.
        </p>

        <pre className="num mt-5 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-white/80">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...`}
        </pre>

        <ol className="mt-5 space-y-2 text-sm text-white/75">
          <li>
            1. En Supabase: <strong>Project Settings → API</strong> para copiar la
            URL y la anon key.
          </li>
          <li>
            2. En el <strong>SQL Editor</strong>, ejecuta{" "}
            <code className="text-accent-2">supabase/schema.sql</code> de este
            repo (tablas, RLS, trigger y el RPC de lanzamiento).
          </li>
          <li>
            3. Reinicia con <code className="text-accent-2">pnpm dev</code>.
          </li>
        </ol>
      </div>
    </main>
  );
}
