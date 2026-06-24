import { randomInt } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { sql, eq, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { serverEnv } from "@/lib/env";
import { sendMail, type MailResult } from "@/lib/email";

/**
 * Lógica de códigos de un solo uso (OTP) para el login passwordless de je-admin.
 * - Se guarda solo el HASH (argon2) del código; nunca el código en claro.
 * - Expiración corta (OTP_TTL_MINUTES) + límite de intentos (OTP_MAX_ATTEMPTS).
 * - Verificación de un solo uso (marca consumed_at).
 */

const CODE_LENGTH = 6;

function generateNumericCode(length = CODE_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) out += randomInt(0, 10).toString();
  return out;
}

/** Crea y persiste un código nuevo para el correo; devuelve el código en claro. */
export async function createLoginCode(
  email: string,
  ip?: string | null,
): Promise<string> {
  const code = generateNumericCode();
  const codeHash = await hash(code);
  const expiresAt = new Date(
    Date.now() + serverEnv.OTP_TTL_MINUTES * 60_000,
  ).toISOString();

  // Limpieza oportunista: elimina códigos ya consumidos o expirados de este
  // correo (mantiene la tabla acotada sin necesidad de un job aparte).
  await db
    .delete(schema.loginCodes)
    .where(
      sql`lower(${schema.loginCodes.email}) = ${email.toLowerCase()} and (${schema.loginCodes.consumedAt} is not null or ${schema.loginCodes.expiresAt} < now())`,
    );

  await db.insert(schema.loginCodes).values({
    email: email.toLowerCase(),
    codeHash,
    expiresAt,
    ip: ip ?? undefined,
  });
  return code;
}

/** Cuántos códigos se han pedido para este correo dentro de la ventana TTL. */
export async function countRecentCodes(email: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.loginCodes)
    .where(
      sql`lower(${schema.loginCodes.email}) = ${email.toLowerCase()} and ${schema.loginCodes.createdAt} > now() - (${serverEnv.OTP_TTL_MINUTES} * interval '1 minute')`,
    );
  return row?.n ?? 0;
}

/**
 * Verifica el código más reciente (no consumido, no expirado) del correo.
 * Incrementa intentos en fallo; marca consumido en éxito. Devuelve true/false.
 */
export async function verifyLoginCode(
  email: string,
  code: string,
): Promise<boolean> {
  // Transacción con FOR UPDATE: bloquea la fila para que dos peticiones
  // simultáneas con el mismo código no puedan consumirlo dos veces (TOCTOU).
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(schema.loginCodes)
      .where(
        sql`lower(${schema.loginCodes.email}) = ${email.toLowerCase()} and ${schema.loginCodes.consumedAt} is null and ${schema.loginCodes.expiresAt} > now()`,
      )
      .orderBy(desc(schema.loginCodes.createdAt))
      .limit(1)
      .for("update");

    if (!row) return false;
    if (row.attempts >= serverEnv.OTP_MAX_ATTEMPTS) return false;

    let ok = false;
    try {
      ok = await verify(row.codeHash, code);
    } catch {
      ok = false;
    }

    if (!ok) {
      await tx
        .update(schema.loginCodes)
        .set({ attempts: row.attempts + 1 })
        .where(eq(schema.loginCodes.id, row.id));
      return false;
    }

    await tx
      .update(schema.loginCodes)
      .set({ consumedAt: new Date().toISOString() })
      .where(eq(schema.loginCodes.id, row.id));
    return true;
  });
}

/** Envía el código por correo con plantilla de marca. */
export async function sendOtpEmail(to: string, code: string): Promise<MailResult> {
  const ttl = serverEnv.OTP_TTL_MINUTES;
  // El código NO va en el asunto (los logs de transporte registran el subject).
  const subject = "Tu acceso a Jygasoft Energy";
  const text = `Tu código de acceso a Jygasoft Energy (je-admin) es: ${code}\nVence en ${ttl} minutos. Si no lo solicitaste, ignora este correo.`;
  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#191c1c">
    <h2 style="color:#002612;margin:0 0 4px">Jygasoft Energy</h2>
    <p style="color:#206c3b;font-weight:600;margin:0 0 16px">Panel de administración</p>
    <p style="font-size:15px;line-height:1.5">Usa este código para iniciar sesión:</p>
    <div style="font-size:34px;font-weight:800;letter-spacing:8px;background:#f8faf9;border:1px solid #e7eae8;border-radius:12px;padding:18px;text-align:center;color:#002612">${code}</div>
    <p style="font-size:13px;color:#6b7280;margin-top:16px">Vence en ${ttl} minutos. Si no solicitaste este código, ignora este correo.</p>
  </div>`;
  return sendMail({ to, subject, html, text });
}
