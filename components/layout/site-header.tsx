"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/casa", label: "Para tu casa" },
  { href: "/negocio", label: "Para tu negocio" },
  { href: "/casos-uso", label: "Casos de Uso" },
  { href: "/calculadora", label: "Calculadora" },
  { href: "/contacto", label: "Contacto" },
];

export function SiteHeader() {
  const pathname = usePathname();

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
          <span className="text-lg font-extrabold tracking-tight text-brand">
            Jygasoft Energy
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium lg:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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

        <Link
          href="/calculadora"
          className="rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-bold text-brand-ink shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow"
        >
          Cotiza ya
        </Link>
      </div>
    </header>
  );
}
