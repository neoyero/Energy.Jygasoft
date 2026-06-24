"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/je-admin/login" })}
      className="text-sm text-muted-foreground hover:text-foreground"
    >
      Salir
    </button>
  );
}
