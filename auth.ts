import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify } from "@node-rs/argon2";
import { sql, eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authConfig } from "@/auth.config";
import { verifyLoginCode } from "@/lib/otp";
import type { PermMap } from "@/lib/admin/rbac";

/**
 * Carga la matriz de permisos del rol del usuario (RBAC dinámico) para su empresa.
 * Se embebe en el JWT al iniciar sesión. Si no hay empresa o el rol no tiene fila
 * activa, devuelve null → el chequeo cae a la matriz del código (fallback seguro).
 */
async function cargarPermisos(empresaId: string | null, rolClave: string): Promise<PermMap | null> {
  if (!empresaId) return null;
  const [r] = await db
    .select({ permisos: schema.roles.permisos })
    .from(schema.roles)
    .where(
      and(
        eq(schema.roles.empresaId, empresaId),
        eq(schema.roles.clave, rolClave),
        eq(schema.roles.activo, true),
      ),
    )
    .limit(1);
  return (r?.permisos as PermMap) ?? null;
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const otpSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
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

        const permisos = await cargarPermisos(user.empresaId, user.rol);
        return {
          id: user.id,
          email: user.email,
          name: user.nombre,
          rol: user.rol,
          empresaId: user.empresaId ?? null,
          permisos,
        };
      },
    }),
    // Login passwordless: verifica el código OTP enviado al correo.
    Credentials({
      id: "otp",
      credentials: { email: {}, code: {} },
      async authorize(raw) {
        const parsed = otpSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, code } = parsed.data;

        // Verifica el usuario ANTES de consumir el código: si no existe o está
        // inactivo, no quemamos el OTP.
        const [user] = await db
          .select()
          .from(schema.usuarios)
          .where(sql`lower(${schema.usuarios.email}) = ${email.toLowerCase()}`)
          .limit(1);

        if (!user || !user.activo) return null;

        const ok = await verifyLoginCode(email, code);
        if (!ok) return null;

        await db
          .update(schema.usuarios)
          .set({ ultimoAcceso: new Date().toISOString() })
          .where(eq(schema.usuarios.id, user.id));

        const permisos = await cargarPermisos(user.empresaId, user.rol);
        return {
          id: user.id,
          email: user.email,
          name: user.nombre,
          rol: user.rol,
          empresaId: user.empresaId ?? null,
          permisos,
        };
      },
    }),
  ],
});
