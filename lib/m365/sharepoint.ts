import { serverEnv } from "@/lib/env";
import { getGraphToken } from "@/lib/email";

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

export function sharePointConfigurado(): boolean {
  return Boolean(
    serverEnv.M365_TENANT_ID &&
      serverEnv.M365_CLIENT_ID &&
      serverEnv.M365_CLIENT_SECRET &&
      (serverEnv.M365_DOCS_DRIVE_ID || serverEnv.M365_DOCS_SITE_ID),
  );
}

/** Base del drive destino: por id de drive, o el drive por defecto del sitio. */
function driveBase(): string | null {
  if (serverEnv.M365_DOCS_DRIVE_ID) {
    return `${GRAPH}/drives/${serverEnv.M365_DOCS_DRIVE_ID}`;
  }
  if (serverEnv.M365_DOCS_SITE_ID) {
    return `${GRAPH}/sites/${serverEnv.M365_DOCS_SITE_ID}/drive`;
  }
  return null;
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
  const base = driveBase();
  if (!sharePointConfigurado() || !base) {
    return { ok: false, error: "not_configured" };
  }

  const root = safeSeg(serverEnv.M365_DOCS_ROOT);
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
  const base = driveBase();
  if (!base || !sharePointConfigurado() || !itemId) return null;
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
  const base = driveBase();
  if (!base || !sharePointConfigurado() || !itemId) return false;
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
