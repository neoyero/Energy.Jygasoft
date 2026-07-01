import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { serverEnv } from "@/lib/env";
import { descifrarSecreto, esSecretoCifrado } from "@/lib/config/crypto";

/**
 * Servicio de configuración: lee las conexiones de la tabla `integraciones`
 * (ajustes en claro + secretos cifrados) con **caché por proceso** y **fallback
 * a variables de entorno**. Así se migra de `.env` a BD sin downtime: si una
 * clave/campo no está en la BD, se usa el valor de env.
 *
 * El REGISTRO es la fuente única: describe qué campos (ajustes/secretos) tiene
 * cada integración y su variable de env de respaldo. Lo usan también el seed y
 * la UI de administración.
 */

export interface CampoDef {
  campo: string;
  label: string;
  /** Variable de env de respaldo (nombre en serverEnv). */
  env?: string;
  /** Marca campos obligatorios para considerar la integración "configurada". */
  requerido?: boolean;
}

export interface IntegracionDef {
  clave: string;
  nombre: string;
  descripcion: string;
  ajustes: CampoDef[];
  secretos: CampoDef[];
}

export const REGISTRO: IntegracionDef[] = [
  {
    clave: "chatwoot",
    nombre: "Chatwoot",
    descripcion: "Conversaciones con clientes (agentes = asesores).",
    ajustes: [
      { campo: "url", label: "URL", env: "CHATWOOT_URL", requerido: true },
      { campo: "account_id", label: "Account ID", env: "CHATWOOT_ACCOUNT_ID", requerido: true },
    ],
    secretos: [
      { campo: "api_token", label: "API token", env: "CHATWOOT_API_TOKEN", requerido: true },
      { campo: "platform_token", label: "Platform token", env: "CHATWOOT_PLATFORM_TOKEN" },
      { campo: "webhook_secret", label: "Webhook secret", env: "CHATWOOT_WEBHOOK_SECRET" },
    ],
  },
  {
    clave: "m365",
    nombre: "Microsoft 365 (Graph)",
    descripcion: "Correo OTP y documentos en SharePoint/OneDrive.",
    ajustes: [
      { campo: "tenant_id", label: "Tenant ID", env: "M365_TENANT_ID", requerido: true },
      { campo: "client_id", label: "Client ID", env: "M365_CLIENT_ID", requerido: true },
      { campo: "sender", label: "Remitente (correo)", env: "M365_SENDER" },
      { campo: "docs_drive_id", label: "Docs Drive ID", env: "M365_DOCS_DRIVE_ID" },
      { campo: "docs_site_id", label: "Docs Site ID", env: "M365_DOCS_SITE_ID" },
      { campo: "docs_root", label: "Docs root", env: "M365_DOCS_ROOT" },
    ],
    secretos: [
      { campo: "client_secret", label: "Client secret", env: "M365_CLIENT_SECRET", requerido: true },
    ],
  },
  {
    clave: "meta",
    nombre: "Meta Conversions API",
    descripcion: "Envío de eventos de conversión a Meta.",
    ajustes: [
      { campo: "pixel_id", label: "Pixel ID", env: "META_PIXEL_ID", requerido: true },
      { campo: "test_event_code", label: "Test event code", env: "META_CAPI_TEST_EVENT_CODE" },
    ],
    secretos: [
      { campo: "capi_token", label: "CAPI token", env: "META_CAPI_TOKEN", requerido: true },
    ],
  },
  {
    clave: "n8n",
    nombre: "n8n (automatización)",
    descripcion: "Webhooks salientes/entrantes de automatización.",
    ajustes: [
      { campo: "webhook_url", label: "Webhook URL", env: "N8N_WEBHOOK_URL", requerido: true },
      { campo: "hmac_kid", label: "HMAC kid", env: "N8N_HMAC_KID" },
    ],
    secretos: [
      { campo: "hmac_secret", label: "HMAC secret", env: "N8N_HMAC_SECRET", requerido: true },
      { campo: "webhook_inbound_secret", label: "Webhook inbound secret", env: "WEBHOOK_INBOUND_SECRET" },
    ],
  },
  {
    clave: "gemini",
    nombre: "Gemini (IA)",
    descripcion: "Asistente de IA para el chat de consulta.",
    ajustes: [{ campo: "model", label: "Modelo", env: "GEMINI_MODEL" }],
    secretos: [{ campo: "api_key", label: "API key", env: "GEMINI_API_KEY", requerido: true }],
  },
  {
    clave: "turnstile",
    nombre: "Cloudflare Turnstile",
    descripcion: "Anti-spam de formularios.",
    ajustes: [],
    secretos: [{ campo: "secret", label: "Secret", env: "TURNSTILE_SECRET", requerido: true }],
  },
];

const DEF_POR_CLAVE = new Map(REGISTRO.map((d) => [d.clave, d]));

