import { defineConfig, s } from "velite";

/**
 * Contenido local tipado (blog, casos, FAQ) compilado por Velite a `.velite/`.
 * Cero llamadas a CMS en runtime. Se ejecuta antes de `next build`/`next dev`.
 */

const slugFrom = (path: string) => path.split("/").pop()!.replace(/\.mdx$/, "");

const posts = defineCollection({
  name: "Post",
  pattern: "blog/**/*.mdx",
  schema: s
    .object({
      title: s.string().max(120),
      description: s.string().max(280),
      date: s.isodate(),
      updated: s.isodate().optional(),
      cover: s.string().optional(),
      tags: s.array(s.string()).default([]),
      draft: s.boolean().default(false),
      body: s.mdx(),
      path: s.path(),
    })
    .transform((data) => ({ ...data, slug: slugFrom(data.path), url: `/blog/${slugFrom(data.path)}` })),
});

const casos = defineCollection({
  name: "Caso",
  pattern: "casos/**/*.mdx",
  schema: s
    .object({
      title: s.string().max(120),
      description: s.string().max(280),
      cliente: s.string().optional(),
      segmento: s.enum(["residencial", "comercial", "industrial"]).optional(),
      capacidadKwp: s.number().optional(),
      ahorroPct: s.number().optional(),
      municipio: s.string().optional(),
      date: s.isodate(),
      cover: s.string().optional(),
      body: s.mdx(),
      path: s.path(),
    })
    .transform((data) => ({ ...data, slug: slugFrom(data.path), url: `/casos/${slugFrom(data.path)}` })),
});

const faqs = defineCollection({
  name: "Faq",
  pattern: "faq/**/*.mdx",
  schema: s
    .object({
      pregunta: s.string().max(200),
      orden: s.number().default(99),
      html: s.markdown(),
      plain: s.excerpt({ length: 400 }),
      path: s.path(),
    })
    .transform((data) => ({ ...data, slug: slugFrom(data.path) })),
});

// `defineCollection` no se exporta directamente; se usa vía objeto en config.
function defineCollection<T>(c: T): T {
  return c;
}

export default defineConfig({
  root: "content",
  output: {
    data: ".velite",
    assets: "public/static",
    base: "/static/",
    name: "[name]-[hash:6].[ext]",
    clean: true,
  },
  collections: { posts, casos, faqs },
});
