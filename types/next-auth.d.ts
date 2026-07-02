import type { DefaultSession } from "next-auth";

type PermMap = Record<string, { view?: boolean; edit?: boolean }>;

declare module "next-auth" {
  interface User {
    rol?: string;
    empresaId?: string | null;
    permisos?: PermMap | null;
  }
  interface Session {
    user: {
      id: string;
      rol: string;
      empresaId?: string | null;
      permisos?: PermMap | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    rol?: string;
    empresaId?: string | null;
    permisos?: PermMap | null;
  }
}
