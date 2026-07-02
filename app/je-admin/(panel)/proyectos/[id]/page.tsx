import type { ReactNode } from "react"
import { notFound } from "next/navigation"

import { paginaTenant } from "@/lib/admin/guard"
import { can, type Rol } from "@/lib/admin/rbac"
import {
  getProyectoDetalle,
  getCuadrillasActivas,
  getCatalogoDisponible,
  getActividadesDeEntidad,
  getUsuariosAsignables,
  type DashboardScope,
} from "@/lib/admin/queries"
import { formatMXN } from "@/lib/admin/format"
import { labelFor } from "@/components/admin/ui/status-badge"
import { PageHeader } from "@/components/admin/ui/page-header"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/admin/ui/card"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { FaseStepper } from "@/components/admin/proyectos/fase-stepper"
import { ProyectoTabs } from "@/components/admin/proyectos/proyecto-tabs"
import { ActividadesPanel } from "@/components/admin/actividades/actividades-panel"

export const dynamic = "force-dynamic"

interface Params {
  params: Promise<{ id: string }>
}

const DASH = "—"

/** Texto seguro: null/undefined/"" -> em-dash. */
function txt(v: unknown): string {
  return v === null || v === undefined || v === "" ? DASH : String(v)
}

/** Si/No para booleanos nullable. */
function siNo(v: boolean | null | undefined): string {
  return v === null || v === undefined ? DASH : v ? "Sí" : "No"
}

/** Monto opcional (numeric|null) formateado en MXN; null -> em-dash. */
function money(v: number | null | undefined): string {
  return v === null || v === undefined ? DASH : formatMXN(v)
}

/**
 * Detalle de un proyecto (D5). Server component: valida permiso, resuelve el
 * detalle con scope (notFound si no existe o esta fuera del scope del rol),
 * carga cuadrillas y catalogo en paralelo, y renderiza la cabecera (Resumen),
 * el stepper de fases y las pestañas (ProyectoTabs).
 */
export default async function ProyectoDetail({ params }: Params) {
  const { id } = await params
  return paginaTenant("proyectos", async (user) => {
  const scope: DashboardScope = {
    rol: (user.rol ?? "lectura") as Rol,
    userId: user.id,
  }

  const detalle = await getProyectoDetalle(scope, id)
  if (!detalle) notFound()

  const [cuadrillas, catalogo, actividades, vendedores] = await Promise.all([
    getCuadrillasActivas(),
    getCatalogoDisponible(),
    getActividadesDeEntidad("proyecto", id),
    getUsuariosAsignables(scope),
  ])

  const { proyecto } = detalle
  const puedeEditar = can(user.rol, "proyectos", "edit")
  const puedeEditarActs = can(user.rol, "actividades", "edit")

  return (
    <div className="space-y-6">
      <PageHeader
        title={proyecto.folio ?? "Proyecto"}
        breadcrumbs={[
          { label: "Proyectos", href: "/je-admin/proyectos" },
          { label: proyecto.folio ?? "Detalle" },
        ]}
        actions={<StatusBadge value={proyecto.fase} size="md" />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Generales */}
        <Card>
          <CardHeader>
            <CardTitle>Generales</CardTitle>
          </CardHeader>
          <CardContent className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Cliente" value={txt(proyecto.clienteNombre)} />
            <Field label="Vendedor" value={txt(proyecto.vendedorNombre)} />
            <Field
              label="Capacidad"
              value={
                proyecto.capacidadKwp === null
                  ? DASH
                  : `${proyecto.capacidadKwp} kWp`
              }
            />
            <Field
              label="Nivel de tensión"
              value={
                proyecto.nivelTension ? labelFor(proyecto.nivelTension) : DASH
              }
            />
            <Field label="Tarifa" value={txt(proyecto.tarifa)} />
            <Field
              label="Esquema CFE"
              value={proyecto.esquema ? labelFor(proyecto.esquema) : DASH}
            />
            <Field label="UVIE requerido" value={siNo(proyecto.uvieRequerido)} />
          </CardContent>
        </Card>

        {/* Comercial / costos */}
        <Card>
          <CardHeader>
            <CardTitle>Comercial &amp; costos</CardTitle>
          </CardHeader>
          <CardContent className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Precio sin IVA" value={money(proyecto.precioSinIva)} />
            <Field label="Total c/IVA" value={money(proyecto.totalConIva)} />
            <Field label="Costo total" value={money(proyecto.costoTotal)} />
            <Field label="Margen real" value={money(proyecto.margenReal)} />
          </CardContent>
        </Card>
      </div>

      {/* Stepper de fases */}
      <FaseStepper
        proyectoId={id}
        fase={proyecto.fase}
        puedeEditar={puedeEditar}
      />

      {/* Pestañas de relaciones */}
      <ProyectoTabs
        detalle={detalle}
        cuadrillas={cuadrillas}
        catalogo={catalogo}
        puedeEditar={puedeEditar}
      />

      {/* Actividades */}
      <Card>
        <CardHeader>
          <CardTitle>Actividades</CardTitle>
        </CardHeader>
        <CardContent className="mt-4">
          <ActividadesPanel
            entidadTipo="proyecto"
            entidadId={id}
            actividades={actividades}
            vendedores={vendedores}
            puedeEditar={puedeEditarActs}
          />
        </CardContent>
      </Card>
    </div>
  )
  })
}

/** Par etiqueta/valor reutilizable dentro de las cards de detalle. */
function Field({
  label,
  value,
  className,
}: {
  label: ReactNode
  value: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  )
}
