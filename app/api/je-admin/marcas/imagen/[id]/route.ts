import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { can } from "@/lib/admin/rbac";
import { db, schema } from "@/db";
import { fetchDriveItemContent } from "@/lib/m365/sharepoint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** Proxy del logo de una marca (streamea el contenido de Graph para usar en <img>). */
export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const session = await auth();
  const user = session?.user as { rol?: string } | undefined;
  if (!user || !can(user.rol, "marcas", "view")) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const [m] = await db
    .select({ itemId: schema.marcas.imagenItemId })
    .from(schema.marcas)
    .where(eq(schema.marcas.id, id))
    .limit(1);
  if (!m?.itemId) {
    return NextResponse.json({ ok: false, error: "Sin imagen." }, { status: 404 });
  }

  const res = await fetchDriveItemContent(m.itemId);
  if (!res || !res.body) {
    return NextResponse.json({ ok: false, error: "No disponible." }, { status: 404 });
  }
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=300",
    },
  });
}
