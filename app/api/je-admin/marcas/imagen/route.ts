import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { can } from "@/lib/admin/rbac";
import { uploadDocumentoSharePoint, sharePointConfigurado } from "@/lib/m365/sharepoint";
import { guardarImagenMarca } from "@/lib/admin/actions";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const TIPOS_OK = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/svg+xml"];

/**
 * Sube el logo de una marca a M365 (SharePoint/OneDrive) bajo `marcas/<id>` y
 * guarda el webUrl + itemId. Requiere sesión con permiso marcas:edit.
 * multipart: file, marcaId.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  const user = session?.user as { rol?: string } | undefined;
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  if (!can(user.rol, "marcas", "edit")) {
    return NextResponse.json({ ok: false, error: "Permiso denegado." }, { status: 403 });
  }
  if (!(await sharePointConfigurado())) {
    return NextResponse.json({ ok: false, error: "Almacenamiento M365 no configurado." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Formulario no válido." }, { status: 400 });
  }

  const file = form.get("file");
  const marcaId = String(form.get("marcaId") ?? "").trim();
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Imagen requerida." }, { status: 400 });
  }
  if (!marcaId) {
    return NextResponse.json({ ok: false, error: "Marca requerida." }, { status: 400 });
  }
  if (!TIPOS_OK.includes(file.type)) {
    return NextResponse.json({ ok: false, error: "Formato no válido (JPG, PNG, WebP, AVIF o SVG)." }, { status: 415 });
  }
  if (file.size === 0) {
    return NextResponse.json({ ok: false, error: "La imagen está vacía." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "La imagen supera 8 MB." }, { status: 413 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "img";
  const bytes = Buffer.from(await file.arrayBuffer());

  const subida = await uploadDocumentoSharePoint({
    carpeta: `marcas/${marcaId}`,
    fileName: `logo-${Date.now()}.${ext}`,
    contentType: file.type,
    bytes,
  });
  if (!subida.ok || !subida.url) {
    return NextResponse.json({ ok: false, error: "No se pudo subir el logo." }, { status: 502 });
  }

  const res = await guardarImagenMarca(marcaId, subida.url, subida.itemId ?? null);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true, url: subida.url });
}
