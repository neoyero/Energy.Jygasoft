import { notFound } from "next/navigation"
import { PackagePlus } from "lucide-react"

import { requirePerm } from "@/lib/admin/guard"
import { can } from "@/lib/admin/rbac"
import { getPaquete, getProductosCatalogo } from "@/lib/admin/queries"
import { PageHeader } from "@/components/admin/ui/page-header"
import { Card, CardContent } from "@/components/admin/ui/card"
import { PaqueteLineasEditor } from "@/components/admin/paquetes/paquete-lineas-editor"

export const dynamic = "force-dynamic"

interface Params {
  params: Promise<{ id: string }>
}

const SEGMENTO_LABEL: Record<string, string> = {
  residencial: "Residencial",
  comercial: "Comercial",
  industrial: "Industrial",
}

export default async function PaqueteDetailPage({ params }: Params) {
  const { id } = await params
  const user = await requirePerm("paquetes", "view")
  const puedeEditar = can(user.rol, "paquetes", "edit")

  const detalle = await getPaquete(id)
  if (!detalle) notFound()

  const { paquete, lineas } = detalle
  const catalogo = puedeEditar ? await getProductosCatalogo() : []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={paquete.nombre}
        description={
          `${SEGMENTO_LABEL[paquete.segmento] ?? paquete.segmento}` +
          (paquete.capacidadKwp != null ? ` · ${paquete.capacidadKwp} kWp` : "") +
          (paquete.activo ? "" : " · Inactivo")
        }
        icon={<PackagePlus className="size-6" aria-hidden />}
        breadcrumbs={[
          { label: "Paquetes", href: "/je-admin/paquetes" },
          { label: paquete.nombre },
        ]}
      />

      {paquete.descripcion ? (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">{paquete.descripcion}</CardContent>
        </Card>
      ) : null}

      <PaqueteLineasEditor
        paqueteId={paquete.id}
        lineasIniciales={lineas}
        catalogo={catalogo}
        moneda={paquete.moneda}
        descuentoPct={paquete.descuentoPct}
        puedeEditar={puedeEditar}
      />
    </div>
  )
}
