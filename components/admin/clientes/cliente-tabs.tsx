"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import type { ClienteDetalle } from "@/lib/admin/queries"
import { formatMXN, fmtFechaRel } from "@/lib/admin/format"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { ContactosPanel } from "@/components/admin/clientes/contactos-panel"
import { cn } from "@/lib/utils"

const DASH = "—"

type TabId =
  | "contactos"
  | "oportunidades"
  | "cotizaciones"
  | "proyectos"
  | "documentos"
  | "historial"

interface TabDef {
  id: TabId
  label: string
  count: number
}

export interface ClienteTabsProps {
  detalle: ClienteDetalle
  /** RBAC clientes:edit -> habilita acciones en el panel de contactos. */
  puedeEditar: boolean
}

/** Monto opcional (numeric|null) formateado en MXN; null -> em-dash. */
function money(v: number | null | undefined): string {
  return v === null || v === undefined ? DASH : formatMXN(v)
}

/**
 * Tabs presentacionales del detalle 360 de cliente. Mantiene la pestana activa
 * con useState y renderiza paneles simples (tablas + StatusBadge + links a
 * pipeline/cotizaciones). El historial es un timeline (<ol>) como en leads.
 * Los contactos delegan en ContactosPanel (editable).
 */
export function ClienteTabs({ detalle, puedeEditar }: ClienteTabsProps) {
  const [tab, setTab] = useState<TabId>("contactos")

  const tabs: ReadonlyArray<TabDef> = [
    { id: "contactos", label: "Contactos", count: detalle.contactos.length },
    {
      id: "oportunidades",
      label: "Oportunidades",
      count: detalle.oportunidades.length,
    },
    {
      id: "cotizaciones",
      label: "Cotizaciones",
      count: detalle.cotizaciones.length,
    },
    { id: "proyectos", label: "Proyectos", count: detalle.proyectos.length },
    { id: "documentos", label: "Documentos", count: detalle.documentos.length },
    { id: "historial", label: "Historial", count: detalle.timeline.length },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de tabs */}
      <div
        role="tablist"
        aria-label="Secciones del cliente"
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
        {tab === "contactos" ? (
          <ContactosPanel
            clienteId={detalle.cliente.id}
            contactos={detalle.contactos}
            puedeEditar={puedeEditar}
          />
        ) : null}

        {tab === "oportunidades" ? (
          detalle.oportunidades.length === 0 ? (
            <EmptyState
              title="Sin oportunidades"
              description="Este cliente no tiene oportunidades en pipeline."
              size="sm"
            />
          ) : (
            <SimpleTable
              head={["Nombre", "Etapa", "Monto", "Prob.", "Creada"]}
            >
              {detalle.oportunidades.map((o) => (
                <Row
                  key={o.id}
                  href={`/je-admin/oportunidades/${o.id}`}
                  cells={[
                    <span key="nombre" className="font-medium text-foreground">
                      {o.nombre}
                    </span>,
                    <StatusBadge key="etapa" value={o.etapa} withDot={false} />,
                    money(o.montoEstimado),
                    `${o.probabilidad}%`,
                    fmtFechaRel(o.createdAt),
                  ]}
                />
              ))}
            </SimpleTable>
          )
        ) : null}

        {tab === "cotizaciones" ? (
          detalle.cotizaciones.length === 0 ? (
            <EmptyState
              title="Sin cotizaciones"
              description="Este cliente no tiene cotizaciones registradas."
              size="sm"
            />
          ) : (
            <SimpleTable
              head={["Folio", "Versión", "Estado", "Total", "Vigencia"]}
            >
              {detalle.cotizaciones.map((c) => (
                <Row
                  key={c.id}
                  href={`/je-admin/cotizaciones/${c.id}`}
                  cells={[
                    <span key="folio" className="font-medium text-foreground">
                      {c.folio ?? DASH}
                    </span>,
                    `v${c.version}`,
                    <StatusBadge key="estado" value={c.estado} withDot={false} />,
                    money(c.total),
                    fmtFechaRel(c.validaHasta),
                  ]}
                />
              ))}
            </SimpleTable>
          )
        ) : null}

        {tab === "proyectos" ? (
          detalle.proyectos.length === 0 ? (
            <EmptyState
              title="Sin proyectos"
              description="Este cliente no tiene proyectos asociados."
              size="sm"
            />
          ) : (
            <SimpleTable head={["Folio", "Fase", "Total c/IVA"]}>
              {detalle.proyectos.map((p) => (
                <Row
                  key={p.id}
                  href={`/je-admin/proyectos/${p.id}`}
                  cells={[
                    <span key="folio" className="font-medium text-foreground">
                      {p.folio ?? DASH}
                    </span>,
                    <StatusBadge key="fase" value={p.fase} withDot={false} />,
                    money(p.totalConIva),
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
              description="Este cliente no tiene documentos cargados."
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
              description="Aún no hay actividad registrada para este cliente."
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

/** Fila clicable: navega al href (interno via router, externo abre pestana). */
function Row({
  href,
  external = false,
  cells,
}: {
  href: string
  external?: boolean
  cells: ReadonlyArray<React.ReactNode>
}) {
  const router = useRouter()

  function navegar(): void {
    if (external) {
      window.open(href, "_blank", "noopener,noreferrer")
    } else {
      router.push(href)
    }
  }

  return (
    <tr
      onClick={navegar}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          navegar()
        }
      }}
      tabIndex={0}
      className={cn(
        "border-b border-border last:border-0 cursor-pointer transition-colors",
        "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
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
