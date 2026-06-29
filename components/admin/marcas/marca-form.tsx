"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ImagePlus, X } from "lucide-react"

import { crearMarca, actualizarMarca } from "@/lib/admin/actions"
import type { MarcaRow } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MarcaImagenField } from "@/components/admin/marcas/marca-imagen-field"

type MarcaInput = Parameters<typeof crearMarca>[0]

export interface MarcaFormProps {
  modo: "crear" | "editar"
  marca?: MarcaRow
  onSuccess?: () => void
  onCancel?: () => void
  onSavingChange?: (saving: boolean) => void
}

function nullable(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/** Formulario de alta/edición de marca (nombre, descripción, activo). */
export function MarcaForm({ modo, marca, onSuccess, onCancel, onSavingChange }: MarcaFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState(marca?.nombre ?? "")
  const [descripcion, setDescripcion] = useState(marca?.descripcion ?? "")
  const [activo, setActivo] = useState(marca?.activo ?? true)
  // Solo en alta: imagen "en espera" que se sube tras crear la marca.
  const inputRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  // Si en el alta la marca ya quedó creada (p. ej. falló solo el logo),
  // guardamos su id para reintentar sin volver a crearla (evita duplicados).
  const [creadaId, setCreadaId] = useState<string | null>(null)

  useEffect(() => {
    onSavingChange?.(pending)
  }, [pending, onSavingChange])

  // Libera el object URL del preview al cambiar/desmontar.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>): void {
    const f = e.target.files?.[0] ?? null
    e.target.value = ""
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setArchivo(f)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
  }

  function quitarArchivo(): void {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setArchivo(null)
    setPreviewUrl(null)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    const payload: MarcaInput = {
      nombre: nombre.trim(),
      descripcion: nullable(descripcion),
      activo,
    }
    startTransition(async () => {
      if (modo === "editar" && marca) {
        const res = await actualizarMarca(marca.id, payload)
        if (!res.ok) {
          setError(res.error)
          return
        }
        router.refresh()
        onSuccess?.()
        return
      }

      // Alta: crea la marca (o actualiza si ya se creó en un intento previo),
      // y si se eligió imagen la sube a su carpeta.
      let id = creadaId
      if (!id) {
        const res = await crearMarca(payload)
        if (!res.ok) {
          setError(res.error)
          return
        }
        id = res.id ?? null
        setCreadaId(id)
      } else {
        await actualizarMarca(id, payload)
      }

      if (archivo && id) {
        try {
          const fd = new FormData()
          fd.append("file", archivo)
          fd.append("marcaId", id)
          const up = await fetch("/api/je-admin/marcas/imagen", { method: "POST", body: fd })
          if (!up.ok) {
            const j = (await up.json().catch(() => ({}))) as { error?: string }
            // La marca quedó creada; solo falló el logo. Modal abierto para reintentar.
            setError(`Marca creada; el logo no se subió (${j.error ?? "error"}). Reintenta.`)
            router.refresh()
            return
          }
        } catch {
          setError("Marca creada; el logo no se subió. Reintenta.")
          router.refresh()
          return
        }
      }
      router.refresh()
      onSuccess?.()
    })
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="marca-nombre">Nombre</Label>
        <Input
          id="marca-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          disabled={pending}
          placeholder="Ej. Jinko Solar"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="marca-desc">Descripción</Label>
        <textarea
          id="marca-desc"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          disabled={pending}
          rows={2}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>

      {/* Logo: al editar usa subida inmediata; al crear se deja "en espera". */}
      {modo === "editar" && marca ? (
        <MarcaImagenField marcaId={marca.id} tieneImagen={marca.imagenUrl != null} />
      ) : (
        <div className="space-y-1.5">
          <Label>Logo (opcional)</Label>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
            onChange={elegirArchivo}
            disabled={pending}
            className="hidden"
          />
          {previewUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Vista previa del logo"
                className="size-16 rounded-md border border-border object-contain bg-white"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={quitarArchivo}
              >
                <X className="size-4" aria-hidden /> Quitar
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="size-4" aria-hidden /> Elegir logo
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Se subirá al guardar la marca. PNG, JPG, WebP, AVIF o SVG (máx. 8 MB).
          </p>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={activo}
          onChange={(e) => setActivo(e.target.checked)}
          disabled={pending}
          className="size-4 rounded border-border"
        />
        Activa
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : modo === "editar" ? "Guardar cambios" : "Crear marca"}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        {error ? <span className="text-sm text-destructive">{error}</span> : null}
      </div>
    </form>
  )
}
