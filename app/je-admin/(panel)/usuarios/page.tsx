import { UserCog } from "lucide-react";

import { requirePerm } from "@/lib/admin/guard";
import { can } from "@/lib/admin/rbac";
import { getUsuarios, getAsesores, getAreasActivas, getCargosActivos, getEmpresas } from "@/lib/admin/queries";
import { chatwootConfigurado } from "@/lib/chatwoot/client";
import { PageHeader } from "@/components/admin/ui/page-header";
import { UsuariosView } from "@/components/admin/usuarios/usuarios-view";
import { AsesoresView } from "@/components/admin/asesores/asesores-view";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const user = await requirePerm("usuarios", "view");
  const [usuarios, asesores, areas, cargos, empresas] = await Promise.all([
    getUsuarios(),
    getAsesores(),
    getAreasActivas(),
    getCargosActivos(),
    getEmpresas(),
  ]);
  const usuarioOptions = usuarios.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
  }));
  const puedeEditar = can(user.rol, "usuarios", "edit");
  const chatwootActivo = await chatwootConfigurado();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuarios / Equipo"
        description="Alta y edición de miembros del equipo (rol, cargo, jefe y área). Entran al panel con un código enviado a su correo."
        icon={<UserCog className="size-6" aria-hidden />}
      />

      <UsuariosView usuarios={usuarios} areas={areas} cargos={cargos} empresas={empresas} puedeEditar={puedeEditar} />

      {/* ── Asesores (agentes de Chatwoot) ── */}
      <div className="pt-2">
        <h2 className="text-xl font-semibold tracking-tight">Asesores</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Agentes que atienden conversaciones (Chatwoot) y reciben leads. Vincula
          un usuario del panel; solo los asesores activos y vinculados son
          asignables como responsables de un lead.
          {chatwootActivo ? "" : " Chatwoot aún no está configurado (modo manual)."}
        </p>
      </div>

      <AsesoresView
        asesores={asesores}
        usuarios={usuarioOptions}
        chatwootActivo={chatwootActivo}
        puedeEditar={puedeEditar}
      />
    </div>
  );
}
