"use client";

import { useState, useTransition } from "react";
import {
  createUsuario,
  updateUsuario,
  toggleUsuarioActivo,
} from "@/lib/admin/actions";
import { ROLES } from "@/lib/admin/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "rounded-md border border-border bg-background px-2 py-1.5 text-sm";

/** Formulario de alta de un miembro del equipo. */
export function UsuarioCreateForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<string>("vendedor");
  const [telefono, setTelefono] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createUsuario({ nombre, email, rol, telefono });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNombre("");
      setEmail("");
      setRol("vendedor");
      setTelefono("");
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 rounded-xl border border-border p-5 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="usuario-nombre">Nombre</Label>
        <Input
          id="usuario-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          disabled={pending}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="usuario-email">Correo</Label>
        <Input
          id="usuario-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="usuario-rol">Rol</Label>
        <select
          id="usuario-rol"
          value={rol}
          onChange={(e) => setRol(e.target.value)}
          disabled={pending}
          className={`${selectClass} h-8 w-full`}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="usuario-telefono">Teléfono</Label>
        <Input
          id="usuario-telefono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Agregar al equipo"}
        </Button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </form>
  );
}

interface UsuarioRowActionsProps {
  id: string;
  nombre: string;
  rol: string;
  telefono: string | null;
  activo: boolean;
}

/** Acciones por fila: editar rol, y activar/desactivar el acceso. */
export function UsuarioRowActions({
  id,
  nombre,
  rol,
  telefono,
  activo,
}: UsuarioRowActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error ?? "Operación fallida.");
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        defaultValue={rol}
        disabled={pending}
        onChange={(e) =>
          handle(() =>
            updateUsuario(id, { nombre, rol: e.target.value, telefono: telefono ?? undefined }),
          )
        }
        className={selectClass}
        aria-label="Rol"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r.replace(/_/g, " ")}
          </option>
        ))}
      </select>

      <Button
        size="sm"
        variant={activo ? "destructive" : "outline"}
        disabled={pending}
        onClick={() => handle(() => toggleUsuarioActivo(id, !activo))}
      >
        {activo ? "Desactivar" : "Activar"}
      </Button>

      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
