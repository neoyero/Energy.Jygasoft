import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import {
  getLead,
  getLeadTimeline,
  getAsesoresAsignables,
} from "@/lib/admin/queries";
import { requirePerm } from "@/lib/admin/guard";
import { can } from "@/lib/admin/rbac";
import { formatMXN, fmtFechaRel } from "@/lib/admin/format";
import { LeadActions } from "@/components/admin/lead-actions";
import { LeadEditPanel } from "@/components/admin/leads/lead-edit-panel";
import { PageHeader } from "@/components/admin/ui/page-header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/admin/ui/card";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { ScoreBar } from "@/components/admin/leads/score-bar";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

/** Placeholder em-dash para valores ausentes. */
const DASH = "—";

/** Texto seguro: null/undefined/"" -> em-dash. */
function txt(v: unknown): string {
  return v === null || v === undefined || v === "" ? DASH : String(v);
}

/** Convierte un numeric (string|number|null) a number para formatMXN. */
function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Formatea un monto numeric; null/"" -> em-dash. */
function money(v: unknown): string {
  if (v === null || v === undefined || v === "") return DASH;
  return formatMXN(toNum(v));
}

function siNo(v: boolean | null | undefined): string {
  return v ? "Sí" : "No";
}

export default async function LeadDetail({ params }: Params) {
  const { id } = await params;
  const user = await requirePerm("leads", "view");
  const puedeEditar = can(user.rol, "leads", "edit");

  const [lead, timeline, vendedores] = await Promise.all([
    getLead(id),
    getLeadTimeline(id),
    getAsesoresAsignables(),
  ]);

  if (!lead) notFound();

  const descripcion = [lead.telefono, lead.email].filter(Boolean).join(" · ");
  const vendedorNombre =
    vendedores.find((v) => v.id === lead.vendedorId)?.nombre ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.nombre ?? "Lead"}
        description={descripcion || undefined}
        breadcrumbs={[
          { label: "Leads", href: "/je-admin/leads" },
          { label: lead.nombre ?? "Detalle" },
        ]}
        actions={<StatusBadge value={lead.estado} size="md" />}
      />

      {puedeEditar ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Gestión</CardTitle>
            </CardHeader>
            <CardContent className="mt-4">
              <LeadActions
                leadId={lead.id}
                estado={lead.estado}
                vendedorId={lead.vendedorId}
                vendedores={vendedores}
              />
            </CardContent>
          </Card>

          <LeadEditPanel lead={lead} vendedores={vendedores} />
        </>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Contacto */}
        <Card>
          <CardHeader>
            <CardTitle>Contacto</CardTitle>
          </CardHeader>
          <CardContent className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" value={txt(lead.nombre)} />
            <Field label="Email" value={txt(lead.email)} />
            <Field label="Teléfono" value={txt(lead.telefono)} />
            <Field
              label="Municipio / Estado"
              value={`${txt(lead.municipio)} · ${txt(lead.estadoMx)}`}
            />
            <Field
              label="CP / Colonia"
              value={`${txt(lead.cp)} · ${txt(lead.colonia)}`}
            />
            <Field
              label="Consent. datos"
              value={siNo(lead.consentimientoDatos)}
            />
            <Field
              label="Consent. marketing"
              value={siNo(lead.consentimientoMarketing)}
            />
            <Field label="Origen" value={txt(lead.origenForm)} />
            <Field
              label="Canal"
              value={
                lead.canal ? <StatusBadge value={lead.canal} /> : DASH
              }
            />
          </CardContent>
        </Card>

        {/* Consumo & sizing */}
        <Card>
          <CardHeader>
            <CardTitle>Consumo &amp; sizing</CardTitle>
          </CardHeader>
          <CardContent className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Consumo (kWh/mes)" value={txt(lead.consumoKwhMes)} />
            <Field label="Recibo" value={money(lead.reciboMxn)} />
            <Field label="Sizing (kWp)" value={txt(lead.sizingKwp)} />
            <Field label="Paneles" value={txt(lead.sizingPaneles)} />
            <Field label="Inversión mín." value={money(lead.inversionMin)} />
            <Field label="Inversión máx." value={money(lead.inversionMax)} />
            <Field label="Ahorro estimado" value={money(lead.ahorroEstimadoMxn)} />
            <Field label="Uso" value={txt(lead.uso)} />
          </CardContent>
        </Card>

        {/* Comercial */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Comercial</CardTitle>
          </CardHeader>
          <CardContent className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Asesor" value={txt(vendedorNombre)} />
            <Field
              label="Estado"
              value={<StatusBadge value={lead.estado} />}
            />
            <Field
              label="Score"
              value={<ScoreBar score={lead.score} className="mt-1.5" />}
            />
            <Field label="Asignado" value={fmtFechaRel(lead.asignadoAt)} />
            <Field label="Calificado" value={fmtFechaRel(lead.calificadoAt)} />
            <Field label="Creado" value={fmtFechaRel(lead.createdAt)} />
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="mt-4">
          {timeline.length === 0 ? (
            <EmptyState
              title="Sin eventos"
              description="Aún no hay actividad registrada para este lead."
              size="sm"
            />
          ) : (
            <ol className="space-y-3">
              {timeline.map((e) => (
                <li
                  key={String(e.id)}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{e.tipo}</span>
                    <time className="text-xs text-muted-foreground">
                      {fmtFechaRel(e.createdAt)}
                    </time>
                  </div>
                  {e.descripcion ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {e.descripcion}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    por {e.actor}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Par etiqueta/valor reutilizable dentro de las cards de detalle. */
function Field({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}
