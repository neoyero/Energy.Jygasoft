"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { AdminNav } from "@/components/admin/admin-nav";
import { SignOutButton } from "@/components/admin/sign-out-button";

export interface AdminMobileNavProps {
  rol?: string | null;
  name: string;
  initial: string;
}

/**
 * Navegación móvil del panel (visible solo < md, donde el sidebar de escritorio
 * está oculto). Topbar fijo con logo + botón hamburguesa que abre un drawer
 * lateral con el mismo AdminNav, la tarjeta de usuario y cerrar sesión.
 * Se cierra al navegar, con Escape o tocando el fondo; bloquea el scroll del
 * body mientras está abierto.
 */
export function AdminMobileNav({ rol, name, initial }: AdminMobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Cierra el drawer al cambiar de ruta.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Bloquea el scroll del body y permite cerrar con Escape mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* Topbar móvil (oculto en >= md, donde está el sidebar) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-stone-200 bg-white px-4 md:hidden">
        <Image
          src="/logo.png"
          alt="Jygasoft Energy"
          width={120}
          height={32}
          priority
          className="h-7 w-auto object-contain"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={open}
          className="inline-flex size-10 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-stone-100"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </header>

      {/* Drawer + overlay */}
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/40"
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-r border-stone-200 bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-stone-100 px-4">
              <Image
                src="/logo.png"
                alt="Jygasoft Energy"
                width={120}
                height={32}
                className="h-7 w-auto object-contain"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="inline-flex size-10 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-stone-100"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              <AdminNav rol={rol} />
            </div>

            <div className="border-t border-stone-100 p-3">
              <div className="flex items-center gap-3 rounded-xl bg-stone-50 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-green text-sm font-bold text-white">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-brand">{name}</p>
                  <p className="truncate text-xs capitalize text-stone-500">
                    {rol ?? "—"}
                  </p>
                </div>
                <SignOutButton variant="icon" />
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
