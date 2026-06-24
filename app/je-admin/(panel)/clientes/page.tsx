import { getClientes } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const clientes = await getClientes();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">Contacto</th>
              <th className="px-4 py-2 font-medium">Municipio</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-medium">{c.nombre}</td>
                <td className="px-4 py-2 text-muted-foreground">{c.tipoPersona}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {c.telefono ?? c.email ?? "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{c.municipio ?? "—"}</td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Aún no hay clientes. Convierte un lead para crear el primero.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
