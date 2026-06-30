import type { ReactNode } from "react"
import { notFound } from "next/navigation"

import { requirePerm } from "@/lib/admin/guard"
import { can, type Rol } from "@/lib/admin/rbac"
import {
  getClienteDetalle,
  getVendedores,
  getUsuariosAsignables,
  type DashboardScope,
} from "@/lib/admin/queries"
import { fmtFechaRel } from "@/lib/admin/format"
import { regimenFiscalLabel } from "@/lib/sat/regimen-fiscal"
import { labelFor } from "@/components/admin/ui/status-badge"
import { PageHeader } from "@/components/admin/ui/page-header"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/admin/ui/card"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { ClienteTabs } from "@/components/admin/clientes/cliente-tabs"
import { ClienteHeaderActions } from "@/components/admin/clientes/cliente-header-actions"

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

/**
 * Detalle 360 de un cliente (D4). Server component: valida permiso, resuelve el
 * detalle con scope (notFound si no existe o esta fuera del scope del rol) y
 * renderiza la ficha (datos fiscales, CFE/suministro, contacto/domicilio,
 * comercial) y las pestañas con sus relaciones (ClienteTabs).
 */
export default async function ClienteDetail({ params }: Params) {
  const { id } = await params
  const user = await requirePerm("clientes", "view")

  const scope: DashboardScope = {
    rol: (user.rol ?? "lectura") as Rol,
    userId: user.id,
  }

  const [detalle, vendedores, asignables] = await Promise.all([
    getClienteDetalle(scope, id),
    getVendedores(),
    getUsuariosAsignables(scope),
  ])
  if (!detalle) notFound()

  const { cliente, vendedorNombre, municipioNombre } = detalle

  const puedeEditar = can(user.rol, "clientes", "edit")
  const puedeEditarCliente = can(user.rol, "clientes", "edit")
  const puedeEliminarCliente = scope.rol === "admin"
  const puedeCrearOport = can(user.rol, "oportunidades", "edit")
  const puedeCrearCotiz = can(user.rol, "cotizaciones", "edit")
  const puedeEditarDocs = can(user.rol, "documentos", "edit")
  const puedeEditarActs = can(user.rol, "actividades", "edit")

  const descripcion = [cliente.rfc, cliente.telefono, cliente.email]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="space-y-6">
      <PageHeader
        title={cliente.nombre}
        description={descripcion || undefined}
        breadcrumbs={[
          { label: "Clientes", href: "/je-admin/clientes" },
          { label: cliente.nombre },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge
              value={cliente.tipoPersona}
              withDot={false}
              size="md"
            />
            <ClienteHeaderActions
              cliente={cliente}
              vendedores={vendedores}
              puedeEditar={puedeEditarCliente}
              puedeEliminar={puedeEliminarCliente}
            />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Datos fiscales */}
        <Card>
          <CardHeader>
            <CardTitle>Datos fiscales</CardTitle>
          </CardHeader>
          <CardContent className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Tipo de persona"
              value={<StatusBadge value={cliente.tipoPersona} withDot={false} />}
            />
            <Field label="RFC" value={txt(cliente.rfc)} />
            <Field label="CURP" value={txt(cliente.curp)} />
            <Field
              label="Régimen fiscal"
              value={
                cliente.regimenFiscal
                  ? regimenFiscalLabel(cliente.regimenFiscal)
                  : DASH
              }
            />
            <Field
              label="CSF actualizada"
              value={fmtFechaRel(cliente.csfActualizadaAt)}
            />
          </CardContent>
        </Card>

        {/* CFE / suministro */}
        <Card>
          <CardHeader>
            <CardTitle>CFE &amp; suministro</CardTitle>
          </CardHeader>
          <CardContent className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="No. servicio CFE"
              value={txt(cliente.numeroServicioCfe)}
            />
            <Field label="Tarifa" value={txt(cliente.tarifa)} />
            <Field
              label="Nivel de tensión"
              value={
                cliente.nivelTension ? labelFor(cliente.nivelTension) : DASH
              }
            />
            <Field label="Titular CFE" value={txt(cliente.titularCfe)} />
            <Field
              label="Titular coincide"
              value={siNo(cliente.titularCoincide)}
            />
          </CardContent>
        </Card>

        {/* Contacto / domicilio */}
        <Card>
          <CardHeader>
            <CardTitle>Contacto &amp; domicilio</CardTitle>
          </CardHeader>
          <CardContent className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Email" value={txt(cliente.email)} />
            <Field label="Teléfono" value={txt(cliente.telefono)} />
            <Field label="Domicilio" value={txt(cliente.domicilio)} />
            <Field
              label="Municipio / Estado"
              value={`${txt(cliente.municipio)} · ${txt(cliente.estadoMx)}`}
            />
            <Field
              label="Municipio (catálogo)"
              value={txt(municipioNombre)}
            />
            <Field label="CP" value={txt(cliente.cp)} />
          </CardContent>
        </Card>

        {/* Comercial */}
        <Card>
          <CardHeader>
            <CardTitle>Comercial</CardTitle>
          </CardHeader>
          <CardContent className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Vendedor" value={txt(vendedorNombre)} />
            <Field label="Alta" value={fmtFechaRel(cliente.createdAt)} />
            <Field
              label="Actualizado"
              value={fmtFechaRel(cliente.updatedAt)}
            />
            <Field
              label="Notas"
              value={txt(cliente.notas)}
              className="sm:col-span-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Pestañas de relaciones */}
      <ClienteTabs
        detalle={detalle}
        vendedores={asignables}
        puedeEditar={puedeEditar}
        puedeCrearOport={puedeCrearOport}
        puedeCrearCotiz={puedeCrearCotiz}
        puedeEditarDocs={puedeEditarDocs}
        puedeEditarActs={puedeEditarActs}
      />
    </div>
  )
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
