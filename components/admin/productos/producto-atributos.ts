/**
 * Definición de campos de `atributos` (jsonb flexible) por clave de tipo de
 * producto. El formulario renderiza estos campos dinámicamente según el tipo
 * seleccionado. Las claves que ya existan en un producto pero no estén aquí se
 * conservan al guardar (no se pierden specs heredadas del catálogo anterior).
 */

export interface AtributoField {
  /** Clave dentro del objeto `atributos`. */
  key: string;
  label: string;
  tipo: "number" | "text";
  /** Sufijo mostrado tras el input (ej. "Wp", "%", "A"). */
  sufijo?: string;
  placeholder?: string;
}

/** Mapa clave-de-tipo → campos de atributos sugeridos. */
export const ATRIBUTOS_POR_TIPO: Record<string, AtributoField[]> = {
  panel: [
    { key: "potencia_wp", label: "Potencia", tipo: "number", sufijo: "Wp" },
    { key: "tecnologia", label: "Tecnología", tipo: "text", placeholder: "Mono PERC, TOPCon…" },
    { key: "eficiencia_pct", label: "Eficiencia", tipo: "number", sufijo: "%" },
    { key: "garantia_anios", label: "Garantía", tipo: "number", sufijo: "años" },
  ],
  inversor: [
    { key: "potencia_kw", label: "Potencia", tipo: "number", sufijo: "kW" },
    { key: "fases", label: "Fases", tipo: "text", placeholder: "Monofásico / Trifásico" },
    { key: "mppt", label: "N.º de MPPT", tipo: "number" },
    { key: "voltaje_v", label: "Voltaje", tipo: "number", sufijo: "V" },
  ],
  estructura: [
    { key: "material", label: "Material", tipo: "text", placeholder: "Aluminio, acero galvanizado…" },
    { key: "tipo_techo", label: "Tipo de techo", tipo: "text", placeholder: "Lámina, concreto…" },
  ],
  material_electrico: [
    { key: "calibre", label: "Calibre", tipo: "text", placeholder: "AWG 10, 6 mm²…" },
    { key: "longitud_m", label: "Longitud", tipo: "number", sufijo: "m" },
  ],
  protecciones: [
    { key: "amperaje_a", label: "Amperaje", tipo: "number", sufijo: "A" },
    { key: "polos", label: "N.º de polos", tipo: "number" },
    { key: "tension_v", label: "Tensión", tipo: "number", sufijo: "V" },
  ],
  otro: [],
};

/** Campos de atributos para una clave de tipo (vacío si no hay definición). */
export function atributosDeTipo(clave: string | undefined): AtributoField[] {
  if (!clave) return [];
  return ATRIBUTOS_POR_TIPO[clave] ?? [];
}
