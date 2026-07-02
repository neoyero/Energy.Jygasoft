import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Contexto de tenant (multi-tenant, Fase 2). Guarda la empresa activa del request
 * en un AsyncLocalStorage y expone un helper de transacción que fija el GUC
 * `app.empresa_id` (y `app.superadmin`) para que las políticas RLS de Postgres
 * apliquen el aislamiento por empresa.
 *
 * Flujo:
 *  1) En cada request de je-admin, `runWithTenant({empresaId, superadmin}, fn)`
 *     establece el contexto (desde la sesión + empresa activa del super-admin).
 *  2) El acceso a BD que deba respetar RLS usa `conTenant(tx => …)`: abre una
 *     transacción y hace `SET LOCAL app.empresa_id` (transaccional, sin fugas de
 *     pool). Las policies RLS leen ese GUC.
 *  3) Super-admin: si `superadmin` está activo, se marca `app.superadmin=on` y las
 *     policies permiten ver todas las empresas.
 */

export interface TenantCtx {
  /** Empresa activa del request (null = sin resolver / super-admin sin selección). */
  empresaId: string | null;
  /** true = puede ver/gestionar todas las empresas (bypass de RLS por empresa). */
  superadmin: boolean;
}

const store = new AsyncLocalStorage<TenantCtx>();

/** Ejecuta `fn` con el contexto de tenant activo. */
export function runWithTenant<T>(ctx: TenantCtx, fn: () => Promise<T>): Promise<T> {
  return store.run(ctx, fn);
}

/** Contexto de tenant del request actual (undefined fuera de un runWithTenant). */
export function tenantActual(): TenantCtx | undefined {
  return store.getStore();
}

/** Empresa activa del request (o null). */
export function empresaActualId(): string | null {
  return store.getStore()?.empresaId ?? null;
}

/** true si el request corre como super-admin (ve todas las empresas). */
export function esSuperadmin(): boolean {
  return store.getStore()?.superadmin ?? false;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Ejecuta `fn` dentro de una transacción con el GUC de tenant fijado (SET LOCAL),
 * para que las políticas RLS apliquen. Usar para toda lectura/escritura que deba
 * respetar el aislamiento por empresa. Si no hay contexto, no fija nada (útil en
 * scripts/seed); en ese caso RLS (si está activa) denegaría — por eso los procesos
 * fuera de request deben correr como superadmin o con empresa explícita.
 */
export async function conTenant<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const ctx = store.getStore();
  return db.transaction(async (tx) => {
    if (ctx?.superadmin) {
      await tx.execute(sql`SELECT set_config('app.superadmin', 'on', true)`);
    } else if (ctx?.empresaId) {
      await tx.execute(sql`SELECT set_config('app.empresa_id', ${ctx.empresaId}, true)`);
    }
    return fn(tx);
  });
}
