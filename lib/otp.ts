import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

// Logo de la empresa en base64 (cacheado), para incrustarlo inline (cid:logo).
let cachedLogo: string | null = null;
function getLogoBase64(): string | null {
  if (cachedLogo !== null) return cachedLogo || null;
  try {
    cachedLogo = readFileSync(join(process.cwd(), "public", "logo.png")).toString("base64");
  } catch {
    cachedLogo = ""; // marcar como intentado (no reintentar en cada envío)
  }
  return cachedLogo || null;
}

/** Envía el código por correo con plantilla de marca (logo inline + diseño pro). */
export async function sendOtpEmail(to: string, code: string): Promise<MailResult> {
  const ttl = serverEnv.OTP_TTL_MINUTES;
  // El código NO va en el asunto (los logs de transporte registran el subject).
  const subject = "Tu código de acceso · Jygasoft Energy";
  const text =
    `Tu código de acceso al panel de Jygasoft Energy es: ${code}\n` +
    `Es de un solo uso y vence en ${ttl} minutos.\n` +
    `Si no solicitaste este acceso, ignora este correo; tu cuenta sigue protegida.`;

  const logo = getLogoBase64();
  const attachments = logo
    ? [{ name: "logo.png", contentType: "image/png", contentBytes: logo, contentId: "logo", isInline: true }]
    : undefined;
  const logoBlock = logo
    ? `<img src="cid:logo" alt="Jygasoft Energy" width="150" style="display:block;margin:0 auto;max-width:150px;height:auto" />`
    : `<div style="font-size:22px;font-weight:800;color:#002612;text-align:center">Jygasoft Energy</div>`;

  const html = `
  <div style="margin:0;padding:24px 12px;background:#eef2f0;font-family:'Segoe UI',system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto">
      <tr><td style="background:#ffffff;border:1px solid #e3e8e5;border-radius:16px;padding:32px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding-bottom:20px">${logoBlock}</td></tr>
          <tr><td style="text-align:center;padding-bottom:4px">
            <span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#206c3b">Panel de administración</span>
          </td></tr>
          <tr><td style="text-align:center;padding-bottom:8px">
            <h1 style="margin:0;font-size:20px;color:#002612">Tu código de acceso</h1>
          </td></tr>
          <tr><td style="text-align:center;padding-bottom:20px">
            <p style="margin:0;font-size:14px;line-height:1.5;color:#4b5563">Úsalo para entrar al panel de Jygasoft Energy. Es de un solo uso.</p>
          </td></tr>
          <tr><td style="padding-bottom:16px">
            <div style="font-size:34px;font-weight:800;letter-spacing:10px;background:#f5faf6;border:1px solid #cfe6d6;border-radius:12px;padding:20px;text-align:center;color:#002612">${code}</div>
          </td></tr>
          <tr><td style="text-align:center;padding-bottom:20px">
            <span style="display:inline-block;background:#fef3c7;color:#92660a;font-size:12px;font-weight:600;border-radius:999px;padding:5px 12px">Vence en ${ttl} minutos</span>
          </td></tr>
          <tr><td style="border-top:1px solid #eef0ef;padding-top:16px">
            <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;text-align:center">¿No solicitaste este acceso? Ignora este correo; tu cuenta sigue protegida.</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="text-align:center;padding-top:16px">
        <p style="margin:0;font-size:11px;color:#9ca3af">Jygasoft Energy · Energía solar en Aguascalientes</p>
      </td></tr>
    </table>
  </div>`;

  return sendMail({ to, subject, html, text, attachments });
}
