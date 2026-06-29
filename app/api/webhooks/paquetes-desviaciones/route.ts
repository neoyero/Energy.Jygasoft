import { NextResponse, type NextRequest } from "next/server";
import { verify } from "@/lib/hmac";
import { serverEnv } from "@/lib/env";
import { notificarDesviacionesPaquetes } from "@/lib/admin/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Disparador (n8n, cadencia programada) del chequeo de desviaciones de precio en
 * líneas de paquete. Calcula las desviaciones NUEVAS (precio_fijo ≠ precio_venta
 * y aún no notificadas), envía un correo-resumen a vendedores/administradores y
 * marca las líneas como notificadas. Autenticado por HMAC (mismo patrón que el
 * webhook entrante de n8n).
 */
export async function POST(req: NextRequest) {
  const secret = serverEnv.WEBHOOK_INBOUND_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const raw = await req.text();
  const sig = req.headers.get("x-jygasoft-signature") ?? "";
  const ts = req.headers.get("x-jygasoft-timestamp") ?? "";
  if (!verify(raw, ts, sig, secret)) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  try {
    const res = await notificarDesviacionesPaquetes();
    return NextResponse.json(res);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }
}
