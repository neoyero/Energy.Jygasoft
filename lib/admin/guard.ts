import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { puede, type Modulo, type Accion, type PermMap } from "@/lib/admin/rbac";

/**
 * Guards de autorización de je-admin. Defensa en profundidad: además del
 * middleware, cada página/acción valida sesión y permiso por rol.
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

/** Para PÁGINAS: redirige a login si no hay sesión, o al panel si no tiene permiso. */
export async function requirePerm(
  modulo: Modulo,
  accion: Accion = "view",
): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/je-admin/login");
  const u = session.user as SessionUser;
  if (!puede(u.permisos, u.rol, modulo, accion)) redirect("/je-admin");
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
  return u;
}

/** Tag de actor para la bitácora (tabla eventos). */
export function actorOf(user: SessionUser): string {
  return user.id ? `usuario:${user.id}` : "panel";
}
