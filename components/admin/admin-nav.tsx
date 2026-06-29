"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserPlus,
  TrendingUp,
  Users,
  FileText,
  CheckSquare,
  FolderKanban,
  FolderOpen,
  Package,
  PackagePlus,
  CreditCard,
  BarChart3,
  Megaphone,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { navFor, NAV_GROUPS, type Modulo } from "@/lib/admin/rbac";

const ICONS: Record<Modulo, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  leads: UserPlus,
  oportunidades: TrendingUp,
  clientes: Users,
  cotizaciones: FileText,
  actividades: CheckSquare,
  proyectos: FolderKanban,
  documentos: FolderOpen,
  productos: Package,
  paquetes: PackagePlus,
  pagos: CreditCard,
  metricas: BarChart3,
  campanas: Megaphone,
  usuarios: UserCog,
};

export function AdminNav({ rol }: { rol?: string | null }) {
  const pathname = usePathname();
  const items = navFor(rol);

  return (
    <nav className="space-y-5">
      {NAV_GROUPS.map((grupo) => {
        const groupItems = items.filter((i) => i.grupo === grupo);
        if (groupItems.length === 0) return null;
        return (
          <div key={grupo}>
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">
              {grupo}
            </p>
            <div className="space-y-0.5">
              {groupItems.map((item) => {
                const Icon = ICONS[item.modulo];
                const active =
                  item.href === "/je-admin"
                    ? pathname === "/je-admin"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand-green text-white shadow-sm"
                        : "text-stone-600 hover:bg-stone-100 hover:text-brand",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
