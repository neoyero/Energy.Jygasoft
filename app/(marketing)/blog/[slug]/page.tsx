import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { posts } from "#site/content";
import { MDXContent } from "@/components/mdx-content";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

interface Params {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return posts.filter((p) => !p.draft).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: post.url },
    openGraph: { title: post.title, description: post.description, type: "article" },
  };
}

export default async function BlogPost({ params }: Params) {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post || post.draft) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: post.title, path: post.url },
        ]}
      />
      <article>
        <time className="text-xs uppercase tracking-wide text-muted-foreground">
          {new Date(post.date).toLocaleDateString("es-MX", { dateStyle: "long" })}
        </time>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">{post.title}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{post.description}</p>
        <div className="mt-8">
          <MDXContent code={post.body} />
        </div>
      </article>
    </main>
  );
}
