import type { Metadata } from "next";
import Link from "next/link";
import {
  Headset,
  MessageCircle,
  Mail,
  Phone,
  Calculator,
  HardHat,
  FileCheck2,
  TrendingDown,
  CreditCard,
  LifeBuoy,
  ChevronDown,
} from "lucide-react";
import { WHATSAPP_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Centro de Soporte",
  description:
    "Centro de ayuda de Jygasoft Energy: preguntas frecuentes sobre cotización, instalación, trámite CFE, tarifas, pagos y postventa. Consulta directa por WhatsApp.",
  alternates: { canonical: "/soporte" },
};

const CANALES = [
  { icon: MessageCircle, t: "WhatsApp", d: "Respuesta más rápida", href: WHATSAPP_URL, cta: "Abrir chat", external: true },
  { icon: Mail, t: "Correo", d: "soporte@jygasoft.com", href: "mailto:soporte@jygasoft.com", cta: "Escribir", external: false },
  { icon: Phone, t: "Teléfono", d: "Lun a Vie, 9:00–18:00", href: "tel:+524490000000", cta: "Llamar", external: false },
];

const CATEGORIAS = [
  {
    icon: Calculator,
    titulo: "Cotización y calculadora",
    faqs: [
      {
        q: "¿La cotización tiene costo?",
        a: "No, es totalmente gratuita y sin compromiso. La estimación con nuestra calculadora es inmediata y, si quieres una propuesta formal, la asesoría inicial y el levantamiento técnico también son gratis. Solo pagas cuando decides contratar el proyecto.",
      },
      {
        q: "¿Qué tan exacta es la calculadora?",
        a: "Es una estimación referencial: parte de parámetros promedio (irradiación de tu zona, rendimiento del sistema y tarifa) y de los datos que ingresas, por lo que te da un rango muy útil para decidir. La cifra definitiva se ajusta tras revisar tu historial de consumo y hacer un levantamiento técnico del inmueble.",
      },
      {
        q: "¿Qué datos necesito para cotizar?",
        a: "Con tu recibo de CFE basta: nos sirve el monto que pagas o tu consumo en kWh, además de tu código postal o municipio para estimar la radiación solar de tu zona. Si nos compartes una foto del recibo, la estimación es más precisa porque vemos tu tarifa y tu historial.",
      },
    ],
  },
  {
    icon: HardHat,
    titulo: "Instalación y equipos",
    faqs: [
      {
        q: "¿Cuánto tarda la instalación?",
        a: "Una instalación residencial típica toma de 1 a 3 días hábiles una vez que el material está en sitio. En proyectos comerciales o industriales el tiempo depende del tamaño del sistema y de las condiciones del techo; en tu propuesta te damos un cronograma estimado por etapas.",
      },
      {
        q: "¿Qué garantía tienen los equipos?",
        a: "Los paneles cuentan con garantía del fabricante de hasta 25 años de rendimiento y los inversores con su propia garantía (normalmente de 5 a 12 años, según marca). Además, la instalación y la mano de obra tienen una garantía de servicio que se detalla en tu contrato.",
      },
      {
        q: "¿Funciona en techo de lámina o inclinado?",
        a: "Sí. Trabajamos con estructuras de montaje adecuadas para techo de concreto, lámina, teja o superficies inclinadas, e incluso montaje en piso cuando hay espacio. En el levantamiento técnico definimos la estructura ideal para asegurar fijación, impermeabilidad y la mejor orientación de los paneles.",
      },
    ],
  },
  {
    icon: FileCheck2,
    titulo: "Trámite CFE",
    faqs: [
      {
        q: "¿Ustedes hacen el trámite con CFE?",
        a: "Sí, gestionamos la interconexión de principio a fin para que tú no te preocupes por el papeleo: solicitud, estudio de media tensión cuando aplica, oficio resolutivo, firma de contratos y la instalación del medidor bidireccional, hasta dejar tu sistema en operación.",
      },
      {
        q: "¿Cuánto tarda el trámite?",
        a: "Los tiempos los determina la propia CFE y varían según el tipo de proyecto y la zona; un trámite residencial suele ser más ágil que uno en media tensión. Nosotros preparamos toda la documentación para evitar rechazos y te damos seguimiento en cada etapa, pero no podemos garantizar plazos de la autoridad.",
      },
      {
        q: "¿Qué es el medidor bidireccional?",
        a: "Es el medidor que CFE instala para registrar tanto la energía que consumes de la red como la que tu sistema inyecta cuando produce de más. Es la base del esquema de interconexión: lo que inyectas se acredita o se valora a PML, según tu esquema.",
      },
    ],
  },
  {
    icon: TrendingDown,
    titulo: "Tarifas y ahorro",
    faqs: [
      {
        q: "¿Qué es la tarifa DAC?",
        a: "DAC (Doméstica de Alto Consumo) es la tarifa que aplica CFE cuando rebasas el límite de consumo de tu región durante varios meses: pierdes el subsidio y el costo del kWh sube de forma importante. Por eso los hogares en DAC son los que más ahorran al instalar paneles, ya que un sistema bien dimensionado puede sacarte de esa tarifa.",
      },
      {
        q: "¿Cómo funciona la compensación de excedentes (PML)?",
        a: "Bajo el esquema de medición/facturación neta, la energía que no consumes y se inyecta a la red se acredita o se valora a PML (Precio Marginal Local), que normalmente es menor a la tarifa a la que tú compras energía. Por eso conviene dimensionar el sistema para autoconsumo y no para vender excedentes.",
      },
      {
        q: "¿Cuánto puedo ahorrar?",
        a: "El ahorro típico va de 70% a 95% de tu facturación eléctrica, y puede acercarse al 99% en casos de tarifa DAC con un sistema bien dimensionado. El porcentaje real depende de tu consumo, tu tarifa y tu esquema de interconexión; con tu recibo, la calculadora te da una estimación personalizada.",
      },
    ],
  },
  {
    icon: CreditCard,
    titulo: "Pagos y facturación",
    faqs: [
      {
        q: "¿Emiten factura (CFDI)?",
        a: "Sí, emitimos CFDI por el total del proyecto. Al contratar te pedimos tu RFC, régimen fiscal y Constancia de Situación Fiscal para facturar correctamente; esto además te permite, en su caso, aprovechar beneficios fiscales por inversión en energías renovables con tu contador.",
      },
      {
        q: "¿Cómo se programan los pagos?",
        a: "El esquema de pagos se define en tu contrato y suele estructurarse en anticipo y pagos contra avance del proyecto (por ejemplo, al iniciar, durante la instalación y al concluir). Te lo presentamos a detalle en la propuesta formal, sin sorpresas ni cobros ocultos.",
      },
    ],
  },
  {
    icon: LifeBuoy,
    titulo: "Postventa y seguimiento",
    faqs: [
      {
        q: "¿Qué hago si mi sistema presenta una falla?",
        a: "Escríbenos por WhatsApp o al correo de soporte con tu folio de proyecto y una breve descripción (idealmente con foto o el dato del inversor). Revisamos el caso a distancia y, si procede conforme a la garantía, coordinamos una visita técnica para resolverlo.",
      },
      {
        q: "¿Ofrecen mantenimiento?",
        a: "Sí. Ofrecemos planes de mantenimiento preventivo y limpieza de paneles, clave para conservar el rendimiento, ya que el polvo y la suciedad reducen la generación. En zonas con mucho polvo o cerca del campo, recomendamos limpiezas más frecuentes.",
      },
      {
        q: "¿Cómo doy seguimiento a mi proyecto?",
        a: "Tu asesor te mantiene informado del avance por fase (cotización, trámite CFE, instalación y operación) y puedes pedir el estatus cuando quieras. En sistemas con monitoreo, además podrás ver la generación de tu sistema prácticamente en tiempo real.",
      },
    ],
  },
];

