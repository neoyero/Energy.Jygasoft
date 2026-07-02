import { serverEnv } from "@/lib/env";
import { getIntegracion } from "@/lib/config/service";

/**
 * Envío de correo transaccional vía Microsoft 365 / Graph (client-credentials).
 *
 * Requiere un App Registration con permiso de APLICACIÓN `Mail.Send` (consentido
 * por admin) y un buzón remitente (M365_SENDER). Si no está configurado:
 *   - dev: registra el correo en consola (fail-open, para desarrollo local).
 *   - prod: no envía y devuelve { ok:false } (el flujo decide cómo degradar).
 */

export interface MailAttachment {
  name: string;
  contentType: string;
  /** Contenido en base64. */
  contentBytes: string;
  /** Si se define + isInline, se referencia en el HTML como cid:<contentId>. */
  contentId?: string;
  isInline?: boolean;
}

interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
}

export interface MailResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Invalida el token de Graph en caché. Útil tras cambiar permisos/consentimiento
 * en Azure: el siguiente getGraphToken() emite uno nuevo con los permisos actuales
 * (sin esperar a que expire el cacheado, ~1h).
 */
export function invalidateGraphToken(): void {
  cachedToken = null;
}

/**
 * Token de aplicación de Microsoft Graph (client-credentials, scope .default).
 * La config de M365 se resuelve desde el servicio (BD con fallback a env).
 */
export async function getGraphToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const m = await getIntegracion("m365");
  const tenantId = m.ajuste("tenant_id");
  const clientId = m.ajuste("client_id");
  const clientSecret = m.secreto("client_secret");
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("m365_no_configurado");
  }
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[email] token Graph ${res.status}: ${detail.slice(0, 300)}`);
    throw new Error(`graph_token_failed_${res.status}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  const m = await getIntegracion("m365");
  const sender = m.ajuste("sender");
  const configured =
    Boolean(m.ajuste("tenant_id") && m.ajuste("client_id") && m.secreto("client_secret")) &&
    Boolean(sender);
  if (!configured) {
    if (serverEnv.NODE_ENV === "production") {
      console.error("[email] Microsoft 365 no configurado; no se envió el correo.");
      return { ok: false, error: "not_configured" };
    }
    // Fallback de desarrollo: imprime el contenido para poder probar el flujo.
    console.info(
      `\n[email:dev] → ${input.to}\n  asunto: ${input.subject}\n  ${input.text ?? input.html}\n`,
    );
    return { ok: true, skipped: true };
  }

  try {
    const token = await getGraphToken();
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender as string)}/sendMail`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: input.subject,
            body: { contentType: "HTML", content: input.html },
            toRecipients: [{ emailAddress: { address: input.to } }],
            ...(input.attachments && input.attachments.length > 0
              ? {
                  attachments: input.attachments.map((a) => ({
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    name: a.name,
                    contentType: a.contentType,
                    contentBytes: a.contentBytes,
                    contentId: a.contentId,
                    isInline: a.isInline ?? false,
                  })),
                }
              : {}),
          },
          saveToSentItems: false,
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] Graph sendMail ${res.status}: ${detail.slice(0, 300)}`);
      return { ok: false, error: `graph_${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    console.error("[email] error", error);
    return { ok: false, error: "send_failed" };
  }
}
