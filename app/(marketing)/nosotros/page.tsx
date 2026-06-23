import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nosotros",
  description:
    "Jygasoft Energy: instalación de sistemas solares y gestión de trámites CFE en Aguascalientes. Equipos certificados y acompañamiento integral.",
  alternates: { canonical: "/nosotros" },
};

export default function NosotrosPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <span className="text-xs font-bold uppercase tracking-widest text-brand-green">
        Quiénes somos
      </span>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-brand">Nosotros</h1>
      <div className="mt-6 space-y-4 font-light text-stone-600">
        <p>
          En Jygasoft Energy ayudamos a familias y empresas de Aguascalientes a
          producir su propia energía con sistemas solares confiables y un
          acompañamiento de principio a fin.
        </p>
        <p>
          Nos encargamos del cálculo, la ingeniería, el trámite de interconexión con
          CFE y la instalación con equipos certificados, para que tú solo veas bajar
          tu recibo.
        </p>
      </div>
    </main>
  );
}
