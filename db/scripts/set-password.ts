import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { Pool } from "pg";

/**
 * Fija (o actualiza) la contraseña argon2 de un usuario del panel.
 *   pnpm tsx db/scripts/set-password.ts <email> <password>
 */
async function main() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error("Uso: tsx db/scripts/set-password.ts <email> <password>");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no definida");

  const passwordHash = await hash(password);
  const pool = new Pool({ connectionString: url });
  try {
    const { rowCount } = await pool.query(
      "UPDATE usuarios SET password_hash = $1 WHERE lower(email) = lower($2)",
      [passwordHash, email],
    );
    console.log(rowCount ? `✓ Contraseña actualizada para ${email}` : `✗ Usuario no encontrado: ${email}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
