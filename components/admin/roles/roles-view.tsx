"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Power, PowerOff } from "lucide-react"

import type { RolRow, RolPermiso } from "@/lib/admin/queries"
import { MODULOS } from "@/lib/admin/rbac"
import { crearRol, actualizarRol, toggleRolActivo, eliminarRol } from "@/lib/admin/actions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/admin/ui/modal"
import { DataTable, type DataTableColumn, type DataTableRowAction } from "@/components/admin/ui/data-table"

type Res = { ok: true } | { ok: false; error: string }

export interface RolesViewProps {
  rolesIniciales: ReadonlyArray<RolRow>
  puedeEditar: boolean
}

export function RolesView({ rolesIniciales, puedeEditar }: RolesViewProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editar, setEditar] = useState<RolRow | null>(null)
  const [crear, setCrear] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function accion(fn: () => Promise<Res>): void {
    setErr(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) {
        setErr(r.error)
        return
      }
      router.refresh()
    })
  }

  const badge = (t: string, tono: "green" | "gray" | "blue") => (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tono === "green"
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          : tono === "blue"
            ? "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
            : "bg-stone-100 text-stone-600 dark:bg-muted dark:text-muted-foreground",
      )}
    >
      {t}
    </span>
  )

  const nModulos = (r: RolRow) =>
    Object.values(r.permisos).filter((p) => p.view || p.edit).length

  const cols: DataTableColumn<RolRow>[] = [
    {
      id: "nombre",
      header: "Rol",
      accessor: (r) => r.nombre,
      render: (r) => (
        <span className="inline-flex items-center gap-2 font-medium">
          {r.nombre}
          {r.sistema ? badge("Sistema", "blue") : null}
        </span>
      ),
    },
    { id: "clave", header: "Clave", accessor: (r) => r.clave, hideOnMobile: true, render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.clave}</span> },
    { id: "modulos", header: "Módulos con acceso", accessor: (r) => nModulos(r), hideOnMobile: true, render: (r) => <span className="text-muted-foreground">{nModulos(r)} / {MODULOS.length}</span> },
    { id: "miembros", header: "Usuarios", accessor: (r) => r.miembros, align: "end", hideOnMobile: true, render: (r) => <span className="tabular-nums text-muted-foreground">{r.miembros}</span> },
    { id: "estado", header: "Estado", accessor: (r) => (r.activo ? 1 : 0), render: (r) => (r.activo ? badge("Activo", "green") : badge("Inactivo", "gray")) },
  ]

  const acciones: DataTableRowAction<RolRow>[] | undefined = puedeEditar
    ? [
        { label: "Editar permisos", icon: <Pencil className="size-4" />, onSelect: (r) => setEditar(r) },
        {
          label: "Desactivar",
          icon: <PowerOff className="size-4" />,
          onSelect: (r) => accion(() => toggleRolActivo(r.id, false)),
          hidden: (r) => !r.activo || r.sistema,
        },
        {
          label: "Activar",
          icon: <Power className="size-4" />,
          onSelect: (r) => accion(() => toggleRolActivo(r.id, true)),
          hidden: (r) => r.activo || r.sistema,
        },
        {
          label: "Eliminar",
          icon: <Trash2 className="size-4" />,
          destructive: true,
          onSelect: (r) => accion(() => eliminarRol(r.id)),
          hidden: (r) => r.sistema,
          confirm: {
            title: "Eliminar rol",
            description: (r) => <>Se eliminará el rol <strong>{r.nombre}</strong>. ¿Continuar?</>,
            confirmLabel: "Eliminar",
          },
        },
      ]
    : undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Los cambios de permisos se aplican al próximo inicio de sesión del usuario.
        </p>
        {puedeEditar ? (
          <Button size="sm" onClick={() => setCrear(true)}>
            <Plus className="size-4" aria-hidden /> Nuevo rol
          </Button>
        ) : null}
      </div>

      {err ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>
      ) : null}

      <DataTable<RolRow>
        data={rolesIniciales as RolRow[]}
        columns={cols}
        rowKey={(r) => r.id}
        onRowClick={puedeEditar ? (r) => setEditar(r) : undefined}
        rowActions={acciones}
        mobileCard={(r) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{r.nombre}</span>
              {r.sistema ? badge("Sistema", "blue") : r.activo ? badge("Activo", "green") : badge("Inactivo", "gray")}
            </div>
            <span className="text-xs text-muted-foreground">
              {nModulos(r)}/{MODULOS.length} módulos · {r.miembros} usuario{r.miembros === 1 ? "" : "s"}
            </span>
          </div>
        )}
        empty={{ title: "Sin roles", description: "Crea el primer rol." }}
      />

      {puedeEditar ? (
        <RolModal
          open={crear || editar !== null}
          rol={editar}
          pending={pending}
          onClose={() => {
            setCrear(false)
            setEditar(null)
          }}
          onSubmit={(payload) =>
            accion(async () => {
              const r = editar ? await actualizarRol(editar.id, payload) : await crearRol(payload)
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

/* ── Modal: nombre + matriz de permisos (view/edit por módulo) ─────────────── */

function RolModal({
  open,
  rol,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean
  rol: RolRow | null
  pending: boolean
  onClose: () => void
  onSubmit: (payload: { nombre: string; permisos: Record<string, RolPermiso>; activo?: boolean }) => void
}) {
  const [nombre, setNombre] = useState("")
  const [permisos, setPermisos] = useState<Record<string, RolPermiso>>({})

  // Reinicia al abrir/cambiar de rol.
  const rolId = rol?.id ?? "nuevo"
  const [ultimo, setUltimo] = useState<string>("")
  if (open && ultimo !== rolId) {
    setUltimo(rolId)
    setNombre(rol?.nombre ?? "")
    setPermisos({ ...(rol?.permisos ?? {}) })
  }

  function set(modulo: string, campo: "view" | "edit", val: boolean): void {
    setPermisos((prev) => {
      const actual = prev[modulo] ?? { view: false, edit: false }
      let next = { ...actual, [campo]: val }
      // "edit" implica "view"; quitar "view" quita "edit".
      if (campo === "edit" && val) next = { view: true, edit: true }
      if (campo === "view" && !val) next = { view: false, edit: false }
      return { ...prev, [modulo]: next }
    })
  }

  function submit(e: React.FormEvent): void {
    e.preventDefault()
    // Solo módulos con algún permiso.
    const limpio: Record<string, RolPermiso> = {}
    for (const [m, p] of Object.entries(permisos)) {
      if (p.view || p.edit) limpio[m] = { view: p.view, edit: p.edit }
    }
    onSubmit({ nombre: nombre.trim(), permisos: limpio, activo: rol?.activo ?? true })
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={rol ? `Editar rol: ${rol.nombre}` : "Nuevo rol"}
      description={rol?.sistema ? "Rol del sistema: puedes editar permisos, pero no eliminarlo." : "Define el nombre y qué puede ver/editar por módulo."}
      size="2xl"
      dismissable={!pending}
    >
      <form onSubmit={submit} className="grid gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="rol-nombre">Nombre</Label>
          <Input id="rol-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required disabled={pending} />
        </div>

        <div className="rounded-lg border border-border">
          <div className="grid grid-cols-[1fr_4rem_4rem] items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Módulo</span>
            <span className="text-center">Ver</span>
            <span className="text-center">Editar</span>
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            {MODULOS.map((m) => {
              const p = permisos[m.modulo] ?? { view: false, edit: false }
              return (
                <div key={m.modulo} className="grid grid-cols-[1fr_4rem_4rem] items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-0">
                  <span>{m.label}</span>
                  <span className="text-center">
                    <input
                      type="checkbox"
                      checked={p.view}
                      onChange={(e) => set(m.modulo, "view", e.target.checked)}
                      disabled={pending}
                      className="size-4 rounded border-border"
                    />
                  </span>
                  <span className="text-center">
                    <input
                      type="checkbox"
                      checked={p.edit}
                      onChange={(e) => set(m.modulo, "edit", e.target.checked)}
                      disabled={pending}
                      className="size-4 rounded border-border"
                    />
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Guardando…" : rol ? "Guardar" : "Crear rol"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
