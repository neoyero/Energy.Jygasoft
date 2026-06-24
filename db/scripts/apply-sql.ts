import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

/**
 * Aplica un archivo .sql arbitrario contra DATABASE_URL.
 *   pnpm db:apply-sql db/migrations/0002_je_admin_auth.sql
 *
 * Pensado para migraciones idempotentes (CREATE ... IF NOT EXISTS,
 * ADD COLUMN IF NOT EXISTS, ADD VALUE IF NOT EXISTS).
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está definida (revisa .env)");

  const file = process.argv[2];
  if (!file) throw new Error("Uso: pnpm db:apply-sql <ruta.sql>");
  const path = resolve(process.cwd(), file);
  const sqlText = readFileSync(path, "utf8");

  const pool = new Pool({ connectionString: url });
  try {
    console.log(`→ Aplicando ${file} ...`);
    await pool.query(sqlText);
    console.log("✓ Aplicado.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗ apply-sql falló:", err);
  process.exit(1);
});
