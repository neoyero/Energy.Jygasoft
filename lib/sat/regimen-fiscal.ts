/**
 * Catálogo oficial del SAT `c_RegimenFiscal` (CFDI 4.0). Módulo puro
 * (sin imports de servidor) → seguro en cliente y servidor.
 * `fisica`/`moral` indican para qué tipo de persona aplica cada régimen.
 * Se almacena la CLAVE (p. ej. "626") en clientes.regimen_fiscal.
 */

export interface RegimenFiscal {
  clave: string;
  descripcion: string;
  fisica: boolean;
  moral: boolean;
}

export const REGIMENES_FISCALES: ReadonlyArray<RegimenFiscal> = [
  { clave: "601", descripcion: "General de Ley Personas Morales", fisica: false, moral: true },
  { clave: "603", descripcion: "Personas Morales con Fines no Lucrativos", fisica: false, moral: true },
  { clave: "605", descripcion: "Sueldos y Salarios e Ingresos Asimilados a Salarios", fisica: true, moral: false },
  { clave: "606", descripcion: "Arrendamiento", fisica: true, moral: false },
  { clave: "607", descripcion: "Régimen de Enajenación o Adquisición de Bienes", fisica: true, moral: false },
  { clave: "608", descripcion: "Demás ingresos", fisica: true, moral: false },
  { clave: "610", descripcion: "Residentes en el Extranjero sin Establecimiento Permanente en México", fisica: true, moral: true },
  { clave: "611", descripcion: "Ingresos por Dividendos (socios y accionistas)", fisica: true, moral: false },
  { clave: "612", descripcion: "Personas Físicas con Actividades Empresariales y Profesionales", fisica: true, moral: false },
  { clave: "614", descripcion: "Ingresos por intereses", fisica: true, moral: false },
  { clave: "615", descripcion: "Régimen de los ingresos por obtención de premios", fisica: true, moral: false },
  { clave: "616", descripcion: "Sin obligaciones fiscales", fisica: true, moral: false },
  { clave: "620", descripcion: "Sociedades Cooperativas de Producción que optan por diferir sus ingresos", fisica: false, moral: true },
  { clave: "621", descripcion: "Incorporación Fiscal", fisica: true, moral: false },
  { clave: "622", descripcion: "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras", fisica: false, moral: true },
  { clave: "623", descripcion: "Opcional para Grupos de Sociedades", fisica: false, moral: true },
  { clave: "624", descripcion: "Coordinados", fisica: false, moral: true },
  { clave: "625", descripcion: "Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas", fisica: true, moral: false },
  { clave: "626", descripcion: "Régimen Simplificado de Confianza (RESICO)", fisica: true, moral: true },
  { clave: "628", descripcion: "Hidrocarburos", fisica: false, moral: true },
  { clave: "629", descripcion: "De los Regímenes Fiscales Preferentes y de las Empresas Multinacionales", fisica: false, moral: true },
  { clave: "630", descripcion: "Enajenación de acciones en bolsa de valores", fisica: false, moral: true },
];

const POR_CLAVE: ReadonlyMap<string, RegimenFiscal> = new Map(
  REGIMENES_FISCALES.map((r) => [r.clave, r]),
);

/** Régimenes aplicables a un tipo de persona (física/moral del enum tipo_persona). */
export function regimenesPara(tipoPersona: string): ReadonlyArray<RegimenFiscal> {
  const esFisica = tipoPersona.startsWith("pf_");
  return REGIMENES_FISCALES.filter((r) => (esFisica ? r.fisica : r.moral));
}

/** Etiqueta legible "clave — descripción"; si no existe la clave, la devuelve cruda. */
export function regimenFiscalLabel(clave: string | null | undefined): string {
  if (!clave) return "—";
  const r = POR_CLAVE.get(clave);
  return r ? `${r.clave} — ${r.descripcion}` : clave;
}
