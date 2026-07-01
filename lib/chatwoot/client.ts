import { serverEnv } from "@/lib/env";

/**
 * Cliente de Chatwoot (self-hosted) — Application API por cuenta.
 * Autentica con el header `api_access_token` (Access Token de un admin de la
 * cuenta). Si no está configurado, `chatwootConfigurado()` devuelve false y el
 * módulo de asesores degrada al modo manual. No lanza: retorna {ok,error}.
 */

/** true si están las variables mínimas para hablar con Chatwoot. */
export function chatwootConfigurado(): boolean {
  return Boolean(
    serverEnv.CHATWOOT_URL &&
      serverEnv.CHATWOOT_ACCOUNT_ID &&
      serverEnv.CHATWOOT_API_TOKEN,
  );
}

/** Agente de Chatwoot (subset relevante). */
export interface ChatwootAgent {
  id: number;
  name: string;
  email: string;
  role: string;
  confirmed?: boolean;
  availability_status?: string;
}

type CwResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Base `${url}/api/v1/accounts/{id}` sin barra final. */
function baseUrl(): string {
  const url = (serverEnv.CHATWOOT_URL ?? "").replace(/\/+$/, "");
  return `${url}/api/v1/accounts/${serverEnv.CHATWOOT_ACCOUNT_ID}`;
}

/**
 * fetch autenticado a la Application API. `path` es relativo a la cuenta
 * (p. ej. "/agents"). Maneja errores sin lanzar.
 */
async function cwFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<CwResult<T>> {
  if (!chatwootConfigurado()) {
    return { ok: false, error: "Chatwoot no está configurado." };
  }
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        api_access_token: serverEnv.CHATWOOT_API_TOKEN as string,
        "content-type": "application/json",
        accept: "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const detalle = (await res.text().catch(() => "")).slice(0, 300);
      console.error(`[chatwoot] ${init?.method ?? "GET"} ${path} -> ${res.status} ${detalle}`);
      return { ok: false, error: `chatwoot_${res.status}` };
    }
    // 204/empty → sin cuerpo.
    if (res.status === 204) return { ok: true, data: undefined as unknown as T };
    const json = (await res.json().catch(() => null)) as T;
    return { ok: true, data: json };
  } catch (e) {
    console.error("[chatwoot] error de red", e instanceof Error ? e.message : e);
    return { ok: false, error: "No se pudo conectar con Chatwoot." };
  }
}

/** Lista los agentes de la cuenta (para reconciliar por correo). */
export async function listarAgentes(): Promise<CwResult<ChatwootAgent[]>> {
  const r = await cwFetch<ChatwootAgent[]>("/agents");
  if (!r.ok) return r;
  return { ok: true, data: Array.isArray(r.data) ? r.data : [] };
}

/**
 * Crea/invita un agente en la cuenta (Chatwoot envía invitación por correo).
 * role: "agent" | "administrator".
 */
export async function crearAgente(params: {
  name: string;
  email: string;
  role?: "agent" | "administrator";
}): Promise<CwResult<ChatwootAgent>> {
  return cwFetch<ChatwootAgent>("/agents", {
    method: "POST",
    body: JSON.stringify({
      name: params.name,
      email: params.email,
      role: params.role ?? "agent",
    }),
  });
}

/** Elimina un agente de la cuenta (no borra el usuario global de Chatwoot). */
export async function eliminarAgente(agentId: number): Promise<CwResult<null>> {
  return cwFetch<null>(`/agents/${agentId}`, { method: "DELETE" });
}
