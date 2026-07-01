import { UserCog } from "lucide-react";

import { requirePerm } from "@/lib/admin/guard";
import { can } from "@/lib/admin/rbac";
import { getUsuarios, getAsesores, getAreasActivas } from "@/lib/admin/queries";
import { PageHeader } from "@/components/admin/ui/page-header";
import { UsuariosView } from "@/components/admin/usuarios/usuarios-view";
import {
  AsesorCreateForm,
  AsesorRowActions,
} from "@/components/admin/asesor-form";

export const dynamic = "force-dynamic";

/** Lista vacía -> "Todas/Ambos"; si no, las etiquetas unidas. */
function listOrAll(items: string[], vacio: string): string {
  return items.length === 0 ? vacio : items.join(", ");
}

export default async function UsuariosPage() {
  const user = await requirePerm("usuarios", "view");
  const [usuarios, asesores, areas] = await Promise.all([
    getUsuarios(),
    getAsesores(),
    getAreasActivas(),
  ]);
  const usuarioOptions = usuarios.map((u) => ({ id: u.id, nombre: u.nombre }));
  const puedeEditar = can(user.rol, "usuarios", "edit");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuarios / Equipo"
        description="Alta y edición de miembros del equipo (rol, cargo, jefe y área). Entran al panel con un código enviado a su correo."
        icon={<UserCog className="size-6" aria-hidden />}
      />

      <UsuariosView usuarios={usuarios} areas={areas} puedeEditar={puedeEditar} />

      {/* ── Asesores ── */}
      <div className="pt-2">
        <h2 className="text-xl font-semibold tracking-tight">Asesores</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Define qué usuarios son asesores. Solo los asesores activos y
          vinculados a un usuario pueden asignarse como responsables de un lead.
        </p>
      </div>

      <AsesorCreateForm usuarios={usuarioOptions} />

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Asesor</th>
              <th className="px-4 py-2 font-medium">Usuario vinculado</th>
              <th className="px-4 py-2 font-medium">Chatwoot</th>
              <th className="px-4 py-2 font-medium">Zonas</th>
              <th className="px-4 py-2 font-medium">Segmentos</th>
              <th className="px-4 py-2 font-medium">Activo</th>
              <th className="px-4 py-2 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {asesores.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-medium">{a.nombre}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {a.usuarioNombre ?? "— (sin vincular)"}
                </td>
                <td className="px-4 py-2 tabular-nums text-muted-foreground">
                  #{a.chatwootAgentId}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {listOrAll(a.zonas, "Todas")}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {listOrAll(a.segmentos, "Ambos")}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {a.activo ? "Sí" : "No"}
                </td>
                <td className="px-4 py-2">
                  <AsesorRowActions
                    id={a.id}
                    nombre={a.nombre}
                    activo={a.activo}
                  />
                </td>
              </tr>
            ))}
            {asesores.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Aún no hay asesores. Registra el primero arriba para poder
                  asignar leads.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
