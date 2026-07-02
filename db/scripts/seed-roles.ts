import "dotenv/config";
import { Client } from "pg";

import { ROLES, MODULOS, can, type Rol } from "@/lib/admin/rbac";

/**
 * Siembra los roles BASE (sistema=true) en cada empresa, derivando su matriz de
 * permisos de la MATRIX del código (vía can()). Idempotente: ON CONFLICT DO
 * NOTHING (no pisa ediciones hechas desde el panel). Correr tras crear empresas.
 *   pnpm db:seed-roles
 */

const NOMBRE: Record<Rol, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  vendedor: "Vendedor",
  preventa: "Preventa",
  ingenieria: "Ingeniería",
  lider_cuadrilla: "Líder de cuadrilla",
  cuadrilla: "Cuadrilla",
  operaciones: "Operaciones",
  finanzas: "Finanzas",
  marketing: "Marketing",
  lectura: "Lectura",
};

async function main(): Promise<void> {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    const empresas = (await c.query(`SELECT id FROM empresas`)).rows as { id: string }[];
    let total = 0;
    for (const e of empresas) {
      for (const rol of ROLES) {
        const permisos: Record<string, { view: boolean; edit: boolean }> = {};
        for (const m of MODULOS) {
          const view = can(rol, m.modulo, "view");
          const edit = can(rol, m.modulo, "edit");
          if (view || edit) permisos[m.modulo] = { view, edit };
        }
        await c.query(
          `INSERT INTO roles (empresa_id, clave, nombre, sistema, permisos)
           VALUES ($1, $2, $3, true, $4::jsonb)
           ON CONFLICT (empresa_id, clave) DO NOTHING`,
          [e.id, rol, NOMBRE[rol] ?? rol, JSON.stringify(permisos)],
        );
        total++;
      }
    }
    console.log(`✓ Roles base sembrados: ${ROLES.length} por empresa × ${empresas.length} empresa(s).`);
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
