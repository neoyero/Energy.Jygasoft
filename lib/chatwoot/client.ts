import { getIntegracion } from "@/lib/config/service";

/**
 * Cliente de Chatwoot (self-hosted) — Application API por cuenta.
 * La configuración (url, account_id, api_token) se resuelve desde el servicio
 * de integraciones (BD con fallback a env). Autentica con el header
 * `api_access_token`. Si no está configurado, `chatwootConfigurado()` devuelve
 * false y el módulo de asesores degrada al modo manual. No lanza: {ok,error}.
 */

/** true si están los datos mínimos para hablar con Chatwoot. */
export async function chatwootConfigurado(): Promise<boolean> {
  return (await getIntegracion("chatwoot")).configurada();
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

/**
 * fetch autenticado a la Application API. `path` es relativo a la cuenta
 * (p. ej. "/agents"). Resuelve config desde el servicio. No lanza.
 */
async function cwFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<CwResult<T>> {
  const cfg = await getIntegracion("chatwoot");
  if (!cfg.configurada()) {
    return { ok: false, error: "Chatwoot no está configurado." };
  }
  const url = (cfg.ajuste("url") ?? "").replace(/\/+$/, "");
  const base = `${url}/api/v1/accounts/${cfg.ajuste("account_id")}`;
  const token = cfg.secreto("api_token") as string;
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        api_access_token: token,
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