/** Lee la variable de env de respaldo por nombre (server-only). */
function envFallback(nombre?: string): string | undefined {
  if (!nombre) return undefined;
  const v = (serverEnv as unknown as Record<string, unknown>)[nombre];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

interface FilaCache {
  activo: boolean;
  ajustes: Record<string, unknown>;
  secretos: Record<string, unknown>;
  expira: number;
}
const CACHE = new Map<string, FilaCache>();
const TTL_MS = 60_000;

async function cargar(clave: string): Promise<FilaCache> {
  const hit = CACHE.get(clave);
  if (hit && hit.expira > Date.now()) return hit;

  let fila: FilaCache = { activo: true, ajustes: {}, secretos: {}, expira: Date.now() + TTL_MS };
  try {
    const [row] = await db
      .select({
        activo: schema.integraciones.activo,
        ajustes: schema.integraciones.ajustes,
        secretos: schema.integraciones.secretos,
      })
      .from(schema.integraciones)
      .where(eq(schema.integraciones.clave, clave))
      .limit(1);
    if (row) {
      fila = {
        activo: row.activo,
        ajustes: (row.ajustes as Record<string, unknown>) ?? {},
        secretos: (row.secretos as Record<string, unknown>) ?? {},
        expira: Date.now() + TTL_MS,
      };
    }
  } catch {
    // Si la BD falla, quedamos con la fila vacía → todo cae al fallback de env.
  }
  CACHE.set(clave, fila);
  return fila;
}

/** Invalida la caché de una integración (llamar tras guardar). */
export function invalidarConfig(clave: string): void {
  CACHE.delete(clave);
}

export interface IntegracionResuelta {
  clave: string;
  activo: boolean;
  ajuste(campo: string): string | undefined;
  secreto(campo: string): string | undefined;
  configurada(): boolean;
}

/**
 * Resuelve una integración: ajustes/secretos desde BD con fallback a env.
 * Un await; luego acceso síncrono a los campos.
 */
export async function getIntegracion(clave: string): Promise<IntegracionResuelta> {
  const def = DEF_POR_CLAVE.get(clave);
  const fila = await cargar(clave);

  const ajuste = (campo: string): string | undefined => {
    const v = fila.ajustes[campo];
    if (typeof v === "string" && v.length > 0) return v;
    const d = def?.ajustes.find((c) => c.campo === campo);
    return envFallback(d?.env);
  };
  const secreto = (campo: string): string | undefined => {
    const blob = fila.secretos[campo];
    if (esSecretoCifrado(blob)) {
      const v = descifrarSecreto(`${clave}:${campo}`, blob);
      if (v != null && v.length > 0) return v;
    }
    const d = def?.secretos.find((c) => c.campo === campo);
    return envFallback(d?.env);
  };
  const configurada = (): boolean => {
    if (!def) return false;
    const reqA = def.ajustes.filter((c) => c.requerido).every((c) => !!ajuste(c.campo));
    const reqS = def.secretos.filter((c) => c.requerido).every((c) => !!secreto(c.campo));
    return reqA && reqS;
  };

  return { clave, activo: fila.activo, ajuste, secreto, configurada };
}

/* ── Vista de administración (NUNCA devuelve el valor de un secreto) ──────── */

export interface CampoAjusteAdmin {
  campo: string;
  label: string;
  valor: string;
  fromEnv: boolean;
}
export interface CampoSecretoAdmin {
  campo: string;
  label: string;
  configurado: boolean;
  fromEnv: boolean;
}
export interface IntegracionAdmin {
  clave: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  configurada: boolean;
  ajustes: CampoAjusteAdmin[];
  secretos: CampoSecretoAdmin[];
}

/**
 * Estructura para la UI de administración: ajustes con su valor (en claro, no
 * sensible) y, por cada secreto, SOLO si está configurado y de qué fuente
 * (BD/env) — nunca el valor descifrado. Server-only.
 */
export async function getIntegracionesAdmin(): Promise<IntegracionAdmin[]> {
  const out: IntegracionAdmin[] = [];
  for (const def of REGISTRO) {
    const fila = await cargar(def.clave);
    const res = await getIntegracion(def.clave);

    const ajustes: CampoAjusteAdmin[] = def.ajustes.map((c) => {
      const dbVal = fila.ajustes[c.campo];
      const enDb = typeof dbVal === "string" && dbVal.length > 0;
      return {
        campo: c.campo,
        label: c.label,
        valor: enDb ? (dbVal as string) : (envFallback(c.env) ?? ""),
        fromEnv: !enDb && envFallback(c.env) != null,
      };
    });

    const secretos: CampoSecretoAdmin[] = def.secretos.map((c) => {
      const enDb = esSecretoCifrado(fila.secretos[c.campo]);
      const enEnv = envFallback(c.env) != null;
      return { campo: c.campo, label: c.label, configurado: enDb || enEnv, fromEnv: !enDb && enEnv };
    });

    out.push({
      clave: def.clave,
      nombre: def.nombre,
      descripcion: def.descripcion,
      activo: res.activo,
      configurada: res.configurada(),
      ajustes,
      secretos,
    });
  }
  return out;
}
