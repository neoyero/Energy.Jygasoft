import { getIntegracion } from "@/lib/config/service";
import type { ChatwootAgent } from "@/lib/chatwoot/types";

export type { ChatwootAgent } from "@/lib/chatwoot/types";

/**
 * Cliente de Chatwoot (self-hosted) — Application API por cuenta.
 * La configuración (url, account_id, api_token) se resuelve desde el servicio de
 * integraciones (BD cifrada, con fallback a env). El token vive SOLO en el
 * backend: este módulo es server-only y nunca se expone al navegador. Autentica
 * con el header `api_access_token`. No lanza: devuelve {ok,error} tipado.
 */

export type CwResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

/** true si están los datos mínimos para hablar con Chatwoot. */
export async function chatwootConfigurado(): Promise<boolean> {
  return (await getIntegracion("chatwoot")).configurada();
}

/** Traduce el código HTTP de Chatwoot a un mensaje claro para el panel. */
export function traducirErrorChatwoot(status: number): string {
  switch (status) {
    case 401:
      return "Token inválido o permisos insuficientes (401).";
    case 403:
      return "Sin permiso para esta acción en Chatwoot (403).";
    case 404:
      return "Recurso no encontrado en Chatwoot (404).";
    case 422:
      return "Datos inválidos para Chatwoot (422).";
    case 429:
      return "Chatwoot está limitando las peticiones (429). Intenta de nuevo.";
    default:
      return status >= 500 ? `Error interno de Chatwoot (${status}).` : `Error de Chatwoot (${status}).`;
  }
}

type Metodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const TIMEOUT_MS = 10_000;
const MAX_REINTENTOS = 2; // adicionales, para 429/5xx

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Petición autenticada a la Application API. `path` es relativo a la cuenta
 * (p. ej. "/agents", "/agents/3"). Reintenta con backoff en 429/5xx, aplica
 * timeout y traduce el error. Nunca registra el token.
 */
export async function cwRequest<T>(method: Metodo, path: string, body?: unknown): Promise<CwResult<T>> {
  const cfg = await getIntegracion("chatwoot");
  if (!cfg.configurada()) return { ok: false, error: "Chatwoot no está configurado." };

  const url = (cfg.ajuste("url") ?? "").replace(/\/+$/, "");
  const base = `${url}/api/v1/accounts/${cfg.ajuste("account_id")}`;
  const token = cfg.secreto("api_token") as string;

  for (let intento = 0; intento <= MAX_REINTENTOS; intento++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: {
          api_access_token: token,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        if (res.status === 204) return { ok: true, data: undefined as unknown as T };
        const json = (await res.json().catch(() => null)) as T;
        return { ok: true, data: json };
      }

      // Reintenta 429/5xx; el resto es error definitivo.
      if ((res.status === 429 || res.status >= 500) && intento < MAX_REINTENTOS) {
        await sleep(300 * Math.pow(3, intento));
        continue;
      }
      console.error(`[chatwoot] ${method} ${path} -> ${res.status}`);
      return { ok: false, error: traducirErrorChatwoot(res.status), status: res.status };
    } catch (e) {
      clearTimeout(timer);
      const abort = e instanceof Error && e.name === "AbortError";
      if (abort && intento < MAX_REINTENTOS) {
        await sleep(300 * Math.pow(3, intento));
        continue;
      }
      console.error("[chatwoot] error de red", e instanceof Error ? e.message : e);
      return { ok: false, error: abort ? "Chatwoot no respondió a tiempo." : "No se pudo conectar con Chatwoot." };
    }
  }
  return { ok: false, error: "No se pudo conectar con Chatwoot." };
}

/* ── Helpers usados por el módulo de Asesores (Fase 1) ────────────────────── */

/** Lista los agentes de la cuenta (para reconciliar por correo). */
export async function listarAgentes(): Promise<CwResult<ChatwootAgent[]>> {
  const r = await cwRequest<ChatwootAgent[]>("GET", "/agents");
  if (!r.ok) return r;
  return { ok: true, data: Array.isArray(r.data) ? r.data : [] };
}

/** Crea/invita un agente en la cuenta (Chatwoot envía invitación por correo). */
export async function crearAgente(params: {
  name: string;
  email: string;
  role?: "agent" | "administrator";
}): Promise<CwResult<ChatwootAgent>> {
  return cwRequest<ChatwootAgent>("POST", "/agents", {
    name: params.name,
    email: params.email,
    role: params.role ?? "agent",
  });
}

/** Elimina un agente de la cuenta (no borra el usuario global de Chatwoot). */
export async function eliminarAgente(agentId: number): Promise<CwResult<null>> {
  return cwRequest<null>("DELETE", `/agents/${agentId}`);
}
