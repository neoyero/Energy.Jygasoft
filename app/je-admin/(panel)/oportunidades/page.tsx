import { TrendingUp, Wallet, Target } from "lucide-react";

import { requirePerm } from "@/lib/admin/guard";
import { can, type Rol } from "@/lib/admin/rbac";
import {
  getOportunidadesPipeline,
  type DashboardScope,
} from "@/lib/admin/queries";
import { formatMXN, formatInt } from "@/lib/admin/format";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatCard } from "@/components/admin/ui/stat-card";
import { PipelineBoard } from "@/components/admin/oportunidades/pipeline-board";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const user = await requirePerm("oportunidades", "view");

  const scope: DashboardScope = {
    rol: (user.rol ?? "lectura") as Rol,
    userId: user.id,
  };

  const data = await getOportunidadesPipeline(scope);
  const puedeEditar = can(scope.rol, "oportunidades", "edit");

  return (
    <div className="space-y-6">
      <PageHeader title="Pipeline" description="Oportunidades por etapa" />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Forecast ponderado"
          value={formatMXN(data.forecastTotal)}
          icon={TrendingUp}
          accent="green"
        />
        <StatCard
          label="Monto abierto"
          value={formatMXN(data.montoTotalAbierto)}
          icon={Wallet}
          accent="gold"
        />
        <StatCard
          label="Oportunidades abiertas"
          value={formatInt(data.oportunidades.length)}
          icon={Target}
          accent="brand"
        />
      </section>

      <PipelineBoard data={data} puedeEditar={puedeEditar} />
    </div>
  );
}
