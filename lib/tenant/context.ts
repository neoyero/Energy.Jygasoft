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

export async function runWithTenant<T>(ctx: TenantCtx, fn: () => Promise<T>): Promise<T> {
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
