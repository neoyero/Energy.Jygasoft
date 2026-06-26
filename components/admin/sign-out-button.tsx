"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SignOutButtonProps {
  /** "text" = enlace "Salir"; "icon" = botón de icono compacto (para la tarjeta de usuario). */
  variant?: "text" | "icon";
}

export function SignOutButton({ variant = "text" }: SignOutButtonProps) {
  const cerrar = () => signOut({ callbackUrl: "/je-admin/login" });

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-stone-500 transition-colors",
          "hover:bg-stone-200 hover:text-stone-700 dark:hover:bg-muted dark:hover:text-foreground",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          "pointer-coarse:size-10",
        )}
      >
        <LogOut className="size-4" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={cerrar}
      className="text-sm text-muted-foreground hover:text-foreground"
    >
      Salir
    </button>
  );
}
