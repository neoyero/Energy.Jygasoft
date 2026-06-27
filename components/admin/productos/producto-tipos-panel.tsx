"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Pencil, Plus, Power, PowerOff, Trash2, X } from "lucide-react"

import {
  crearProductoTipo,
  actualizarProductoTipo,
  toggleProductoTipoActivo,
  eliminarProductoTipo,
} from "@/lib/admin/actions"
import type { ProductoTipoRecord } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type TipoInput = Parameters<typeof crearProductoTipo>[0]

export interface ProductoTiposPanelProps {
  tipos: ReadonlyArray<ProductoTipoRecord>
  puedeEditar: boolean
}

/** Genera una clave/slug estable a partir del nombre (a-z, 0-9, _). */
function slugify(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

interface TipoFormState {
  nombre: string
  clave: string
  descripcion: string
}

const VACIO: TipoFormState = { nombre: "", clave: "", descripcion: "" }

/**
 * Administración de tipos de producto: alta, edición inline, activar/desactivar
 * y borrado (solo si el tipo no tiene productos). La clave se autogenera desde el
 * nombre al crear, pero es editable.
 */
export function ProductoTiposPanel({ tipos, puedeEditar }: ProductoTiposPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [nuevo, setNuevo] = useState<TipoFormState>(VACIO)
  const [editId, setEditId] = useState<string | null>(null)
  const [edit, setEdit] = useState<TipoFormState>(VACIO)

  function ejecutar(accion: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void): void {
    setError(null)
    startTransition(async () => {
      const res = await accion()
      if (!res.ok) {
        setError(res.error ?? "No se pudo completar la acción.")
        return
      }
      router.refresh()
      onOk?.()
    })
  }

  function crear(): void {
    const payload: TipoInput = {
      nombre: nuevo.nombre.trim(),
      clave: (nuevo.clave.trim() || slugify(nuevo.nombre)).toLowerCase(),
      descripcion: nuevo.descripcion.trim() || null,
    }
    ejecutar(
      () => crearProductoTipo(payload),
      () => {
        setNuevo(VACIO)
        setCreando(false)
      },
    )
  }

  function guardarEdicion(): void {
    if (!editId) return
    const payload: TipoInput = {
      nombre: edit.nombre.trim(),
      clave: edit.clave.trim().toLowerCase(),
      descripcion: edit.descripcion.trim() || null,
    }
    ejecutar(
      () => actualizarProductoTipo(editId, payload),
      () => setEditId(null),
    )
  }

  function abrirEdicion(t: ProductoTipoRecord): void {
    setError(null)
    setEditId(t.id)
    setEdit({ nombre: t.nombre, clave: t.clave, descripcion: t.descripcion ?? "" })
  }

  return (
    <div className="flex flex-col gap-4">
      {puedeEditar ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Tipos editables del catálogo. No se puede eliminar un tipo con productos.
          </p>
          <Button
            type="button"
            size="sm"
            variant={creando ? "outline" : "default"}
            onClick={() => {
              setCreando((p) => !p)
              setNuevo(VACIO)
              setError(null)
            }}
          >
            {creando ? (
              <>
                <X className="size-4" aria-hidden /> Cerrar
              </>
            ) : (
              <>
                <Plus className="size-4" aria-hidden /> Nuevo tipo
              </>
            )}
          </Button>
        </div>
      ) : null}

      {puedeEditar && creando ? (
        <div className="grid gap-4 rounded-xl border border-border p-5 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="tipo-nombre">Nombre</Label>
            <Input
              id="tipo-nombre"
              value={nuevo.nombre}
              onChange={(e) =>
                setNuevo((p) => ({
                  ...p,
                  nombre: e.target.value,
                  // Autocompleta la clave mientras no se haya tocado a mano.
                  clave: p.clave === slugify(p.nombre) || p.clave === "" ? slugify(e.target.value) : p.clave,
                }))
              }
              disabled={pending}
              placeholder="Ej. Baterías"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tipo-clave">Clave</Label>
            <Input
              id="tipo-clave"
              value={nuevo.clave}
              onChange={(e) => setNuevo((p) => ({ ...p, clave: e.target.value }))}
              disabled={pending}
              placeholder="baterias"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tipo-desc">Descripción</Label>
            <Input
              id="tipo-desc"
              value={nuevo.descripcion}
              onChange={(e) => setNuevo((p) => ({ ...p, descripcion: e.target.value }))}
              disabled={pending}
              placeholder="Opcional"
            />
          </div>
          <div className="sm:col-span-3">
            <Button type="button" size="sm" onClick={crear} disabled={pending || !nuevo.nombre.trim()}>
              {pending ? "Guardando…" : "Crear tipo"}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Clave</th>
              <th className="px-4 py-2 font-medium">Productos</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              {puedeEditar ? <th className="px-4 py-2 font-medium text-right">Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {tipos.map((t) => {
              const enEdicion = editId === t.id
              return (
                <tr key={t.id} className="border-b border-border last:border-0">
                  {enEdicion ? (
                    <>
                      <td className="px-4 py-2">
                        <Input
                          value={edit.nombre}
                          onChange={(e) => setEdit((p) => ({ ...p, nombre: e.target.value }))}
                          disabled={pending}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={edit.clave}
                          onChange={(e) => setEdit((p) => ({ ...p, clave: e.target.value }))}
                          disabled={pending}
                        />
                      </td>
                      <td className="px-4 py-2 text-muted-foreground tabular-nums">{t.productos}</td>
                      <td className="px-4 py-2 text-muted-foreground">{t.activo ? "Activo" : "Inactivo"}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button type="button" size="sm" variant="ghost" onClick={guardarEdicion} disabled={pending || !edit.nombre.trim()}>
                            <Check className="size-4" aria-hidden /> Guardar
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)} disabled={pending}>
                            <X className="size-4" aria-hidden />
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2 font-medium text-stone-800 dark:text-foreground">
                        {t.nombre}
                        {t.descripcion ? (
                          <span className="block text-xs font-normal text-muted-foreground">{t.descripcion}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{t.clave}</td>
                      <td className="px-4 py-2 tabular-nums text-muted-foreground">{t.productos}</td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            t.activo
                              ? "inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : "inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500 dark:bg-muted dark:text-muted-foreground"
                          }
                        >
                          {t.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      {puedeEditar ? (
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              title="Editar"
                              onClick={() => abrirEdicion(t)}
                              disabled={pending}
                              className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 disabled:opacity-50 dark:text-muted-foreground dark:hover:bg-muted"
                            >
                              <Pencil className="size-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              title={t.activo ? "Desactivar" : "Activar"}
                              onClick={() => ejecutar(() => toggleProductoTipoActivo(t.id, !t.activo))}
                              disabled={pending}
                              className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 disabled:opacity-50 dark:text-muted-foreground dark:hover:bg-muted"
                            >
                              {t.activo ? <PowerOff className="size-4" aria-hidden /> : <Power className="size-4" aria-hidden />}
                            </button>
                            <button
                              type="button"
                              title={t.productos > 0 ? "No se puede eliminar: tiene productos" : "Eliminar"}
                              onClick={() => ejecutar(() => eliminarProductoTipo(t.id))}
                              disabled={pending || t.productos > 0}
                              className="rounded-md p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-500/10"
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
