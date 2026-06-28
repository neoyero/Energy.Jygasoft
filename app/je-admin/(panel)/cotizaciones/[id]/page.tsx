import { notFound } from "next/navigation";

import { requirePerm } from "@/lib/admin/guard";
import { can, type Rol } from "@/lib/admin/rbac";
import {
  getCotizacion,
  getCatalogoDisponible,
  getOportunidadesDeClienteOpciones,
  type DashboardScope,
  type OportunidadOpcion,
} from "@/lib/admin/queries";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { CotizacionBuilder } from "@/components/admin/cotizaciones/cotizacion-builder";
import { CotizacionOportunidadLink } from "@/components/admin/cotizaciones/cotizacion-oportunidad-link";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * Detalle / constructor de cotizacion (D4). Server component: valida permiso
 * (cotizaciones:view), arma el scope por rol y resuelve en paralelo el detalle
 * de la cotizacion y el catalogo disponible. notFound() si la cotizacion no
 * existe o esta fuera del scope. La edicion se habilita por permiso
 * (cotizaciones:edit) y se delega en CotizacionBuilder.
 */
export default async function CotizacionDetailPage({ params }: Params) {
  const { id } = await params;
  const user = await requirePerm("cotizaciones", "view");

  const scope: DashboardScope = {
    rol: (user.rol ?? "lectura") as Rol,
    userId: user.id,
  };

  const [detalle, catalogo] = await Promise.all([
    getCotizacion(scope, id),
    getCatalogoDisponible(),
  ]);

  if (!detalle) notFound();

  const { cotizacion } = detalle;
  const puedeEditar = can(user.rol, "cotizaciones", "edit");
  const puedeEditarDocs = can(user.rol, "documentos", "edit");
  const folio = cotizacion.folio ?? `#${cotizacion.id}`;

  // Oportunidades del cliente para el selector de enlace (solo si hay cliente).
  const oportunidadesCliente: OportunidadOpcion[] = cotizacion.clienteId
    ? await getOportunidadesDeClienteOpciones(cotizacion.clienteId)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Cotización ${cotizacion.folio ?? ""}`.trim()}
        description={`Versión ${cotizacion.version}`}
        breadcrumbs={[
          { label: "Cotizaciones", href: "/je-admin/cotizaciones" },
          { label: folio },
        ]}
        actions={<StatusBadge value={cotizacion.estado} size="md" />}
      />

      {cotizacion.clienteId ? (
        <CotizacionOportunidadLink
          cotizacionId={cotizacion.id}
          oportunidadId={cotizacion.oportunidadId}
          opciones={oportunidadesCliente}
          puedeEditar={puedeEditar}
        />
      ) : null}

      <CotizacionBuilder
        detalle={detalle}
        catalogo={catalogo}
        puedeEditar={puedeEditar}
        puedeEditarDocs={puedeEditarDocs}
      />
    </div>
  );
}
