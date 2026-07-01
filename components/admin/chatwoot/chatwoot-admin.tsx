"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Plus, Pencil, Trash2, Users, RefreshCw, Stethoscope } from "lucide-react"

import type {
  ChatwootAgent,
  CwInbox,
  CwTeam,
  CwCannedResponse,
  CwLabel,
  CwCustomAttribute,
  CwWebhook,
} from "@/lib/chatwoot/types"
import type { CwDiagnostico } from "@/lib/chatwoot/types"
import { WEBHOOK_EVENTOS, CUSTOM_ATTR_TIPOS, CUSTOM_ATTR_MODELOS } from "@/lib/chatwoot/types"
import {
  cwListAgents,
  cwCreateAgent,
  cwUpdateAgent,
  cwDeleteAgent,
  cwListInboxes,
  cwListInboxMembers,
  cwSetInboxMembers,
  cwListTeams,
  cwCreateTeam,
  cwUpdateTeam,
  cwDeleteTeam,
  cwListTeamMembers,
  cwSetTeamMembers,
  cwListCanned,
  cwCreateCanned,
  cwUpdateCanned,
  cwDeleteCanned,
  cwListLabels,
  cwCreateLabel,
  cwUpdateLabel,
  cwDeleteLabel,
  cwListCustomAttrs,
  cwCreateCustomAttr,
  cwUpdateCustomAttr,
  cwDeleteCustomAttr,
  cwListWebhooks,
  cwCreateWebhook,
  cwUpdateWebhook,
  cwDeleteWebhook,
  cwDiagnostico,
} from "@/lib/chatwoot/admin-actions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/admin/ui/modal"
import { DataTable, type DataTableColumn, type DataTableRowAction } from "@/components/admin/ui/data-table"

/* ── Resultado de acción (inferido de las server actions) ─────────────────── */
type Res<T> = { ok: true; data: T } | { ok: false; error: string }

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

