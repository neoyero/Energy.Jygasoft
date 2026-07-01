"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { Plus, Search, Pencil, Trash2 } from "lucide-react"

import type { CwContact, CwPagina } from "@/lib/chatwoot/types"
import {
  cwSearchContacts,
  cwCreateContact,
  cwUpdateContact,
  cwDeleteContact,
} from "@/lib/chatwoot/admin-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/admin/ui/modal"
import { DataTable, type DataTableColumn, type DataTableRowAction } from "@/components/admin/ui/data-table"
import { AvisoError, type Res } from "@/components/admin/chatwoot/chatwoot-ui"

const PAGE_SIZE = 15

export function ContactosTab({ puedeEditar }: { puedeEditar: boolean }) {
  const [busqueda, setBusqueda] = useState("")
  const [busquedaEf, setBusquedaEf] = useState("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<CwPagina<CwContact>>({ items: [], total: 0, page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [pending, startTransition] = useTransition()
  const [editar, setEditar] = useState<CwContact | null>(null)
  const [crear, setCrear] = useState(false)
  const [accErr, setAccErr] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setBusquedaEf(busqueda), 300)
    return () => clearTimeout(t)
  }, [busqueda])

  useEffect(() => setPage(1), [busquedaEf])

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const r = await cwSearchContacts(busquedaEf, page)
    if (r.ok) setData(r.data)
    else setError(r.error)
    setLoading(false)
  }, [busquedaEf, page])

  useEffect(() => {
    void cargar()
  }, [cargar, reload])

  function accion(fn: () => Promise<Res<unknown>>): void {
    setAccErr(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) {
        setAccErr(r.error)
        return
      }
      setReload((n) => n + 1)
    })
  }

  const cols: DataTableColumn<CwContact>[] = [
    { id: "name", header: "Nombre", accessor: (r) => r.name ?? "", render: (r) => <span className="font-medium">{r.name || "—"}</span> },
    { id: "email", header: "Correo", accessor: (r) => r.email ?? "", hideOnMobile: true, render: (r) => <span className="text-muted-foreground">{r.email || "—"}</span> },
    { id: "phone", header: "Teléfono", accessor: (r) => r.phone_number ?? "", hideOnMobile: true, render: (r) => <span className="text-muted-foreground">{r.phone_number || "—"}</span> },
  ]

  const acciones: DataTableRowAction<CwContact>[] | undefined = puedeEditar
    ? [
        { label: "Editar", icon: <Pencil className="size-4" />, onSelect: (r) => setEditar(r) },
        {
          label: "Eliminar",
          icon: <Trash2 className="size-4" />,
          destructive: true,
          onSelect: (r) => accion(() => cwDeleteContact(r.id)),
          confirm: {
            title: "Eliminar contacto",
            description: (r) => <>Se eliminará <strong>{r.name || r.email || "el contacto"}</strong>. ¿Continuar?</>,
            confirmLabel: "Eliminar",
          },
        },
      ]
    : undefined

  const pageCount = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar contacto…"
            className="w-64 pl-8"
          />
        </div>
        {puedeEditar ? (
          <Button size="sm" onClick={() => setCrear(true)}>
            <Plus className="size-4" aria-hidden /> Nuevo contacto
          </Button>
        ) : null}
      </div>

      {error ? <AvisoError error={error} /> : null}
      {accErr ? <AvisoError error={accErr} /> : null}

      <DataTable<CwContact>
        data={data.items}
        columns={cols}
        rowKey={(r) => String(r.id)}
        rowActions={acciones}
        loading={loading}
        mobileCard={(r) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">{r.name || "—"}</span>
            <span className="text-xs text-muted-foreground">{r.email || "sin correo"}</span>
            {r.phone_number ? <span className="text-xs text-muted-foreground">{r.phone_number}</span> : null}
          </div>
        )}
        pageControl={{ page, pageCount, total: data.total, pageSize: PAGE_SIZE, onPageChange: setPage }}
        empty={{ title: "Sin contactos", description: busquedaEf ? "Sin resultados para la búsqueda." : "Aún no hay contactos." }}
      />

      {puedeEditar ? (
        <ContactoModal
          open={crear || editar !== null}
          contacto={editar}
          pending={pending}
          onClose={() => {
            setCrear(false)
            setEditar(null)
          }}
          onSubmit={(payload) =>
            accion(async () => {
              const r = editar ? await cwUpdateContact(editar.id, payload) : await cwCreateContact(payload)
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

function ContactoModal({
  open,
  contacto,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean
  contacto: CwContact | null
  pending: boolean
  onClose: () => void
  onSubmit: (payload: Record<string, string>) => void
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [identifier, setIdentifier] = useState("")

  useEffect(() => {
    setName(contacto?.name ?? "")
    setEmail(contacto?.email ?? "")
    setPhone(contacto?.phone_number ?? "")
    setIdentifier(contacto?.identifier ?? "")
  }, [contacto, open])

  const payload = useMemo(
    () => ({
      name: name.trim(),
      email: email.trim(),
      phone_number: phone.trim(),
      identifier: identifier.trim(),
    }),
    [name, email, phone, identifier],
  )

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={contacto ? "Editar contacto" : "Nuevo contacto"} size="md" dismissable={!pending}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(payload)
        }}
        className="grid gap-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="ct-name">Nombre</Label>
          <Input id="ct-name" value={name} onChange={(e) => setName(e.target.value)} disabled={pending} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ct-email">Correo</Label>
            <Input id="ct-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={pending} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-phone">Teléfono</Label>
            <Input id="ct-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+52…" disabled={pending} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ct-id">Identificador (opcional)</Label>
          <Input id="ct-id" value={identifier} onChange={(e) => setIdentifier(e.target.value)} disabled={pending} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Guardando…" : contacto ? "Guardar" : "Crear"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
