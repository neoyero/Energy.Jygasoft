"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { clientEnv } from "@/lib/env";

/**
 * Meta Pixel cliente, gobernado por consentimiento (LFPDPPP).
 * El Pixel solo carga si el usuario acepta. Los eventos de conversión
 * (Lead) se disparan con `eventID = request_id` para deduplicar con la CAPI.
 */

const CONSENT_KEY = "jygasoft_consent";
type Consent = "granted" | "denied";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Dispara un evento Lead en el Pixel con el mismo event_id que la CAPI. */
export function trackPixelLead(eventId: string, value?: number) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq(
    "track",
    "Lead",
    value !== undefined ? { value, currency: "MXN" } : {},
    { eventID: eventId },
  );
}

export function MetaPixel() {
  const pixelId = clientEnv.NEXT_PUBLIC_META_PIXEL_ID;
  const [consent, setConsent] = useState<Consent | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(CONSENT_KEY) as Consent | null;
    setConsent(stored);
  }, []);

  function decide(value: Consent) {
    window.localStorage.setItem(CONSENT_KEY, value);
    setConsent(value);
  }

  if (!pixelId) return null;

  return (
    <>
      {consent === "granted" && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
            document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init','${pixelId}');fbq('track','PageView');
          `}
        </Script>
      )}

      {consent === null && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 p-4 backdrop-blur">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              Usamos cookies de medición (Meta) para mejorar nuestra publicidad. Puedes
              aceptarlas o rechazarlas.{" "}
              <a href="/legal/aviso-privacidad" className="underline">
                Más información
              </a>
              .
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => decide("denied")}
                className="rounded-md border border-border px-3 py-1.5 text-sm"
              >
                Rechazar
              </button>
              <button
                onClick={() => decide("granted")}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
