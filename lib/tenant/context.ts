import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";

import { basedb, txStore } from "@/db";

/**
 * Contexto de tenant (multi-tenant, Fase 2). Por cada request de je-admin,
 * `runWithTenant({empresaId, superadmin}, fn)`:
 *   1) abre UNA transacción sobre la conexión base,
 *   2) fija el GUC transaccional `app.empresa_id` (o `app.superadmin`),
 *   3) expone esa transacción al proxy `db` (vía `txStore`) para que TODAS las
 *      queries dentro de `fn` hereden el tenant y apliquen RLS — sin reescribirlas.
 *
 * El super-admin corre con `app.superadmin='on'` → ve todas las empresas. El resto
 * queda acotado a su `empresa_id`. Fuera de `runWithTenant` (login, scripts) no hay
 * GUC → la policy RLS transicional permite (se endurece en el cierre 2G).
 */

export interface TenantCtx {
  empresaId: string | null;
  superadmin: boolean;
}

const ctxStore = new AsyncLocalStorage<TenantCtx>();

export function tenantActual(): TenantCtx | undefined {
  return ctxStore.getStore();
}
export function empresaActualId(): string | null {
  return ctxStore.getStore()?.empresaId ?? null;
}
export function esSuperadmin(): boolean {
  return ctxStore.getStore()?.superadmin ?? false;
}

/**
 * Fija el tenant para el resto del contexto async actual, SIN abrir transacción.
 * Úsalo en el guard (requirePerm/assertPerm): deja `empresaActualId()` /
 * `esSuperadmin()` disponibles en toda la página/acción → potencia el scoping a
 * nivel de app (capa primaria de aislamiento, 2E). El backstop RLS se activa
 * además con `runWithTenant`, que abre la transacción y fija el GUC.
 *
 * `enterWith` propaga el store al árbol async del request actual; cada request de
 * Next corre en su propia raíz async, así que no hay fuga entre requests.
 */
export function establecerTenant(ctx: TenantCtx): void {
  ctxStore.enterWith(ctx);
}

export async function runWithTenant<T>(ctx: TenantCtx, fn: () => Promise<T>): Promise<T> {
  // Llamada anidada dentro de un tenant ya activo (p. ej. una página envuelta que
  // llama a una acción también envuelta): reutiliza la transacción/contexto — no
  // abras otra ni exhaustas el pool. Hace que `withTenant` sea seguro de anidar.
  if (txStore.getStore()) return fn();
  return ctxStore.run(ctx, () =>
    basedb.transaction(async (tx) => {
      if (ctx.superadmin) {
        await tx.execute(sql`SELECT set_config('app.superadmin', 'on', true)`);
      } else if (ctx.empresaId) {
        await tx.execute(sql`SELECT set_config('app.empresa_id', ${ctx.empresaId}, true)`);
      }
      // Enruta el `db` global a esta transacción durante `fn`.
      return txStore.run(tx as unknown as typeof basedb, fn);
    }),
  );
}
