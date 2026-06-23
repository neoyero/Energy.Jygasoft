import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Firma HMAC-SHA256 del contrato sitio ↔ n8n.
 *
 * La firma cubre `timestamp + "." + rawBody` para atar la firma a un instante
 * concreto (defensa anti-replay) y al cuerpo exacto recibido.
 * Formato: `sha256=<hex>`.
 */

const DEFAULT_WINDOW_MS = 5 * 60_000; // 5 minutos

export function sign(body: string, ts: string, secret: string): string {
  const hex = createHmac("sha256", secret)
    .update(`${ts}.${body}`)
    .digest("hex");
  return `sha256=${hex}`;
}

interface VerifyOptions {
  /** Ventana anti-replay en ms (default 5 min). */
  windowMs?: number;
  /** Instante actual en ms (inyectable para tests; default Date.now()). */
  now?: number;
}

/**
 * Verifica firma + frescura del timestamp en tiempo constante.
 * Devuelve `false` ante cualquier entrada inválida (no lanza).
 */
export function verify(
  body: string,
  ts: string,
  sig: string,
  secret: string,
  options: VerifyOptions = {},
): boolean {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const now = options.now ?? Date.now();

  // Validación del timestamp (anti-replay): número y dentro de la ventana.
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(now - tsNum) > windowMs) return false;

  // Comparación en tiempo constante contra la firma esperada.
  const expected = sign(body, ts, secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sig, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
