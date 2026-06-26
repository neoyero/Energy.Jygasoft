"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import type { CatalogoOption, ProyectoDetalle } from "@/lib/admin/queries"
import { formatMXN, fmtFechaRel } from "@/lib/admin/format"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { TramiteCfePanel } from "@/components/admin/proyectos/tramite-cfe-panel"
import { InstalacionPanel } from "@/components/admin/proyectos/instalacion-panel"
import { MaterialesPanel } from "@/components/admin/proyectos/materiales-panel"
import { cn } from "@/lib/utils"

const DASH = "—"

type TabId =
  | "tramite"
  | "instalacion"
  | "materiales"
  | "pagos"
  | "documentos"
  | "historial"

interface TabDef {
  id: TabId
  label: string
  count: number
}

export interface ProyectoTabsProps {
  detalle: ProyectoDetalle
  cuadrillas: ReadonlyArray<{ id: string; nombre: string }>
  catalogo: ReadonlyArray<CatalogoOption>
  /** RBAC proyectos:edit -> habilita acciones en los paneles editables. */
  puedeEditar: boolean
}

/**
 * Tabs del detalle de proyecto. Mantiene la pestaña activa con useState y
 * orquesta los paneles: Trámite CFE, Instalación y Materiales (editables) más
 * Pagos, Documentos e Historial (solo lectura, como en el detalle de cliente).
 */
export function ProyectoTabs({
  detalle,
  cuadrillas,
  catalogo,
  puedeEditar,
}: ProyectoTabsProps) {
  const [tab, setTab] = useState<TabId>("tramite")

  const tabs: ReadonlyArray<TabDef> = [
    { id: "tramite", label: "Trámite CFE", count: detalle.tramite ? 1 : 0 },
    {
      id: "instalacion",
      label: "Instalación",
      count: detalle.instalacion ? 1 : 0,
    },
    { id: "materiales", label: "Materiales", count: detalle.materiales.length },
    { id: "pagos", label: "Pagos", count: detalle.pagos.length },
    { id: "documentos", label: "Documentos", count: detalle.documentos.length },
    { id: "historial", label: "Historial", count: detalle.timeline.length },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de tabs */}
      <div
        role="tablist"
        aria-label="Secciones del proyecto"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              tab === t.id
                ? "border-brand text-brand dark:border-primary dark:text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Panel activo */}
      <div role="tabpanel">
        {tab === "tramite" ? (
          <TramiteCfePanel
            proyectoId={detalle.proyecto.id}
            tramite={detalle.tramite}
            puedeEditar={puedeEditar}
          />
        ) : null}

        {tab === "instalacion" ? (
          <InstalacionPanel
            proyectoId={detalle.proyecto.id}
            instalacion={detalle.instalacion}
            cuadrillas={cuadrillas}
            puedeEditar={puedeEditar}
          />
        ) : null}

        {tab === "materiales" ? (
          <MaterialesPanel
            proyectoId={detalle.proyecto.id}
            materiales={detalle.materiales}
            catalogo={catalogo}
            puedeEditar={puedeEditar}
          />
        ) : null}

        {tab === "pagos" ? (
          detalle.pagos.length === 0 ? (
            <EmptyState
              title="Sin pagos"
              description="Este proyecto no tiene pagos registrados."
              size="sm"
            />
          ) : (
            <SimpleTable head={["Concepto", "Monto", "Estado", "Programada"]}>
              {detalle.pagos.map((p) => (
                <Row
                  key={p.id}
                  cells={[
                    <span key="concepto" className="font-medium text-foreground">
                      {p.concepto}
                    </span>,
                    formatMXN(p.monto),
                    <StatusBadge
                      key="estado"
                      value={p.vencido ? "vencido" : p.estado}
                      withDot={false}
                    />,
                    fmtFechaRel(p.fechaProgramada),
                  ]}
                />
              ))}
            </SimpleTable>
          )
        ) : null}

        {tab === "documentos" ? (
          detalle.documentos.length === 0 ? (
            <EmptyState
              title="Sin documentos"
              description="Este proyecto no tiene documentos cargados."
              size="sm"
            />
          ) : (
            <SimpleTable head={["Tipo", "Nombre", "Cargado"]}>
              {detalle.documentos.map((d) => (
                <Row
                  key={d.id}
                  href={d.url}
                  external
                  cells={[
                    <StatusBadge key="tipo" value={d.tipo} withDot={false} />,
                    <span key="nombre" className="font-medium text-foreground">
                      {d.nombre}
                    </span>,
                    fmtFechaRel(d.createdAt),
                  ]}
                />
              ))}
            </SimpleTable>
          )
        ) : null}

        {tab === "historial" ? (
          detalle.timeline.length === 0 ? (
            <EmptyState
              title="Sin eventos"
              description="Aún no hay actividad registrada para este proyecto."
              size="sm"
            />
          ) : (
            <ol className="space-y-3">
              {detalle.timeline.map((e) => (
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
          )
        ) : null}
      </div>
    </div>
  )
}

/** Tabla simple presentacional con cabecera de columnas. */
function SimpleTable({
  head,
  children,
}: {
  head: ReadonlyArray<string>
  children: React.ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="border-b border-border bg-muted/40 text-left">
          <tr>
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

/** Fila opcionalmente clicable: navega al href (interno via router, externo abre pestaña). */
function Row({
  href,
  external = false,
  cells,
}: {
  href?: string
  external?: boolean
  cells: ReadonlyArray<React.ReactNode>
}) {
  const router = useRouter()

  function navegar(): void {
    if (!href) return
    if (external) {
      window.open(href, "_blank", "noopener,noreferrer")
    } else {
      router.push(href)
    }
  }

  const clicable = Boolean(href)

  return (
    <tr
      onClick={clicable ? navegar : undefined}
      onKeyDown={
        clicable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                navegar()
              }
            }
          : undefined
      }
      tabIndex={clicable ? 0 : undefined}
      className={cn(
        "border-b border-border last:border-0 transition-colors",
        clicable &&
          "cursor-pointer hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
      )}
    >
      {cells.map((cell, i) => (
        <td key={i} className="px-4 py-3 text-stone-700 dark:text-foreground">
          {cell}
        </td>
      ))}
    </tr>
  )
}
