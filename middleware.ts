import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { can, type Modulo } from "@/lib/admin/rbac";

/**
 * Middleware transversal:
 *  - Guard de sesión (Auth.js, edge-safe vía JWT) para /je-admin.
 *  - Content-Security-Policy (allowlist: self, Meta Pixel/Connect, Turnstile, GA).
 *  - noindex para /je-admin (mini-CRM no debe indexarse).
 */

const { auth } = NextAuth(authConfig);

const isDev = process.env.NODE_ENV !== "production";

// Mapea la primera parte de la ruta de je-admin a un módulo RBAC.
const SECTION_TO_MODULO: Record<string, Modulo> = {
  leads: "leads",
  oportunidades: "oportunidades",
  clientes: "clientes",
  cotizaciones: "cotizaciones",
  proyectos: "proyectos",
  pagos: "pagos",
  productos: "productos",
  paquetes: "paquetes",
  marcas: "marcas",
  campanas: "campanas",
  actividades: "actividades",
  documentos: "documentos",
  metricas: "metricas",
  areas: "areas",
  cargos: "cargos",
  organigrama: "organizacion",
  chatwoot: "chatwoot",
  integraciones: "integraciones",
  usuarios: "usuarios",
};

function moduloFromPath(pathname: string): Modulo | null {
  const rest = pathname.replace(/^\/je-admin\/?/, "");
  if (rest === "") return "dashboard";
  const seg = rest.split("/")[0]!;
  return SECTION_TO_MODULO[seg] ?? null;
}

function buildCsp(): string {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    isDev ? "'unsafe-eval'" : "",
    "https://connect.facebook.net",
    "https://challenges.cloudflare.com",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
  ]
    .filter(Boolean)
    .join(" ");

  const connectSrc = [
    "'self'",
    "https://www.facebook.com",
    "https://connect.facebook.net",
    "https://challenges.cloudflare.com",
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
    isDev ? "ws:" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.facebook.com https://www.google-analytics.com",
    `connect-src ${connectSrc}`,
    "font-src 'self' data:",
    "frame-src https://challenges.cloudflare.com https://www.facebook.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    isDev ? "" : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ");
}

export default auth((req) => {
  const { nextUrl } = req;
  const isAdmin = nextUrl.pathname.startsWith("/je-admin");
  const isLogin = nextUrl.pathname.startsWith("/je-admin/login");

  // Guard: /je-admin requiere sesión (excepto la página de login).
  if (isAdmin && !isLogin && !req.auth) {
    const url = new URL("/je-admin/login", nextUrl.origin);
    url.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  // Si ya hay sesión y visita /je-admin/login, mándalo al panel.
  if (isLogin && req.auth) {
    return NextResponse.redirect(new URL("/je-admin", nextUrl.origin));
  }

  // Guard por sección (RBAC): bloquea acceso por URL directa a módulos sin permiso.
  if (isAdmin && !isLogin && req.auth) {
    const modulo = moduloFromPath(nextUrl.pathname);
    if (modulo && !can(req.auth.user?.rol, modulo, "view")) {
      return NextResponse.redirect(new URL("/je-admin", nextUrl.origin));
    }
  }

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", buildCsp());
  if (isAdmin) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
