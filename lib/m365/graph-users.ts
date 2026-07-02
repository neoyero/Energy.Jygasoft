import { getGraphToken } from "@/lib/email";

/**
 * Lista usuarios de la organización M365 vía Microsoft Graph (app-only, mismo App
 * Registration que el correo OTP). Requiere el permiso de APLICACIÓN
 * `User.Read.All` con consentimiento de administrador en Azure AD. Filtra por el
 * dominio de la empresa (userPrincipalName/mail que terminan en @dominio).
 * Server-only. No lanza: devuelve {ok,data|error}.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

export interface M365User {
  id: string;
  displayName: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
  phone: string | null;
  accountEnabled: boolean;
}

type Res<T> = { ok: true; data: T } | { ok: false; error: string };

interface GraphUser {
  id: string;
  displayName?: string | null;
  userPrincipalName?: string | null;
  mail?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  mobilePhone?: string | null;
  businessPhones?: string[] | null;
  accountEnabled?: boolean | null;
}

export async function listarUsuariosM365(dominio: string): Promise<Res<M365User[]>> {
  let token: string;
  try {
    token = await getGraphToken();
  } catch {
    return { ok: false, error: "M365 no está configurado (revisa la integración m365)." };
  }

  const select =
    "id,displayName,userPrincipalName,mail,jobTitle,department,mobilePhone,businessPhones,accountEnabled";
  let url: string | null = `${GRAPH}/users?$select=${select}&$top=999`;
  const dom = dominio.trim().toLowerCase();
  const out: M365User[] = [];

  try {
    while (url) {
      const res = await fetch(url, {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) {
        const detalle = (await res.text().catch(() => "")).slice(0, 200);
        console.error(`[graph-users] ${res.status} ${detalle}`);
        if (res.status === 403) {
          return { ok: false, error: "Falta el permiso User.Read.All (consentimiento admin en Azure)." };
        }
        return { ok: false, error: `Error de Microsoft Graph (${res.status}).` };
      }
      const json = (await res.json()) as { value?: GraphUser[]; "@odata.nextLink"?: string };
      for (const u of json.value ?? []) {
        const email = (u.mail || u.userPrincipalName || "").toLowerCase();
        if (!email) continue;
        if (dom && !email.endsWith(`@${dom}`)) continue;
        out.push({
          id: u.id,
          displayName: u.displayName || email,
          email,
          jobTitle: u.jobTitle ?? null,
          department: u.department ?? null,
          phone: u.mobilePhone ?? u.businessPhones?.[0] ?? null,
          accountEnabled: u.accountEnabled ?? true,
        });
      }
      url = json["@odata.nextLink"] ?? null;
    }
    out.sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
    return { ok: true, data: out };
  } catch (e) {
    console.error("[graph-users] error de red", e instanceof Error ? e.message : e);
    return { ok: false, error: "No se pudo conectar con Microsoft Graph." };
  }
}
