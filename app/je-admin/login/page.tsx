"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Turnstile } from "@marsidev/react-turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientEnv } from "@/lib/env";

type Step = "email" | "code";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const siteKey = clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Solo rutas internas relativas (evita open redirect / phishing).
  const rawCallback = params.get("callbackUrl") ?? "/je-admin";
  const callbackUrl =
    rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : "/je-admin";

  const [step, setStep] = useState<Step>("email");
  const [usePassword, setUsePassword] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Paso 1: solicitar el código al correo.
  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    if (siteKey && !token) {
      setError("Completa la verificación de seguridad.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, turnstileToken: token }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo enviar el código.");
        return;
      }
      setInfo("Si el correo está registrado, te enviamos un código de 6 dígitos.");
      setStep("code");
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // Paso 2: verificar el código.
  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("otp", { email, code, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Código inválido o expirado.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  // Respaldo: contraseña (admin).
  async function passwordLogin(e: React.FormEvent) {
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
    <main className="flex min-h-screen items-center justify-center bg-brand-surface px-6">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src="/logo.png"
            alt="Jygasoft Energy"
            width={160}
            height={64}
            priority
            className="h-14 w-auto object-contain"
          />
          <div className="space-y-0.5">
            <h1 className="text-lg font-bold text-brand">Panel de administración</h1>
            <p className="text-sm text-stone-500">Acceso restringido</p>
          </div>
        </div>

        {/* ---- Modo contraseña (respaldo) ---- */}
        {usePassword ? (
          <form onSubmit={passwordLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" autoComplete="username" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
            </Button>
            <button type="button" onClick={() => { setUsePassword(false); setError(null); }}
              className="block w-full text-center text-xs text-brand-green hover:underline">
              Entrar con código al correo
            </button>
          </form>
        ) : step === "email" ? (
          /* ---- Paso 1: correo ---- */
          <form onSubmit={requestCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" autoComplete="username" placeholder="tu@correo.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <p className="text-xs text-stone-500">
              Te enviaremos un código de acceso de un solo uso. Sin contraseñas que recordar.
            </p>
            {siteKey && (
              <Turnstile siteKey={siteKey} onSuccess={setToken} options={{ theme: "auto" }} />
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || (!!siteKey && !token)}>
              {loading ? "Enviando…" : "Enviar código"}
            </Button>
            <button type="button" onClick={() => { setUsePassword(true); setError(null); }}
              className="block w-full text-center text-xs text-stone-400 hover:text-brand-green hover:underline">
              Usar contraseña (administradores)
            </button>
          </form>
        ) : (
          /* ---- Paso 2: código ---- */
          <form onSubmit={verifyCode} className="space-y-4">
            {info && <p className="rounded-lg bg-brand-mint-light/30 p-3 text-xs text-brand-green">{info}</p>}
            <div className="space-y-2">
              <Label htmlFor="code">Código de 6 dígitos</Label>
              <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                placeholder="••••••" value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-lg tracking-[0.5em]" required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
              {loading ? "Verificando…" : "Entrar"}
            </Button>
            <button type="button"
              onClick={() => { setStep("email"); setCode(""); setError(null); setInfo(null); }}
              className="block w-full text-center text-xs text-stone-400 hover:text-brand-green hover:underline">
              ← Usar otro correo
            </button>
          </form>
        )}
      </div>
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
