import "dotenv/config";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

/**
 * Carga los seeds (seed.sql) en la BD. Ejecutar UNA vez tras la migración
 * inicial en un entorno nuevo (los INSERT no son idempotentes).
 *   pnpm db:seed
 */
const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no definida");
  const seedSql = readFileSync(join(__dirname, "..", "seed.sql"), "utf8");
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(seedSql);
    console.log("✓ Seeds cargados.");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("✗ Seed falló:", e);
  process.exit(1);
});
