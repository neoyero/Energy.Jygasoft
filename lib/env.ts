import { z } from "zod";

/**
 * Validación de variables de entorno (server-side) con Zod.
 *
 * Reglas:
 * - Solo las `NEXT_PUBLIC_*` pueden llegar al navegador.
 * - Secretos (DB, HMAC, CAPI, tokens) NUNCA se exponen al cliente: viven en `serverEnv`.
 * - Fail-fast: si falta/está mal una variable requerida, lanza al boot.
 *
 * Estrategia por fases: las variables de servicios aún no cableados se marcan
 * `.optional()` y se endurecen (quitando optional) cuando aterriza su fase.
 *   - Fase 2 (DB): DATABASE_URL
 *   - Fase 3 (lead→n8n): N8N_WEBHOOK_URL, N8N_HMAC_SECRET, TURNSTILE_SECRET, NEXT_PUBLIC_TURNSTILE_SITE_KEY
 *   - Fase 6 (Meta): META_PIXEL_ID, META_CAPI_TOKEN, NEXT_PUBLIC_META_PIXEL_ID
 *   - Fase 7 (Auth/webhook inbound): AUTH_SECRET, AUTH_URL, WEBHOOK_INBOUND_SECRET
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Fase 2 — Base de datos
  DATABASE_URL: z.string().url().optional(),

  // Fase 3 — Integración n8n (saliente)
  N8N_WEBHOOK_URL: z.string().url().optional(),
  N8N_HMAC_SECRET: z.string().min(16).optional(),
  N8N_HMAC_KID: z.string().default("energy-web-v1"),

  // Fase 7 — Inbound desde n8n
  WEBHOOK_INBOUND_SECRET: z.string().min(16).optional(),

  // Fase 3 — Anti-spam (server)
  TURNSTILE_SECRET: z.string().min(1).optional(),

  // Asistente IA (Gemini) — server-only. Acepta vacío (→ undefined) para dev.
  GEMINI_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),

  // Fase 6 — Meta Conversions API (server-only)
  META_PIXEL_ID: z.string().min(1).optional(),
  META_CAPI_TOKEN: z.string().min(1).optional(),
  META_CAPI_TEST_EVENT_CODE: z.string().optional(),

  // Fase 7 — Auth.js
  AUTH_SECRET: z.string().min(16).optional(),
  AUTH_URL: z.string().url().optional(),

  // je-admin — Microsoft 365 (Graph) para enviar el código OTP por correo.
  // Si faltan, en dev se loguea el código a consola (fail-open) y en prod no envía.
  M365_TENANT_ID: z.string().optional(),
  M365_CLIENT_ID: z.string().optional(),
  M365_CLIENT_SECRET: z.string().optional(),
  M365_SENDER: z.string().email().optional(),

  // je-admin — Login passwordless por código (OTP)
  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(5),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_REQUESTS_PER_EMAIL: z.coerce.number().int().positive().default(3),

  // Rate-limit (server) — valores por defecto razonables
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_META_PIXEL_ID: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
});

type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

function parseServer(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `❌ Variables de entorno de servidor inválidas:\n${formatIssues(parsed.error)}`,
    );
  }
  return parsed.data;
}

function parseClient(): ClientEnv {
  // Next inyecta las NEXT_PUBLIC_* en build; aquí leemos process.env de forma
  // estática para que el bundler las reemplace.
  const source = {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  };
  const parsed = clientSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `❌ Variables de entorno públicas inválidas:\n${formatIssues(parsed.error)}`,
    );
  }
  return parsed.data;
}

/** Variables públicas (seguras para el cliente). */
export const clientEnv: ClientEnv = parseClient();

/**
 * Variables de servidor. Acceder a esto desde un componente de cliente
 * provocará un error de bundling (process.env de secretos no se inyecta),
 * que es justo la protección deseada.
 */
export const serverEnv: ServerEnv =
  typeof window === "undefined"
    ? parseServer()
    : (undefined as unknown as ServerEnv);
