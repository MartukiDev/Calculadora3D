"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Inicio", exact: true },
  { href: "/dashboard/calculos/nuevo", label: "Calcular", exact: true },
  { href: "/dashboard/calculos", label: "Historial", exact: false },
  { href: "/dashboard/filamentos", label: "Filamentos", exact: false },
  { href: "/dashboard/impresoras", label: "Impresoras", exact: false },
  { href: "/dashboard/configuracion", label: "Configuración", exact: false },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto sm:order-none sm:w-auto">
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
