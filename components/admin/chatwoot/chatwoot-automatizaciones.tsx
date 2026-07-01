"use client"

import { useEffect, useState, useTransition } from "react"
import { Plus, Pencil, Trash2, Power, PowerOff, X } from "lucide-react"

import type { CwAutomationRule } from "@/lib/chatwoot/types"
import { AUTOMATION_EVENTOS, AUTOMATION_OPERADORES, AUTOMATION_ACCIONES } from "@/lib/chatwoot/types"
import {
  cwListAutomations,
  cwCreateAutomation,
  cwUpdateAutomation,
  cwToggleAutomation,
  cwDeleteAutomation,
} from "@/lib/chatwoot/admin-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/admin/ui/modal"
import { DataTable, type DataTableColumn, type DataTableRowAction } from "@/components/admin/ui/data-table"
import { useRecurso, AvisoError, BarraTab, badge, SELECT_CLASS, type Res } from "@/components/admin/chatwoot/chatwoot-ui"

function eventoLabel(v: string): string {
  return AUTOMATION_EVENTOS.find((e) => e.value === v)?.label ?? v
}

export function AutomatizacionesTab({ puedeEditar }: { puedeEditar: boolean }) {
  const { data, loading, error, recargar } = useRecurso<CwAutomationRule[]>(cwListAutomations)
  const [pending, startTransition] = useTransition()
  const [editar, setEditar] = useState<CwAutomationRule | null>(null)
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

  const cols: DataTableColumn<CwAutomationRule>[] = [
    { id: "name", header: "Regla", accessor: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
    { id: "event", header: "Evento", accessor: (r) => r.event_name, hideOnMobile: true, render: (r) => <span className="text-muted-foreground">{eventoLabel(r.event_name)}</span> },
    {
      id: "reglas",
      header: "Condiciones / Acciones",
      accessor: (r) => (r.conditions?.length ?? 0) + (r.actions?.length ?? 0),
      hideOnMobile: true,
      render: (r) => (
        <span className="text-muted-foreground">
          {r.conditions?.length ?? 0} cond · {r.actions?.length ?? 0} acc
        </span>
      ),
    },
    { id: "estado", header: "Estado", accessor: (r) => (r.active ? 1 : 0), render: (r) => (r.active ? badge("Activa", "green") : badge("Inactiva")) },
  ]

  const acciones: DataTableRowAction<CwAutomationRule>[] | undefined = puedeEditar
    ? [
        { label: "Editar", icon: <Pencil className="size-4" />, onSelect: (r) => setEditar(r) },
        {
          label: "Desactivar",
          icon: <PowerOff className="size-4" />,
          onSelect: (r) => accion(() => cwToggleAutomation(r.id, false)),
          hidden: (r) => !r.active,
        },
        {
          label: "Activar",
          icon: <Power className="size-4" />,
          onSelect: (r) => accion(() => cwToggleAutomation(r.id, true)),
          hidden: (r) => r.active,
        },
        {
          label: "Eliminar",
          icon: <Trash2 className="size-4" />,
          destructive: true,
          onSelect: (r) => accion(() => cwDeleteAutomation(r.id)),
          confirm: { title: "Eliminar automatización", description: (r) => <>Se eliminará <strong>{r.name}</strong>. ¿Continuar?</>, confirmLabel: "Eliminar" },
        },
      ]
    : undefined

  return (
    <div className="flex flex-col gap-3">
      <BarraTab puedeEditar={puedeEditar} onRecargar={recargar} onNuevo={() => setCrear(true)} etiquetaNuevo="Nueva automatización" />
      {error ? <AvisoError error={error} /> : null}
      {accErr ? <AvisoError error={accErr} /> : null}
      <DataTable<CwAutomationRule>
        data={data ?? []}
        columns={cols}
        rowKey={(r) => String(r.id)}
        rowActions={acciones}
        loading={loading}
        mobileCard={(r) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{r.name}</span>
              {r.active ? badge("Activa", "green") : badge("Inactiva")}
            </div>
            <span className="text-xs text-muted-foreground">{eventoLabel(r.event_name)}</span>
            <span className="text-[11px] text-muted-foreground">
              {r.conditions?.length ?? 0} condiciones · {r.actions?.length ?? 0} acciones
            </span>
          </div>
        )}
        empty={{ title: "Sin automatizaciones", description: "Crea la primera regla." }}
      />

      {puedeEditar ? (
        <AutomationModal
          open={crear || editar !== null}
          rule={editar}
          pending={pending}
          onClose={() => {
            setCrear(false)
            setEditar(null)
          }}
          onSubmit={(payload) =>
            accion(async () => {
              const r = editar ? await cwUpdateAutomation(editar.id, payload) : await cwCreateAutomation(payload)
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

/* ── Modal crear/editar (con constructor de condiciones y acciones) ────────── */

interface FilaCond {
  id: number
  attribute_key: string
  filter_operator: string
  values: string
}
interface FilaAcc {
  id: number
  action_name: string
  action_params: string
}

function AutomationModal({
  open,
  rule,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean
  rule: CwAutomationRule | null
  pending: boolean
  onClose: () => void
  onSubmit: (payload: Record<string, unknown>) => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [evento, setEvento] = useState(AUTOMATION_EVENTOS[0].value)
  const [active, setActive] = useState(true)
  const [conds, setConds] = useState<FilaCond[]>([])
  const [accs, setAccs] = useState<FilaAcc[]>([])
  const [seq, setSeq] = useState(1)

  useEffect(() => {
    setName(rule?.name ?? "")
    setDescription(rule?.description ?? "")
    setEvento(rule?.event_name ?? AUTOMATION_EVENTOS[0].value)
    setActive(rule?.active ?? true)
    let n = 1
    setConds(
      (rule?.conditions ?? [{ attribute_key: "status", filter_operator: "equal_to", values: [] }]).map((c) => ({
        id: n++,
        attribute_key: c.attribute_key,
        filter_operator: c.filter_operator,
        values: (c.values ?? []).join(", "),
      })),
    )
    setAccs(
      (rule?.actions ?? [{ action_name: "assign_agent", action_params: [] }]).map((a) => ({
        id: n++,
        action_name: a.action_name,
        action_params: (a.action_params ?? []).join(", "),
      })),
    )
    setSeq(n)
  }, [rule, open])

  function nuevoId(): number {
    const id = seq
    setSeq((s) => s + 1)
    return id
  }
  const toArray = (s: string): Array<string | number> =>
    s
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => (/^\d+$/.test(v) ? Number(v) : v))

  function submit(e: React.FormEvent): void {
    e.preventDefault()
    const conditions = conds
      .filter((c) => c.attribute_key.trim() && c.filter_operator.trim())
      .map((c, i, arr) => ({
        attribute_key: c.attribute_key.trim(),
        filter_operator: c.filter_operator.trim(),
        values: toArray(c.values),
        query_operator: i < arr.length - 1 ? ("and" as const) : null,
      }))
    const actions = accs
      .filter((a) => a.action_name.trim())
      .map((a) => ({ action_name: a.action_name.trim(), action_params: toArray(a.action_params) }))
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      event_name: evento,
      active,
      conditions,
      actions,
    })
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={rule ? "Editar automatización" : "Nueva automatización"} size="2xl" dismissable={!pending}>
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="au-name">Nombre</Label>
            <Input id="au-name" value={name} onChange={(e) => setName(e.target.value)} required disabled={pending} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="au-event">Evento (disparador)</Label>
            <select id="au-event" value={evento} onChange={(e) => setEvento(e.target.value)} className={SELECT_CLASS} disabled={pending}>
              {AUTOMATION_EVENTOS.map((ev) => (
                <option key={ev.value} value={ev.value}>
                  {ev.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="au-desc">Descripción</Label>
          <Input id="au-desc" value={description} onChange={(e) => setDescription(e.target.value)} disabled={pending} />
        </div>

        {/* Condiciones */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Condiciones (se cumplen todas)</Label>
            <Button size="xs" variant="outline" type="button" onClick={() => setConds((p) => [...p, { id: nuevoId(), attribute_key: "", filter_operator: "equal_to", values: "" }])} disabled={pending}>
              <Plus className="size-3" aria-hidden /> Condición
            </Button>
          </div>
          {conds.map((c) => (
            <div key={c.id} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Input value={c.attribute_key} onChange={(e) => setConds((p) => p.map((x) => (x.id === c.id ? { ...x, attribute_key: e.target.value } : x)))} placeholder="atributo (status, assignee_id…)" disabled={pending} />
              <select value={c.filter_operator} onChange={(e) => setConds((p) => p.map((x) => (x.id === c.id ? { ...x, filter_operator: e.target.value } : x)))} className={SELECT_CLASS} disabled={pending}>
                {AUTOMATION_OPERADORES.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
              <Input value={c.values} onChange={(e) => setConds((p) => p.map((x) => (x.id === c.id ? { ...x, values: e.target.value } : x)))} placeholder="valores (coma)" disabled={pending} />
              <Button size="icon-sm" variant="ghost" type="button" onClick={() => setConds((p) => p.filter((x) => x.id !== c.id))} disabled={pending || conds.length === 1} title="Quitar">
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Acciones */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Acciones</Label>
            <Button size="xs" variant="outline" type="button" onClick={() => setAccs((p) => [...p, { id: nuevoId(), action_name: AUTOMATION_ACCIONES[0].value, action_params: "" }])} disabled={pending}>
              <Plus className="size-3" aria-hidden /> Acción
            </Button>
          </div>
          {accs.map((a) => (
            <div key={a.id} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_1fr_auto]">
              <select value={a.action_name} onChange={(e) => setAccs((p) => p.map((x) => (x.id === a.id ? { ...x, action_name: e.target.value } : x)))} className={SELECT_CLASS} disabled={pending}>
                {AUTOMATION_ACCIONES.map((ac) => (
                  <option key={ac.value} value={ac.value}>
                    {ac.label}
                  </option>
                ))}
              </select>
              <Input value={a.action_params} onChange={(e) => setAccs((p) => p.map((x) => (x.id === a.id ? { ...x, action_params: e.target.value } : x)))} placeholder="parámetro (id / valor)" disabled={pending} />
              <Button size="icon-sm" variant="ghost" type="button" onClick={() => setAccs((p) => p.filter((x) => x.id !== a.id))} disabled={pending || accs.length === 1} title="Quitar">
                <X className="size-4" />
              </Button>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">
            Ej.: asignar a agente → parámetro = id del agente; agregar etiqueta → parámetro = título de la etiqueta.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={pending} className="size-4 rounded border-border" />
          Activa
        </label>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Guardando…" : rule ? "Guardar" : "Crear"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
