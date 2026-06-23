import Link from "next/link";
import { notFound } from "next/navigation";
import { getLead, getLeadTimeline } from "@/lib/admin/queries";
import { LeadActions } from "@/components/admin/lead-actions";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

function fmt(v: unknown) {
  return v === null || v === undefined || v === "" ? "—" : String(v);
}

export default async function LeadDetail({ params }: Params) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();
  const timeline = await getLeadTimeline(id);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link href="/admin/leads" className="text-sm text-muted-foreground hover:underline">
          ← Leads
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {fmt(lead.nombre)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {fmt(lead.telefono)} · {fmt(lead.email)} · score {lead.score}
        </p>
      </div>

      <div className="rounded-xl border border-border p-5">
        <LeadActions leadId={lead.id} estado={lead.estado} />
      </div>

      <section className="grid gap-3 rounded-xl border border-border p-5 text-sm sm:grid-cols-2">
        <Field label="Segmento" value={fmt(lead.segmento)} />
        <Field label="Uso" value={fmt(lead.uso)} />
        <Field label="CP / Municipio" value={`${fmt(lead.cp)} · ${fmt(lead.municipio)}`} />
        <Field label="Consumo (kWh/mes)" value={fmt(lead.consumoKwhMes)} />
        <Field label="Recibo (MXN)" value={fmt(lead.reciboMxn)} />
        <Field label="Sizing" value={`${fmt(lead.sizingKwp)} kWp · ${fmt(lead.sizingPaneles)} paneles`} />
        <Field label="Canal" value={fmt(lead.canal)} />
        <Field label="Origen" value={fmt(lead.origenForm)} />
        <Field label="Consent. datos" value={lead.consentimientoDatos ? "Sí" : "No"} />
        <Field label="Consent. marketing" value={lead.consentimientoMarketing ? "Sí" : "No"} />
      </section>

      <section>
        <h2 className="mb-3 font-medium">Timeline</h2>
        <ol className="space-y-3">
          {timeline.map((e) => (
            <li key={String(e.id)} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{e.tipo}</span>
                <time className="text-xs text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString("es-MX")}
                </time>
              </div>
              {e.descripcion && (
                <p className="mt-1 text-muted-foreground">{e.descripcion}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">por {e.actor}</p>
            </li>
          ))}
          {timeline.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin eventos.</p>
          )}
        </ol>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
