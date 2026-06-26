import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { can } from "@/lib/admin/rbac";
import { documentoTipo } from "@/db/schema";
import { uploadDocumentoSharePoint } from "@/lib/m365/sharepoint";
import { registrarDocumento } from "@/lib/admin/actions";

export const runtime = "nodejs";

/** Tamaño máximo aceptado (defensa básica; Graph soporta más vía sesión). */
const MAX_BYTES = 25 * 1024 * 1024;

type DocumentoTipo = (typeof documentoTipo.enumValues)[number];

/**
 * Sube un documento a SharePoint (Graph) y lo registra en `documentos` (entidad
 * cliente). Recibe multipart: file, entidadId (cliente), tipo, nombre opcional.
 * Requiere sesión con permiso documentos:edit.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  const user = session?.user as { id?: string; rol?: string } | undefined;
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  if (!can(user.rol, "documentos", "edit")) {
    return NextResponse.json({ ok: false, error: "Permiso denegado." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Formulario no válido." }, { status: 400 });
  }

  const file = form.get("file");
  const entidadId = String(form.get("entidadId") ?? "").trim();
  const tipoRaw = String(form.get("tipo") ?? "otro");
  const nombreInput = String(form.get("nombre") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Archivo requerido." }, { status: 400 });
  }
  if (!entidadId) {
    return NextResponse.json({ ok: false, error: "Cliente requerido." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ ok: false, error: "El archivo está vacío." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "El archivo supera 25 MB." }, { status: 413 });
  }

  const tipo: DocumentoTipo = (documentoTipo.enumValues as readonly string[]).includes(
    tipoRaw,
  )
    ? (tipoRaw as DocumentoTipo)
    : "otro";
  const nombre = (nombreInput || file.name || "documento").slice(0, 200);

  const bytes = Buffer.from(await file.arrayBuffer());

  const subida = await uploadDocumentoSharePoint({
    carpeta: `clientes/${entidadId}`,
    fileName: file.name || nombre,
    contentType: file.type || "application/octet-stream",
    bytes,
  });

  if (!subida.ok || !subida.url) {
    const status = subida.error === "not_configured" ? 503 : 502;
    const error =
      subida.error === "not_configured"
        ? "Subida a SharePoint no configurada (falta M365_DOCS_DRIVE_ID/SITE_ID o el permiso Sites.ReadWrite.All)."
        : "No se pudo subir el archivo a SharePoint.";
    return NextResponse.json({ ok: false, error }, { status });
  }

  // Registra el documento (entidad cliente) apuntando al webUrl de SharePoint.
  const res = await registrarDocumento({
    entidadTipo: "cliente",
    entidadId,
    tipo,
    nombre,
    url: subida.url,
  });
  if (!res.ok) {
    return NextResponse.json(res, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: res.id, url: subida.url, nombre });
}
