import { requirePerm } from "@/lib/admin/guard";
import { can, type Rol } from "@/lib/admin/rbac";
import {
  getOportunidadesPipeline,
  type DashboardScope,
} from "@/lib/admin/queries";
import { PageHeader } from "@/components/admin/ui/page-header";
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

      <PipelineBoard data={data} puedeEditar={puedeEditar} />
    </div>
  );
}
