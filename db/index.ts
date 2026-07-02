import { AsyncLocalStorage } from "node:async_hooks";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";
import * as relations from "./relations";

/**
 * Conexión a PostgreSQL vía pg.Pool + Drizzle.
 *
 * Co-hosteado en el droplet de n8n (misma VPC) → pool directo, sin pgbouncer.
 * El pool se reutiliza entre invocaciones gracias al cache de módulos de Node.
 *
 */

export const fullSchema = { ...schema, ...relations };

const globalForPool = globalThis as unknown as { __energyPool?: Pool };

export const pool =
  globalForPool.__energyPool ??
  new Pool({
    connectionString: serverEnv.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (serverEnv.NODE_ENV !== "production") {
  globalForPool.__energyPool = pool;
}

/** Instancia base (pool). Úsala en procesos SIN tenant (migraciones/seed). */
export const basedb = drizzle(pool, { schema: fullSchema });
type DrizzleDb = typeof basedb;

/**
 * Transacción de tenant activa del request (la fija `runWithTenant`). Cuando
 * existe, el `db` exportado enruta TODAS las queries a ella (con el GUC
 * `app.empresa_id` seteado → aplica RLS), sin tener que reescribir las queries.
 */
export const txStore = new AsyncLocalStorage<DrizzleDb>();

/**
 * `db` tenant-aware: si hay una transacción de tenant activa (AsyncLocalStorage),
 * reenvía a ella; si no, al pool base. Comportamiento idéntico al de antes cuando
 * no hay tenant activo (p. ej. login, scripts).
 */
export const db: DrizzleDb = new Proxy(basedb, {
  get(target, prop, receiver) {
    const active = (txStore.getStore() ?? target) as DrizzleDb;
    const value = Reflect.get(active as object, prop, receiver);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(active) : value;
  },
}) as DrizzleDb;

export { schema };
