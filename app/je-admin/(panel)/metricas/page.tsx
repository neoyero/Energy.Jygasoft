import { BarChart3 } from "lucide-react";

import { requirePerm } from "@/lib/admin/guard";
import { type Rol } from "@/lib/admin/rbac";
import {
  getMetricasData,
  getVendedores,
  isScoped,
  type DashboardScope,
} from "@/lib/admin/queries";
import { PageHeader } from "@/components/admin/ui/page-header";
import { MetricasView } from "@/components/admin/metricas/metricas-view";

export const dynamic = "force-dynamic";

export default async function MetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; vendedor?: string }>;
}) {
  const sp = await searchParams;

  const user = await requirePerm("metricas", "view");
  const scope: DashboardScope = {
    rol: (user.rol ?? "lectura") as Rol,
    userId: user.id,
  };
  const rolScoped = isScoped(scope.rol);

  const filtros = {
    desde: sp.desde,
    hasta: sp.hasta,
    vendedorId: sp.vendedor ?? null,
  };

  const [data, vendedores] = await Promise.all([
    getMetricasData(scope, filtros),
    getVendedores(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Métricas"
        description="Ingresos, conversión del pipeline, proyectos por fase y cobranza."
        icon={<BarChart3 className="size-6" aria-hidden />}
      />

      <MetricasView
        data={data}
        vendedores={vendedores}
        rolScoped={rolScoped}
        initial={{
          desde: sp.desde ?? "",
          hasta: sp.hasta ?? "",
          vendedor: sp.vendedor ?? "",
        }}
      />
    </div>
  );
}
