"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navFor } from "@/lib/admin/rbac";

export function AdminNav({ rol }: { rol?: string | null }) {
  const pathname = usePathname();
  const items = navFor(rol);
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active =
          item.href === "/je-admin"
            ? pathname === "/je-admin"
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
