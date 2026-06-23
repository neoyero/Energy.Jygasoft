import Image from "next/image";
import Link from "next/link";
import { Home, Sprout, Store, Factory, ArrowRight } from "lucide-react";

interface UseCase {
  image: string;
  icon: typeof Home;
  kicker: string;
  title: string;
  reto: string;
  solucion: string;
  resultado: string;
  metricas: { v: string; l: string }[];
  ctaText: string;
  ctaHref: string;
}

const CASOS: UseCase[] = [
  {
    image: "/caso-residencial.png",
    icon: Home,
    kicker: "Residencial",
    title: "Casa en tarifa DAC",
    reto: "Recibos altos por aire acondicionado y alto consumo; caíste en tarifa DAC, sin subsidio.",
    solucion: "Sistema de 3 a 6 kWp en azotea con paneles TOPCon e inversor; trámite de interconexión incluido.",
    resultado: "Sales de DAC y reduces tu recibo hasta 95–99%.",
    metricas: [
      { v: "3–6 kWp", l: "Sistema típico" },
      { v: "~6–12", l: "Paneles" },
      { v: "~3 años", l: "Retorno" },
    ],
    ctaText: "Calcula tu ahorro",
    ctaHref: "/calculadora",
  },
  {
    image: "/caso-granja.png",
    icon: Sprout,
    kicker: "Granja y agro",
    title: "Rancho con bombeo y riego",
    reto: "El bombeo de agua, el riego y la refrigeración disparan el costo eléctrico de la operación.",
    solucion: "Sistema dimensionado a tus bombas y equipos, con montaje en piso o techo y monitoreo.",
    resultado: "Operas con energía limpia y costos predecibles por más de 25 años.",
    metricas: [
      { v: "10–50 kWp", l: "Sistema típico" },
      { v: "Bombeo/riego", l: "Aplicación" },
      { v: "~3–5 años", l: "Retorno" },
    ],
    ctaText: "Solicitar propuesta",
    ctaHref: "/contacto",
  },
  {
    image: "/caso-negocio.png",
    icon: Store,
    kicker: "Negocio pequeño",
    title: "Comercio u oficina (PDBT)",
    reto: "La luz pesa cada mes en el gasto operativo de tu local o despacho.",
    solucion: "Sistema en azotea dimensionado al consumo del negocio en tarifa PDBT.",
    resultado: "Bajas el costo operativo y estabilizas tu factura mensual.",
    metricas: [
      { v: "10–30 kWp", l: "Sistema típico" },
      { v: "PDBT", l: "Tarifa" },
      { v: "~3–4 años", l: "Retorno" },
    ],
    ctaText: "Ver soluciones",
    ctaHref: "/negocio",
  },
  {
    image: "/caso-empresa.png",
    icon: Factory,
    kicker: "Industria y empresas",
    title: "Planta o nave industrial (GDMT)",
    reto: "Consumo elevado en media tensión; la energía es un costo crítico de tu operación.",
    solucion: "Proyecto a gran escala con estudio de media tensión, monitoreo y mantenimiento.",
    resultado: "Reduces de forma importante tu costo energético y tu huella de carbono.",
    metricas: [
      { v: "100+ kWp", l: "Sistema típico" },
      { v: "GDMTO/GDMTH", l: "Tarifa" },
      { v: "Garantía total", l: "Postventa" },
    ],
    ctaText: "Solicitar cotización",
    ctaHref: "/contacto",
  },
];

export function UseCases({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <section className="border-y border-stone-200 bg-brand-surface-2">
      <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-10">
        {showHeader && (
          <div className="mb-14 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Casos de uso
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand sm:text-4xl">
              Una solución para cada tipo de proyecto
            </h2>
            <p className="mt-4 text-lg font-light leading-relaxed text-stone-600">
              Así trabajamos según tu perfil: del hogar a la industria. Cada proyecto se
              dimensiona a tu consumo real.
            </p>
          </div>
        )}

        <div className="space-y-12">
          {CASOS.map((c, i) => {
            const imgFirst = i % 2 === 0;
            return (
              <div
                key={c.title}
                className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12"
              >
                {/* Imagen */}
                <div className={imgFirst ? "lg:order-1" : "lg:order-2"}>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-lg ring-1 ring-stone-200/60">
                    <Image
                      src={c.image}
                      alt={c.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover"
                    />
                  </div>
                </div>

                {/* Texto */}
                <div className={imgFirst ? "lg:order-2" : "lg:order-1"}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-mint-light/40 text-brand-green">
                      <c.icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-widest text-brand-green">
                      {c.kicker}
                    </span>
                  </div>

                  <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-brand">
                    {c.title}
                  </h3>

                  <dl className="mt-5 space-y-3 text-sm">
                    <div>
                      <dt className="font-bold text-stone-800">El reto</dt>
                      <dd className="font-light text-stone-600">{c.reto}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-brand-green">La solución</dt>
                      <dd className="font-light text-stone-600">{c.solucion}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-brand-gold-dark">El resultado</dt>
                      <dd className="font-light text-stone-600">{c.resultado}</dd>
                    </div>
                  </dl>

                  <div className="mt-6 grid grid-cols-3 gap-3">
                    {c.metricas.map((m) => (
                      <div
                        key={m.l}
                        className="rounded-xl border border-stone-200/70 bg-white p-3 text-center"
                      >
                        <p className="text-base font-extrabold text-brand">{m.v}</p>
                        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-stone-500">
                          {m.l}
                        </p>
                      </div>
                    ))}
                  </div>

                  <Link
                    href={c.ctaHref}
                    className="group mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-green hover:text-brand-green-dark"
                  >
                    {c.ctaText}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-xs text-stone-500">
          Cifras ilustrativas; el dimensionamiento y el retorno dependen de tu consumo,
          tarifa y esquema de interconexión. Estima el tuyo en la{" "}
          <Link href="/calculadora" className="text-brand-green underline">
            calculadora
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
