/**
 * Control de acceso por rol (RBAC) para je-admin.
 * Módulo PURO (sin imports de servidor) → seguro de usar en cliente y servidor.
 * Matriz módulo → { view, edit }. El scoping por propiedad (un vendedor ve
 * SUS leads) se aplica además en las queries.
 */

export const ROLES = [
  "admin",
  "gerente",
  "vendedor",
  "preventa",
  "ingenieria",
  "lider_cuadrilla",
  "cuadrilla",
  "operaciones",
  "finanzas",
  "marketing",
  "lectura",
] as const;

export type Rol = (typeof ROLES)[number];
export type Accion = "view" | "edit";

export type Modulo =
  | "dashboard"
  | "leads"
  | "oportunidades"
  | "cotizaciones"
  | "clientes"
  | "proyectos"
  | "pagos"
  | "catalogo"
  | "productos"
  | "campanas"
  | "actividades"
  | "documentos"
  | "metricas"
  | "usuarios";

// Grupos de roles para no repetir.
const ALL: Rol[] = [...ROLES];
const COMERCIAL: Rol[] = ["admin", "gerente", "vendedor", "preventa"];
const OPS: Rol[] = ["admin", "gerente", "ingenieria", "operaciones"];
const FIELD: Rol[] = ["lider_cuadrilla", "cuadrilla"];
const FINANZAS: Rol[] = ["admin", "gerente", "finanzas"];
const MKT: Rol[] = ["admin", "gerente", "marketing"];
const MANAGERS: Rol[] = ["admin", "gerente"];

const MATRIX: Record<Modulo, { view: Rol[]; edit: Rol[] }> = {
  dashboard: { view: ALL, edit: [] },
  leads: {
    view: [...COMERCIAL, "marketing", "lectura"],
    edit: COMERCIAL,
  },
  oportunidades: {
    view: [...COMERCIAL, "ingenieria", "finanzas", "lectura"],
    edit: COMERCIAL,
  },
  cotizaciones: {
    view: [...COMERCIAL, "ingenieria", "finanzas", "lectura"],
    edit: [...COMERCIAL, "ingenieria"],
  },
  clientes: {
    view: [...COMERCIAL, "ingenieria", "operaciones", "finanzas", "lectura"],
    edit: COMERCIAL,
  },
  proyectos: {
    view: [...OPS, ...FIELD, "vendedor", "preventa", "finanzas", "lectura"],
    edit: OPS,
  },
  pagos: { view: [...FINANZAS, "lectura"], edit: FINANZAS },
  catalogo: { view: [...ALL], edit: OPS },
  productos: { view: [...ALL], edit: OPS },
  campanas: { view: [...MKT, "finanzas", "lectura"], edit: MKT },
  actividades: {
    view: [...COMERCIAL, ...OPS, ...FIELD, "lectura"],
    edit: [...COMERCIAL, ...OPS, ...FIELD],
  },
  documentos: {
    view: [...OPS, ...COMERCIAL, ...FIELD, "finanzas", "lectura"],
    edit: [...OPS, ...COMERCIAL, ...FIELD],
  },
  metricas: { view: [...MANAGERS, "finanzas", "marketing", "lectura"], edit: MANAGERS },
  usuarios: { view: ["admin"], edit: ["admin"] },
};

export function can(
  rol: string | undefined | null,
  modulo: Modulo,
  accion: Accion = "view",
): boolean {
  if (!rol) return false;
  const entry = MATRIX[modulo];
  if (!entry) return false;
  const list = accion === "edit" ? entry.edit : entry.view;
  return list.includes(rol as Rol);
}

/** Orden de los grupos en el sidebar. */
export const NAV_GROUPS = [
  "General",
  "Comercial",
  "Operaciones",
  "Finanzas",
  "Marketing",
  "Sistema",
] as const;
export type NavGrupo = (typeof NAV_GROUPS)[number];

export interface NavItem {
  href: string;
  label: string;
  modulo: Modulo;
  grupo: NavGrupo;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/je-admin", label: "Dashboard", modulo: "dashboard", grupo: "General" },
  { href: "/je-admin/leads", label: "Leads", modulo: "leads", grupo: "Comercial" },
  { href: "/je-admin/oportunidades", label: "Pipeline", modulo: "oportunidades", grupo: "Comercial" },
  { href: "/je-admin/clientes", label: "Clientes", modulo: "clientes", grupo: "Comercial" },
  { href: "/je-admin/cotizaciones", label: "Cotizaciones", modulo: "cotizaciones", grupo: "Comercial" },
  { href: "/je-admin/actividades", label: "Actividades", modulo: "actividades", grupo: "Comercial" },
  { href: "/je-admin/proyectos", label: "Proyectos", modulo: "proyectos", grupo: "Operaciones" },
  { href: "/je-admin/documentos", label: "Documentos", modulo: "documentos", grupo: "Operaciones" },
  { href: "/je-admin/catalogo", label: "Catálogo", modulo: "catalogo", grupo: "Operaciones" },
  { href: "/je-admin/pagos", label: "Pagos", modulo: "pagos", grupo: "Finanzas" },
  { href: "/je-admin/metricas", label: "Métricas", modulo: "metricas", grupo: "Finanzas" },
  { href: "/je-admin/campanas", label: "Campañas", modulo: "campanas", grupo: "Marketing" },
  { href: "/je-admin/usuarios", label: "Usuarios", modulo: "usuarios", grupo: "Sistema" },
];

/** Items de navegación visibles para un rol. */
export function navFor(rol: string | undefined | null): NavItem[] {
  return NAV_ITEMS.filter((i) => can(rol, i.modulo, "view"));
}
