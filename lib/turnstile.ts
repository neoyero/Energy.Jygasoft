import { serverEnv } from "@/lib/env";
import { getIntegracion } from "@/lib/config/service";

/**
 * Verificación server-side de Cloudflare Turnstile.
 * - Sin `TURNSTILE_SECRET` configurado: permite en desarrollo (fail-open) y
 *   bloquea en producción (fail-closed), para no romper el dev local.
 */

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  success: boolean;
  reason?: string;
}

export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<TurnstileResult> {
  const secret = (await getIntegracion("turnstile")).secreto("secret");

  if (!secret) {
    if (serverEnv.NODE_ENV === "production") {
      return { success: false, reason: "turnstile_not_configured" };
    }
    return { success: true, reason: "turnstile_skipped_dev" };
  }

  if (!token) return { success: false, reason: "missing_token" };

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);

    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success: boolean };
    return { success: Boolean(data.success) };
  } catch {
    return { success: false, reason: "turnstile_request_failed" };
  }
}
