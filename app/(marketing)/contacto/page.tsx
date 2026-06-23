import type { Metadata } from "next";
import { MapPin, Calendar, FileCheck2 } from "lucide-react";
import { LeadForm } from "@/components/forms/lead-form";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Habla con un asesor de Jygasoft Energy. Cotiza paneles solares para tu casa o negocio en Aguascalientes.",
  alternates: { canonical: "/contacto" },
};

const PUNTOS = [
  { icon: MapPin, t: "Aguascalientes y región", d: "Cobertura local con cuadrillas propias." },
  { icon: FileCheck2, t: "Trámite CFE gestionado", d: "Interconexión completa hasta operación." },
  { icon: Calendar, t: "Asesoría sin costo", d: "Evaluamos tu viabilidad sin compromiso." },
];

export default function ContactoPage() {
  return (
    <main className="relative overflow-hidden bg-brand py-24 text-white">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-green/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 translate-x-1/3 rounded-full bg-brand-gold/10 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 sm:px-12">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-5">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-mint">
              Agenda tu asesoría
            </span>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              Hablemos de tu proyecto solar.
            </h1>
            <p className="text-lg font-light leading-relaxed text-brand-mint">
              Déjanos tus datos y un asesor te contacta para evaluar tu ahorro,
              trámite CFE e instalación.
            </p>
            <div className="space-y-6 border-t border-white/10 pt-6">
              {PUNTOS.map((p) => (
                <div key={p.t} className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-brand-gold">
                    <p.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{p.t}</h4>
                    <span className="text-xs text-brand-mint">{p.d}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white p-8 text-stone-800 shadow-xl sm:p-10 lg:col-span-7">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold tracking-tight text-brand">
                Solicita tu cotización
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                Completa los datos para coordinar una llamada con tu recibo de CFE.
              </p>
            </div>
            <LeadForm formName="contacto" withMensaje />
          </div>
        </div>
      </div>
    </main>
  );
}
