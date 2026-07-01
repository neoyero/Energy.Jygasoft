"use client"

import { useEffect, useRef, useState, useTransition } from "react"

import type { ChatwootAgent, CwConversation, CwMessage } from "@/lib/chatwoot/types"
import { CONVERSACION_ESTADOS, ESTADO_LABEL } from "@/lib/chatwoot/types"
import {
  cwListConversations,
  cwListMessages,
  cwSendMessage,
  cwSetConversationStatus,
  cwAssignConversation,
  cwListAgents,
} from "@/lib/chatwoot/admin-actions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/admin/ui/modal"
import { DataTable, type DataTableColumn } from "@/components/admin/ui/data-table"
import { AvisoError, badge, SELECT_CLASS, type Res } from "@/components/admin/chatwoot/chatwoot-ui"

const SELECT_FILTRO = "h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

function tonoEstado(status: string): "green" | "amber" | "gray" | "blue" {
  return status === "open" ? "green" : status === "pending" ? "amber" : status === "snoozed" ? "blue" : "gray"
}

function fecha(ts?: number): string {
  if (!ts) return ""
  try {
    return new Date(ts * 1000).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
  } catch {
    return ""
  }
}

export function ConversacionesTab({ puedeEditar }: { puedeEditar: boolean }) {
  const [estado, setEstado] = useState<string>("open")
  const [convs, setConvs] = useState<CwConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [sel, setSel] = useState<CwConversation | null>(null)
  const [agentes, setAgentes] = useState<ChatwootAgent[]>([])

  useEffect(() => {
    let stale = false
    setLoading(true)
    setError(null)
    cwListConversations({ status: estado }).then((r) => {
      if (stale) return
      if (r.ok) setConvs(r.data)
      else setError(r.error)
      setLoading(false)
    })
    return () => {
      stale = true
    }
  }, [estado, reload])

  useEffect(() => {
    cwListAgents().then((r) => {
      if (r.ok) setAgentes(r.data)
    })
  }, [])

  const cols: DataTableColumn<CwConversation>[] = [
    {
      id: "contacto",
      header: "Contacto",
      accessor: (r) => r.contactoNombre ?? "",
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium">{r.contactoNombre || `Conversación #${r.id}`}</span>
          <span className="text-xs text-muted-foreground">{r.contactoEmail || r.contactoTelefono || `#${r.id}`}</span>
        </div>
      ),
    },
    {
      id: "ultimo",
      header: "Último mensaje",
      accessor: (r) => r.ultimoMensaje ?? "",
      hideOnMobile: true,
      render: (r) => <span className="line-clamp-1 text-muted-foreground">{r.ultimoMensaje || "—"}</span>,
    },
    {
      id: "asignado",
      header: "Asignado",
      accessor: (r) => r.asignadoNombre ?? "",
      hideOnMobile: true,
      render: (r) => <span className="text-muted-foreground">{r.asignadoNombre || "Sin asignar"}</span>,
    },
    {
      id: "estado",
      header: "Estado",
      accessor: (r) => r.status,
      render: (r) => badge(ESTADO_LABEL[r.status] ?? r.status, tonoEstado(r.status)),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Estado:</span>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className={SELECT_FILTRO}>
            <option value="open">Abiertas</option>
            <option value="pending">Pendientes</option>
            <option value="snoozed">Pospuestas</option>
            <option value="resolved">Resueltas</option>
            <option value="all">Todas</option>
          </select>
        </label>
        <Button type="button" size="sm" variant="ghost" onClick={() => setReload((n) => n + 1)}>
          Recargar
        </Button>
      </div>

      {error ? <AvisoError error={error} /> : null}

      <DataTable<CwConversation>
        data={convs}
        columns={cols}
        rowKey={(r) => String(r.id)}
        onRowClick={(r) => setSel(r)}
        loading={loading}
        mobileCard={(r) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{r.contactoNombre || `Conversación #${r.id}`}</span>
              {badge(ESTADO_LABEL[r.status] ?? r.status, tonoEstado(r.status))}
            </div>
            <span className="line-clamp-1 text-xs text-muted-foreground">{r.ultimoMensaje || "—"}</span>
            <span className="text-[11px] text-muted-foreground">{r.asignadoNombre || "Sin asignar"}</span>
          </div>
        )}
        empty={{ title: "Sin conversaciones", description: "No hay conversaciones en este estado." }}
      />

      {sel ? (
        <ConversacionDetalle
          conv={sel}
          agentes={agentes}
          puedeEditar={puedeEditar}
          onClose={() => setSel(null)}
          onCambio={() => setReload((n) => n + 1)}
        />
      ) : null}
    </div>
  )
}

/* ── Detalle de conversación (hilo + responder + asignar + estado) ─────────── */

