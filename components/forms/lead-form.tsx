"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile } from "@marsidev/react-turnstile";
import { CheckCircle2, ChevronRight } from "lucide-react";
import {
  leadInputSchema,
  type LeadInput,
  type LeadFormInput,
} from "@/lib/validators/lead";
import { clientEnv } from "@/lib/env";
import { trackPixelLead } from "@/components/analytics/meta-pixel";

interface LeadFormProps {
  formName: string;
  withMensaje?: boolean;
}

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

function parseUtm(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const sp = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const v = sp.get(k);
    if (v) utm[k] = v;
  }
  return utm;
}

const inputCls =
  "w-full rounded-xl border border-stone-200 bg-brand-surface px-4 py-3 text-sm font-light text-brand-ink outline-none transition-all focus:border-brand-green focus:ring-1 focus:ring-brand-green";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-600";

export function LeadForm({ formName, withMensaje = false }: LeadFormProps) {
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });
  const siteKey = clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<LeadFormInput, unknown, LeadInput>({
    resolver: zodResolver(leadInputSchema),
    defaultValues: {
      segmento: "residencial",
      consentimiento_datos: false,
      consentimiento_marketing: false,
      origen: { form: formName, utm: {} },
    },
  });

  useEffect(() => {
    setValue("origen.form", formName);
    setValue("origen.landing_url", window.location.href);
    if (document.referrer) setValue("origen.referrer", document.referrer);
    setValue("origen.utm", parseUtm());
  }, [formName, setValue]);

  async function onSubmit(values: LeadInput) {
    setSubmit({ status: "submitting" });
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        requestId?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (data.requestId) trackPixelLead(data.requestId);
      setSubmit({ status: "success" });
    } catch (err) {
      setSubmit({
        status: "error",
        message: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  }

  if (submit.status === "success") {
    return (
      <div className="space-y-6 px-4 py-12 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-mint-light/30 text-brand-green">
          <CheckCircle2 className="h-12 w-12" />
        </div>
        <h3 className="text-2xl font-extrabold tracking-tight text-brand">
          ¡Solicitud enviada con éxito!
        </h3>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-stone-600">
          Un asesor de Jygasoft Energy te contactará a la brevedad.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="hidden" aria-hidden>
        <input tabIndex={-1} autoComplete="off" {...register("company_website")} />
      </div>

      <div>
        <label htmlFor="nombre" className={labelCls}>Nombre completo</label>
        <input id="nombre" autoComplete="name" placeholder="Ej. Juan Pérez" className={inputCls} {...register("nombre")} />
        {errors.nombre && <p className="mt-1 text-xs text-red-600">{errors.nombre.message}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="telefono" className={labelCls}>WhatsApp / Teléfono</label>
          <input id="telefono" inputMode="tel" autoComplete="tel" placeholder="10 dígitos" className={inputCls} {...register("telefono")} />
          {errors.telefono && <p className="mt-1 text-xs text-red-600">{errors.telefono.message}</p>}
        </div>
        <div>
          <label htmlFor="email" className={labelCls}>Correo (opcional)</label>
          <input id="email" type="email" autoComplete="email" placeholder="correo@ejemplo.com" className={inputCls} {...register("email")} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
      </div>

      <div>
        <label className={labelCls}>¿Para qué es?</label>
        <div className="grid grid-cols-2 gap-3">
          {(["residencial", "negocio"] as const).map((seg) => (
            <label
              key={seg}
              className="flex cursor-pointer items-center justify-center rounded-xl border border-stone-200 bg-stone-50 py-3 text-sm font-semibold text-stone-600 transition-all has-[:checked]:border-brand-green has-[:checked]:bg-brand-green has-[:checked]:text-white"
            >
              <input type="radio" value={seg} {...register("segmento")} className="sr-only" />
              {seg === "residencial" ? "Casa" : "Negocio"}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cp" className={labelCls}>Código postal</label>
          <input id="cp" inputMode="numeric" maxLength={5} className={inputCls} {...register("cp")} />
          {errors.cp && <p className="mt-1 text-xs text-red-600">{errors.cp.message}</p>}
        </div>
        <div>
          <label htmlFor="recibo_mxn" className={labelCls}>Recibo CFE (MXN, opcional)</label>
          <input id="recibo_mxn" inputMode="decimal" className={inputCls} {...register("recibo_mxn")} />
        </div>
      </div>

      {withMensaje && (
        <div>
          <label htmlFor="mensaje" className={labelCls}>Mensaje</label>
          <textarea id="mensaje" rows={4} className={inputCls} {...register("mensaje")} />
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
        <Controller
          control={control}
          name="consentimiento_datos"
          render={({ field }) => (
            <label className="flex items-start gap-3 text-sm text-stone-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-brand-green"
                checked={field.value ?? false}
                onChange={(e) => field.onChange(e.target.checked)}
              />
              <span>
                Acepto el{" "}
                <a href="/legal/aviso-privacidad" className="text-brand-green underline" target="_blank">
                  Aviso de Privacidad
                </a>{" "}
                y el tratamiento de mis datos. *
              </span>
            </label>
          )}
        />
        {errors.consentimiento_datos && (
          <p className="text-xs text-red-600">{errors.consentimiento_datos.message}</p>
        )}
        <Controller
          control={control}
          name="consentimiento_marketing"
          render={({ field }) => (
            <label className="flex items-start gap-3 text-sm text-stone-500">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-brand-green"
                checked={field.value ?? false}
                onChange={(e) => field.onChange(e.target.checked)}
              />
              <span>Quiero recibir promociones y novedades (opcional).</span>
            </label>
          )}
        />
      </div>

      {siteKey && (
        <Turnstile siteKey={siteKey} onSuccess={(t) => setValue("turnstileToken", t)} options={{ theme: "auto" }} />
      )}

      {submit.status === "error" && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
          No se pudo enviar ({submit.message}). Intenta de nuevo.
        </div>
      )}

      <button
        type="submit"
        disabled={submit.status === "submitting"}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold px-6 py-4 text-sm font-bold tracking-wide text-brand-ink shadow-md transition-all hover:bg-brand-gold-dark hover:shadow-lg active:scale-[0.99]"
      >
        {submit.status === "submitting" ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-ink border-t-transparent" />
        ) : (
          <>
            Solicitar contacto
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
