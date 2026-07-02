import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { puede, type Modulo, type Accion, type PermMap } from "@/lib/admin/rbac";
import { establecerTenant, runWithTenant, type TenantCtx } from "@/lib/tenant/context";

/**
 * Guards de autorización de je-admin. Defensa en profundidad: además del
 * middleware, cada página/acción valida sesión y permiso por rol.
 *
 * Multi-tenant: requirePerm/assertPerm además FIJAN el tenant de la sesión
 * (empresaActualId disponible en todo el handler → scoping a nivel de app). Para
 * el backstop RLS (transacción + SET LOCAL), envuelve el handler con
 * `paginaTenant`/`accionTenant`.
 */

export interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  rol?: string | null;
  empresaId?: string | null;
  /** Matriz de permisos del rol (RBAC dinámico). Ausente = fallback a la matriz. */
  permisos?: PermMap | null;
}

/** Contexto de tenant a partir del usuario de sesión. super-admin: 2F. */
function ctxDe(u: SessionUser): TenantCtx {
  return { empresaId: u.empresaId ?? null, superadmin: false };
}

/** Para PÁGINAS: redirige a login si no hay sesión, o al panel si no tiene permiso. */
export async function requirePerm(
  modulo: Modulo,
  accion: Accion = "view",
): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/je-admin/login");
  const u = session.user as SessionUser;
  if (!puede(u.permisos, u.rol, modulo, accion)) redirect("/je-admin");
  establecerTenant(ctxDe(u));
  return u;
}

/** Para SERVER ACTIONS: lanza si no hay sesión o permiso. Devuelve el usuario. */
export async function assertPerm(
  modulo: Modulo,
  accion: Accion = "view",
): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  const u = session.user as SessionUser;
  if (!puede(u.permisos, u.rol, modulo, accion)) throw new Error("Permiso denegado");
  establecerTenant(ctxDe(u));
  return u;
}

/**
 * PÁGINA con permiso + backstop RLS: valida `view`, fija el tenant y corre el
 * render dentro de una transacción con `SET LOCAL app.empresa_id`. Uso:
 *   export default async function Page() {
 *     return paginaTenant("leads", async () => { ...datos + JSX... })
 *   }
 * Los fetchers llamados dentro reutilizan la misma transacción (runWithTenant
 * es anidable), así que es 1 transacción por render.
 */
export async function paginaTenant<T>(
  modulo: Modulo,
  fn: (u: SessionUser) => Promise<T>,
): Promise<T> {
  const u = await requirePerm(modulo);
  return runWithTenant(ctxDe(u), () => fn(u));
}

/** ACCIÓN con permiso + backstop RLS: valida permiso y corre dentro de la tx de tenant. */
export async function accionTenant<T>(
  modulo: Modulo,
  accion: Accion,
  fn: (u: SessionUser) => Promise<T>,
): Promise<T> {
  const u = await assertPerm(modulo, accion);
  return runWithTenant(ctxDe(u), () => fn(u));
}

/** Tag de actor para la bitácora (tabla eventos). */
export function actorOf(user: SessionUser): string {
  return user.id ? `usuario:${user.id}` : "panel";
}
