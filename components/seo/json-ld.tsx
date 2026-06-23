import { clientEnv } from "@/lib/env";

const SITE = clientEnv.NEXT_PUBLIC_SITE_URL;

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // El contenido es estático y controlado por nosotros.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function OrganizationJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Jygasoft Energy",
        url: SITE,
        logo: `${SITE}/static/logo.png`,
        areaServed: "Aguascalientes, México",
        sameAs: [],
      }}
    />
  );
}

export function LocalBusinessJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "Jygasoft Energy",
        url: SITE,
        areaServed: { "@type": "State", name: "Aguascalientes" },
        address: {
          "@type": "PostalAddress",
          addressLocality: "Aguascalientes",
          addressRegion: "AGU",
          addressCountry: "MX",
        },
        priceRange: "$$",
      }}
    />
  );
}

export function FaqJsonLd({ items }: { items: { pregunta: string; respuesta: string }[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((i) => ({
          "@type": "Question",
          name: i.pregunta,
          acceptedAnswer: { "@type": "Answer", text: i.respuesta },
        })),
      }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; path: string }[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((i, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          name: i.name,
          item: `${SITE}${i.path}`,
        })),
      }}
    />
  );
}
