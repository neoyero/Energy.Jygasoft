import "dotenv/config";
import { getGraphToken } from "@/lib/email";

/**
 * Imprime el DRIVE_ID del OneDrive de un usuario/buzón para configurar el
 * almacenamiento de documentos/imágenes (M365_DOCS_DRIVE_ID).
 *
 *   pnpm m365:onedrive correo@jygasoft.com
 *
 * Requiere en .env: M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET y el
 * permiso de APLICACIÓN Files.ReadWrite.All con consentimiento de administrador.
 */
const GRAPH = "https://graph.microsoft.com/v1.0";

async function main(): Promise<void> {
  const user = process.argv[2];
  if (!user) {
    console.error("Uso: pnpm m365:onedrive <correo-del-usuario>");
    process.exit(1);
  }

  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    console.error("No se pudo obtener token de Graph. Revisa M365_TENANT_ID/CLIENT_ID/CLIENT_SECRET.");
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
  const headers = { Authorization: `Bearer ${token}` };

  const res = await fetch(`${GRAPH}/users/${encodeURIComponent(user)}/drive`, { headers });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`Error ${res.status} al leer el OneDrive de ${user}:`);
    console.error(detail.slice(0, 500));
    if (res.status === 403)
      console.error("→ Falta el permiso Files.ReadWrite.All (Aplicación) + consentimiento de admin.");
    if (res.status === 404)
      console.error("→ Ese usuario no tiene OneDrive aprovisionado (licencia OneDrive/SharePoint).");
    process.exit(1);
  }

  const d = (await res.json()) as {
    id: string;
    name: string;
    driveType: string;
    webUrl: string;
  };

  console.log("\n✓ OneDrive encontrado:");
  console.log("  driveType:", d.driveType);
  console.log("  name     :", d.name);
  console.log("  webUrl   :", d.webUrl);
  console.log("  id       :", d.id);
  console.log("\n→ Agrega esto a tu .env (y redepliega):");
  console.log(`M365_DOCS_DRIVE_ID=${d.id}`);
  console.log(`M365_DOCS_ROOT=CRM`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Falló:", err);
  process.exit(1);
});
