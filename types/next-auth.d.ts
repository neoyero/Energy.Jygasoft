import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    rol?: string;
  }
  interface Session {
    user: {
      id: string;
      rol: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    rol?: string;
  }
}