export default function SoportePage() {
  return (
    <main>
      {/* Cabecera de soporte */}
      <section className="relative overflow-hidden bg-brand text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-green/25 blur-3xl" />
        <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-16 sm:px-10">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-brand-gold">
              <Headset className="h-6 w-6" />
            </span>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-brand-mint">
                Centro de ayuda
              </span>
              <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
                Soporte
              </h1>
              <p className="mt-3 max-w-2xl text-lg font-light text-brand-mint">
                Resolvemos tus dudas sobre cotización, instalación, trámite CFE,
                tarifas, pagos y postventa. ¿No encuentras tu respuesta? Consúltanos
                directamente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Canales */}
      <section className="mx-auto -mt-8 w-full max-w-5xl px-6 sm:px-10">
        <div className="grid gap-4 sm:grid-cols-3">
          {CANALES.map((c) => (
            <div key={c.t} className="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-lg">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-mint-light/40 text-brand-green">
                <c.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-bold text-brand">{c.t}</h2>
              <p className="mt-1 text-sm text-stone-600">{c.d}</p>
              <a
                href={c.href}
                {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="mt-3 inline-block text-sm font-semibold text-brand-green hover:underline"
              >
                {c.cta} →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* FAQs por categoría */}
      <section className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-10">
        <h2 className="text-2xl font-extrabold tracking-tight text-brand">
          Preguntas frecuentes
        </h2>
        <div className="mt-8 space-y-10">
          {CATEGORIAS.map((cat) => (
            <div key={cat.titulo}>
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-green">
                <cat.icon className="h-4 w-4" />
                {cat.titulo}
              </h3>
              <div className="mt-3 divide-y divide-stone-200 rounded-2xl border border-stone-200/70 bg-white">
                {cat.faqs.map((f) => (
                  <details key={f.q} className="group px-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-stone-800 marker:hidden">
                      {f.q}
                      <ChevronDown className="h-4 w-4 shrink-0 text-stone-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="pb-4 text-sm font-light leading-relaxed text-stone-600">
                      {f.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA consulta */}
        <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl bg-brand-surface-2 p-8 text-center">
          <Headset className="h-8 w-8 text-brand-green" />
          <h3 className="text-xl font-bold text-brand">¿Aún tienes dudas?</h3>
          <p className="max-w-md text-sm text-stone-600">
            Habla con un asesor real. Te ayudamos con tu caso específico.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-6 py-3.5 text-sm font-bold text-brand-ink shadow-md transition-all hover:bg-brand-gold-dark"
            >
              <MessageCircle className="h-4 w-4" />
              Consultar por WhatsApp
            </a>
            <Link
              href="/contacto"
              className="inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-6 py-3.5 text-sm font-bold text-stone-800 transition-all hover:bg-stone-50"
            >
              Dejar mis datos
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
