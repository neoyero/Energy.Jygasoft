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
  | "productos"
  | "paquetes"
  | "marcas"
  | "campanas"
  | "actividades"
  | "documentos"
  | "metricas"
  | "organizacion"
  | "areas"
  | "cargos"
  | "chatwoot"
  | "integraciones"
  | "roles"
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
  productos: { view: [...ALL], edit: OPS },
  // Paquetes: todos los ven/seleccionan; solo admin/gerente crean/editan.
  paquetes: { view: [...ALL], edit: MANAGERS },
  marcas: { view: [...ALL], edit: OPS },
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
  // Organigrama visible para todos (transparencia); estructura la editan managers.
  organizacion: { view: [...ALL], edit: MANAGERS },
  areas: { view: [...ALL], edit: MANAGERS },
  cargos: { view: [...ALL], edit: MANAGERS },
  // Chatwoot (administración de la instancia vía API): admin/gerente.
  chatwoot: { view: MANAGERS, edit: MANAGERS },
  // Integraciones (tokens/keys de servicios): solo admin.
  integraciones: { view: ["admin"], edit: ["admin"] },
  // Roles y permisos (RBAC): solo admin.
  roles: { view: ["admin"], edit: ["admin"] },
  usuarios: { view: ["admin"], edit: ["admin"] },
};

/** Lista de módulos con etiqueta legible (para el editor de permisos por rol). */
export const MODULOS: { modulo: Modulo; label: string }[] = [
  { modulo: "dashboard", label: "Dashboard" },
  { modulo: "leads", label: "Leads" },
  { modulo: "oportunidades", label: "Pipeline / Oportunidades" },
  { modulo: "clientes", label: "Clientes" },
  { modulo: "cotizaciones", label: "Cotizaciones" },
  { modulo: "actividades", label: "Actividades" },
  { modulo: "proyectos", label: "Proyectos" },
  { modulo: "documentos", label: "Documentos" },
  { modulo: "productos", label: "Productos" },
  { modulo: "paquetes", label: "Paquetes" },
  { modulo: "marcas", label: "Marcas" },
  { modulo: "pagos", label: "Pagos" },
  { modulo: "metricas", label: "Métricas" },
  { modulo: "campanas", label: "Campañas" },
  { modulo: "organizacion", label: "Organigrama" },
  { modulo: "areas", label: "Áreas" },
  { modulo: "cargos", label: "Cargos" },
  { modulo: "chatwoot", label: "Chatwoot" },
  { modulo: "integraciones", label: "Integraciones" },
  { modulo: "roles", label: "Roles" },
  { modulo: "usuarios", label: "Usuarios" },
];

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
  "Catálogos",
  "Finanzas",
  "Marketing",
  "Organización",
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
  { href: "/je-admin/productos", label: "Productos", modulo: "productos", grupo: "Operaciones" },
  { href: "/je-admin/paquetes", label: "Paquetes", modulo: "paquetes", grupo: "Operaciones" },
  { href: "/je-admin/marcas", label: "Marcas", modulo: "marcas", grupo: "Catálogos" },
  { href: "/je-admin/areas", label: "Áreas", modulo: "areas", grupo: "Catálogos" },
  { href: "/je-admin/cargos", label: "Cargos", modulo: "cargos", grupo: "Catálogos" },
  { href: "/je-admin/pagos", label: "Pagos", modulo: "pagos", grupo: "Finanzas" },
  { href: "/je-admin/metricas", label: "Métricas", modulo: "metricas", grupo: "Finanzas" },
  { href: "/je-admin/campanas", label: "Campañas", modulo: "campanas", grupo: "Marketing" },
  { href: "/je-admin/organigrama", label: "Organigrama", modulo: "organizacion", grupo: "Organización" },
  { href: "/je-admin/chatwoot", label: "Chatwoot", modulo: "chatwoot", grupo: "Sistema" },
  { href: "/je-admin/integraciones", label: "Integraciones", modulo: "integraciones", grupo: "Sistema" },
  { href: "/je-admin/roles", label: "Roles", modulo: "roles", grupo: "Sistema" },
  { href: "/je-admin/usuarios", label: "Usuarios", modulo: "usuarios", grupo: "Sistema" },
];

/** Items de navegación visibles para un rol. */
export function navFor(rol: string | undefined | null): NavItem[] {
  return NAV_ITEMS.filter((i) => can(rol, i.modulo, "view"));
}
