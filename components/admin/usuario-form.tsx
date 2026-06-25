"use client";

import { useState, useTransition } from "react";
import {
  createUsuario,
  updateUsuario,
  toggleUsuarioActivo,
} from "@/lib/admin/actions";
import { ROLES } from "@/lib/admin/rbac";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/admin/ui/confirm-button";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
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
  // Rol mostrado (controlado) y rol propuesto a confirmar.
  const [rolActual, setRolActual] = useState(rol);
  const [rolPendiente, setRolPendiente] = useState<string | null>(null);

  function handle(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error ?? "Operación fallida.");
    });
  }

  // El select es controlado: al elegir un rol distinto se propone el cambio sin
  // aplicarlo (el value sigue siendo rolActual hasta confirmar).
  function pedirCambioRol(e: React.ChangeEvent<HTMLSelectElement>): void {
    const value = e.target.value;
    if (value === rolActual) return;
    setRolPendiente(value);
  }

  function confirmarRol(): void {
    const nuevo = rolPendiente;
    setRolPendiente(null);
    if (!nuevo) return;
    setRolActual(nuevo);
    handle(() =>
      updateUsuario(id, { nombre, rol: nuevo, telefono: telefono ?? undefined }),
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        value={rolActual}
        disabled={pending}
        onChange={pedirCambioRol}
        className={selectClass}
        aria-label="Rol"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r.replace(/_/g, " ")}
          </option>
        ))}
      </select>

      <ConfirmButton
        size="sm"
        variant={activo ? "destructive" : "outline"}
        disabled={pending}
        title={activo ? "Desactivar acceso" : "Activar acceso"}
        description={
          activo ? (
            <>
              Se revocará el acceso de <strong>{nombre}</strong> al panel.
              ¿Continuar?
            </>
          ) : (
            <>
              Se restablecerá el acceso de <strong>{nombre}</strong> al panel.
              ¿Continuar?
            </>
          )
        }
        confirmLabel={activo ? "Desactivar" : "Activar"}
        onConfirm={() => handle(() => toggleUsuarioActivo(id, !activo))}
      >
        {activo ? "Desactivar" : "Activar"}
      </ConfirmButton>

      {error && <span className="text-xs text-destructive">{error}</span>}

      <ConfirmDialog
        open={rolPendiente !== null}
        onOpenChange={(open) => {
          if (!open) setRolPendiente(null);
        }}
        title="Cambiar rol"
        description={
          <>
            El rol de <strong>{nombre}</strong> cambiará a{" "}
            <strong>{rolPendiente?.replace(/_/g, " ")}</strong>. Esto modifica
            sus permisos en el sistema. ¿Continuar?
          </>
        }
        confirmLabel="Cambiar rol"
        onConfirm={confirmarRol}
      />
    </div>
  );
}
