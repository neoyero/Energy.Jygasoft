"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Turnstile } from "@marsidev/react-turnstile";
import {
  Sun,
  Sparkles,
  Zap,
  DollarSign,
  BatteryCharging,
  ShieldCheck,
} from "lucide-react";
import { clientEnv } from "@/lib/env";
import { trackPixelLead } from "@/components/analytics/meta-pixel";

interface CalcResultado {
  kwp: number;
  paneles: number;
  produccionAnualKwh: number;
  inversionMin: number;
  inversionMax: number;
  ahorroAnualMxn: number;
  paybackAnios: number;
  consumoKwhMes: number;
}

interface CalcResponse {
  ok: boolean;
  resultado?: CalcResultado;
  tarifa?: string;
  disclaimer?: string;
  leadId?: string;
  requestId?: string;
  error?: string;
}

interface FormValues {
  segmento: "residencial" | "negocio";
  reciboMxn: string;
  consumoKwhMes: string;
  cp: string;
  municipio: string;
  estado: string;
  nombre: string;
  telefono: string;
  email: string;
  consentimiento_datos: boolean;
  consentimiento_marketing: boolean;
  company_website: string;
}

const mxn = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);

const inputCls =
  "w-full rounded-xl border border-stone-200 bg-brand-surface px-4 py-3 text-sm text-brand-ink outline-none transition-all focus:border-brand-green focus:ring-1 focus:ring-brand-green";

