import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { Client } from "pg";

/**
 * Genera un seed ESENCIAL (config) con datos reales de la BD:
 *  - integraciones (ajustes + secretos cifrados tal cual)
 *  - el usuario admin (Yerandy) únicamente
 *  - cargos (catálogo)
 *  - áreas + area_lideres (solo del admin)
 * NO incluye leads/oportunidades/clientes/proyectos/etc.
 *
 * Uso:  pnpm tsx db/scripts/gen-seed-esencial.ts
 * Salida: db/Backup-SQL/Seed_Esencial.sql  (carpeta blindada en git)
 */

const ADMIN_EMAIL = "yerandy.arias@jygasoft.com";
const OUT = path.join("db", "Backup-SQL", "Seed_Esencial.sql");

function q(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return `'${v.toISOString()}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}
function qjson(v: unknown): string {
  if (v === null || v === undefined) return "'{}'::jsonb";
  return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL en el entorno (.env).");
  const c = new Client({ connectionString: url });
  await c.connect();

  try {
    const admin = await c.query(
      `SELECT * FROM usuarios WHERE lower(email) = lower($1) LIMIT 1`,
      [ADMIN_EMAIL],
    );
    if (admin.rowCount === 0) throw new Error(`No se encontró el usuario ${ADMIN_EMAIL}.`);
    const u = admin.rows[0];
    const adminId: string = u.id;

    const cargos = (await c.query(`SELECT * FROM cargos ORDER BY orden, nombre`)).rows;
    const areas = (await c.query(`SELECT * FROM areas ORDER BY created_at`)).rows;
    const lideres = (
      await c.query(`SELECT * FROM area_lideres WHERE usuario_id = $1 ORDER BY area_id, orden`, [adminId])
    ).rows;
    const integraciones = (await c.query(`SELECT * FROM integraciones ORDER BY clave`)).rows;

    const areaIds = new Set(areas.map((a) => a.id as string));

    const L: string[] = [];
    L.push("-- =====================================================================");
    L.push("-- Seed ESENCIAL (config) — generado desde la BD actual.");
    L.push("-- Incluye: integraciones (claves cifradas), usuario admin, cargos, areas,");
    L.push("-- area_lideres. NO incluye leads/oportunidades/clientes/proyectos/etc.");
    L.push("--");
    L.push("-- ⚠ Los secretos de integraciones van CIFRADOS (AES-256-GCM). Solo se");
    L.push("--   descifran con el MISMO CONFIG_ENC_KEY del entorno donde se generaron.");
    L.push("-- Idempotente (ON CONFLICT DO NOTHING). Requiere el esquema ya creado.");
    L.push("-- =====================================================================");
    L.push("BEGIN;");
    L.push("");

    // 1) Cargos
    if (cargos.length) {
      L.push("-- Cargos (catálogo)");
      L.push(
        "INSERT INTO cargos (id, nombre, nombre_normalizado, activo, orden, created_at, updated_at) VALUES",
      );
      L.push(
        cargos
          .map(
            (r) =>
              `  (${q(r.id)}, ${q(r.nombre)}, ${q(r.nombre_normalizado)}, ${q(r.activo)}, ${q(r.orden)}, ${q(r.created_at)}, ${q(r.updated_at)})`,
          )
          .join(",\n") + "\nON CONFLICT (id) DO NOTHING;",
      );
      L.push("");
    }

    // 2) Usuario admin (area_id/reporta_a se ajustan después para evitar ciclos de FK)
    L.push("-- Usuario admin (Yerandy) — reporta_a/area_id se fijan más abajo");
    L.push(
      "INSERT INTO usuarios (id, nombre, email, rol, folio_vendedor, telefono, password_hash, activo, reporta_a, cargo, cargo_id, area_id, ultimo_acceso, created_at, updated_at) VALUES",
    );
    L.push(
      `  (${q(u.id)}, ${q(u.nombre)}, ${q(u.email)}, ${q(u.rol)}, ${q(u.folio_vendedor)}, ${q(u.telefono)}, ${q(u.password_hash)}, ${q(u.activo)}, NULL, ${q(u.cargo)}, ${q(u.cargo_id)}, NULL, ${q(u.ultimo_acceso)}, ${q(u.created_at)}, ${q(u.updated_at)})`,
    );
    L.push("ON CONFLICT (id) DO NOTHING;");
    L.push("");

    // 3) Áreas — primero sin padre_id ni lider ajeno; luego padre_id
    if (areas.length) {
      L.push("-- Áreas (padre_id se fija en el paso siguiente)");
      L.push(
        "INSERT INTO areas (id, nombre, nombre_normalizado, descripcion, lider_id, padre_id, activa, created_at, updated_at) VALUES",
      );
      L.push(
        areas
          .map((r) => {
            const lider = r.lider_id === adminId ? q(r.lider_id) : "NULL";
            return `  (${q(r.id)}, ${q(r.nombre)}, ${q(r.nombre_normalizado)}, ${q(r.descripcion)}, ${lider}, NULL, ${q(r.activa)}, ${q(r.created_at)}, ${q(r.updated_at)})`;
          })
          .join(",\n") + "\nON CONFLICT (id) DO NOTHING;",
      );
      L.push("");
      const conPadre = areas.filter((a) => a.padre_id && areaIds.has(a.padre_id as string));
      if (conPadre.length) {
        L.push("-- Jerarquía de áreas (padre_id)");
        for (const a of conPadre) {
          L.push(`UPDATE areas SET padre_id = ${q(a.padre_id)} WHERE id = ${q(a.id)};`);
        }
        L.push("");
      }
    }

    // 4) Ajusta el área del admin (si su área está en el conjunto)
    const adminArea = u.area_id && areaIds.has(u.area_id as string) ? u.area_id : null;
    if (adminArea) {
      L.push("-- Área del admin");
      L.push(`UPDATE usuarios SET area_id = ${q(adminArea)} WHERE id = ${q(adminId)};`);
      L.push("");
    }

    // 5) Líderes de área (solo del admin)
    if (lideres.length) {
      L.push("-- Líderes de área (solo el admin)");
      L.push("INSERT INTO area_lideres (area_id, usuario_id, orden, created_at) VALUES");
      L.push(
        lideres
          .filter((r) => areaIds.has(r.area_id as string))
          .map((r) => `  (${q(r.area_id)}, ${q(r.usuario_id)}, ${q(r.orden)}, ${q(r.created_at)})`)
          .join(",\n") + "\nON CONFLICT (area_id, usuario_id) DO NOTHING;",
      );
      L.push("");
    }

    // 6) Integraciones (ajustes + secretos cifrados)
    if (integraciones.length) {
      L.push("-- Integraciones (llaves/config; secretos cifrados)");
      L.push(
        "INSERT INTO integraciones (clave, nombre, descripcion, activo, ajustes, secretos, actualizado_por, created_at, updated_at) VALUES",
      );
      L.push(
        integraciones
          .map((r) => {
            const actor = r.actualizado_por === adminId ? q(r.actualizado_por) : "NULL";
            return `  (${q(r.clave)}, ${q(r.nombre)}, ${q(r.descripcion)}, ${q(r.activo)}, ${qjson(r.ajustes)}, ${qjson(r.secretos)}, ${actor}, ${q(r.created_at)}, ${q(r.updated_at)})`;
          })
          .join(",\n") + "\nON CONFLICT (clave) DO NOTHING;",
      );
      L.push("");
    }

    L.push("COMMIT;");
    L.push("");

    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(OUT, L.join("\n"), "utf8");

    console.log(`✓ Seed generado: ${OUT}`);
    console.log(
      `  cargos=${cargos.length} areas=${areas.length} area_lideres=${lideres.length} integraciones=${integraciones.length} usuario=1 (${u.nombre})`,
    );
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
