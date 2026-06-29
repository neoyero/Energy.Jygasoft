"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ImagePlus, Trash2, Loader2 } from "lucide-react"

import { quitarImagenMarca } from "@/lib/admin/actions"
import { Button } from "@/components/ui/button"

export interface MarcaImagenFieldProps {
  marcaId: string
  tieneImagen: boolean
}

/** Logo de la marca: sube a M365 y muestra el preview vía el proxy. Solo al editar. */
export function MarcaImagenField({ marcaId, tieneImagen }: MarcaImagenFieldProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [tiene, setTiene] = useState(tieneImagen)
  const [ver, setVer] = useState(0)
  const [subiendo, setSubiendo] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const src = `/api/je-admin/marcas/imagen/${marcaId}?v=${ver}`

  async function onFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setError(null)
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("marcaId", marcaId)
      const res = await fetch("/api/je-admin/marcas/imagen", { method: "POST", body: fd })
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !j.ok) {
        setError(j.error ?? "No se pudo subir el logo.")
        return
      }
      setTiene(true)
      setVer((v) => v + 1)
      router.refresh()
    } catch {
      setError("No se pudo subir el logo.")
    } finally {
      setSubiendo(false)
    }
  }

  function quitar(): void {
    setError(null)
    startTransition(async () => {
      const res = await quitarImagenMarca(marcaId)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setTiene(false)
      router.refresh()
    })
  }

  const ocupado = subiendo || pending

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Logo</p>
      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
          {tiene ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="Logo de la marca" className="size-full object-contain" />
          ) : (
            <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
              onChange={onFile}
              disabled={ocupado}
              className="hidden"
            />
            <Button type="button" size="sm" variant="outline" disabled={ocupado} onClick={() => inputRef.current?.click()}>
              {subiendo ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Subiendo…
                </>
              ) : (
                <>
                  <ImagePlus className="size-4" aria-hidden /> {tiene ? "Reemplazar" : "Subir logo"}
                </>
              )}
            </Button>
            {tiene ? (
              <Button type="button" size="sm" variant="ghost" disabled={ocupado} onClick={quitar} className="text-destructive">
                <Trash2 className="size-4" aria-hidden /> Quitar
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPG, WebP, AVIF o SVG · hasta 8 MB.</p>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      </div>
    </div>
  )
}
