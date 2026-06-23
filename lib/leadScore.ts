/**
 * Scoring de lead (PURO, §7). El sitio sólo calcula y envía la señal;
 * el enrutamiento/asignación final lo decide n8n.
 *
 * Suma puntos por completitud e intención. `score >= UMBRAL_CALIENTE`
 * marca el lead como "caliente".
 */

export const UMBRAL_CALIENTE = 60;

export interface LeadScoreInput {
  segmento?: string | null;
  uso?: string | null;
  cp?: string | null;
  consumoKwhMes?: number | null;
  reciboMxn?: number | null;
  /** URL del recibo subido (foto). */
  reciboUrl?: string | null;
  esTitular?: boolean | null;
  esPropietario?: boolean | null;
  /** Si el rango de inversión comunicado fue rechazado por el prospecto. */
  rangoRechazado?: boolean | null;
  /** Mostró intención de agendar visita/llamada. */
  intencionAgenda?: boolean | null;
}

export interface LeadScoreResult {
  score: number;
  caliente: boolean;
}

const PESOS = {
  segmento: 15,
  uso: 5,
  cp: 10,
  consumoORecibo: 20,
  foto: 10,
  titular: 10,
  propietario: 10,
  rangoNoRechazado: 10,
  intencionAgenda: 20,
} as const;

const cpRegex = /^\d{5}$/;

export function scoreLead(input: LeadScoreInput): LeadScoreResult {
  let score = 0;

  if (input.segmento) score += PESOS.segmento;
  if (input.uso) score += PESOS.uso;
  if (input.cp && cpRegex.test(input.cp)) score += PESOS.cp;

  const tieneConsumo =
    (input.consumoKwhMes ?? 0) > 0 || (input.reciboMxn ?? 0) > 0;
  if (tieneConsumo) {
    score += PESOS.consumoORecibo;
    if (input.reciboUrl) score += PESOS.foto;
  }

  if (input.esTitular) score += PESOS.titular;
  if (input.esPropietario) score += PESOS.propietario;
  if (!input.rangoRechazado) score += PESOS.rangoNoRechazado;
  if (input.intencionAgenda) score += PESOS.intencionAgenda;

  return { score, caliente: score >= UMBRAL_CALIENTE };
}
