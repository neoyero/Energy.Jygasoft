"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/casa", label: "Para tu casa" },
  { href: "/negocio", label: "Para tu negocio" },
  { href: "/casos-uso", label: "Casos de Uso" },
  { href: "/calculadora", label: "Calculadora" },
  { href: "/contacto", label: "Contacto" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Cierra el menú al navegar a otra ruta.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Cierra con la tecla Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Jygasoft Energy"
            width={40}
            height={40}
            priority
            className="h-9 w-auto object-contain"
          />
          <span className="text-base font-extrabold tracking-tight text-brand sm:text-lg">
            Jygasoft Energy
          </span>
        </Link>

        {/* Navegación de escritorio */}
        <nav className="hidden items-center gap-8 text-sm font-medium lg:flex">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative py-1 transition-colors",
                  active ? "text-brand" : "text-stone-600 hover:text-brand",
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute -bottom-0.5 left-0 h-0.5 w-full rounded-full bg-brand-green" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/calculadora"
            className="rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-bold text-brand-ink shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow sm:px-5"
          >
            Cotiza ya
          </Link>

          {/* Botón de menú (móvil / tablet) */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="inline-flex items-center justify-center rounded-lg p-2 text-brand transition-colors hover:bg-stone-100 lg:hidden"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Menú móvil desplegable */}
      {open && (
        <nav
          id="mobile-nav"
          className="animate-[fadeIn_0.18s_ease] border-t border-stone-200/70 bg-white lg:hidden"
        >
          <ul className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-8">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block rounded-lg px-3 py-3 text-base font-medium transition-colors",
                      active
                        ? "bg-brand-mint-light/30 text-brand"
                        : "text-stone-700 hover:bg-stone-50 hover:text-brand",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
