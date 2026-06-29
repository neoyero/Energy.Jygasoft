import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { can } from "@/lib/admin/rbac";
import { uploadDocumentoSharePoint, sharePointConfigurado } from "@/lib/m365/sharepoint";
import { guardarImagenProducto } from "@/lib/admin/actions";

export const runtime = "nodejs";

/** Tamaño máximo de imagen aceptado. */
const MAX_BYTES = 8 * 1024 * 1024;
const TIPOS_OK = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

/**
 * Sube la imagen de un producto a M365 (SharePoint/OneDrive) bajo
 * `productos/<id>` y guarda el webUrl + itemId en la tabla productos. Requiere
 * sesión con permiso productos:edit. multipart: file, productoId.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  const user = session?.user as { id?: string; rol?: string } | undefined;
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  if (!can(user.rol, "productos", "edit")) {
    return NextResponse.json({ ok: false, error: "Permiso denegado." }, { status: 403 });
  }
  if (!sharePointConfigurado()) {
    return NextResponse.json(
      { ok: false, error: "Almacenamiento M365 no configurado." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Formulario no válido." }, { status: 400 });
  }

  const file = form.get("file");
  const productoId = String(form.get("productoId") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Imagen requerida." }, { status: 400 });
  }
  if (!productoId) {
    return NextResponse.json({ ok: false, error: "Producto requerido." }, { status: 400 });
  }
  if (!TIPOS_OK.includes(file.type)) {
    return NextResponse.json(
      { ok: false, error: "Formato no válido (usa JPG, PNG, WebP o AVIF)." },
      { status: 415 },
    );
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
    carpeta: `productos/${productoId}`,
    fileName: `imagen-${Date.now()}.${ext}`,
    contentType: file.type,
    bytes,
  });
  if (!subida.ok || !subida.url) {
    return NextResponse.json(
      { ok: false, error: "No se pudo subir la imagen." },
      { status: 502 },
    );
  }

  const res = await guardarImagenProducto(productoId, subida.url, subida.itemId ?? null);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url: subida.url });
}
