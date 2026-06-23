"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface Slide {
  id: string;
  image: string;
  alt: string;
  kicker: string;
  title: React.ReactNode;
  subtitle: string;
  ctaText: string;
  /** Destino del CTA. Si `action` es "chat", se ignora y se abre el asesor. */
  ctaHref: string;
  action?: "chat";
}

// Orden de enfoque: residencial → seguimiento → granjas → comercial → industrial.
const SLIDES: Slide[] = [
  {
    id: "residencial",
    image: "/hero-residencial.png",
    alt: "Casa residencial con paneles solares en la azotea",
    kicker: "Residencial",
    title: (
      <>
        Reduce hasta un <span className="text-brand-gold">95%</span> tu recibo de luz
        con energía solar
      </>
    ),
    subtitle:
      "Proyectos llave en mano: nos encargamos de todo lo técnico, financiero y los trámites ante CFE.",
    ctaText: "Pregunta sin compromiso",
    ctaHref: "/contacto",
  },
  {
    id: "seguimiento",
    image: "/hero-seguimiento.png",
    alt: "Persona consultando el estatus de su proyecto solar desde el celular",
    kicker: "Seguimiento en tiempo real",
    title: (
      <>
        Sigue tu proyecto solar <span className="text-brand-gold">desde tu celular</span>
      </>
    ),
    subtitle:
      "Pregúntale a nuestro asesor por chat y conoce en qué etapa va tu proyecto: trámite CFE, instalación y operación. Sin llamadas ni esperas.",
    ctaText: "Abrir el chat",
    ctaHref: "#chat",
    action: "chat",
  },
  {
    id: "agro",
    image: "/hero-granja.png",
    alt: "Paneles solares en una granja agrícola",
    kicker: "Granjas y agro",
    title: <>Energía solar para granjas y el campo</>,
    subtitle:
      "Reduce el costo de bombeo, riego y operación agrícola con energía limpia.",
    ctaText: "Soluciones para el agro",
    ctaHref: "/negocio",
  },
  {
    id: "comercial",
    image: "/hero-comercial.png",
    alt: "Paneles solares en la azotea de un comercio",
    kicker: "Comercial",
    title: <>Paneles solares para comercios y empresas en todo México</>,
    subtitle: "Transformamos tu espacio en una fuente de energía y ahorro.",
    ctaText: "Soluciones para tu negocio",
    ctaHref: "/negocio",
  },
  {
    id: "industrial",
    image: "/hero-industrial.png",
    alt: "Instalación solar en nave industrial",
    kicker: "Industria y empresas",
    title: (
      <>Energía solar para empresas con tarifas GDMTO, GDMTH y PDBT</>
    ),
    subtitle:
      "Reduce tu huella de carbono y genera energía limpia por más de 25 años.",
    ctaText: "Calcula tu ahorro",
    ctaHref: "/calculadora",
  },
];

const INTERVAL = 6500;

export function HeroCarousel() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((n: number) => setIdx((n + SLIDES.length) % SLIDES.length), []);

  // Abre el widget del Asesor Solar (escucha el evento en consult-chat.tsx).
  const openChat = useCallback(() => {
    window.dispatchEvent(new CustomEvent("open-consult-chat"));
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), INTERVAL);
    return () => clearInterval(t);
  }, [paused]);

  const active = SLIDES[idx];

  return (
    <section
      className="relative h-[78vh] min-h-[520px] w-full overflow-hidden bg-brand"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carrusel"
    >
      {/* Capas de imagen (crossfade) */}
      {SLIDES.map((s, i) => (
        <div
          key={s.id}
          aria-hidden={i !== idx}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === idx ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={s.image}
            alt={s.alt}
            fill
            priority={i === 0}
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>
      ))}

      {/* Contenido del slide activo */}
      <div className="absolute inset-0 z-10 flex items-center">
        <div className="mx-auto w-full max-w-7xl px-6 sm:px-10">
          <div key={idx} className="max-w-2xl animate-[fadeIn_0.6s_ease]">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-mint-light">
              {active.kicker}
            </span>
            <h1 className="mt-4 text-balance text-4xl font-extrabold uppercase leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              {active.title}
            </h1>
            <p className="mt-5 max-w-lg text-pretty text-base font-medium leading-relaxed text-white/85 sm:text-lg">
              {active.subtitle}
            </p>
            {active.action === "chat" ? (
              <button
                type="button"
                onClick={openChat}
                className="group mt-8 inline-flex items-center gap-3 text-sm font-bold uppercase tracking-wide text-white"
              >
                {active.ctaText}
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/50 transition-all group-hover:border-brand-gold group-hover:bg-brand-gold group-hover:text-brand-ink">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </button>
            ) : (
              <Link
                href={active.ctaHref}
                className="group mt-8 inline-flex items-center gap-3 text-sm font-bold uppercase tracking-wide text-white"
              >
                {active.ctaText}
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/50 transition-all group-hover:border-brand-gold group-hover:bg-brand-gold group-hover:text-brand-ink">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Controles: puntos */}
      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2.5">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => go(i)}
            aria-label={`Ir al slide ${i + 1}`}
            aria-current={i === idx}
            className={`h-2.5 rounded-full transition-all ${
              i === idx ? "w-7 bg-brand-gold" : "w-2.5 bg-white/50 hover:bg-white/80"
            }`}
          />
        ))}
      </div>

      {/* Flechas */}
      <button
        onClick={() => go(idx - 1)}
        aria-label="Anterior"
        className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur transition-colors hover:bg-black/50 sm:block"
      >
        <ArrowRight className="h-5 w-5 rotate-180" />
      </button>
      <button
        onClick={() => go(idx + 1)}
        aria-label="Siguiente"
        className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur transition-colors hover:bg-black/50 sm:block"
      >
        <ArrowRight className="h-5 w-5" />
      </button>
    </section>
  );
}
