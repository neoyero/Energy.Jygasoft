import { getCatalogo } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function CatalogoPage() {
  const equipos = await getCatalogo();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Catálogo de equipos</h1>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">Marca / Modelo</th>
              <th className="px-4 py-2 font-medium">Potencia</th>
              <th className="px-4 py-2 font-medium">Precio</th>
            </tr>
          </thead>
          <tbody>
            {equipos.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{e.tipo}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {[e.marca, e.modelo].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {e.potenciaWp ? `${e.potenciaWp} W` : "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {e.precio ? `$${Number(e.precio).toLocaleString("es-MX")}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
