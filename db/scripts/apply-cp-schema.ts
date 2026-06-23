import "dotenv/config";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

/**
 * Crea/asegura las tablas de códigos postales (migración 0001) y siembra
 * hsp_estados, SIN cargar datos de CPs. Idempotente.
 *   pnpm db:apply-cp
 *
 * Útil para tener el esquema listo antes de cargar el catálogo con db:import-cp.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = join(__dirname, "..");

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está definida (revisa .env)");

  const migrationSql = readFileSync(
    join(dbDir, "migrations", "0001_codigos_postales.sql"),
    "utf8",
  );
  const hspSeedSql = readFileSync(join(dbDir, "seeds", "hsp_estados.sql"), "utf8");

  const pool = new Pool({ connectionString: url });
  try {
    console.log("→ Asegurando esquema (0001_codigos_postales.sql) ...");
    await pool.query(migrationSql);
    console.log("→ Sembrando hsp_estados (UPSERT) ...");
    await pool.query(hspSeedSql);

    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name IN ('codigos_postales','hsp_estados')
       ORDER BY table_name`,
    );
    const { rows: hsp } = await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM hsp_estados",
    );
    console.log(`✓ Tablas listas: ${rows.map((r) => r.table_name).join(", ")}`);
    console.log(`✓ hsp_estados: ${hsp[0].n} estados sembrados.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗ apply-cp-schema falló:", err);
  process.exit(1);
});