export function CalcForm() {
  const siteKey = clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [data, setData] = useState<CalcResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | undefined>();
  const [quiereContacto, setQuiereContacto] = useState(false);

  const { register, handleSubmit, setValue } = useForm<FormValues>({
    defaultValues: {
      segmento: "residencial",
      consentimiento_datos: false,
      consentimiento_marketing: false,
    },
  });

  async function onSubmit(v: FormValues) {
    setLoading(true);
    setError(null);
    const payload: Record<string, unknown> = {
      segmento: v.segmento,
      reciboMxn: v.reciboMxn ? Number(v.reciboMxn) : undefined,
      consumoKwhMes: v.consumoKwhMes ? Number(v.consumoKwhMes) : undefined,
      cp: v.cp || undefined,
      municipio: v.municipio || undefined,
      estado: v.estado || undefined,
      company_website: v.company_website || undefined,
    };
    if (quiereContacto) {
      Object.assign(payload, {
        nombre: v.nombre || undefined,
        telefono: v.telefono || undefined,
        email: v.email || undefined,
        consentimiento_datos: v.consentimiento_datos,
        consentimiento_marketing: v.consentimiento_marketing,
        turnstileToken: token,
      });
    }
    try {
      const res = await fetch("/api/calculadora", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as CalcResponse;
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      if (json.requestId) trackPixelLead(json.requestId, json.resultado?.ahorroAnualMxn);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  // CP → estado + municipio (autocompletado nacional vía BD SEPOMEX).
  const cpReg = register("cp");
  async function handleCpChange(e: React.ChangeEvent<HTMLInputElement>) {
    cpReg.onChange(e);
    const v = e.target.value.replace(/\D/g, "");
    if (v.length === 5) {
      try {
        const r = await fetch(`/api/cp/${v}`);
        const j = (await r.json()) as {
          found?: boolean;
          municipio?: string | null;
          estado?: string | null;
        };
        if (j.found) {
          if (j.municipio) setValue("municipio", j.municipio, { shouldValidate: false });
          if (j.estado) setValue("estado", j.estado, { shouldValidate: false });
        }
      } catch {
        /* sin conexión: el usuario puede escribir el municipio/estado */
      }
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
      {/* Inputs */}
      <div className="rounded-2xl border border-stone-200/70 bg-white p-8 shadow-sm lg:col-span-5">
        <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-brand">
          <Sun className="h-5 w-5 animate-pulse-soft text-brand-gold" />
          Tus datos de consumo
        </h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="hidden" aria-hidden>
            <input tabIndex={-1} autoComplete="off" {...register("company_website")} />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-600">
              ¿Casa o negocio?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["residencial", "negocio"] as const).map((seg) => (
                <label
                  key={seg}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 py-3 text-sm font-semibold capitalize text-stone-600 transition-all has-[:checked]:border-brand-green has-[:checked]:bg-brand-green has-[:checked]:text-white"
                >
                  <input type="radio" value={seg} {...register("segmento")} className="sr-only" />
                  {seg === "residencial" ? "Casa" : "Negocio"}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-600">
                Recibo CFE (MXN/mes)
              </label>
              <input inputMode="decimal" placeholder="1800" className={inputCls} {...register("reciboMxn")} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-600">
                o Consumo (kWh/mes)
              </label>
              <input inputMode="decimal" placeholder="450" className={inputCls} {...register("consumoKwhMes")} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-600">
                Código postal
              </label>
              <input
                inputMode="numeric"
                maxLength={5}
                placeholder="20000"
                className={inputCls}
                {...cpReg}
                onChange={handleCpChange}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-600">
                Estado
              </label>
              <input
                placeholder="Se completa con tu CP"
                className={inputCls}
                {...register("estado")}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-600">
                Municipio
              </label>
              <input
                placeholder="Se completa con tu CP"
                className={inputCls}
                {...register("municipio")}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={quiereContacto}
              onChange={(e) => setQuiereContacto(e.target.checked)}
              className="h-4 w-4 accent-brand-green"
            />
            Quiero que un asesor me contacte con la propuesta
          </label>

          {quiereContacto && (
            <div className="space-y-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input placeholder="Nombre" className={inputCls} {...register("nombre")} />
                <input placeholder="WhatsApp" inputMode="tel" className={inputCls} {...register("telefono")} />
              </div>
              <input placeholder="Correo (opcional)" type="email" className={inputCls} {...register("email")} />
              <label className="flex items-start gap-2 text-xs text-stone-600">
                <input type="checkbox" className="mt-0.5 accent-brand-green" {...register("consentimiento_datos")} />
                <span>
                  Acepto el{" "}
                  <a href="/legal/aviso-privacidad" className="text-brand-green underline" target="_blank">
                    Aviso de Privacidad
                  </a>
                  . *
                </span>
              </label>
              {siteKey && <Turnstile siteKey={siteKey} onSuccess={setToken} options={{ theme: "auto" }} />}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
              No se pudo calcular ({error}).
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold px-6 py-4 text-sm font-bold tracking-wide text-brand-ink shadow-md transition-all hover:bg-brand-gold-dark hover:shadow-lg active:scale-[0.99]"
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-ink border-t-transparent" />
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Calcular ahorro real
              </>
            )}
          </button>
        </form>
      </div>

      {/* Resultados */}
      <div className="lg:col-span-7">
        {data?.resultado ? (
          <div className="relative overflow-hidden rounded-2xl border border-stone-200/70 bg-white p-8 shadow-sm">
            <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-brand-green/5" />
            <h3 className="mb-8 text-2xl font-extrabold tracking-tight text-brand">
              Tu propuesta técnica preliminar
            </h3>

            <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2">
              <Metric
                icon={<Zap className="h-6 w-6" />}
                tone="green"
                label="Sistema sugerido"
                value={`${data.resultado.kwp} kWp`}
                sub={`≈ ${data.resultado.paneles} paneles`}
              />
              <Metric
                icon={<DollarSign className="h-6 w-6" />}
                tone="gold"
                label="Inversión estimada"
                value={mxn(data.resultado.inversionMin)}
                sub={`hasta ${mxn(data.resultado.inversionMax)}`}
              />
              <Metric
                icon={<BatteryCharging className="h-6 w-6" />}
                tone="green"
                label="Ahorro anual (≈)"
                value={mxn(data.resultado.ahorroAnualMxn)}
                sub={`${Math.round(data.resultado.produccionAnualKwh).toLocaleString("es-MX")} kWh/año`}
              />
              <Metric
                icon={<ShieldCheck className="h-6 w-6" />}
                tone="blue"
                label="Retorno de inversión"
                value={`${data.resultado.paybackAnios} años`}
                sub="+ 20 años de ganancia"
              />
            </div>

            {data.disclaimer && (
              <p className="rounded-xl bg-brand-700 p-4 text-xs font-light leading-relaxed text-brand-mint-light">
                {data.disclaimer}
              </p>
            )}
            {data.leadId && (
              <p className="mt-4 text-sm font-medium text-brand-green">
                ¡Listo! Un asesor te contactará con la propuesta detallada.
              </p>
            )}
          </div>
        ) : (
          <div className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-stone-200/70 bg-white/80 p-8 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-stone-100">
              <Sun
                className="h-10 w-10 text-brand-green"
                style={{ animation: "spin 20s linear infinite" }}
              />
            </div>
            <h4 className="text-xl font-bold text-brand">Esperando tus datos</h4>
            <p className="mt-3 max-w-sm text-sm text-stone-500">
              Ingresa tu recibo o consumo a la izquierda para ver tu propuesta
              instantánea: paneles, inversión y retorno.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "green" | "gold" | "blue";
}) {
  const tones = {
    green: "bg-brand-mint-light/40 text-brand-green",
    gold: "bg-brand-gold/20 text-brand-gold-dark",
    blue: "bg-blue-50 text-blue-600",
  } as const;
  return (
    <div className="flex items-start gap-4 rounded-xl border border-stone-100 bg-brand-surface p-5">
      <div className={`rounded-lg p-3 ${tones[tone]}`}>{icon}</div>
      <div>
        <span className="block text-xs font-bold uppercase tracking-widest text-stone-500">
          {label}
        </span>
        <strong className="mt-1 block text-2xl font-extrabold text-brand-ink">{value}</strong>
        <span className="mt-0.5 block text-xs font-light text-stone-500">{sub}</span>
      </div>
    </div>
  );
}
