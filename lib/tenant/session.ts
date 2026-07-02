import { auth } from "@/auth";

import { runWithTenant } from "@/lib/tenant/context";

/**
 * Envuelve el cuerpo de una página/acción de je-admin en el contexto de tenant de
 * la sesión: fija `app.empresa_id` para que las queries dentro apliquen RLS.
 * Uso:
 *   export default async function Page() {
 *     return withTenant(async () => { ...carga de datos + JSX... })
 *   }
 * o en una server action:
 *   export async function accion() { return withTenant(async () => { ... }) }
 *
 * Super-admin: por ahora `superadmin=false` (cada quien a su empresa); el selector
 * de empresa activa del super-admin se conecta en el incremento 2F.
 */
export async function withTenant<T>(fn: () => Promise<T>): Promise<T> {
  const session = await auth();
  const u = session?.user as { empresaId?: string | null } | undefined;
  return runWithTenant({ empresaId: u?.empresaId ?? null, superadmin: false }, fn);
}
