import { serverEnv } from "@/lib/env";

/**
 * Envío de correo transaccional vía Microsoft 365 / Graph (client-credentials).
 *
 * Requiere un App Registration con permiso de APLICACIÓN `Mail.Send` (consentido
 * por admin) y un buzón remitente (M365_SENDER). Si no está configurado:
 *   - dev: registra el correo en consola (fail-open, para desarrollo local).
 *   - prod: no envía y devuelve { ok:false } (el flujo decide cómo degradar).
 */

interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface MailResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

function isConfigured(): boolean {
  return Boolean(
    serverEnv.M365_TENANT_ID &&
      serverEnv.M365_CLIENT_ID &&
      serverEnv.M365_CLIENT_SECRET &&
      serverEnv.M365_SENDER,
  );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getGraphToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const url = `https://login.microsoftonline.com/${serverEnv.M365_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: serverEnv.M365_CLIENT_ID!,
    client_secret: serverEnv.M365_CLIENT_SECRET!,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
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
  if (!isConfigured()) {
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
    const sender = serverEnv.M365_SENDER!;
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
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
