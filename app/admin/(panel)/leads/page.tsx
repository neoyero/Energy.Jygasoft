import Link from "next/link";
import { getLeads } from "@/lib/admin/queries";
import { schema } from "@/db";

export const dynamic = "force-dynamic";

const ESTADOS = schema.leadEstado.enumValues;

export default async function LeadsKanban() {
  const leads = await getLeads();

  const byEstado = new Map<string, typeof leads>();
  for (const e of ESTADOS) byEstado.set(e, []);
  for (const l of leads) byEstado.get(l.estado)?.push(l);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="text-sm text-muted-foreground">{leads.length} en total</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {ESTADOS.map((estado) => {
          const items = byEstado.get(estado) ?? [];
          return (
            <div key={estado} className="w-64 shrink-0">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-medium capitalize">
                  {estado.replace(/_/g, " ")}
                </h2>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((l) => (
                  <Link
                    key={l.id}
                    href={`/admin/leads/${l.id}`}
                    className="block rounded-lg border border-border p-3 text-sm transition-colors hover:bg-muted/50"
                  >
                    <p className="font-medium">{l.nombre ?? "Sin nombre"}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.telefono ?? l.email ?? "—"}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="rounded bg-muted px-1.5 py-0.5">
                        {l.segmento ?? "—"}
                      </span>
                      <span className="text-muted-foreground">score {l.score}</span>
                    </div>
                  </Link>
                ))}
                {items.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                    Vacío
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
