"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Inicio", exact: true },
  { href: "/dashboard/calculos/nuevo", label: "Calcular", exact: true },
  { href: "/dashboard/calculos", label: "Historial", exact: false },
  { href: "/dashboard/reportes", label: "Reportes", exact: false },
  { href: "/dashboard/filamentos", label: "Filamentos", exact: false },
  { href: "/dashboard/inventario", label: "Inventario", exact: false },
  { href: "/dashboard/impresoras", label: "Impresoras", exact: false },
  { href: "/dashboard/configuracion", label: "Configuración", exact: false },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    // En mobile la barra sangra hasta el borde: ver un link cortado avisa que
    // hay más al costado, cosa que un scroll que empieza y termina con padding
    // no comunica.
    <nav className="order-3 -mx-4 flex w-[calc(100%+2rem)] items-center gap-1 overflow-x-auto px-4 sm:order-none sm:mx-0 sm:w-auto sm:px-0">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href ||
            (pathname.startsWith(`${link.href}/`) &&
              link.href !== "/dashboard/calculos") ||
            (link.href === "/dashboard/calculos" &&
              pathname.startsWith("/dashboard/calculos") &&
              pathname !== "/dashboard/calculos/nuevo");

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${
              active
                ? "bg-white/10 text-white"
                : "text-muted hover:bg-white/[0.06] hover:text-white/85"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