/** Carga un recurso de Chatwoot con estados de carga/error y recarga manual. */
function useRecurso<T>(cargar: () => Promise<Res<T>>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(0)
  const recargar = useCallback(() => setToken((t) => t + 1), [])

  useEffect(() => {
    let stale = false
    setLoading(true)
    setError(null)
    cargar()
      .then((r) => {
        if (stale) return
        if (r.ok) setData(r.data)
        else setError(r.error)
        setLoading(false)
      })
      .catch(() => {
        if (stale) return
        setError("Error inesperado al consultar Chatwoot.")
        setLoading(false)
      })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return { data, loading, error, recargar }
}

function AvisoError({ error }: { error: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error}
    </div>
  )
}

/* ── Shell con pestañas ───────────────────────────────────────────────────── */

type TabId = "agentes" | "inboxes" | "equipos" | "respuestas" | "etiquetas" | "atributos" | "webhooks"

const TABS: { id: TabId; label: string }[] = [
  { id: "agentes", label: "Agentes" },
  { id: "inboxes", label: "Inboxes" },
  { id: "equipos", label: "Equipos" },
  { id: "respuestas", label: "Respuestas" },
  { id: "etiquetas", label: "Etiquetas" },
  { id: "atributos", label: "Atributos" },
  { id: "webhooks", label: "Webhooks" },
]

export function ChatwootAdmin({ puedeEditar }: { puedeEditar: boolean }) {
  const [tab, setTab] = useState<TabId>("agentes")
  const [diag, setDiag] = useState<CwDiagnostico | null>(null)
  const [probando, startProbar] = useTransition()

  function probar(): void {
    startProbar(async () => {
      const r = await cwDiagnostico()
      setDiag(r.ok ? r.data : { baseUrl: "", accountId: "", tokenPresente: false, tokenLongitud: 0, status: null, ok: false, mensaje: r.error })
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Instancia conectada vía Application API.</span>
        <Button type="button" size="sm" variant="outline" onClick={probar} disabled={probando}>
          <Stethoscope className="size-4" aria-hidden /> {probando ? "Probando…" : "Probar conexión"}
        </Button>
      </div>

      {diag ? (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            diag.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          <p className="font-medium">{diag.mensaje}</p>
          <ul className="mt-1 space-y-0.5 font-mono">
            <li>URL base: {diag.baseUrl || "—"}</li>
            <li>Account ID: {diag.accountId || "—"}</li>
            <li>
              Token: {diag.tokenPresente ? `presente (${diag.tokenLongitud} caracteres)` : "AUSENTE / no se descifró"}
            </li>
            <li>HTTP status: {diag.status ?? "—"}</li>
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-brand-green text-brand-green"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "agentes" ? <AgentesTab puedeEditar={puedeEditar} /> : null}
      {tab === "inboxes" ? <InboxesTab puedeEditar={puedeEditar} /> : null}
      {tab === "equipos" ? <EquiposTab puedeEditar={puedeEditar} /> : null}
      {tab === "respuestas" ? <RespuestasTab puedeEditar={puedeEditar} /> : null}
      {tab === "etiquetas" ? <EtiquetasTab puedeEditar={puedeEditar} /> : null}
      {tab === "atributos" ? <AtributosTab puedeEditar={puedeEditar} /> : null}
      {tab === "webhooks" ? <WebhooksTab puedeEditar={puedeEditar} /> : null}
    </div>
  )
}

/** Barra superior de una pestaña: botón crear + recargar. */
function BarraTab({
  onNuevo,
  onRecargar,
  puedeEditar,
  etiquetaNuevo,
}: {
  onNuevo?: () => void
  onRecargar: () => void
  puedeEditar: boolean
  etiquetaNuevo?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button type="button" size="sm" variant="ghost" onClick={onRecargar}>
        <RefreshCw className="size-4" aria-hidden /> Recargar
      </Button>
      {puedeEditar && onNuevo ? (
        <Button type="button" size="sm" onClick={onNuevo}>
          <Plus className="size-4" aria-hidden /> {etiquetaNuevo ?? "Nuevo"}
        </Button>
      ) : null}
    </div>
  )
}

function badge(texto: string, tono: "green" | "gray" | "amber" = "gray") {
  const clase =
    tono === "green"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
      : tono === "amber"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        : "bg-stone-100 text-stone-600 dark:bg-muted dark:text-muted-foreground"
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", clase)}>
      {texto}
    </span>
  )
}

/* ── Agentes ──────────────────────────────────────────────────────────────── */

function AgentesTab({ puedeEditar }: { puedeEditar: boolean }) {
  const { data, loading, error, recargar } = useRecurso<ChatwootAgent[]>(cwListAgents)
  const [pending, startTransition] = useTransition()
  const [editar, setEditar] = useState<ChatwootAgent | null>(null)
  const [crear, setCrear] = useState(false)
  const [accErr, setAccErr] = useState<string | null>(null)

  function accion(fn: () => Promise<Res<unknown>>): void {
    setAccErr(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) {
        setAccErr(r.error)
        return
      }
      recargar()
    })
  }

  const cols: DataTableColumn<ChatwootAgent>[] = [
    { id: "name", header: "Nombre", accessor: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
    { id: "email", header: "Correo", accessor: (r) => r.email, hideOnMobile: true },
    {
      id: "role",
      header: "Rol",
      accessor: (r) => r.role,
      render: (r) => badge(r.role === "administrator" ? "Administrador" : "Agente", r.role === "administrator" ? "amber" : "gray"),
    },
    {
      id: "disp",
      header: "Disponibilidad",
      accessor: (r) => r.availability_status ?? "",
      hideOnMobile: true,
      render: (r) => <span className="text-muted-foreground">{r.availability_status ?? "—"}</span>,
    },
    {
      id: "conf",
      header: "Estado",
      accessor: (r) => (r.confirmed ? 1 : 0),
      render: (r) => (r.confirmed ? badge("Confirmado", "green") : badge("Pendiente", "amber")),
    },
  ]

  const acciones: DataTableRowAction<ChatwootAgent>[] | undefined = puedeEditar
    ? [
        { label: "Editar", icon: <Pencil className="size-4" />, onSelect: (r) => setEditar(r) },
        {
          label: "Quitar",
          icon: <Trash2 className="size-4" />,
          destructive: true,
          onSelect: (r) => accion(() => cwDeleteAgent(r.id)),
          confirm: {
            title: "Quitar agente",
            description: (r) => <>Se quitará <strong>{r.name}</strong> de la cuenta de Chatwoot. ¿Continuar?</>,
            confirmLabel: "Quitar",
          },
        },
      ]
    : undefined

  return (
    <div className="flex flex-col gap-3">
      <BarraTab puedeEditar={puedeEditar} onRecargar={recargar} onNuevo={() => setCrear(true)} etiquetaNuevo="Agregar agente" />
      {error ? <AvisoError error={error} /> : null}
      {accErr ? <AvisoError error={accErr} /> : null}
      <DataTable<ChatwootAgent>
        data={data ?? []}
        columns={cols}
        rowKey={(r) => String(r.id)}
        rowActions={acciones}
        loading={loading}
        empty={{ title: "Sin agentes", description: "Agrega el primer agente." }}
      />

      {puedeEditar ? (
        <AgenteModal
          open={crear || editar !== null}
          modo={editar ? "editar" : "crear"}
          agente={editar}
          pending={pending}
          onClose={() => {
            setCrear(false)
            setEditar(null)
          }}
          onSubmit={(payload) =>
            accion(async () => {
              const r = editar ? await cwUpdateAgent(editar.id, payload) : await cwCreateAgent(payload)
              if (r.ok) {
                setCrear(false)
                setEditar(null)
              }
              return r
            })
          }
        />
      ) : null}
    </div>
  )
}

function AgenteModal({
  open,
  modo,
  agente,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean
  modo: "crear" | "editar"
  agente: ChatwootAgent | null
  pending: boolean
  onClose: () => void
  onSubmit: (payload: Record<string, unknown>) => void
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"agent" | "administrator">("agent")
  const [disp, setDisp] = useState("")

  useEffect(() => {
    setName(agente?.name ?? "")
    setEmail(agente?.email ?? "")
    setRole((agente?.role as "agent" | "administrator") ?? "agent")
    setDisp(agente?.availability_status ?? "")
  }, [agente, open])

  function submit(e: React.FormEvent): void {
    e.preventDefault()
    if (modo === "crear") {
      onSubmit({ name, email, role, ...(disp ? { availability_status: disp } : {}) })
    } else {
      onSubmit({ role, ...(disp ? { availability_status: disp } : {}) })
    }
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={modo === "crear" ? "Agregar agente" : "Editar agente"} size="md" dismissable={!pending}>
      <form onSubmit={submit} className="grid gap-3">
        {modo === "crear" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="ag-name">Nombre</Label>
              <Input id="ag-name" value={name} onChange={(e) => setName(e.target.value)} required disabled={pending} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-email">Correo</Label>
              <Input id="ag-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={pending} />
              <p className="text-[11px] text-muted-foreground">Chatwoot enviará una invitación a este correo.</p>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {agente?.name} · {agente?.email}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ag-role">Rol</Label>
            <select id="ag-role" value={role} onChange={(e) => setRole(e.target.value as "agent" | "administrator")} className={SELECT_CLASS} disabled={pending}>
              <option value="agent">Agente</option>
              <option value="administrator">Administrador</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ag-disp">Disponibilidad</Label>
            <select id="ag-disp" value={disp} onChange={(e) => setDisp(e.target.value)} className={SELECT_CLASS} disabled={pending}>
              <option value="">(sin cambiar)</option>
              <option value="available">Disponible</option>
              <option value="busy">Ocupado</option>
              <option value="offline">Desconectado</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Guardando…" : modo === "crear" ? "Agregar" : "Guardar"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Modal de miembros (compartido inbox/equipo) ──────────────────────────── */

function MiembrosModal({
  open,
  titulo,
  cargarActuales,
  onGuardar,
  onClose,
}: {
  open: boolean
  titulo: string
  cargarActuales: () => Promise<Res<ChatwootAgent[]>>
  onGuardar: (ids: number[]) => Promise<Res<unknown>>
  onClose: () => void
}) {
  const [agentes, setAgentes] = useState<ChatwootAgent[]>([])
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    let stale = false
    setLoading(true)
    setError(null)
    Promise.all([cwListAgents(), cargarActuales()]).then(([todos, actuales]) => {
      if (stale) return
      if (!todos.ok) setError(todos.error)
      else setAgentes(todos.data)
      if (actuales.ok) setSel(new Set(actuales.data.map((a) => a.id)))
      setLoading(false)
    })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function toggle(id: number): void {
    setSel((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function guardar(): void {
    setError(null)
    startTransition(async () => {
      const r = await onGuardar([...sel])
      if (!r.ok) {
        setError(r.error)
        return
      }
      onClose()
    })
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={titulo} size="md" dismissable={!pending}>
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {error ? <AvisoError error={error} /> : null}
          <ul className="max-h-72 overflow-y-auto rounded-lg border border-border">
            {agentes.map((a) => (
              <li key={a.id} className="border-b border-border last:border-0">
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40">
                  <input type="checkbox" checked={sel.has(a.id)} onChange={() => toggle(a.id)} disabled={pending} className="size-4 rounded border-border" />
                  <span className="font-medium">{a.name}</span>
                  <span className="text-muted-foreground">{a.email}</span>
                </label>
              </li>
            ))}
            {agentes.length === 0 ? <li className="px-3 py-2 text-sm text-muted-foreground">Sin agentes.</li> : null}
          </ul>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={guardar} disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ── Inboxes ──────────────────────────────────────────────────────────────── */

function InboxesTab({ puedeEditar }: { puedeEditar: boolean }) {
  const { data, loading, error, recargar } = useRecurso<CwInbox[]>(cwListInboxes)
  const [miembrosDe, setMiembrosDe] = useState<CwInbox | null>(null)

  const cols: DataTableColumn<CwInbox>[] = [
    { id: "name", header: "Inbox", accessor: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
    { id: "tipo", header: "Canal", accessor: (r) => r.channel_type ?? "", hideOnMobile: true, render: (r) => <span className="text-muted-foreground">{r.channel_type ?? "—"}</span> },
    { id: "id", header: "ID", accessor: (r) => r.id, align: "end", render: (r) => <span className="tabular-nums text-muted-foreground">{r.id}</span> },
  ]

  const acciones: DataTableRowAction<CwInbox>[] | undefined = puedeEditar
    ? [{ label: "Colaboradores", icon: <Users className="size-4" />, onSelect: (r) => setMiembrosDe(r) }]
    : undefined

  return (
    <div className="flex flex-col gap-3">
      <BarraTab puedeEditar={false} onRecargar={recargar} />
      <p className="text-xs text-muted-foreground">
        Los inboxes se crean en Chatwoot (cada canal tiene su configuración). Aquí gestionas sus colaboradores.
      </p>
      {error ? <AvisoError error={error} /> : null}
      <DataTable<CwInbox>
        data={data ?? []}
        columns={cols}
        rowKey={(r) => String(r.id)}
        rowActions={acciones}
        loading={loading}
        empty={{ title: "Sin inboxes", description: "Crea un inbox en Chatwoot." }}
      />
      {miembrosDe ? (
        <MiembrosModal
          open
          titulo={`Colaboradores · ${miembrosDe.name}`}
          cargarActuales={() => cwListInboxMembers(miembrosDe.id)}
          onGuardar={(ids) => cwSetInboxMembers(miembrosDe.id, ids)}
          onClose={() => setMiembrosDe(null)}
        />
      ) : null}
    </div>
  )
}

/* ── Equipos ──────────────────────────────────────────────────────────────── */

function EquiposTab({ puedeEditar }: { puedeEditar: boolean }) {
  const { data, loading, error, recargar } = useRecurso<CwTeam[]>(cwListTeams)
  const [pending, startTransition] = useTransition()
  const [editar, setEditar] = useState<CwTeam | null>(null)
  const [crear, setCrear] = useState(false)
  const [miembrosDe, setMiembrosDe] = useState<CwTeam | null>(null)
  const [accErr, setAccErr] = useState<string | null>(null)

  function accion(fn: () => Promise<Res<unknown>>): void {
    setAccErr(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) {
        setAccErr(r.error)
        return
      }
      recargar()
    })
  }

  const cols: DataTableColumn<CwTeam>[] = [
    { id: "name", header: "Equipo", accessor: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
    { id: "desc", header: "Descripción", accessor: (r) => r.description ?? "", hideOnMobile: true, render: (r) => <span className="text-muted-foreground">{r.description ?? "—"}</span> },
    { id: "auto", header: "Auto-asignar", accessor: (r) => (r.allow_auto_assign ? 1 : 0), render: (r) => (r.allow_auto_assign ? badge("Sí", "green") : badge("No")) },
  ]

  const acciones: DataTableRowAction<CwTeam>[] | undefined = puedeEditar
    ? [
        { label: "Miembros", icon: <Users className="size-4" />, onSelect: (r) => setMiembrosDe(r) },
        { label: "Editar", icon: <Pencil className="size-4" />, onSelect: (r) => setEditar(r) },
        {
          label: "Eliminar",
          icon: <Trash2 className="size-4" />,
          destructive: true,
          onSelect: (r) => accion(() => cwDeleteTeam(r.id)),
          confirm: { title: "Eliminar equipo", description: (r) => <>Se eliminará <strong>{r.name}</strong>. ¿Continuar?</>, confirmLabel: "Eliminar" },
        },
      ]
    : undefined

  return (
    <div className="flex flex-col gap-3">
      <BarraTab puedeEditar={puedeEditar} onRecargar={recargar} onNuevo={() => setCrear(true)} etiquetaNuevo="Nuevo equipo" />
      {error ? <AvisoError error={error} /> : null}
      {accErr ? <AvisoError error={accErr} /> : null}
      <DataTable<CwTeam>
        data={data ?? []}
        columns={cols}
        rowKey={(r) => String(r.id)}
        rowActions={acciones}
        loading={loading}
        empty={{ title: "Sin equipos", description: "Crea el primer equipo." }}
      />

      {puedeEditar ? (
        <EquipoModal
          open={crear || editar !== null}
          equipo={editar}
          pending={pending}
          onClose={() => {
            setCrear(false)
            setEditar(null)
          }}
          onSubmit={(payload) =>
            accion(async () => {
              const r = editar ? await cwUpdateTeam(editar.id, payload) : await cwCreateTeam(payload)
              if (r.ok) {
                setCrear(false)
                setEditar(null)
              }
              return r
            })
          }
        />
      ) : null}

      {miembrosDe ? (
        <MiembrosModal
          open
          titulo={`Miembros · ${miembrosDe.name}`}
          cargarActuales={() => cwListTeamMembers(miembrosDe.id)}
          onGuardar={(ids) => cwSetTeamMembers(miembrosDe.id, ids)}
          onClose={() => setMiembrosDe(null)}
        />
      ) : null}
    </div>
  )
}

function EquipoModal({
  open,
  equipo,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean
  equipo: CwTeam | null
  pending: boolean
  onClose: () => void
  onSubmit: (payload: Record<string, unknown>) => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [auto, setAuto] = useState(false)

  useEffect(() => {
    setName(equipo?.name ?? "")
    setDescription(equipo?.description ?? "")
    setAuto(equipo?.allow_auto_assign ?? false)
  }, [equipo, open])

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={equipo ? "Editar equipo" : "Nuevo equipo"} size="md" dismissable={!pending}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit({ name, description: description || undefined, allow_auto_assign: auto })
        }}
        className="grid gap-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="eq-name">Nombre</Label>
          <Input id="eq-name" value={name} onChange={(e) => setName(e.target.value)} required disabled={pending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="eq-desc">Descripción</Label>
          <Input id="eq-desc" value={description} onChange={(e) => setDescription(e.target.value)} disabled={pending} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} disabled={pending} className="size-4 rounded border-border" />
          Permitir auto-asignación
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Guardando…" : equipo ? "Guardar" : "Crear"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Respuestas predefinidas ──────────────────────────────────────────────── */

function RespuestasTab({ puedeEditar }: { puedeEditar: boolean }) {
  const { data, loading, error, recargar } = useRecurso<CwCannedResponse[]>(cwListCanned)
  const [pending, startTransition] = useTransition()
  const [editar, setEditar] = useState<CwCannedResponse | null>(null)
  const [crear, setCrear] = useState(false)
  const [accErr, setAccErr] = useState<string | null>(null)

  function accion(fn: () => Promise<Res<unknown>>): void {
    setAccErr(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) return setAccErr(r.error)
      recargar()
    })
  }

  const cols: DataTableColumn<CwCannedResponse>[] = [
    { id: "code", header: "Atajo", accessor: (r) => r.short_code, render: (r) => <span className="font-mono text-sm">/{r.short_code}</span> },
    { id: "content", header: "Contenido", accessor: (r) => r.content, render: (r) => <span className="line-clamp-2 text-muted-foreground">{r.content}</span> },
  ]
  const acciones: DataTableRowAction<CwCannedResponse>[] | undefined = puedeEditar
    ? [
        { label: "Editar", icon: <Pencil className="size-4" />, onSelect: (r) => setEditar(r) },
        {
          label: "Eliminar",
          icon: <Trash2 className="size-4" />,
          destructive: true,
          onSelect: (r) => accion(() => cwDeleteCanned(r.id)),
          confirm: { title: "Eliminar respuesta", description: (r) => <>Se eliminará <strong>/{r.short_code}</strong>. ¿Continuar?</>, confirmLabel: "Eliminar" },
        },
      ]
    : undefined

  return (
    <div className="flex flex-col gap-3">
      <BarraTab puedeEditar={puedeEditar} onRecargar={recargar} onNuevo={() => setCrear(true)} etiquetaNuevo="Nueva respuesta" />
      {error ? <AvisoError error={error} /> : null}
      {accErr ? <AvisoError error={accErr} /> : null}
      <DataTable<CwCannedResponse> data={data ?? []} columns={cols} rowKey={(r) => String(r.id)} rowActions={acciones} loading={loading} empty={{ title: "Sin respuestas", description: "Crea la primera respuesta rápida." }} />
      {puedeEditar ? (
        <CannedModal
          open={crear || editar !== null}
          canned={editar}
          pending={pending}
          onClose={() => {
            setCrear(false)
            setEditar(null)
          }}
          onSubmit={(payload) =>
            accion(async () => {
              const r = editar ? await cwUpdateCanned(editar.id, payload) : await cwCreateCanned(payload)
              if (r.ok) {
                setCrear(false)
                setEditar(null)
              }
              return r
            })
          }
        />
      ) : null}
    </div>
  )
}

function CannedModal({
  open,
  canned,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean
  canned: CwCannedResponse | null
  pending: boolean
  onClose: () => void
  onSubmit: (payload: { short_code: string; content: string }) => void
}) {
  const [shortCode, setShortCode] = useState("")
  const [content, setContent] = useState("")
  useEffect(() => {
    setShortCode(canned?.short_code ?? "")
    setContent(canned?.content ?? "")
  }, [canned, open])

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={canned ? "Editar respuesta" : "Nueva respuesta"} size="lg" dismissable={!pending}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit({ short_code: shortCode.trim(), content: content.trim() })
        }}
        className="grid gap-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="cn-code">Atajo (short code)</Label>
          <Input id="cn-code" value={shortCode} onChange={(e) => setShortCode(e.target.value)} placeholder="saludo" required disabled={pending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cn-content">Contenido</Label>
          <textarea id="cn-content" value={content} onChange={(e) => setContent(e.target.value)} rows={4} required disabled={pending} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Guardando…" : canned ? "Guardar" : "Crear"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Etiquetas ────────────────────────────────────────────────────────────── */

function EtiquetasTab({ puedeEditar }: { puedeEditar: boolean }) {
  const { data, loading, error, recargar } = useRecurso<CwLabel[]>(cwListLabels)
  const [pending, startTransition] = useTransition()
  const [editar, setEditar] = useState<CwLabel | null>(null)
  const [crear, setCrear] = useState(false)
  const [accErr, setAccErr] = useState<string | null>(null)

  function accion(fn: () => Promise<Res<unknown>>): void {
    setAccErr(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) return setAccErr(r.error)
      recargar()
    })
  }

  const cols: DataTableColumn<CwLabel>[] = [
    {
      id: "title",
      header: "Etiqueta",
      accessor: (r) => r.title,
      render: (r) => (
        <span className="inline-flex items-center gap-2 font-medium">
          <span className="size-3 rounded-full border border-border" style={{ backgroundColor: r.color ?? "transparent" }} />
          {r.title}
        </span>
      ),
    },
    { id: "desc", header: "Descripción", accessor: (r) => r.description ?? "", hideOnMobile: true, render: (r) => <span className="text-muted-foreground">{r.description ?? "—"}</span> },
    { id: "side", header: "En barra", accessor: (r) => (r.show_on_sidebar ? 1 : 0), render: (r) => (r.show_on_sidebar ? badge("Sí", "green") : badge("No")) },
  ]
  const acciones: DataTableRowAction<CwLabel>[] | undefined = puedeEditar
    ? [
        { label: "Editar", icon: <Pencil className="size-4" />, onSelect: (r) => setEditar(r) },
        {
          label: "Eliminar",
          icon: <Trash2 className="size-4" />,
          destructive: true,
          onSelect: (r) => accion(() => cwDeleteLabel(r.id)),
          confirm: { title: "Eliminar etiqueta", description: (r) => <>Se eliminará <strong>{r.title}</strong>. ¿Continuar?</>, confirmLabel: "Eliminar" },
        },
      ]
    : undefined

  return (
    <div className="flex flex-col gap-3">
      <BarraTab puedeEditar={puedeEditar} onRecargar={recargar} onNuevo={() => setCrear(true)} etiquetaNuevo="Nueva etiqueta" />
      {error ? <AvisoError error={error} /> : null}
      {accErr ? <AvisoError error={accErr} /> : null}
      <DataTable<CwLabel> data={data ?? []} columns={cols} rowKey={(r) => String(r.id)} rowActions={acciones} loading={loading} empty={{ title: "Sin etiquetas", description: "Crea la primera etiqueta." }} />
      {puedeEditar ? (
        <LabelModal
          open={crear || editar !== null}
          label={editar}
          pending={pending}
          onClose={() => {
            setCrear(false)
            setEditar(null)
          }}
          onSubmit={(payload) =>
            accion(async () => {
              const r = editar ? await cwUpdateLabel(editar.id, payload) : await cwCreateLabel(payload)
              if (r.ok) {
                setCrear(false)
                setEditar(null)
              }
              return r
            })
          }
        />
      ) : null}
    </div>
  )
}

function LabelModal({
  open,
  label,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean
  label: CwLabel | null
  pending: boolean
  onClose: () => void
  onSubmit: (payload: { title: string; description?: string; color?: string; show_on_sidebar?: boolean }) => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState("#1f93ff")
  const [side, setSide] = useState(true)
  useEffect(() => {
    setTitle(label?.title ?? "")
    setDescription(label?.description ?? "")
    setColor(label?.color ?? "#1f93ff")
    setSide(label?.show_on_sidebar ?? true)
  }, [label, open])

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={label ? "Editar etiqueta" : "Nueva etiqueta"} size="md" dismissable={!pending}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit({ title: title.trim(), description: description || undefined, color, show_on_sidebar: side })
        }}
        className="grid gap-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="lb-title">Título</Label>
          <Input id="lb-title" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={pending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lb-desc">Descripción</Label>
          <Input id="lb-desc" value={description} onChange={(e) => setDescription(e.target.value)} disabled={pending} />
        </div>
        <div className="flex items-center gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="lb-color">Color</Label>
            <input id="lb-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} disabled={pending} className="h-9 w-16 rounded border border-border bg-background" />
          </div>
          <label className="mt-5 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={side} onChange={(e) => setSide(e.target.checked)} disabled={pending} className="size-4 rounded border-border" />
            Mostrar en barra lateral
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Guardando…" : label ? "Guardar" : "Crear"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Atributos personalizados ─────────────────────────────────────────────── */

function AtributosTab({ puedeEditar }: { puedeEditar: boolean }) {
  const { data, loading, error, recargar } = useRecurso<CwCustomAttribute[]>(cwListCustomAttrs)
  const [pending, startTransition] = useTransition()
  const [editar, setEditar] = useState<CwCustomAttribute | null>(null)
  const [crear, setCrear] = useState(false)
  const [accErr, setAccErr] = useState<string | null>(null)

  function accion(fn: () => Promise<Res<unknown>>): void {
    setAccErr(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) return setAccErr(r.error)
      recargar()
    })
  }

  const cols: DataTableColumn<CwCustomAttribute>[] = [
    { id: "name", header: "Atributo", accessor: (r) => r.attribute_display_name, render: (r) => <span className="font-medium">{r.attribute_display_name}</span> },
    { id: "key", header: "Clave", accessor: (r) => r.attribute_key, hideOnMobile: true, render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.attribute_key}</span> },
    { id: "type", header: "Tipo", accessor: (r) => r.attribute_display_type, render: (r) => badge(r.attribute_display_type) },
    { id: "model", header: "Aplica a", accessor: (r) => r.attribute_model, hideOnMobile: true, render: (r) => <span className="text-muted-foreground">{r.attribute_model === "contact_attribute" ? "Contacto" : "Conversación"}</span> },
  ]
  const acciones: DataTableRowAction<CwCustomAttribute>[] | undefined = puedeEditar
    ? [
        { label: "Editar", icon: <Pencil className="size-4" />, onSelect: (r) => setEditar(r) },
        {
          label: "Eliminar",
          icon: <Trash2 className="size-4" />,
          destructive: true,
          onSelect: (r) => accion(() => cwDeleteCustomAttr(r.id)),
          confirm: { title: "Eliminar atributo", description: (r) => <>Se eliminará <strong>{r.attribute_display_name}</strong>. ¿Continuar?</>, confirmLabel: "Eliminar" },
        },
      ]
    : undefined

  return (
    <div className="flex flex-col gap-3">
      <BarraTab puedeEditar={puedeEditar} onRecargar={recargar} onNuevo={() => setCrear(true)} etiquetaNuevo="Nuevo atributo" />
      {error ? <AvisoError error={error} /> : null}
      {accErr ? <AvisoError error={accErr} /> : null}
      <DataTable<CwCustomAttribute> data={data ?? []} columns={cols} rowKey={(r) => String(r.id)} rowActions={acciones} loading={loading} empty={{ title: "Sin atributos", description: "Crea el primer atributo personalizado." }} />
      {puedeEditar ? (
        <AtributoModal
          open={crear || editar !== null}
          attr={editar}
          pending={pending}
          onClose={() => {
            setCrear(false)
            setEditar(null)
          }}
          onSubmit={(payload) =>
            accion(async () => {
              const r = editar ? await cwUpdateCustomAttr(editar.id, payload) : await cwCreateCustomAttr(payload)
              if (r.ok) {
                setCrear(false)
                setEditar(null)
              }
              return r
            })
          }
        />
      ) : null}
    </div>
  )
}

function AtributoModal({
  open,
  attr,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean
  attr: CwCustomAttribute | null
  pending: boolean
  onClose: () => void
  onSubmit: (payload: Record<string, unknown>) => void
}) {
  const editando = attr !== null
  const [name, setName] = useState("")
  const [tipo, setTipo] = useState("text")
  const [model, setModel] = useState("conversation_attribute")
  const [desc, setDesc] = useState("")
  const [valores, setValores] = useState("")

  useEffect(() => {
    setName(attr?.attribute_display_name ?? "")
    setTipo(attr?.attribute_display_type ?? "text")
    setModel(attr?.attribute_model ?? "conversation_attribute")
    setDesc(attr?.attribute_description ?? "")
    setValores((attr?.attribute_values ?? []).join(", "))
  }, [attr, open])

  function submit(e: React.FormEvent): void {
    e.preventDefault()
    const values = tipo === "list" ? valores.split(",").map((v) => v.trim()).filter(Boolean) : undefined
    if (editando) {
      onSubmit({ attribute_display_name: name.trim(), attribute_description: desc || undefined, ...(values ? { attribute_values: values } : {}) })
    } else {
      onSubmit({
        attribute_display_name: name.trim(),
        attribute_display_type: tipo,
        attribute_model: model,
        attribute_description: desc || undefined,
        ...(values ? { attribute_values: values } : {}),
      })
    }
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={editando ? "Editar atributo" : "Nuevo atributo"} size="md" dismissable={!pending}>
      <form onSubmit={submit} className="grid gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="at-name">Nombre</Label>
          <Input id="at-name" value={name} onChange={(e) => setName(e.target.value)} required disabled={pending} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="at-tipo">Tipo</Label>
            <select id="at-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={SELECT_CLASS} disabled={pending || editando}>
              {CUSTOM_ATTR_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="at-model">Aplica a</Label>
            <select id="at-model" value={model} onChange={(e) => setModel(e.target.value)} className={SELECT_CLASS} disabled={pending || editando}>
              {CUSTOM_ATTR_MODELOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {tipo === "list" ? (
          <div className="space-y-1.5">
            <Label htmlFor="at-vals">Valores (separados por coma)</Label>
            <Input id="at-vals" value={valores} onChange={(e) => setValores(e.target.value)} placeholder="Bajo, Medio, Alto" disabled={pending} />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="at-desc">Descripción</Label>
          <Input id="at-desc" value={desc} onChange={(e) => setDesc(e.target.value)} disabled={pending} />
        </div>
        {editando ? <p className="text-[11px] text-muted-foreground">El tipo y el modelo no se pueden cambiar tras crear el atributo.</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Guardando…" : editando ? "Guardar" : "Crear"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Webhooks ─────────────────────────────────────────────────────────────── */

function WebhooksTab({ puedeEditar }: { puedeEditar: boolean }) {
  const { data, loading, error, recargar } = useRecurso<CwWebhook[]>(cwListWebhooks)
  const [pending, startTransition] = useTransition()
  const [editar, setEditar] = useState<CwWebhook | null>(null)
  const [crear, setCrear] = useState(false)
  const [accErr, setAccErr] = useState<string | null>(null)

  function accion(fn: () => Promise<Res<unknown>>): void {
    setAccErr(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) return setAccErr(r.error)
      recargar()
    })
  }

  const cols: DataTableColumn<CwWebhook>[] = [
    { id: "url", header: "URL", accessor: (r) => r.url, render: (r) => <span className="font-mono text-xs">{r.url}</span> },
    { id: "subs", header: "Eventos", accessor: (r) => r.subscriptions?.length ?? 0, render: (r) => badge(`${r.subscriptions?.length ?? 0} eventos`) },
  ]
  const acciones: DataTableRowAction<CwWebhook>[] | undefined = puedeEditar
    ? [
        { label: "Editar", icon: <Pencil className="size-4" />, onSelect: (r) => setEditar(r) },
        {
          label: "Eliminar",
          icon: <Trash2 className="size-4" />,
          destructive: true,
          onSelect: (r) => accion(() => cwDeleteWebhook(r.id)),
          confirm: { title: "Eliminar webhook", description: (r) => <>Se eliminará el webhook a <strong>{r.url}</strong>. ¿Continuar?</>, confirmLabel: "Eliminar" },
        },
      ]
    : undefined

  return (
    <div className="flex flex-col gap-3">
      <BarraTab puedeEditar={puedeEditar} onRecargar={recargar} onNuevo={() => setCrear(true)} etiquetaNuevo="Nuevo webhook" />
      {error ? <AvisoError error={error} /> : null}
      {accErr ? <AvisoError error={accErr} /> : null}
      <DataTable<CwWebhook> data={data ?? []} columns={cols} rowKey={(r) => String(r.id)} rowActions={acciones} loading={loading} empty={{ title: "Sin webhooks", description: "Crea el primer webhook." }} />
      {puedeEditar ? (
        <WebhookModal
          open={crear || editar !== null}
          webhook={editar}
          pending={pending}
          onClose={() => {
            setCrear(false)
            setEditar(null)
          }}
          onSubmit={(payload) =>
            accion(async () => {
              const r = editar ? await cwUpdateWebhook(editar.id, payload) : await cwCreateWebhook(payload)
              if (r.ok) {
                setCrear(false)
                setEditar(null)
              }
              return r
            })
          }
        />
      ) : null}
    </div>
  )
}

function WebhookModal({
  open,
  webhook,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean
  webhook: CwWebhook | null
  pending: boolean
  onClose: () => void
  onSubmit: (payload: { url: string; subscriptions: string[] }) => void
}) {
  const [url, setUrl] = useState("")
  const [subs, setSubs] = useState<Set<string>>(new Set())
  useEffect(() => {
    setUrl(webhook?.url ?? "")
    setSubs(new Set(webhook?.subscriptions ?? []))
  }, [webhook, open])

  function toggle(ev: string): void {
    setSubs((prev) => {
      const n = new Set(prev)
      if (n.has(ev)) n.delete(ev)
      else n.add(ev)
      return n
    })
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={webhook ? "Editar webhook" : "Nuevo webhook"} size="md" dismissable={!pending}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit({ url: url.trim(), subscriptions: [...subs] })
        }}
        className="grid gap-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="wh-url">URL</Label>
          <Input id="wh-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" required disabled={pending} />
        </div>
        <div className="space-y-1.5">
          <Label>Eventos</Label>
          <div className="grid grid-cols-1 gap-1.5 rounded-lg border border-border p-2 sm:grid-cols-2">
            {WEBHOOK_EVENTOS.map((ev) => (
              <label key={ev} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={subs.has(ev)} onChange={() => toggle(ev)} disabled={pending} className="size-4 rounded border-border" />
                {ev}
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Guardando…" : webhook ? "Guardar" : "Crear"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
