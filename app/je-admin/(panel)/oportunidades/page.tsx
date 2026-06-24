import { getOportunidades } from "@/lib/admin/queries";
import { schema } from "@/db";

export const dynamic = "force-dynamic";

const ETAPAS = schema.oportunidadEtapa.enumValues;

const mxn = (v: string | null) =>
  v ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v)) : "—";

export default async function PipelinePage() {
  const oports = await getOportunidades();

  const byEtapa = new Map<string, typeof oports>();
  for (const e of ETAPAS) byEtapa.set(e, []);
  for (const o of oports) byEtapa.get(o.etapa)?.push(o);

  const ponderado = oports.reduce((acc, o) => {
    const monto = Number(o.montoEstimado ?? 0);
    const prob = (o.probabilidad ?? 0) / 100;
    return acc + monto * prob;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Forecast ponderado: <span className="font-medium">{mxn(String(ponderado))}</span>
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {ETAPAS.map((etapa) => {
          const items = byEtapa.get(etapa) ?? [];
          return (
            <div key={etapa} className="w-64 shrink-0">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-medium capitalize">{etapa}</h2>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((o) => (
                  <div key={o.id} className="rounded-lg border border-border p-3 text-sm">
                    <p className="font-medium">{o.nombre}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{mxn(o.montoEstimado)}</span>
                      <span>{o.probabilidad ?? 0}%</span>
                    </div>
                  </div>
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
