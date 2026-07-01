"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, FileText, Plus, Search, Trash2 } from "lucide-react"

import type { DocumentoListRow, DocumentosFiltros, DocumentosPage } from "@/lib/admin/queries"
import { fetchDocumentos, eliminarDocumento } from "@/lib/admin/actions"
import { documentoTipo } from "@/db/schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/admin/ui/data-table"
import { StatusBadge, labelFor } from "@/components/admin/ui/status-badge"
import { fmtFechaRel } from "@/lib/admin/format"
import { ENTIDAD_LABEL, rutaEntidad } from "@/components/admin/actividades/actividad-utils"
import { SubirDocumentoModal } from "@/components/admin/documentos/subir-documento-modal"

const PAGE_SIZE = 15
const EMPTY: DocumentosPage = { rows: [], total: 0, hasMore: false }

const SELECT_CLASS =
  "h-9 rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

/** Tipos de entidad ofrecidos en el filtro (con ficha navegable). */
const ENTIDAD_TIPOS = ["lead", "cliente", "oportunidad", "cotizacion", "proyecto"] as const

export interface DocumentosViewProps {
  puedeEditar: boolean
  puedeEliminar: boolean
}

/**
 * Listado global de documentos (transversal a todas las entidades). Filtros por
 * tipo/entidad/búsqueda, tabla paginada server-side (fetchDocumentos, con scope
 * por subárbol), subida con selector de entidad y borrado. Cada fila enlaza al
 * archivo en M365 y a la ficha de su entidad dueña.
 */
