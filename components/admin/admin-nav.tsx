"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/oportunidades", label: "Pipeline" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/cotizaciones", label: "Cotizaciones" },
  { href: "/admin/proyectos", label: "Proyectos" },
  { href: "/admin/pagos", label: "Pagos" },
  { href: "/admin/catalogo", label: "Catálogo" },
  { href: "/admin/campanas", label: "Campañas" },
  { href: "/admin/actividades", label: "Actividades" },
  { href: "/admin/documentos", label: "Documentos" },
  { href: "/admin/metricas", label: "Métricas" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
