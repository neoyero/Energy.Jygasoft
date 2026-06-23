import "dotenv/config";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

/**
 * Aplica el esquema canónico (0000_init.sql) y los seeds (seed.sql) a la BD
 * apuntada por DATABASE_URL. Ejecutar UNA vez sobre una BD vacía.
 *
 *   pnpm db:apply
 *
 * Pre-requisito: el rol/BD energy_app deben existir (ver db/scripts/bootstrap.sql).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = join(__dirname, "..");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está definida (revisa .env)");

  const schemaSql = readFileSync(join(dbDir, "migrations", "0000_init.sql"), "utf8");
  const seedSql = readFileSync(join(dbDir, "seed.sql"), "utf8");

  const pool = new Pool({ connectionString: url });
  try {
    console.log("→ Aplicando esquema 0000_init.sql ...");
    await pool.query(schemaSql);
    console.log("✓ Esquema aplicado.");

    console.log("→ Cargando seeds seed.sql ...");
    await pool.query(seedSql);
    console.log("✓ Seeds cargados.");

    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'",
    );
    console.log(`✓ Tablas en public: ${rows[0].n}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗ Error aplicando init:", err);
  process.exit(1);
});
