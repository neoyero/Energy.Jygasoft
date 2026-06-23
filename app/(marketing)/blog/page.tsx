import type { Metadata } from "next";
import Link from "next/link";
import { posts } from "#site/content";

export const metadata: Metadata = {
  title: "Blog — energía solar en Aguascalientes",
  description:
    "Guías sobre costos, ahorro, Net Metering y trámites CFE para energía solar en Aguascalientes.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndex() {
  const items = posts
    .filter((p) => !p.draft)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <span className="text-xs font-bold uppercase tracking-widest text-brand-green">
        Aprende
      </span>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-brand">Blog</h1>
      <ul className="mt-8 space-y-8">
        {items.map((p) => (
          <li key={p.slug}>
            <article>
              <time className="text-xs uppercase tracking-wide text-muted-foreground">
                {new Date(p.date).toLocaleDateString("es-MX", { dateStyle: "long" })}
              </time>
              <h2 className="mt-1 text-xl font-semibold">
                <Link href={p.url} className="hover:underline">
                  {p.title}
                </Link>
              </h2>
              <p className="mt-1 text-muted-foreground">{p.description}</p>
            </article>
          </li>
        ))}
      </ul>
    </main>
  );
}
