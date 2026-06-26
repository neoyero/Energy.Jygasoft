/**
 * Lógica pura del pipeline (sin imports de servidor) → segura en cliente y
 * servidor. La probabilidad de una oportunidad la determina su ETAPA (modelo
 * estándar de embudo): mover el deal de etapa actualiza su probabilidad y, por
 * ende, su monto ponderado. Evita estados incoherentes (p. ej. un deal en
 * negociación al 100% por haber pasado antes por ganada).
 */
import { oportunidadEtapa } from "@/db/schema";

export type OportunidadEtapa = (typeof oportunidadEtapa.enumValues)[number];

/** Probabilidad canónica de cierre por etapa (%). */
export const PROBABILIDAD_POR_ETAPA: Record<OportunidadEtapa, number> = {
  calificacion: 10,
  levantamiento: 30,
  propuesta: 50,
  negociacion: 75,
  ganada: 100,
  perdida: 0,
};

/** Etapas cerradas (no cuentan para forecast / monto abierto / abiertas). */
export const ETAPAS_CERRADAS: ReadonlySet<string> = new Set(["ganada", "perdida"]);

/** Probabilidad (%) de una etapa; 0 si la etapa es desconocida. */
export function probabilidadDeEtapa(etapa: string): number {
  return PROBABILIDAD_POR_ETAPA[etapa as OportunidadEtapa] ?? 0;
}

/** Monto ponderado = monto estimado × probabilidad de la etapa / 100. */
export function ponderar(montoEstimado: number, etapa: string): number {
  return (montoEstimado * probabilidadDeEtapa(etapa)) / 100;
}
