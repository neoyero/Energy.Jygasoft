import { timingSafeEqual } from "crypto";

import { getIntegracion } from "@/lib/config/service";
import { publicarEventoChatwoot } from "@/lib/chatwoot/realtime";

/**
 * Webhook ENTRANTE de Chatwoot. Chatwoot hace POST aquí en cada evento
 * (message_created, conversation_updated, …). Se valida con el secreto que va en
 * la query (?token=…) contra `chatwoot.webhook_secret` (Chatwoot no firma sus
 * webhooks, por eso el secreto viaja en la URL). Publica un evento normalizado al
 * broker en memoria, del que se alimenta el stream SSE. Runtime Node (no edge).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function comparaSegura(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

interface CwWebhookBody {
  event?: string;
  id?: number;
  conversation?: { id?: number } | null;
  conversation_id?: number;
}

export async function POST(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const secret = (await getIntegracion("chatwoot")).secreto("webhook_secret") ?? "";
  if (!secret || !comparaSegura(token, secret)) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: CwWebhookBody | null = null;
  try {
    body = (await req.json()) as CwWebhookBody;
  } catch {
    body = null;
  }

  const tipo = typeof body?.event === "string" ? body.event : "unknown";
  const conversationId =
    Number(body?.conversation?.id ?? body?.conversation_id ?? body?.id ?? 0) || null;

  publicarEventoChatwoot({ tipo, conversationId, at: Date.now() });
  return new Response("ok", { status: 200 });
}

/** Chequeo rápido de que la ruta existe (Chatwoot solo usa POST). */
export async function GET(): Promise<Response> {
  return new Response("chatwoot webhook", { status: 200 });
}