function ConversacionDetalle({
  conv,
  agentes,
  puedeEditar,
  onClose,
  onCambio,
}: {
  conv: CwConversation
  agentes: ChatwootAgent[]
  puedeEditar: boolean
  onClose: () => void
  onCambio: () => void
}) {
  const [mensajes, setMensajes] = useState<CwMessage[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [texto, setTexto] = useState("")
  const [privada, setPrivada] = useState(false)
  const [estado, setEstado] = useState(conv.status)
  const [asignado, setAsignado] = useState<number | "">(conv.asignadoId ?? "")
  const [pending, startTransition] = useTransition()
  const finRef = useRef<HTMLDivElement | null>(null)

  function cargarMensajes(): void {
    setCargando(true)
    setError(null)
    cwListMessages(conv.id).then((r) => {
      if (r.ok) setMensajes(r.data)
      else setError(r.error)
      setCargando(false)
    })
  }

  useEffect(() => {
    cargarMensajes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.id])

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" })
  }, [mensajes])

  function accion(fn: () => Promise<Res<unknown>>, tras?: () => void): void {
    setError(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) {
        setError(r.error)
        return
      }
      tras?.()
      onCambio()
    })
  }

  function enviar(): void {
    const content = texto.trim()
    if (content === "") return
    accion(
      () => cwSendMessage(conv.id, { content, private: privada }),
      () => {
        setTexto("")
        cargarMensajes()
      },
    )
  }

  function cambiarEstado(nuevo: string): void {
    accion(
      () => cwSetConversationStatus(conv.id, nuevo),
      () => setEstado(nuevo),
    )
  }

  function cambiarAsignado(valor: string): void {
    const id = valor === "" ? 0 : Number(valor)
    setAsignado(valor === "" ? "" : id)
    accion(() => cwAssignConversation(conv.id, id))
  }

  const titulo = conv.contactoNombre || `Conversación #${conv.id}`

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={titulo}
      description={conv.contactoEmail || conv.contactoTelefono || `#${conv.id}`}
      size="3xl"
      dismissable={!pending}
    >
      <div className="flex flex-col gap-3">
        {/* Barra: estado + asignación */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          {badge(ESTADO_LABEL[estado] ?? estado, tonoEstado(estado))}
          {puedeEditar ? (
            <>
              <div className="flex flex-wrap gap-1">
                {CONVERSACION_ESTADOS.filter((s) => s !== estado).map((s) => (
                  <Button key={s} size="xs" variant="outline" onClick={() => cambiarEstado(s)} disabled={pending}>
                    {ESTADO_LABEL[s]}
                  </Button>
                ))}
              </div>
              <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                Asignar:
                <select
                  value={asignado === "" ? "" : String(asignado)}
                  onChange={(e) => cambiarAsignado(e.target.value)}
                  disabled={pending}
                  className={SELECT_CLASS + " h-8 w-44"}
                >
                  <option value="">Sin asignar</option>
                  {agentes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
        </div>

        {error ? <AvisoError error={error} /> : null}

        {/* Hilo de mensajes */}
        <div className="max-h-[45vh] min-h-40 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3">
          {cargando ? (
            <p className="text-sm text-muted-foreground">Cargando mensajes…</p>
          ) : mensajes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin mensajes.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {mensajes.map((m) => (
                <Mensaje key={m.id} m={m} />
              ))}
              <div ref={finRef} />
            </div>
          )}
        </div>

        {/* Responder */}
        {puedeEditar ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              disabled={pending}
              placeholder={privada ? "Nota privada (no la ve el cliente)…" : "Escribe una respuesta…"}
              className={cn(
                "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                privada ? "border-amber-300 bg-amber-50/50 dark:border-amber-500/40 dark:bg-amber-500/5" : "border-border",
              )}
            />
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={privada} onChange={(e) => setPrivada(e.target.checked)} disabled={pending} className="size-4 rounded border-border" />
                Nota privada
              </label>
              <Button size="sm" onClick={enviar} disabled={pending || texto.trim() === ""}>
                {pending ? "Enviando…" : privada ? "Guardar nota" : "Enviar"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

function Mensaje({ m }: { m: CwMessage }) {
  // 2 = actividad (centrado); 1 = saliente (derecha); 0/otros = entrante (izquierda).
  if (m.message_type === 2) {
    return (
      <div className="text-center text-[11px] italic text-muted-foreground">
        {m.content || "—"} {m.created_at ? `· ${fecha(m.created_at)}` : ""}
      </div>
    )
  }
  const saliente = m.message_type === 1
  return (
    <div className={cn("flex", saliente ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          m.private
            ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100"
            : saliente
              ? "bg-brand-green text-white"
              : "bg-card text-foreground border border-border",
        )}
      >
        {m.private ? <span className="mb-0.5 block text-[10px] font-semibold uppercase opacity-70">Nota privada</span> : null}
        <p className="whitespace-pre-wrap break-words">{m.content || "(sin texto / adjunto)"}</p>
        <span className={cn("mt-1 block text-[10px]", saliente && !m.private ? "text-white/70" : "text-muted-foreground")}>
          {m.senderNombre ? `${m.senderNombre} · ` : ""}
          {fecha(m.created_at)}
        </span>
      </div>
    </div>
  )
}
