import { requirePerm } from "@/lib/admin/guard";
import { getUsuarios } from "@/lib/admin/queries";
import {
  UsuarioCreateForm,
  UsuarioRowActions,
} from "@/components/admin/usuario-form";

export const dynamic = "force-dynamic";

function fmtFecha(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("es-MX");
}

export default async function UsuariosPage() {
  await requirePerm("usuarios", "view");
  const usuarios = await getUsuarios();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios / Equipo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Da de alta a los miembros del equipo. Entran al panel con un código que
          se envía a su correo (sin contraseña).
        </p>
      </div>

      <UsuarioCreateForm />

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Correo</th>
              <th className="px-4 py-2 font-medium">Rol</th>
              <th className="px-4 py-2 font-medium">Teléfono</th>
              <th className="px-4 py-2 font-medium">Activo</th>
              <th className="px-4 py-2 font-medium">Último acceso</th>
              <th className="px-4 py-2 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-medium">{u.nombre}</td>
                <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {u.rol.replace(/_/g, " ")}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {u.telefono ?? "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {u.activo ? "Sí" : "No"}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {fmtFecha(u.ultimoAcceso)}
                </td>
                <td className="px-4 py-2">
                  <UsuarioRowActions
                    id={u.id}
                    nombre={u.nombre}
                    rol={u.rol}
                    telefono={u.telefono}
                    activo={u.activo}
                  />
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Aún no hay usuarios. Agrega al primer miembro del equipo arriba.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
