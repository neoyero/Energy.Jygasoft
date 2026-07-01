import "dotenv/config";
import { Client } from "pg";

import { REGISTRO } from "@/lib/config/service";
import { cifrarSecreto } from "@/lib/config/crypto";

/**
 * Persiste UNA integración desde variables de entorno hacia la tabla
 * `integraciones` (ajustes en claro + secretos cifrados AES-256-GCM). Reutiliza
 * el REGISTRO como fuente de campos/env. Idempotente (merge por jsonb `||`).
 *
 * Uso:  pnpm tsx db/scripts/upsert-integracion.ts <clave>
 *   p.ej. pnpm tsx db/scripts/upsert-integracion.ts turnstile
 * Requiere CONFIG_ENC_KEY en el entorno.
 */
async function main(): Promise<void> {
  const clave = process.argv[2];
  const def = REGISTRO.find((d) => d.clave === clave);
  if (!def) {
    console.error(`Clave no válida. Opciones: ${REGISTRO.map((d) => d.clave).join(", ")}`);
    process.exit(1);
  }

  const env = process.env;
  const ajustes: Record<string, string> = {};
  for (const c of def.ajustes) {
    const v = c.env ? env[c.env] : undefined;
    if (typeof v === "string" && v.length > 0) ajustes[c.campo] = v;
  }
  const secretos: Record<string, unknown> = {};
  for (const c of def.secretos) {
    const v = c.env ? env[c.env] : undefined;
    if (typeof v === "string" && v.length > 0) {
      secretos[c.campo] = cifrarSecreto(`${clave}:${c.campo}`, v);
    }
  }

  if (Object.keys(ajustes).length === 0 && Object.keys(secretos).length === 0) {
    console.error(`Sin valores en env para '${clave}' (revisa las variables ${def.secretos.map((s) => s.env).join(", ")}).`);
    process.exit(1);
  }

  const c = new Client({ connectionString: env.DATABASE_URL });
  await c.connect();
  try {
    await c.query(
      `INSERT INTO integraciones (clave, nombre, descripcion, activo, ajustes, secretos)
       VALUES ($1, $2, $3, true, $4::jsonb, $5::jsonb)
       ON CONFLICT (clave) DO UPDATE SET
         ajustes  = integraciones.ajustes  || EXCLUDED.ajustes,
         secretos = integraciones.secretos || EXCLUDED.secretos,
         updated_at = now()`,
      [clave, def.nombre, def.descripcion, JSON.stringify(ajustes), JSON.stringify(secretos)],
    );
    console.log(
      `✓ ${clave} upsert: ajustes=${Object.keys(ajustes).length} secretos=${Object.keys(secretos).length}`,
    );
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
