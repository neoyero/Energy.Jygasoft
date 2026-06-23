import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { casos } from "#site/content";
import { MDXContent } from "@/components/mdx-content";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

interface Params {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return casos.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const caso = casos.find((c) => c.slug === slug);
  if (!caso) return {};
  return {
    title: caso.title,
    description: caso.description,
    alternates: { canonical: caso.url },
  };
}

export default async function CasoDetalle({ params }: Params) {
  const { slug } = await params;
  const caso = casos.find((c) => c.slug === slug);
  if (!caso) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Casos", path: "/casos" },
          { name: caso.title, path: caso.url },
        ]}
      />
      <h1 className="text-4xl font-semibold tracking-tight">{caso.title}</h1>
      <div className="mt-8">
        <MDXContent code={caso.body} />
      </div>
    </main>
  );
}
