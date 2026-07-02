import type { NextAuthConfig } from "next-auth";
import type { PermMap } from "@/lib/admin/rbac";

/**
 * Configuración edge-safe de Auth.js (sin providers con dependencias de Node).
 * El provider Credentials (argon2 + DB) se añade en auth.ts (runtime Node).
 * Esta config la usa el middleware para leer la sesión JWT en el edge.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/je-admin/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.rol = user.rol;
        // Contexto multi-tenant + RBAC dinámico (calculado en auth.ts, sin DB aquí
        // para no romper el runtime edge del middleware).
        token.empresaId = user.empresaId ?? null;
        token.permisos = user.permisos ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = String(token.uid);
      if (token.rol) session.user.rol = String(token.rol);
      session.user.empresaId = (token.empresaId as string | null | undefined) ?? null;
      session.user.permisos = (token.permisos as PermMap | null | undefined) ?? null;
      return session;
    },
  },
  providers: [],
};