export function DocumentosView({ puedeEditar, puedeEliminar }: DocumentosViewProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [tipo, setTipo] = useState("")
  const [entidadTipo, setEntidadTipo] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [busquedaEf, setBusquedaEf] = useState("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<DocumentosPage>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)
  const [subiendo, setSubiendo] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setBusquedaEf(busqueda), 250)
    return () => clearTimeout(t)
  }, [busqueda])

  const filtros: DocumentosFiltros = useMemo(
    () => ({
      tipo: tipo || undefined,
      entidadTipo: entidadTipo || undefined,
      busqueda: busquedaEf.trim() || undefined,
    }),
    [tipo, entidadTipo, busquedaEf],
  )
  const filtrosKey = JSON.stringify(filtros)

  const fetchPage = useCallback(
    (p: number) => fetchDocumentos({ filtros, limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtrosKey],
  )

  useEffect(() => {
    setPage(1)
  }, [filtrosKey])

  useEffect(() => {
    let stale = false
    setLoading(true)
    fetchPage(page)
      .then((res) => {
        if (!stale) {
          setData(res)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!stale) setLoading(false)
      })
    return () => {
      stale = true
    }
  }, [fetchPage, page, reloadToken])

  function borrar(row: DocumentoListRow): void {
    startTransition(async () => {
      await eliminarDocumento(row.id)
      setData(await fetchPage(page))
      router.refresh()
    })
  }

  const columns: ReadonlyArray<DataTableColumn<DocumentoListRow>> = [
    {
      id: "nombre",
      header: "Documento",
      accessor: (r) => r.nombre,
      render: (r) => (
        <a
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 font-medium text-stone-800 underline-offset-4 hover:underline dark:text-foreground"
        >
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{r.nombre}</span>
          <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </a>
      ),
    },
    {
      id: "tipo",
      header: "Tipo",
      accessor: (r) => r.tipo,
      render: (r) => <StatusBadge value={r.tipo} withDot={false} />,
    },
    {
      id: "entidad",
      header: "Entidad",
      accessor: (r) => r.entidadNombre ?? "",
      hideOnMobile: true,
      render: (r) =>
        r.entidadTipo ? (
          <div className="flex flex-col">
            <span className="text-stone-700 dark:text-foreground">{r.entidadNombre ?? "—"}</span>
            <span className="text-xs text-stone-400 dark:text-muted-foreground">
              {ENTIDAD_LABEL[r.entidadTipo] ?? r.entidadTipo}
            </span>
          </div>
        ) : (
          <span className="text-stone-400">—</span>
        ),
    },
    {
      id: "subidoPor",
      header: "Subido por",
      accessor: (r) => r.subidoPorNombre ?? "",
      hideOnMobile: true,
      render: (r) => (
        <span className="text-stone-600 dark:text-muted-foreground">
          {r.subidoPorNombre ?? "—"}
        </span>
      ),
    },
    {
      id: "fecha",
      header: "Fecha",
      accessor: (r) => r.createdAt,
      sortable: true,
      render: (r) => (
        <span className="text-stone-600 dark:text-muted-foreground">{fmtFechaRel(r.createdAt)}</span>
      ),
    },
  ]

  const rowActions: ReadonlyArray<DataTableRowAction<DocumentoListRow>> | undefined = puedeEditar
    ? [
        {
          label: "Abrir",
          icon: <ExternalLink className="size-4" />,
          onSelect: (r) => window.open(r.url, "_blank", "noopener,noreferrer"),
        },
        ...(puedeEliminar
          ? [
              {
                label: "Eliminar",
                icon: <Trash2 className="size-4" />,
                destructive: true,
                onSelect: borrar,
                confirm: {
                  title: "Eliminar documento",
                  description: (r: DocumentoListRow) => (
                    <>
                      Se eliminará <strong>{r.nombre}</strong> de forma permanente. ¿Continuar?
                    </>
                  ),
                  confirmLabel: "Eliminar",
                },
              } satisfies DataTableRowAction<DocumentoListRow>,
            ]
          : []),
      ]
    : undefined

  const pageCount = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  function abrirEntidad(row: DocumentoListRow): void {
    const ruta = rutaEntidad(row.entidadTipo, row.entidadId)
    if (ruta) router.push(ruta)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={SELECT_CLASS}>
              <option value="">Todos</option>
              {documentoTipo.enumValues.map((t) => (
                <option key={t} value={t}>
                  {labelFor(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">Entidad</label>
            <select
              value={entidadTipo}
              onChange={(e) => setEntidadTipo(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Todas</option>
              {ENTIDAD_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {ENTIDAD_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">Buscar</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre…"
                className="w-56 pl-8"
              />
            </div>
          </div>
        </div>

        {puedeEditar ? (
          <Button type="button" size="sm" onClick={() => setSubiendo(true)}>
            <Plus className="size-4" aria-hidden /> Subir documento
          </Button>
        ) : null}
      </div>

      <DataTable<DocumentoListRow>
        data={data.rows}
        columns={columns}
        rowKey={(r) => r.id}
        rowActions={rowActions}
        loading={loading}
        onRowClick={abrirEntidad}
        defaultSort={{ columnId: "fecha", direction: "desc" }}
        mobileCard={(r) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-stone-800 underline-offset-4 hover:underline dark:text-foreground"
              >
                {r.nombre}
              </a>
              <StatusBadge value={r.tipo} withDot={false} />
            </div>
            <p className="text-xs text-stone-500 dark:text-muted-foreground">
              {r.entidadTipo ? `${ENTIDAD_LABEL[r.entidadTipo] ?? r.entidadTipo}: ${r.entidadNombre ?? "—"} · ` : ""}
              {fmtFechaRel(r.createdAt)}
            </p>
          </div>
        )}
        pageControl={{ page, pageCount, total: data.total, pageSize: PAGE_SIZE, onPageChange: setPage }}
        empty={{
          title: "Sin documentos",
          description: "No hay documentos que coincidan con los filtros actuales.",
        }}
      />

      {puedeEditar ? (
        <SubirDocumentoModal
          open={subiendo}
          onOpenChange={setSubiendo}
          onSubido={() => setReloadToken((n) => n + 1)}
        />
      ) : null}
    </div>
  )
}
