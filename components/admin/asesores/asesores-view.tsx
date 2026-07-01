"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Power, PowerOff, RefreshCw } from "lucide-react"

import type { AsesorRow } from "@/lib/admin/queries"
import { toggleAsesorActivo, sincronizarAsesoresChatwoot } from "@/lib/admin/actions"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/admin/ui/modal"
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/admin/ui/data-table"
import { StatusBadge, type StatusTone } from "@/components/admin/ui/status-badge"
import { AsesorForm } from "@/components/admin/asesores/asesor-form"

export interface AsesoresViewProps {
  asesores: ReadonlyArray<AsesorRow>
  usuarios: ReadonlyArray<{ id: string; nombre: string; email?: string }>
  /** true si Chatwoot está configurado (habilita invitación + sincronización). */
  chatwootActivo: boolean
  puedeEditar: boolean
}

/** Estado de sync Chatwoot -> tono + etiqueta legible. */
const ESTADO_META: Record<string, { tone: StatusTone; label: string }> = {
  activo: { tone: "success", label: "Vinculado" },
  invitado: { tone: "info", label: "Invitado" },
  error: { tone: "danger", label: "Error" },
  no_sincronizado: { tone: "neutral", label: "Sin vincular" },
}

/** "" -> "Todas/Ambos"; si no, las etiquetas unidas. */
function listOrAll(items: string[], vacio: string): string {
  return items.length === 0 ? vacio : items.join(", ")
}

/**
 * Gestión de asesores (agentes de Chatwoot) homologada: tabla con estado de
 * vinculación a Chatwoot, alta/edición en modal, activar/desactivar y un botón
 * "Sincronizar con Chatwoot" que reconcilia por correo (enlaza agentes ya
 * existentes en el droplet).
 */
export function AsesoresView({ asesores, usuarios, chatwootActivo, puedeEditar }: AsesoresViewProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<AsesorRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const opciones = useMemo(
    () => usuarios.map((u) => ({ id: u.id, nombre: u.nombre, email: u.email })),
    [usuarios],
  )

  function cerrar(): void {
    setCreando(false)
    setEditando(null)
  }

  function toggle(a: AsesorRow): void {
    startTransition(async () => {
      await toggleAsesorActivo(a.id, !a.activo)
      router.refresh()
    })
  }

  function sincronizar(): void {
    setMsg(null)
    startTransition(async () => {
      const res = await sincronizarAsesoresChatwoot()
      if (!res.ok) setMsg(res.error)
      else {
        setMsg(`Sincronizado: ${res.enlazados ?? 0} enlazados, ${res.sinMatch ?? 0} sin coincidencia.`)
        router.refresh()
      }
    })
  }

  const columns: ReadonlyArray<DataTableColumn<AsesorRow>> = [
    {
      id: "nombre",
      header: "Asesor",
      accessor: (a) => a.nombre,
      render: (a) => (
        <div className="flex flex-col">
          <span className="font-medium text-stone-800 dark:text-foreground">{a.nombre}</span>
          {a.email ? (
            <span className="text-xs text-stone-500 dark:text-muted-foreground">{a.email}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "usuario",
      header: "Usuario",
      accessor: (a) => a.usuarioNombre ?? "",
      hideOnMobile: true,
      render: (a) => (
        <span className="text-stone-600 dark:text-muted-foreground">
          {a.usuarioNombre ?? "— (sin vincular)"}
        </span>
      ),
    },
    {
      id: "chatwoot",
      header: "Chatwoot",
      accessor: (a) => a.chatwootEstado,
      render: (a) => {
        const meta = ESTADO_META[a.chatwootEstado] ?? ESTADO_META.no_sincronizado
        return (
          <div className="flex items-center gap-2">
            <StatusBadge value={a.chatwootEstado} tone={meta.tone} label={meta.label} />
            {a.chatwootAgentId != null ? (
              <span className="text-xs tabular-nums text-muted-foreground">#{a.chatwootAgentId}</span>
            ) : null}
          </div>
        )
      },
    },
    {
      id: "cobertura",
      header: "Zonas / Segmentos",
      accessor: (a) => a.zonas.join(",") + a.segmentos.join(","),
      hideOnMobile: true,
      render: (a) => (
        <span className="text-xs text-stone-500 dark:text-muted-foreground">
          {listOrAll(a.zonas, "Todas")} · {listOrAll(a.segmentos, "Ambos")}
        </span>
      ),
    },
    {
      id: "asignaciones",
      header: "Asign.",
      accessor: (a) => a.asignaciones,
      align: "end",
      hideOnMobile: true,
      render: (a) => (
        <span className="tabular-nums text-stone-600 dark:text-muted-foreground">{a.asignaciones}</span>
      ),
    },
    {
      id: "activo",
      header: "Estado",
      accessor: (a) => (a.activo ? 1 : 0),
      render: (a) =>
        a.activo ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            Activo
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500 dark:bg-muted dark:text-muted-foreground">
            Inactivo
          </span>
        ),
    },
  ]

  const rowActions: ReadonlyArray<DataTableRowAction<AsesorRow>> | undefined = puedeEditar
    ? [
        { label: "Editar", icon: <Pencil className="size-4" />, onSelect: (a) => setEditando(a) },
        {
          label: "Desactivar",
          icon: <PowerOff className="size-4" />,
          onSelect: toggle,
          hidden: (a) => !a.activo,
          confirm: {
            title: "Desactivar asesor",
            description: (a) => (
              <>
                <strong>{a.nombre}</strong> dejará de ser asignable a leads. ¿Continuar?
              </>
            ),
            confirmLabel: "Desactivar",
          },
        },
        {
          label: "Activar",
          icon: <Power className="size-4" />,
          onSelect: toggle,
          hidden: (a) => a.activo,
        },
      ]
    : undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {asesores.length} asesor{asesores.length === 1 ? "" : "es"}
          {msg ? <span className="ml-2 text-foreground">· {msg}</span> : null}
        </p>
        {puedeEditar ? (
          <div className="flex items-center gap-2">
            {chatwootActivo ? (
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={sincronizar}>
                <RefreshCw className="size-4" aria-hidden /> Sincronizar con Chatwoot
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={() => { setEditando(null); setCreando(true) }}>
              <Plus className="size-4" aria-hidden /> Nuevo asesor
            </Button>
          </div>
        ) : null}
      </div>

      <DataTable<AsesorRow>
        data={[...asesores]}
        columns={columns}
        rowKey={(a) => a.id}
        onRowClick={puedeEditar ? (a) => setEditando(a) : undefined}
        rowActions={rowActions}
        empty={{ title: "Sin asesores", description: "Registra el primer asesor para asignar leads." }}
      />

      {puedeEditar ? (
        <Modal
          open={creando || editando !== null}
          onOpenChange={(abierto) => { if (!abierto) cerrar() }}
          title={editando ? "Editar asesor" : "Nuevo asesor"}
          description={
            chatwootActivo
              ? "Vincula un usuario y define correo/zonas. Al crear se invita al agente en Chatwoot."
              : "Vincula un usuario y define correo/zonas (Chatwoot no configurado)."
          }
          size="2xl"
          dismissable={!saving}
        >
          <AsesorForm
            key={editando?.id ?? "nuevo"}
            modo={editando ? "editar" : "crear"}
            asesor={editando ?? undefined}
            usuarios={opciones}
            chatwootActivo={chatwootActivo}
            onSuccess={cerrar}
            onCancel={cerrar}
            onSavingChange={setSaving}
          />
        </Modal>
      ) : null}
    </div>
  )
}
