import { getDashboard } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { leadsByEstado, oportByEtapa, totals } = await getDashboard();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Leads" value={totals.leads} />
        <Stat label="Clientes" value={totals.clientes} />
        <Stat label="Oportunidades" value={totals.oportunidades} />
        <Stat label="Proyectos" value={totals.proyectos} />
        <Stat label="Simulaciones" value={totals.simulaciones} />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Panel title="Leads por estado">
          {leadsByEstado.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-1 text-sm">
              {leadsByEstado.map((r) => (
                <li key={r.estado} className="flex justify-between">
                  <span className="text-muted-foreground">{r.estado}</span>
                  <span className="font-medium">{r.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Pipeline por etapa">
          {oportByEtapa.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-1 text-sm">
              {oportByEtapa.map((r) => (
                <li key={r.etapa} className="flex justify-between">
                  <span className="text-muted-foreground">{r.etapa}</span>
                  <span className="font-medium">{r.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-5">
      <h2 className="mb-3 font-medium">{title}</h2>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">Sin datos aún.</p>;
}
