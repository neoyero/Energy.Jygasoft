import { auth } from "@/auth";
import { can } from "@/lib/admin/rbac";
import { suscribirEventosChatwoot, type EventoChatwoot } from "@/lib/chatwoot/realtime";

/**
 * Stream SSE de eventos de Chatwoot para la UI admin. El navegador abre un
 * EventSource aquí y recibe en vivo los eventos publicados por el webhook
 * entrante. Solo para admins con sesión (chatwoot:view). Runtime Node.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user || !can(session.user.rol, "chatwoot", "view")) {
    return new Response("unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let desuscribir: (() => void) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enviar = (obj: EventoChatwoot): void => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          // controller cerrado; se limpia en abort/cancel.
        }
      };

      // Reintento de reconexión del cliente + evento inicial de "conectado".
      controller.enqueue(encoder.encode("retry: 5000\n\n"));
      enviar({ tipo: "conectado", conversationId: null, at: Date.now() });

      desuscribir = suscribirEventosChatwoot(enviar);

      // Heartbeat para mantener viva la conexión a través de proxies.
      ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          // ignore
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        limpiar();
        try {
          controller.close();
        } catch {
          // ya cerrado
        }
      });
    },
    cancel() {
      limpiar();
    },
  });

  function limpiar(): void {
    if (desuscribir) desuscribir();
    if (ping) clearInterval(ping);
    desuscribir = null;
    ping = null;
  }

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Evita que nginx/proxy bufferee el stream.
      "x-accel-buffering": "no",
    },
  });
}
