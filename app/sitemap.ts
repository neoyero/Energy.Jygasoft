import type { MetadataRoute } from "next";
import { posts, casos } from "#site/content";
import { clientEnv } from "@/lib/env";

const SITE = clientEnv.NEXT_PUBLIC_SITE_URL;

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/casa",
    "/negocio",
    "/casos-uso",
    "/calculadora",
    "/casos",
    "/blog",
    "/faq",
    "/nosotros",
    "/contacto",
    "/soporte",
    "/legal/aviso-privacidad",
    "/legal/terminos",
  ].map((path) => ({
    url: `${SITE}${path}`,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  const postRoutes = posts
    .filter((p) => !p.draft)
    .map((p) => ({ url: `${SITE}${p.url}`, lastModified: p.updated ?? p.date }));

  const casoRoutes = casos.map((c) => ({
    url: `${SITE}${c.url}`,
    lastModified: c.date,
  }));

  return [...staticRoutes, ...postRoutes, ...casoRoutes];
}
