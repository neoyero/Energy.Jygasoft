import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";

/**
 * Carga el Catálogo Nacional de Códigos Postales (SEPOMEX) en `codigos_postales`.
 *
 *   pnpm db:import-cp <dir-csv>
 *
 * Recibe un directorio con los CSV (uno por estado) generados por
 * `db/scripts/import-cp.ps1` a partir de los .xlsx. Es idempotente: asegura el
 * esquema (migración 0001), siembra hsp_estados y hace TRUNCATE + recarga total.
 *
 * No requiere dependencias nuevas ni red externa (conexión local vía pg).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = join(__dirname, "..");

// Columnas destino en el orden del INSERT.
const COLS = [
  "d_codigo",
  "d_asenta",
  "d_tipo_asenta",
  "d_mnpio",
  "d_estado",
  "d_ciudad",
  "d_cp",
  "c_estado",
  "c_oficina",
  "c_cp",
  "c_tipo_asenta",
  "c_mnpio",
  "id_asenta_cpcons",
  "d_zona",
  "c_cve_ciudad",
] as const;

const BATCH_ROWS = 1000; // 1000 * 15 = 15 000 parámetros (< límite 65 535).

/** Parser simple delimitado (sin comillas), para los .txt SEPOMEX (pipe '|'). */
function parseDelimited(text: string, delim: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split(delim));
}

/** Parser CSV (RFC 4180): comillas, comas/saltos embebidos, comillas escapadas. */
function parseCsv(text: string): string[][] {
  // Quitar BOM (Excel xlCSVUTF8 lo añade).
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch === "\r") {
      // ignora; el \n cierra la fila
    } else {
      field += ch;
    }
  }
  // Última fila sin salto final.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Mapea encabezado del CSV → índice de columna por nombre normalizado. */
function buildHeaderIndex(header: string[]): Map<string, number> {
  const idx = new Map<string, number>();
  header.forEach((h, i) => idx.set(h.trim().toLowerCase(), i));
  return idx;
}

function cell(values: string[], col: number | undefined): string | null {
  if (col === undefined) return null;
  const v = values[col];
  if (v === undefined) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

async function flushBatch(client: PoolClient, batch: (string | null)[][]): Promise<void> {
  if (batch.length === 0) return;
  const params: (string | null)[] = [];
  const tuples: string[] = [];
  batch.forEach((vals, r) => {
    const ph = vals.map((_, c) => `$${r * COLS.length + c + 1}`);
    tuples.push(`(${ph.join(",")})`);
    params.push(...vals);
  });
  await client.query(
    `INSERT INTO codigos_postales (${COLS.join(",")}) VALUES ${tuples.join(",")}`,
    params,
  );
}

/** Lee como UTF-8; si hay bytes inválidos (carácter de reemplazo), reintenta Latin1. */
function readText(file: string): string {
  const utf8 = readFileSync(file, "utf8");
  if (utf8.includes("�")) return readFileSync(file, "latin1");
  return utf8;
}

async function loadFile(client: PoolClient, file: string): Promise<number> {
  const isTxt = file.toLowerCase().endsWith(".txt");
  const text = readText(file);
  const rows = isTxt ? parseDelimited(text, "|") : parseCsv(text);
  if (rows.length === 0) return 0;

  // Localiza la fila de encabezado (los .txt SEPOMEX traen una línea de
  // copyright antes del header). Es la primera fila que contiene 'd_codigo'.
  const headerRow = rows.findIndex((r) =>
    r.some((c) => c.trim().toLowerCase() === "d_codigo"),
  );
  if (headerRow === -1) {
    throw new Error(`${basename(file)}: no encuentro el encabezado con 'd_codigo'`);
  }

  const header = buildHeaderIndex(rows[headerRow]);
  const cpCol = header.get("d_codigo");
  if (cpCol === undefined) {
    throw new Error(`${basename(file)}: no encuentro la columna 'd_codigo' en el encabezado`);
  }
  const colIdx = COLS.map((c) => header.get(c));

  let batch: (string | null)[][] = [];
  let count = 0;
  for (let r = headerRow + 1; r < rows.length; r++) {
    const values = rows[r];
    // Saltar filas vacías o sin CP de 5 dígitos.
    const cp = cell(values, cpCol);
    if (!cp || !/^\d{5}$/.test(cp)) continue;
    batch.push(colIdx.map((c) => cell(values, c)));
    count++;
    if (batch.length >= BATCH_ROWS) {
      await flushBatch(client, batch);
      batch = [];
    }
  }
  await flushBatch(client, batch);
  return count;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está definida (revisa .env)");

  const csvDir = process.argv[2];
  if (!csvDir) {
    throw new Error("Uso: pnpm db:import-cp <dir-csv>");
  }

  const files = readdirSync(csvDir)
    .filter((f) => /\.(csv|txt)$/i.test(f))
    .map((f) => join(csvDir, f))
    .sort();
  if (files.length === 0) {
    throw new Error(`No hay archivos .csv/.txt en ${csvDir}`);
  }

  const migrationSql = readFileSync(
    join(dbDir, "migrations", "0001_codigos_postales.sql"),
    "utf8",
  );
  const hspSeedSql = readFileSync(join(dbDir, "seeds", "hsp_estados.sql"), "utf8");

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    console.log("→ Asegurando esquema (0001_codigos_postales.sql) ...");
    await client.query(migrationSql);

    console.log("→ Sembrando hsp_estados (UPSERT) ...");
    await client.query(hspSeedSql);

    console.log("→ TRUNCATE codigos_postales ...");
    await client.query("TRUNCATE codigos_postales RESTART IDENTITY");

    let total = 0;
    for (const file of files) {
      process.stdout.write(`→ Cargando ${basename(file)} ... `);
      const n = await loadFile(client, file);
      total += n;
      console.log(`${n.toLocaleString("es-MX")} filas`);
    }

    const { rows: est } = await client.query<{ n: string }>(
      "SELECT count(DISTINCT d_estado)::text AS n FROM codigos_postales",
    );
    const { rows: cps } = await client.query<{ n: string }>(
      "SELECT count(DISTINCT d_codigo)::text AS n FROM codigos_postales",
    );
    console.log(
      `✓ Listo: ${total.toLocaleString("es-MX")} asentamientos | ` +
        `${cps[0].n} CPs únicos | ${est[0].n} estados.`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗ Import CP falló:", err);
  process.exit(1);
});
