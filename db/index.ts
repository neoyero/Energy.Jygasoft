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

export const db = drizzle(pool, { schema: fullSchema });

export { schema };
