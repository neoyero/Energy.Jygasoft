import { z } from "zod";

/**
 * Validación de leads (compartida cliente + servidor).
 * Alineada a la tabla `leads` y al contrato sitio→n8n (§4).
 */

export const SEGMENTOS = ["residencial", "negocio"] as const;
export const USOS_INMUEBLE = [
  "residencial",
  "comercial",
  "mixto",
  "industrial",
] as const;

const cpRegex = /^\d{5}$/;

export const utmSchema = z
  .object({
    utm_source: z.string().max(120).optional(),
    utm_medium: z.string().max(120).optional(),
    utm_campaign: z.string().max(120).optional(),
    utm_term: z.string().max(120).optional(),
    utm_content: z.string().max(120).optional(),
  })
  .partial();

export const origenSchema = z.object({
  form: z.string().min(1).max(60),
  landing_url: z.string().url().max(2048).optional(),
  referrer: z.string().max(2048).optional(),
  utm: utmSchema.default({}),
});

export const leadInputSchema = z
  .object({
    nombre: z.string().trim().min(2).max(160).optional(),
    email: z.string().trim().email().max(254).optional(),
    telefono: z
      .string()
      .trim()
      .min(7)
      .max(20)
      .regex(/^[\d+()\-\s]+$/, "Teléfono inválido")
      .optional(),
    segmento: z.enum(SEGMENTOS),
    uso: z.enum(USOS_INMUEBLE).optional(),
    cp: z.string().regex(cpRegex, "CP debe tener 5 dígitos").optional(),
    municipio: z.string().trim().max(120).optional(),
    estado: z.string().trim().max(120).optional(),
    consumo_kwh_mes: z.coerce.number().positive().max(1_000_000).optional(),
    recibo_mxn: z.coerce.number().positive().max(10_000_000).optional(),
    es_titular: z.boolean().optional(),
    es_propietario: z.boolean().optional(),
    mensaje: z.string().trim().max(2000).optional(),

    // LFPDPPP: consentimiento de datos obligatorio; marketing separado.
    consentimiento_datos: z
      .boolean()
      .refine((v) => v === true, {
        message: "Debes aceptar el aviso de privacidad",
      }),
    consentimiento_marketing: z.boolean().default(false),

    origen: origenSchema,

    // Anti-spam: honeypot (debe venir vacío) + token Turnstile.
    company_website: z.string().max(0).optional(),
    turnstileToken: z.string().max(4096).optional(),
  })
  .refine((d) => Boolean(d.email || d.telefono), {
    message: "Proporciona email o teléfono",
    path: ["telefono"],
  });

export type LeadInput = z.infer<typeof leadInputSchema>;
/** Tipo de entrada del formulario (con campos opcionales por defaults de Zod). */
export type LeadFormInput = z.input<typeof leadInputSchema>;
