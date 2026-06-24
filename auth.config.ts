import type { NextAuthConfig } from "next-auth";

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
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = String(token.uid);
      if (token.rol) session.user.rol = String(token.rol);
      return session;
    },
  },
  providers: [],
};
