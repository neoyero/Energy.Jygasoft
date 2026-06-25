import {
  Users,
  Target,
  TrendingUp,
  FolderKanban,
  Wallet,
} from "lucide-react";

import { requirePerm } from "@/lib/admin/guard";
import { can, type Rol } from "@/lib/admin/rbac";
import {
  getDashboardData,
  ETAPA_ORDER,
  type DashboardScope,
  type PipelineEtapaRow,
  type ProyectoFaseRow,
} from "@/lib/admin/queries";
import { formatMXN, formatInt, buildTrend, toneToHex } from "@/lib/admin/format";
import { PageHeader } from "@/components/admin/ui/page-header";
import { ChartCard } from "@/components/admin/ui/chart-card";
import { Card, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { StatCard } from "@/components/admin/ui/stat-card";
import {
  LineChartMini,
  DonutChart,
  BarChartMini,
  Sparkline,
  type DonutDatum,
  type ChartDatum,
} from "@/components/admin/ui/charts";
import { toneFor, labelFor } from "@/components/admin/ui/status-badge";
import { MisTareasTable } from "@/components/admin/dashboard/mis-tareas-table";
import { ActividadReciente } from "@/components/admin/dashboard/actividad-reciente";

export const dynamic = "force-dynamic";

/** Etapas cerradas del pipeline (se excluyen del desglose de pipeline abierto). */
const ETAPAS_CERRADAS: ReadonlySet<string> = new Set(["ganada", "perdida"]);

export default async function DashboardPage() {
  const user = await requirePerm("dashboard", "view");
  const scope: DashboardScope = {
    rol: (user.rol ?? "lectura") as Rol,
    userId: user.id,
  };

  const data = await getDashboardData(scope);
  const { kpis, leadsSerie, pipeline, proyectosFase } = data;

  const rol = scope.rol;
  const verLeads = can(rol, "leads");
  const verPipeline = can(rol, "oportunidades");
  const verProyectos = can(rol, "proyectos");
  const verFinanzas = can(rol, "pagos");

  const isScoped = !verPipeline && !verProyectos && !verFinanzas;
  const description = isScoped
    ? "Resumen de tu actividad."
    : "Resumen de la actividad del equipo.";

  // Pipeline abierto: excluye etapas cerradas, ordenado por ETAPA_ORDER.
  const pipelineAbierto: PipelineEtapaRow[] = pipeline
    .filter((row) => !ETAPAS_CERRADAS.has(row.etapa))
    .slice()
    .sort(
      (a, b) =>
        (ETAPA_ORDER as readonly string[]).indexOf(a.etapa) -
        (ETAPA_ORDER as readonly string[]).indexOf(b.etapa),
    );

  const pipelineDonut: DonutDatum[] = pipelineAbierto.map((row) => ({
    name: labelFor(row.etapa),
    value: row.monto,
    color: toneToHex(toneFor(row.etapa)),
  }));
  const pipelineTotal = pipelineAbierto.reduce((acc, row) => acc + row.monto, 0);

  const proyectosFaseData: ChartDatum[] = proyectosFase.map(
    (row: ProyectoFaseRow) => ({
      etiqueta: labelFor(row.fase),
      conteo: row.conteo,
    }),
  );

  const leadsSerieData: ChartDatum[] = leadsSerie.map((point) => ({
    dia: point.dia,
    n: point.n,
  }));
  const leadsSparkline = leadsSerie.map((point) => point.n);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={description}
        actions={
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Últimos 30 días
          </span>
        }
      />

      {/* Fila de KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {verLeads ? (
          <StatCard
            label="Leads (30d)"
            value={formatInt(kpis.leadsNuevos.actual)}
            icon={Users}
            accent="brand"
            trend={buildTrend(kpis.leadsNuevos.actual, kpis.leadsNuevos.previo)}
            sparkline={<Sparkline data={leadsSparkline} />}
            href="/je-admin/leads"
          />
        ) : null}

        {verPipeline ? (
          <StatCard
            label="Pipeline abierto"
            value={formatInt(kpis.oportAbiertas.actual)}
            icon={Target}
            accent="green"
            trend={buildTrend(
              kpis.oportAbiertas.actual,
              kpis.oportAbiertas.previo,
            )}
            href="/je-admin/oportunidades"
          />
        ) : null}

        {verPipeline ? (
          <StatCard
            label="Valor ponderado"
            value={formatMXN(kpis.pipelinePonderado.actual)}
            icon={TrendingUp}
            accent="gold"
            trend={buildTrend(
              kpis.pipelinePonderado.actual,
              kpis.pipelinePonderado.previo,
            )}
            href="/je-admin/oportunidades"
          />
        ) : null}

        {verProyectos ? (
          <StatCard
            label="Proyectos activos"
            value={formatInt(kpis.proyectosActivos.actual)}
            icon={FolderKanban}
            accent="mint"
            trend={buildTrend(
              kpis.proyectosActivos.actual,
              kpis.proyectosActivos.previo,
            )}
            href="/je-admin/proyectos"
          />
        ) : null}

        {verFinanzas ? (
          <StatCard
            label="Cobranza pendiente"
            value={formatMXN(kpis.cobranzaPendiente.actual)}
            icon={Wallet}
            accent="neutral"
            trend={buildTrend(
              kpis.cobranzaPendiente.actual,
              kpis.cobranzaPendiente.previo,
              { goodWhenDown: true },
            )}
            href="/je-admin/pagos"
          />
        ) : null}
      </section>

      {/* Fila de gráficas */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {verLeads ? (
          <ChartCard
            title="Leads en el tiempo"
            description="Nuevos leads por día (últimos 30 días)"
            height={256}
            isEmpty={leadsSerieData.length === 0}
            className="lg:col-span-2"
          >
            <LineChartMini
              data={leadsSerieData}
              xKey="dia"
              lines={[{ key: "n", name: "Leads", area: true }]}
              valueFormat="int"
            />
          </ChartCard>
        ) : null}

        {verPipeline ? (
          <ChartCard
            title="Pipeline por etapa"
            description="Monto por etapa abierta"
            height={256}
            isEmpty={pipelineDonut.length === 0}
          >
            <DonutChart
              data={pipelineDonut}
              centerLabel={formatMXN(pipelineTotal)}
              centerSub="pipeline"
              valueFormat="mxn"
              showLegend
            />
          </ChartCard>
        ) : null}

        {verProyectos ? (
          <ChartCard
            title="Proyectos por fase"
            description="Distribución de proyectos activos"
            height={256}
            isEmpty={proyectosFaseData.length === 0}
          >
            <BarChartMini
              data={proyectosFaseData}
              xKey="etiqueta"
              bars={[{ key: "conteo", name: "Proyectos" }]}
              valueFormat="int"
            />
          </ChartCard>
        ) : null}
      </section>

      {/* Sección inferior: tareas y actividad */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card padding="md">
          <CardHeader>
            <CardTitle>Mis tareas</CardTitle>
          </CardHeader>
          <div className="mt-4">
            <MisTareasTable rows={data.misActividades} />
          </div>
        </Card>

        <Card padding="md">
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
          </CardHeader>
          <div className="mt-4">
            <ActividadReciente rows={data.actividadReciente} />
          </div>
        </Card>
      </section>
    </div>
  );
}
