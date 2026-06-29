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

/**
 * Proxy de la imagen de un producto: transmite el contenido del item de Graph
 * (SharePoint/OneDrive) para poder usarlo como `src` de `<img>`. Requiere sesión
 * con permiso productos:view. La URL es estable: /api/je-admin/productos/imagen/<id>.
 */
export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const session = await auth();
  const user = session?.user as { rol?: string } | undefined;
  if (!user || !can(user.rol, "productos", "view")) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const [p] = await db
    .select({ itemId: schema.productos.imagenItemId })
    .from(schema.productos)
    .where(eq(schema.productos.id, id))
    .limit(1);
  if (!p?.itemId) {
    return NextResponse.json({ ok: false, error: "Sin imagen." }, { status: 404 });
  }

  const res = await fetchDriveItemContent(p.itemId);
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
