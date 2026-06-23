import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify } from "@node-rs/argon2";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authConfig } from "@/auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const [user] = await db
          .select()
          .from(schema.usuarios)
          .where(sql`lower(${schema.usuarios.email}) = ${email.toLowerCase()}`)
          .limit(1);

        if (!user || !user.activo || !user.passwordHash) return null;

        const valid = await verify(user.passwordHash, password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.nombre,
          rol: user.rol,
        };
      },
    }),
  ],
});
