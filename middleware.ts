import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

/**
 * Middleware transversal:
 *  - Guard de sesión (Auth.js, edge-safe vía JWT) para /admin.
 *  - Content-Security-Policy (allowlist: self, Meta Pixel/Connect, Turnstile, GA).
 *  - noindex para /admin (mini-CRM no debe indexarse).
 */

const { auth } = NextAuth(authConfig);

const isDev = process.env.NODE_ENV !== "production";

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
  const isAdmin = nextUrl.pathname.startsWith("/admin");
  const isLogin = nextUrl.pathname.startsWith("/admin/login");

  // Guard: /admin requiere sesión (excepto la página de login).
  if (isAdmin && !isLogin && !req.auth) {
    const url = new URL("/admin/login", nextUrl.origin);
    url.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  // Si ya hay sesión y visita /admin/login, mándalo al panel.
  if (isLogin && req.auth) {
    return NextResponse.redirect(new URL("/admin", nextUrl.origin));
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
