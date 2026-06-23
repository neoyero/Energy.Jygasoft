"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Solo permitir rutas internas relativas (evita open redirect / phishing).
  const rawCallback = params.get("callbackUrl") ?? "/admin";
  const callbackUrl =
    rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Credenciales inválidas.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-xl border border-border p-8"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Panel Jygasoft Energy</h1>
          <p className="text-sm text-muted-foreground">Acceso restringido.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}

export default function AdminLogin() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
