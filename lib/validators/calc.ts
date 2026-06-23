import { z } from "zod";
import { SEGMENTOS } from "@/lib/validators/lead";

/**
 * Validación de la calculadora. Requiere recibo o consumo. La captura de lead
 * es opcional (si dejan contacto + consentimiento).
 */
export const calcInputSchema = z
  .object({
    segmento: z.enum(SEGMENTOS),
    reciboMxn: z.coerce.number().positive().max(10_000_000).optional(),
    consumoKwhMes: z.coerce.number().positive().max(1_000_000).optional(),
    cp: z.string().regex(/^\d{5}$/).optional(),
    municipio: z.string().trim().max(120).optional(),
    estado: z.string().trim().max(120).optional(),
    tarifa: z.string().trim().max(20).optional(),

    // Captura opcional de lead
    nombre: z.string().trim().min(2).max(160).optional(),
    email: z.string().trim().email().max(254).optional(),
    telefono: z
      .string()
      .trim()
      .min(7)
      .max(20)
      .regex(/^[\d+()\-\s]+$/)
      .optional(),
    consentimiento_datos: z.boolean().optional(),
    consentimiento_marketing: z.boolean().optional(),

    // Anti-spam
    company_website: z.string().max(0).optional(),
    turnstileToken: z.string().max(4096).optional(),
  })
  .refine((d) => Boolean(d.reciboMxn || d.consumoKwhMes), {
    message: "Proporciona tu recibo (MXN) o tu consumo (kWh/mes)",
    path: ["reciboMxn"],
  });

export type CalcInputDto = z.infer<typeof calcInputSchema>;
