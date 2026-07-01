import { getGraphToken } from "@/lib/email";
import { getIntegracion } from "@/lib/config/service";

/**
 * Subida de documentos a SharePoint/OneDrive vía Microsoft Graph (app-only,
 * client-credentials — mismo App Registration que el correo OTP).
 *
 * Requisitos en Azure AD (los configura un admin del tenant):
 *  - Permiso de APLICACIÓN `Sites.ReadWrite.All` (o Files.ReadWrite.All) con
 *    consentimiento de administrador.
 *  - Env: M365_DOCS_DRIVE_ID (biblioteca destino) o M365_DOCS_SITE_ID (se usa su
 *    drive por defecto). Carpeta raíz en M365_DOCS_ROOT (default "CRM").
 * Si no está configurado, devuelve { ok:false, error:"not_configured" }.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

export interface SharePointUploadResult {
  ok: boolean;
  url?: string;
  itemId?: string;
  error?: string;
}

/**
 * Config de M365 para documentos, resuelta desde el servicio (BD con fallback a
 * env): credenciales + base del drive destino + carpeta raíz.
 */
async function resolverDrive(): Promise<{ base: string | null; root: string; configurado: boolean }> {
  const m = await getIntegracion("m365");
  const credenciales = Boolean(
    m.ajuste("tenant_id") && m.ajuste("client_id") && m.secreto("client_secret"),
  );
  const driveId = m.ajuste("docs_drive_id");
  const siteId = m.ajuste("docs_site_id");
  const base = driveId
    ? `${GRAPH}/drives/${driveId}`
    : siteId
      ? `${GRAPH}/sites/${siteId}/drive`
      : null;
  return { base, root: m.ajuste("docs_root") ?? "CRM", configurado: credenciales && base != null };
}

/** true si Documentos en M365 está configurado (credenciales + drive destino). */
export async function sharePointConfigurado(): Promise<boolean> {
  return (await resolverDrive()).configurado;
}

/** Sanitiza un segmento de ruta (sin caracteres prohibidos por SharePoint). */
function safeSeg(s: string): string {
  const clean = s
    .replace(/[\\/:*?"<>|#%]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return clean.length > 0 ? clean : "archivo";
}

/**
 * Sube un archivo al drive destino bajo `<M365_DOCS_ROOT>/<carpeta>/<fileName>`.
 * Subida simple (<4 MB) o por sesión en bloques (>=4 MB). Devuelve el webUrl.
 */
export async function uploadDocumentoSharePoint(params: {
  carpeta: string;
  fileName: string;
  contentType: string;
  bytes: Buffer;
}): Promise<SharePointUploadResult> {
  const d = await resolverDrive();
  const base = d.base;
  if (!d.configurado || !base) {
    return { ok: false, error: "not_configured" };
  }

  const root = safeSeg(d.root);
  const carpeta = params.carpeta
    .split("/")
    .filter(Boolean)
    .map(safeSeg)
    .join("/");
  const path = `${root}/${carpeta}/${safeSeg(params.fileName)}`;
  const size = params.bytes.length;

  try {
    const token = await getGraphToken();

    // Subida simple para archivos pequeños.
    if (size <= 4 * 1024 * 1024) {
      const res = await fetch(
        `${base}/root:/${encodeURI(path)}:/content?@microsoft.graph.conflictBehavior=rename`,
        {
          method: "PUT",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": params.contentType || "application/octet-stream",
          },
          body: new Uint8Array(params.bytes),
        },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(`[sharepoint] upload ${res.status}: ${detail.slice(0, 300)}`);
        return { ok: false, error: `graph_${res.status}` };
      }
      const item = (await res.json()) as { id: string; webUrl: string };
      return { ok: true, url: item.webUrl, itemId: item.id };
    }

    // Subida por sesión (bloques múltiplos de 320 KiB) para archivos grandes.
    const sessionRes = await fetch(
      `${base}/root:/${encodeURI(path)}:/createUploadSession`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          item: { "@microsoft.graph.conflictBehavior": "rename" },
        }),
      },
    );
    if (!sessionRes.ok) {
      const detail = await sessionRes.text().catch(() => "");
      console.error(`[sharepoint] session ${sessionRes.status}: ${detail.slice(0, 300)}`);
      return { ok: false, error: `graph_${sessionRes.status}` };
    }
    const { uploadUrl } = (await sessionRes.json()) as { uploadUrl: string };

    const CHUNK = 5 * 320 * 1024; // 1.6 MB (múltiplo de 320 KiB)
    let offset = 0;
    let item: { id: string; webUrl: string } | null = null;
    while (offset < size) {
      const end = Math.min(offset + CHUNK, size);
      const chunk = params.bytes.subarray(offset, end);
      const r = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "content-length": String(chunk.length),
          "content-range": `bytes ${offset}-${end - 1}/${size}`,
        },
        body: new Uint8Array(chunk),
      });
      if (r.status === 200 || r.status === 201) {
        item = (await r.json()) as { id: string; webUrl: string };
      } else if (r.status !== 202) {
        const detail = await r.text().catch(() => "");
        console.error(`[sharepoint] chunk ${r.status}: ${detail.slice(0, 200)}`);
        return { ok: false, error: `graph_${r.status}` };
      }
      offset = end;
    }
    if (item?.webUrl) return { ok: true, url: item.webUrl, itemId: item.id };
    return { ok: false, error: "upload_incomplete" };
  } catch (error) {
    console.error("[sharepoint] error", error);
    return { ok: false, error: "upload_failed" };
  }
}

/**
 * Devuelve la respuesta de Graph con el CONTENIDO de un item (para hacer proxy
 * y mostrar imágenes con `<img>`, ya que el webUrl es una página, no el binario).
 * Sigue el redirect a la downloadUrl. Devuelve null si no está disponible.
 */
export async function fetchDriveItemContent(itemId: string): Promise<Response | null> {
  if (!itemId) return null;
  const d = await resolverDrive();
  const base = d.base;
  if (!base || !d.configurado) return null;
  try {
    const token = await getGraphToken();
    const res = await fetch(`${base}/items/${itemId}/content`, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "follow",
    });
    return res.ok ? res : null;
  } catch (error) {
    console.error("[sharepoint] content error", error);
    return null;
  }
}

/**
 * Borra un item del drive por su id de Graph (best-effort; usado al reemplazar o
 * quitar la imagen de un producto). No lanza: devuelve true/false.
 */
export async function deleteDriveItem(itemId: string): Promise<boolean> {
  if (!itemId) return false;
  const d = await resolverDrive();
  const base = d.base;
  if (!base || !d.configurado) return false;
  try {
    const token = await getGraphToken();
    const res = await fetch(`${base}/items/${itemId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok || res.status === 404;
  } catch (error) {
    console.error("[sharepoint] delete error", error);
    return false;
  }
}
