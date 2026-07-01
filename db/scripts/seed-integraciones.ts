import "dotenv/config";
import { db, schema } from "@/db";
import { serverEnv } from "@/lib/env";
import { REGISTRO } from "@/lib/config/service";
import { cifrarSecreto, configCryptoDisponible } from "@/lib/config/crypto";

/**
 * Bootstrap de `integraciones` desde las variables de entorno actuales:
 * crea una fila por conexión con `ajustes` en claro y `secretos` cifrados.
 * IDEMPOTENTE y seguro: NO pisa filas que ya existan (para no clobbear cambios
 * hechos desde el panel). Requiere CONFIG_ENC_KEY para cifrar los secretos.
 *
 *   pnpm tsx db/scripts/seed-integraciones.ts
 */
async function main() {
  if (!configCryptoDisponible()) {
    console.error(
      "❌ CONFIG_ENC_KEY no está configurada o no es válida (32 bytes base64). Genera una con:\n" +
        '   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
    process.exit(1);
  }

  const env = serverEnv as unknown as Record<string, unknown>;
  const existentes = new Set(
    (await db.select({ clave: schema.integraciones.clave }).from(schema.integraciones)).map(
      (r) => r.clave,
    ),
  );

  let creadas = 0;
  for (const def of REGISTRO) {
    if (existentes.has(def.clave)) {
      console.log(`= ${def.clave}: ya existe, se omite.`);
      continue;
    }

    const ajustes: Record<string, string> = {};
    for (const a of def.ajustes) {
      const v = a.env ? env[a.env] : undefined;
      if (typeof v === "string" && v.length > 0) ajustes[a.campo] = v;
    }

    const secretos: Record<string, unknown> = {};
    for (const s of def.secretos) {
      const v = s.env ? env[s.env] : undefined;
      if (typeof v === "string" && v.length > 0) {
        secretos[s.campo] = cifrarSecreto(`${def.clave}:${s.campo}`, v);
      }
    }

    await db.insert(schema.integraciones).values({
      clave: def.clave,
      nombre: def.nombre,
      descripcion: def.descripcion,
      activo: true,
      ajustes,
      secretos,
    });
    creadas += 1;
    console.log(
      `+ ${def.clave}: creada (ajustes: ${Object.keys(ajustes).length}, secretos: ${Object.keys(secretos).length}).`,
    );
  }

  console.log(`\nListo. ${creadas} integraciones creadas, ${existentes.size} ya existían.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
