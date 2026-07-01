"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Power, PowerOff, Search } from "lucide-react"

import type { UsuarioAdminRow } from "@/lib/admin/queries"
import { toggleUsuarioActivo } from "@/lib/admin/actions"
import { fmtFechaRel } from "@/lib/admin/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/admin/ui/modal"
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/admin/ui/data-table"
import { UsuarioForm } from "@/components/admin/usuarios/usuario-form"
import { cn } from "@/lib/utils"

export interface UsuariosViewProps {
  usuarios: ReadonlyArray<UsuarioAdminRow>
  areas: ReadonlyArray<{ id: string; nombre: string }>
  /** RBAC usuarios:edit (solo admin). */
  puedeEditar: boolean
}

/** Rol -> etiqueta legible (reemplaza guiones bajos). */
function rolLabel(rol: string): string {
  return rol.replace(/_/g, " ")
}

/**
 * Gestión del equipo (usuarios) homologada con el resto del panel: tabla rica
 * (avatar, rol, cargo, jefe, área, estado, último acceso) + alta/edición en
 * modal (UsuarioForm) y activar/desactivar por fila. El detalle se refresca vía
 * router.refresh() tras cada acción.
 */
export function UsuariosView({ usuarios, areas, puedeEditar }: UsuariosViewProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busqueda, setBusqueda] = useState("")
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<UsuarioAdminRow | null>(null)
  const [saving, setSaving] = useState(false)

  const opciones = useMemo(
    () => usuarios.map((u) => ({ id: u.id, nombre: u.nombre })),
    [usuarios],
  )

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return usuarios
    return usuarios.filter(
      (u) =>
        u.nombre.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.cargo ?? "").toLowerCase().includes(q),
    )
  }, [usuarios, busqueda])

  function cerrar(): void {
    setCreando(false)
    setEditando(null)
  }

  function toggle(u: UsuarioAdminRow): void {
    startTransition(async () => {
      await toggleUsuarioActivo(u.id, !u.activo)
      router.refresh()
    })
  }

  const columns: ReadonlyArray<DataTableColumn<UsuarioAdminRow>> = [
    {
      id: "usuario",
      header: "Usuario",
      accessor: (u) => u.nombre,
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
              u.activo
                ? "bg-brand/10 text-brand dark:bg-muted dark:text-foreground"
                : "bg-stone-100 text-stone-400 dark:bg-muted dark:text-muted-foreground",
            )}
          >
            {u.nombre.charAt(0).toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="font-medium text-stone-800 dark:text-foreground">{u.nombre}</span>
            <span className="truncate text-xs text-stone-500 dark:text-muted-foreground">
              {u.email}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "rol",
      header: "Rol",
      accessor: (u) => u.rol,
      render: (u) => (
        <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium capitalize text-stone-600 dark:bg-muted dark:text-muted-foreground">
          {rolLabel(u.rol)}
        </span>
      ),
    },
    {
      id: "cargo",
      header: "Cargo",
      accessor: (u) => u.cargo ?? "",
      hideOnMobile: true,
      render: (u) => (
        <span className="text-stone-600 dark:text-muted-foreground">{u.cargo ?? "—"}</span>
      ),
    },
    {
      id: "jefe",
      header: "Reporta a",
      accessor: (u) => u.jefeNombre ?? "",
      hideOnMobile: true,
      render: (u) => (
        <span className="text-stone-600 dark:text-muted-foreground">{u.jefeNombre ?? "—"}</span>
      ),
    },
    {
      id: "area",
      header: "Área",
      accessor: (u) => u.areaNombre ?? "",
      hideOnMobile: true,
      render: (u) => (
        <span className="text-stone-600 dark:text-muted-foreground">{u.areaNombre ?? "—"}</span>
      ),
    },
    {
      id: "estado",
      header: "Estado",
      accessor: (u) => (u.activo ? 1 : 0),
      render: (u) =>
        u.activo ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            Activo
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500 dark:bg-muted dark:text-muted-foreground">
            Inactivo
          </span>
        ),
    },
    {
      id: "ultimoAcceso",
      header: "Último acceso",
      accessor: (u) => u.ultimoAcceso ?? "",
      sortable: true,
      hideOnMobile: true,
      render: (u) => (
        <span className="text-stone-500 dark:text-muted-foreground">
          {u.ultimoAcceso ? fmtFechaRel(u.ultimoAcceso) : "Nunca"}
        </span>
      ),
    },
  ]

  const rowActions: ReadonlyArray<DataTableRowAction<UsuarioAdminRow>> | undefined = puedeEditar
    ? [
        { label: "Editar", icon: <Pencil className="size-4" />, onSelect: (u) => setEditando(u) },
        {
          label: "Desactivar",
          icon: <PowerOff className="size-4" />,
          onSelect: toggle,
          hidden: (u) => !u.activo,
          confirm: {
            title: "Desactivar acceso",
            description: (u) => (
              <>
                Se revocará el acceso de <strong>{u.nombre}</strong> al panel. ¿Continuar?
              </>
            ),
            confirmLabel: "Desactivar",
          },
        },
        {
          label: "Activar",
          icon: <Power className="size-4" />,
          onSelect: toggle,
          hidden: (u) => u.activo,
        },
      ]
    : undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-muted-foreground">Buscar</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, correo o cargo…"
              className="w-64 pl-8"
            />
          </div>
        </div>

        {puedeEditar ? (
          <Button type="button" size="sm" onClick={() => { setEditando(null); setCreando(true) }}>
            <Plus className="size-4" aria-hidden /> Nuevo usuario
          </Button>
        ) : null}
      </div>

      <DataTable<UsuarioAdminRow>
        data={filtrados}
        columns={columns}
        rowKey={(u) => u.id}
        onRowClick={puedeEditar ? (u) => setEditando(u) : undefined}
        rowActions={rowActions}
        empty={{ title: "Sin usuarios", description: "Agrega al primer miembro del equipo." }}
      />

      {puedeEditar ? (
        <Modal
          open={creando || editando !== null}
          onOpenChange={(abierto) => { if (!abierto) cerrar() }}
          title={editando ? "Editar usuario" : "Nuevo usuario"}
          description={
            editando
              ? "Modifica datos de acceso y posición en el organigrama."
              : "Alta de un miembro del equipo (entra por código al correo)."
          }
          size="2xl"
          dismissable={!saving}
        >
          <UsuarioForm
            key={editando?.id ?? "nuevo"}
            modo={editando ? "editar" : "crear"}
            usuario={editando ?? undefined}
            usuarios={opciones}
            areas={areas}
            onSuccess={cerrar}
            onCancel={cerrar}
            onSavingChange={setSaving}
          />
        </Modal>
      ) : null}
    </div>
  )
}
