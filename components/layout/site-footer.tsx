import Link from "next/link";

const LINKS = [
  { href: "/legal/aviso-privacidad", label: "Aviso de Privacidad" },
  { href: "/legal/terminos", label: "Términos y Condiciones" },
  { href: "/nosotros", label: "Certificaciones" },
  { href: "/soporte", label: "Soporte" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-brand text-brand-mint">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-12 sm:px-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md space-y-2">
          <p className="text-xl font-extrabold tracking-tight text-white">Jygasoft Energy</p>
          <p className="text-sm font-light leading-relaxed text-brand-mint">
            © 2026 Jygasoft Energy. Líderes en Energía Solar en México. Todos los
            derechos reservados.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm sm:flex sm:flex-wrap sm:gap-6">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
