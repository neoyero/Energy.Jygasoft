import {
  sql,
  desc,
  asc,
  eq,
  and,
  or,
  ilike,
  gte,
  lt,
  isNull,
  count,
  type SQL,
} from "drizzle-orm";
import { db, schema } from "@/db";
import type { Rol } from "@/lib/admin/rbac";

/** Lecturas del panel (read-side). Las mutaciones van por Server Actions. */

export async function getDashboard() {
  const [leadsByEstado, oportByEtapa, totals] = await Promise.all([
    db
      .select({ estado: schema.leads.estado, n: sql<number>`count(*)::int` })
      .from(schema.leads)
      .groupBy(schema.leads.estado),
    db
      .select({ etapa: schema.oportunidades.etapa, n: sql<number>`count(*)::int` })
      .from(schema.oportunidades)
      .groupBy(schema.oportunidades.etapa),
    db
      .select({
        leads: sql<number>`(select count(*) from leads)::int`,
        clientes: sql<number>`(select count(*) from clientes)::int`,
        oportunidades: sql<number>`(select count(*) from oportunidades)::int`,
        proyectos: sql<number>`(select count(*) from proyectos)::int`,
        simulaciones: sql<number>`(select count(*) from calculadora_simulaciones)::int`,
      })
      .from(sql`(select 1) as x`),
  ]);

  return { leadsByEstado, oportByEtapa, totals: totals[0] };
}

export type LeadRecord = typeof schema.leads.$inferSelect;

/** Uso del inmueble (enum uso_inmueble). */
export type UsoInmueble = (typeof schema.usoInmueble.enumValues)[number];

/**
 * Datos editables de un lead (alta manual / edición). Solo campos capturables
 * por una persona; los derivados (score, sizing, inversión, utm…) se calculan
 * o llegan por integración y no se editan desde este formulario. Los numéricos
 * viajan como string (formato numeric de Postgres) o null.
 */
export interface LeadFormData {
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  segmento: "residencial" | "negocio" | null;
  uso: UsoInmueble | null;
  cp: string | null;
  colonia: string | null;
  municipio: string | null;
  estadoMx: string | null;
  consumoKwhMes: string | null;
  reciboMxn: string | null;
  esTitular: boolean | null;
  esPropietario: boolean | null;
  canal: LeadCanal;
  consentimientoDatos: boolean;
  consentimientoMarketing: boolean;
  notas: string | null;
  vendedorId: string | null;
}

export async function getLeads(limit = 200): Promise<LeadRecord[]> {
  return db
    .select()
    .from(schema.leads)
    .orderBy(desc(schema.leads.createdAt))
    .limit(limit);
}

export async function getLead(id: string) {
  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, id))
    .limit(1);
  return lead ?? null;
}

export async function getLeadTimeline(id: string) {
  return db
    .select()
    .from(schema.eventos)
    .where(
      sql`${schema.eventos.entidadTipo} = 'lead' AND ${schema.eventos.entidadId} = ${id}`,
    )
    .orderBy(desc(schema.eventos.createdAt))
    .limit(100);
}

export async function getOportunidades() {
  return db
    .select()
    .from(schema.oportunidades)
    .orderBy(desc(schema.oportunidades.createdAt))
    .limit(200);
}

export async function getClientes() {
  return db
    .select()
    .from(schema.clientes)
    .orderBy(desc(schema.clientes.createdAt))
    .limit(200);
}

export async function getCatalogo() {
  return db
    .select()
    .from(schema.catalogoEquipos)
    .orderBy(desc(schema.catalogoEquipos.createdAt))
    .limit(200);
}

export async function getUsuarios() {
  return db
    .select({
      id: schema.usuarios.id,
      nombre: schema.usuarios.nombre,
      email: schema.usuarios.email,
      rol: schema.usuarios.rol,
      telefono: schema.usuarios.telefono,
      activo: schema.usuarios.activo,
      ultimoAcceso: schema.usuarios.ultimoAcceso,
    })
    .from(schema.usuarios)
    .orderBy(asc(schema.usuarios.nombre))
    .limit(500);
}

/* ─────────────────────────────────────────────────────────────────────────
 * DASHBOARD je-admin — capa de datos
 *
 * Convenciones SQL:
 *  - Montos: coalesce(sum(col),0)::float8  -> number JS.
 *  - Conteos: count(*)::int.
 *  - ids bigint: id::text (evita perdida de precision en JS).
 *  - Scoping: roles 'vendedor' y 'preventa' ven SOLO sus entidades
 *    (filtro por vendedor_id = userId). El resto ve global.
 *  - db.execute(sql`…`) devuelve QueryResult; las filas estan en `.rows` y se
 *    tipan como unknown y se estrechan con helpers de narrowing (sin `any`).
 * ──────────────────────────────────────────────────────────────────────── */

export interface DashboardScope {
  rol: Rol;
  userId: string;
}

/** true para roles con vista acotada a sus propias entidades. */
export function isScoped(rol: Rol): boolean {
  return rol === "vendedor" || rol === "preventa";
}

/** Orden canonico de etapas del pipeline (para ordenar/visualizar). */
export const ETAPA_ORDER = [
  "calificacion",
  "levantamiento",
  "propuesta",
  "negociacion",
  "ganada",
  "perdida",
] as const;

/** Orden canonico de fases de proyecto. */
export const FASE_ORDER = [
  "input_comercial",
  "inicio",
  "planeacion",
  "ejecucion",
  "seguimiento",
  "cierre",
  "garantia",
] as const;

export interface KpiMetric {
  actual: number;
  previo: number;
  deltaPct: number | null;
}

export interface DashboardKpis {
  leadsNuevos: KpiMetric;
  oportAbiertas: KpiMetric;
  pipelinePonderado: KpiMetric;
  proyectosActivos: KpiMetric;
  cobranzaPendiente: KpiMetric;
}

export interface LeadsSeriePoint {
  dia: string;
  n: number;
}

export interface PipelineEtapaRow {
  etapa: string;
  conteo: number;
  monto: number;
}

export interface ProyectoFaseRow {
  fase: string;
  conteo: number;
  total: number;
}

export interface MiActividadRow {
  id: string;
  tipo: string;
  titulo: string;
  estado: string;
  venceAt: string | null;
  entidadTipo: string | null;
  entidadId: string | null;
  vencida: boolean;
}

export interface EventoRow {
  id: string;
  entidadTipo: string;
  entidadId: string;
  tipo: string;
  descripcion: string | null;
  actor: string;
  createdAt: string;
}

export interface DashboardData {
  kpis: DashboardKpis;
  leadsSerie: LeadsSeriePoint[];
  pipeline: PipelineEtapaRow[];
  proyectosFase: ProyectoFaseRow[];
  misActividades: MiActividadRow[];
  actividadReciente: EventoRow[];
}

/* ── Helpers de narrowing para filas crudas (db.execute -> unknown) ──────── */

type Row = Record<string, unknown>;

function asRows(result: { rows: unknown[] }): Row[] {
  return result.rows as Row[];
}

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function strOrNull(v: unknown): string | null {
  return v == null ? null : str(v);
}

function bool(v: unknown): boolean {
  return v === true || v === "t" || v === "true";
}

/** deltaPct: null si no hay base previa; si no, ((actual-previo)/previo)*100 a 1 decimal. */
function deltaPct(actual: number, previo: number): number | null {
  if (previo === 0) return null;
  return Math.round(((actual - previo) / previo) * 1000) / 10;
}

/**
 * KPIs del dashboard.
 *
 * Ventanas temporales:
 *  - actual = created_at >= now() - interval '30 days'
 *  - previa = created_at en [60d, 30d)  (mes anterior)
 *
 * Para `leadsNuevos` el valor "actual" del KPI ES el flujo de altas en la
 * ventana (leads creados ultimos 30d) y el delta compara contra la ventana
 * previa.
 *
 * Para `oportAbiertas`, `proyectosActivos` y `cobranzaPendiente` el valor
 * "actual" del KPI es el STOCK vigente (no el flujo). Como un stock no tiene
 * "ventana", usamos las ALTAS en cada ventana (creadas ult. 30d vs [60,30)d)
 * SOLO como proxy del delta/tendencia. Documentado por columna abajo.
 *
 * `pipelinePonderado` actual = sum(monto_estimado * probabilidad/100) sobre
 * oportunidades abiertas; el proxy de delta usa la misma ponderacion sobre las
 * altas de cada ventana.
 */
export async function getDashboardKpis(
  scope: DashboardScope,
): Promise<DashboardKpis> {
  const scoped = isScoped(scope.rol);
  const uid = scope.userId;

  // Filtros de propiedad por tabla (vacio = sin filtro para roles globales).
  const fLead = scoped ? sql`AND vendedor_id = ${uid}` : sql``;
  const fOport = scoped ? sql`AND vendedor_id = ${uid}` : sql``;
  const fProy = scoped ? sql`AND vendedor_id = ${uid}` : sql``;
  // pagos no tiene vendedor_id -> se acota via el proyecto dueño.
  const fPago = scoped
    ? sql`AND EXISTS (SELECT 1 FROM proyectos pr WHERE pr.id = p.proyecto_id AND pr.vendedor_id = ${uid})`
    : sql``;

  const result = await db.execute(sql`
    SELECT
      -- leadsNuevos: FLUJO de altas (actual vs ventana previa).
      (SELECT count(*) FROM leads
        WHERE created_at >= now() - interval '30 days' ${fLead})::int AS leads_actual,
      (SELECT count(*) FROM leads
        WHERE created_at >= now() - interval '60 days'
          AND created_at <  now() - interval '30 days' ${fLead})::int AS leads_previo,

      -- oportAbiertas: STOCK vigente (etapa NOT IN ganada/perdida).
      (SELECT count(*) FROM oportunidades
        WHERE etapa NOT IN ('ganada','perdida') ${fOport})::int AS oport_actual,
      -- proxy delta: altas por ventana.
      (SELECT count(*) FROM oportunidades
        WHERE created_at >= now() - interval '30 days' ${fOport})::int AS oport_prev_cur,
      (SELECT count(*) FROM oportunidades
        WHERE created_at >= now() - interval '60 days'
          AND created_at <  now() - interval '30 days' ${fOport})::int AS oport_prev_old,

      -- pipelinePonderado: STOCK ponderado sobre abiertas.
      (SELECT coalesce(sum(coalesce(monto_estimado,0) * coalesce(probabilidad,0) / 100.0),0)::float8
        FROM oportunidades
        WHERE etapa NOT IN ('ganada','perdida') ${fOport}) AS pipe_actual,
      -- proxy delta: ponderado de altas por ventana.
      (SELECT coalesce(sum(coalesce(monto_estimado,0) * coalesce(probabilidad,0) / 100.0),0)::float8
        FROM oportunidades
        WHERE created_at >= now() - interval '30 days' ${fOport}) AS pipe_prev_cur,
      (SELECT coalesce(sum(coalesce(monto_estimado,0) * coalesce(probabilidad,0) / 100.0),0)::float8
        FROM oportunidades
        WHERE created_at >= now() - interval '60 days'
          AND created_at <  now() - interval '30 days' ${fOport}) AS pipe_prev_old,

      -- proyectosActivos: STOCK vigente (fase NOT IN cierre/garantia).
      (SELECT count(*) FROM proyectos
        WHERE fase NOT IN ('cierre','garantia') ${fProy})::int AS proy_actual,
      (SELECT count(*) FROM proyectos
        WHERE created_at >= now() - interval '30 days' ${fProy})::int AS proy_prev_cur,
      (SELECT count(*) FROM proyectos
        WHERE created_at >= now() - interval '60 days'
          AND created_at <  now() - interval '30 days' ${fProy})::int AS proy_prev_old,

      -- cobranzaPendiente: STOCK de monto por cobrar (estado programado/vencido).
      (SELECT coalesce(sum(monto),0)::float8 FROM pagos p
        WHERE estado IN ('programado','vencido') ${fPago}) AS cob_actual,
      (SELECT coalesce(sum(monto),0)::float8 FROM pagos p
        WHERE estado IN ('programado','vencido')
          AND created_at >= now() - interval '30 days' ${fPago}) AS cob_prev_cur,
      (SELECT coalesce(sum(monto),0)::float8 FROM pagos p
        WHERE estado IN ('programado','vencido')
          AND created_at >= now() - interval '60 days'
          AND created_at <  now() - interval '30 days' ${fPago}) AS cob_prev_old
  `);

  const r = asRows(result)[0] ?? {};

  const leadsActual = num(r.leads_actual);
  const leadsPrevio = num(r.leads_previo);

  const oportActual = num(r.oport_actual);
  const oportPrevCur = num(r.oport_prev_cur);
  const oportPrevOld = num(r.oport_prev_old);

  const pipeActual = num(r.pipe_actual);
  const pipePrevCur = num(r.pipe_prev_cur);
  const pipePrevOld = num(r.pipe_prev_old);

  const proyActual = num(r.proy_actual);
  const proyPrevCur = num(r.proy_prev_cur);
  const proyPrevOld = num(r.proy_prev_old);

  const cobActual = num(r.cob_actual);
  const cobPrevCur = num(r.cob_prev_cur);
  const cobPrevOld = num(r.cob_prev_old);

  return {
    leadsNuevos: {
      actual: leadsActual,
      previo: leadsPrevio,
      deltaPct: deltaPct(leadsActual, leadsPrevio),
    },
    // El stock es el valor mostrado; el delta usa las altas como proxy.
    oportAbiertas: {
      actual: oportActual,
      previo: oportPrevOld,
      deltaPct: deltaPct(oportPrevCur, oportPrevOld),
    },
    pipelinePonderado: {
      actual: pipeActual,
      previo: pipePrevOld,
      deltaPct: deltaPct(pipePrevCur, pipePrevOld),
    },
    proyectosActivos: {
      actual: proyActual,
      previo: proyPrevOld,
      deltaPct: deltaPct(proyPrevCur, proyPrevOld),
    },
    cobranzaPendiente: {
      actual: cobActual,
      previo: cobPrevOld,
      deltaPct: deltaPct(cobPrevCur, cobPrevOld),
    },
  };
}

/**
 * Serie de leads por dia de los ultimos 30 dias (incluye hoy). Rellena con 0
 * los dias sin leads via generate_series LEFT JOIN. `dia` en 'YYYY-MM-DD'.
 */
export async function getLeadsSerie30d(
  scope: DashboardScope,
): Promise<LeadsSeriePoint[]> {
  const fLead = isScoped(scope.rol)
    ? sql`AND l.vendedor_id = ${scope.userId}`
    : sql``;

  const result = await db.execute(sql`
    SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia,
           count(l.id)::int AS n
    FROM generate_series(current_date - 29, current_date, interval '1 day') AS d(dia)
    LEFT JOIN leads l
      ON date(l.created_at) = d.dia ${fLead}
    GROUP BY d.dia
    ORDER BY d.dia ASC
  `);

  return asRows(result).map((row) => ({
    dia: str(row.dia),
    n: num(row.n),
  }));
}

/**
 * Pipeline agrupado por etapa: conteo + monto estimado total. Devuelve las
 * filas en el orden canonico ETAPA_ORDER (etapas sin datos se omiten; las
 * presentes se reordenan).
 */
export async function getPipelinePorEtapa(
  scope: DashboardScope,
): Promise<PipelineEtapaRow[]> {
  const fOport = isScoped(scope.rol)
    ? sql`WHERE vendedor_id = ${scope.userId}`
    : sql``;

  const result = await db.execute(sql`
    SELECT etapa::text AS etapa,
           count(*)::int AS conteo,
           coalesce(sum(coalesce(monto_estimado,0)),0)::float8 AS monto
    FROM oportunidades
    ${fOport}
    GROUP BY etapa
  `);

  const rows = asRows(result).map((row) => ({
    etapa: str(row.etapa),
    conteo: num(row.conteo),
    monto: num(row.monto),
  }));

  return sortByOrder(rows, (r) => r.etapa, ETAPA_ORDER);
}

/**
 * Proyectos agrupados por fase: conteo + total con IVA. Ordenado por
 * FASE_ORDER.
 */
export async function getProyectosPorFase(
  scope: DashboardScope,
): Promise<ProyectoFaseRow[]> {
  const fProy = isScoped(scope.rol)
    ? sql`WHERE vendedor_id = ${scope.userId}`
    : sql``;

  const result = await db.execute(sql`
    SELECT fase::text AS fase,
           count(*)::int AS conteo,
           coalesce(sum(coalesce(total_con_iva,0)),0)::float8 AS total
    FROM proyectos
    ${fProy}
    GROUP BY fase
  `);

  const rows = asRows(result).map((row) => ({
    fase: str(row.fase),
    conteo: num(row.conteo),
    total: num(row.total),
  }));

  return sortByOrder(rows, (r) => r.fase, FASE_ORDER);
}

/**
 * Actividades pendientes asignadas a un usuario, ordenadas por vencimiento
 * (nulls al final). `vencida` = vence_at no nulo y ya pasado. No depende del
 * scope de rol: siempre son las del usuario indicado.
 */
export async function getMisActividadesPendientes(
  userId: string,
  limit = 8,
): Promise<MiActividadRow[]> {
  const result = await db.execute(sql`
    SELECT id::text AS id,
           tipo::text AS tipo,
           titulo,
           estado::text AS estado,
           vence_at AS vence_at,
           entidad_tipo::text AS entidad_tipo,
           entidad_id::text AS entidad_id,
           (vence_at IS NOT NULL AND vence_at < now()) AS vencida
    FROM actividades
    WHERE asignado_a = ${userId}
      AND estado = 'pendiente'
    ORDER BY vence_at ASC NULLS LAST
    LIMIT ${limit}
  `);

  return asRows(result).map((row) => ({
    id: str(row.id),
    tipo: str(row.tipo),
    titulo: str(row.titulo),
    estado: str(row.estado),
    venceAt: strOrNull(row.vence_at),
    entidadTipo: strOrNull(row.entidad_tipo),
    entidadId: strOrNull(row.entidad_id),
    vencida: bool(row.vencida),
  }));
}

/**
 * Feed de eventos recientes (timeline global).
 *
 * Scoping: para roles acotados (vendedor/preventa) el feed se filtra a eventos
 * de entidades que son del usuario. Como `eventos` no tiene vendedor_id, se
 * resuelve por (entidad_tipo, entidad_id) con un EXISTS contra la tabla dueña
 * de cada tipo. Solo se acotan los tipos con dueño comercial conocido
 * (lead/oportunidad/proyecto vía vendedor_id, y cliente vía sus oportunidades);
 * eventos de otros tipos quedan fuera del feed de un rol acotado. Para roles
 * globales se devuelve el feed completo sin filtro.
 */
export async function getActividadReciente(
  scope: DashboardScope,
  limit = 10,
): Promise<EventoRow[]> {
  const uid = scope.userId;

  // Filtro de propiedad para roles acotados. Un evento es "del vendedor" si su
  // entidad le pertenece. Se cubre lead/oportunidad/proyecto directamente y
  // cliente a traves de tener al menos una oportunidad suya.
  const ownership = isScoped(scope.rol)
    ? sql`WHERE (
        (e.entidad_tipo = 'lead'        AND EXISTS (SELECT 1 FROM leads x         WHERE x.id = e.entidad_id AND x.vendedor_id = ${uid}))
     OR (e.entidad_tipo = 'oportunidad' AND EXISTS (SELECT 1 FROM oportunidades x WHERE x.id = e.entidad_id AND x.vendedor_id = ${uid}))
     OR (e.entidad_tipo = 'proyecto'    AND EXISTS (SELECT 1 FROM proyectos x     WHERE x.id = e.entidad_id AND x.vendedor_id = ${uid}))
     OR (e.entidad_tipo = 'cliente'     AND EXISTS (SELECT 1 FROM oportunidades x WHERE x.cliente_id = e.entidad_id AND x.vendedor_id = ${uid}))
      )`
    : sql``;

  const result = await db.execute(sql`
    SELECT e.id::text AS id,
           e.entidad_tipo::text AS entidad_tipo,
           e.entidad_id::text AS entidad_id,
           e.tipo,
           e.descripcion,
           e.actor,
           e.created_at AS created_at
    FROM eventos e
    ${ownership}
    ORDER BY e.created_at DESC
    LIMIT ${limit}
  `);

  return asRows(result).map((row) => ({
    id: str(row.id),
    entidadTipo: str(row.entidad_tipo),
    entidadId: str(row.entidad_id),
    tipo: str(row.tipo),
    descripcion: strOrNull(row.descripcion),
    actor: str(row.actor),
    createdAt: str(row.created_at),
  }));
}

/** Agrega todas las lecturas del dashboard en paralelo. */
export async function getDashboardData(
  scope: DashboardScope,
): Promise<DashboardData> {
  const [
    kpis,
    leadsSerie,
    pipeline,
    proyectosFase,
    misActividades,
    actividadReciente,
  ] = await Promise.all([
    getDashboardKpis(scope),
    getLeadsSerie30d(scope),
    getPipelinePorEtapa(scope),
    getProyectosPorFase(scope),
    getMisActividadesPendientes(scope.userId),
    getActividadReciente(scope),
  ]);

  return {
    kpis,
    leadsSerie,
    pipeline,
    proyectosFase,
    misActividades,
    actividadReciente,
  };
}

/**
 * Ordena filas segun el indice de su clave en `order`. Las claves presentes en
 * `order` van primero (en ese orden); claves desconocidas quedan al final
 * preservando su orden relativo.
 */
function sortByOrder<T>(
  rows: T[],
  key: (row: T) => string,
  order: readonly string[],
): T[] {
  const rank = new Map(order.map((value, index) => [value, index]));
  return [...rows].sort((a, b) => {
    const ra = rank.get(key(a)) ?? order.length;
    const rb = rank.get(key(b)) ?? order.length;
    return ra - rb;
  });
}

/* ─────────────────────────────────────────────────────────────────────────
 * LEADS / PIPELINE (D3) — capa de datos
 *
 * Estilo: query builder de Drizzle (eq/ilike/and/or/gte/lte/lt/isNull/count) +
 * leftJoin. Los numeric (mode:'string') se convierten con Number(...). Scoping
 * por rol vía isScoped(): vendedor/preventa ven SOLO sus entidades.
 * ──────────────────────────────────────────────────────────────────────── */

export type LeadEstado = (typeof schema.leadEstado.enumValues)[number];
export type LeadCanal = (typeof schema.leadCanal.enumValues)[number];

export interface LeadsFiltros {
  estado?: LeadEstado;
  canal?: LeadCanal;
  vendedorId?: string | null;
  scoreMin?: number;
  busqueda?: string;
  desde?: string;
  hasta?: string;
}

export interface LeadRow {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  segmento: string | null;
  canal: string | null;
  score: number;
  estado: string;
  vendedorId: string | null;
  vendedorNombre: string | null;
  municipio: string | null;
  estadoMx: string | null;
  consumoKwhMes: number | null;
  reciboMxn: number | null;
  sizingKwp: number | null;
  createdAt: string;
}

export interface LeadsResumen {
  porEstado: Array<{ estado: string; n: number }>;
  total: number;
}

export interface VendedorOption {
  id: string;
  nombre: string;
  rol: string;
}

export interface OportunidadRow {
  id: string;
  nombre: string;
  etapa: string;
  clienteId: string | null;
  clienteNombre: string | null;
  leadId: string | null;
  leadNombre: string | null;
  vendedorId: string | null;
  vendedorNombre: string | null;
  capacidadKwp: number | null;
  montoEstimado: number;
  probabilidad: number;
  montoPonderado: number;
  fechaCierreEstimada: string | null;
  motivoPerdida: string | null;
  createdAt: string;
}

export interface PipelineForecastEtapa {
  etapa: string;
  conteo: number;
  monto: number;
  ponderado: number;
}

export interface PipelineData {
  oportunidades: OportunidadRow[];
  forecast: PipelineForecastEtapa[];
  forecastTotal: number;
  montoTotalAbierto: number;
}

/** numeric(mode:'string') -> number | null. */
function numOrNull(v: string | null): number | null {
  if (v == null) return null;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : null;
}

/** numeric(mode:'string') con default 0 -> number. */
function numOrZero(v: string | null): number {
  return numOrNull(v) ?? 0;
}

const LEAD_QUERY_LIMIT = 500;
const OPORTUNIDAD_QUERY_LIMIT = 500;

/**
 * Lista de leads filtrada. Scoping por vendedor para roles acotados. Filtros:
 * estado, canal, vendedorId (null = sin asignar / isNull), scoreMin (gte),
 * busqueda (ilike nombre/email/telefono), desde (gte) y hasta (lt) sobre
 * created_at. Incluye nombre del vendedor vía leftJoin a usuarios.
 */
export async function getLeadsFiltrados(
  scope: DashboardScope,
  filtros: LeadsFiltros = {},
): Promise<LeadRow[]> {
  const conds: SQL[] = [];

  if (isScoped(scope.rol)) {
    conds.push(eq(schema.leads.vendedorId, scope.userId));
  }

  if (filtros.estado) conds.push(eq(schema.leads.estado, filtros.estado));
  if (filtros.canal) conds.push(eq(schema.leads.canal, filtros.canal));

  if (filtros.vendedorId !== undefined) {
    conds.push(
      filtros.vendedorId === null
        ? isNull(schema.leads.vendedorId)
        : eq(schema.leads.vendedorId, filtros.vendedorId),
    );
  }

  if (typeof filtros.scoreMin === "number") {
    conds.push(gte(schema.leads.score, filtros.scoreMin));
  }

  if (filtros.desde) conds.push(gte(schema.leads.createdAt, filtros.desde));
  if (filtros.hasta) conds.push(lt(schema.leads.createdAt, filtros.hasta));

  const q = filtros.busqueda?.trim();
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    const busquedaCond = or(
      ilike(schema.leads.nombre, like),
      ilike(schema.leads.email, like),
      ilike(schema.leads.telefono, like),
    );
    if (busquedaCond) conds.push(busquedaCond);
  }

  const rows = await db
    .select({
      id: schema.leads.id,
      nombre: schema.leads.nombre,
      email: schema.leads.email,
      telefono: schema.leads.telefono,
      segmento: schema.leads.segmento,
      canal: schema.leads.canal,
      score: schema.leads.score,
      estado: schema.leads.estado,
      vendedorId: schema.leads.vendedorId,
      vendedorNombre: schema.usuarios.nombre,
      municipio: schema.leads.municipio,
      estadoMx: schema.leads.estadoMx,
      consumoKwhMes: schema.leads.consumoKwhMes,
      reciboMxn: schema.leads.reciboMxn,
      sizingKwp: schema.leads.sizingKwp,
      createdAt: schema.leads.createdAt,
    })
    .from(schema.leads)
    .leftJoin(schema.usuarios, eq(schema.leads.vendedorId, schema.usuarios.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.leads.createdAt))
    .limit(LEAD_QUERY_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    telefono: row.telefono,
    segmento: row.segmento,
    canal: row.canal,
    score: row.score,
    estado: row.estado,
    vendedorId: row.vendedorId,
    vendedorNombre: row.vendedorNombre,
    municipio: row.municipio,
    estadoMx: row.estadoMx,
    consumoKwhMes: numOrNull(row.consumoKwhMes),
    reciboMxn: numOrNull(row.reciboMxn),
    sizingKwp: numOrNull(row.sizingKwp),
    createdAt: row.createdAt,
  }));
}

/**
 * Resumen de leads por estado (conteo). Mismo scoping que getLeadsFiltrados.
 * Rellena con 0 las 8 claves del enum leadEstado y respeta su orden canónico.
 */
export async function getLeadsResumen(
  scope: DashboardScope,
): Promise<LeadsResumen> {
  const scopeCond = isScoped(scope.rol)
    ? eq(schema.leads.vendedorId, scope.userId)
    : undefined;

  const rows = await db
    .select({ estado: schema.leads.estado, n: count() })
    .from(schema.leads)
    .where(scopeCond)
    .groupBy(schema.leads.estado);

  const conteos = new Map<string, number>(
    rows.map((row) => [row.estado, Number(row.n)]),
  );

  const porEstado = schema.leadEstado.enumValues.map((estado) => ({
    estado,
    n: conteos.get(estado) ?? 0,
  }));

  const total = porEstado.reduce((acc, item) => acc + item.n, 0);

  return { porEstado, total };
}

/**
 * Opciones de vendedores activos con rol comercial (admin/gerente/vendedor/
 * preventa), ordenadas por nombre. Para selects de asignación.
 */
export async function getVendedores(): Promise<VendedorOption[]> {
  const rows = await db
    .select({
      id: schema.usuarios.id,
      nombre: schema.usuarios.nombre,
      rol: schema.usuarios.rol,
    })
    .from(schema.usuarios)
    .where(
      and(
        eq(schema.usuarios.activo, true),
        or(
          eq(schema.usuarios.rol, "admin"),
          eq(schema.usuarios.rol, "gerente"),
          eq(schema.usuarios.rol, "vendedor"),
          eq(schema.usuarios.rol, "preventa"),
        ),
      ),
    )
    .orderBy(asc(schema.usuarios.nombre));

  return rows.map((row) => ({ id: row.id, nombre: row.nombre, rol: row.rol }));
}

/** Fila de asesor para la gestión en el panel (con el usuario vinculado). */
export interface AsesorRow {
  id: string;
  usuarioId: string | null;
  nombre: string;
  chatwootAgentId: number;
  msEmail: string | null;
  telefono: string | null;
  zonas: string[];
  segmentos: string[];
  activo: boolean;
  asignaciones: number;
  usuarioNombre: string | null;
  usuarioEmail: string | null;
}

/**
 * Usuarios asignables a un lead = asesores ACTIVOS vinculados a un usuario
 * ACTIVO. El `id` devuelto es el usuario_id (lo que se guarda en
 * leads.vendedor_id). Esta es la única fuente de "asignables" para leads.
 */
export async function getAsesoresAsignables(): Promise<VendedorOption[]> {
  const rows = await db
    .select({
      id: schema.asesores.usuarioId,
      nombre: schema.usuarios.nombre,
      rol: schema.usuarios.rol,
    })
    .from(schema.asesores)
    .innerJoin(
      schema.usuarios,
      eq(schema.asesores.usuarioId, schema.usuarios.id),
    )
    .where(
      and(
        eq(schema.asesores.activo, true),
        eq(schema.usuarios.activo, true),
      ),
    )
    .orderBy(asc(schema.usuarios.nombre));

  return rows
    .filter((r) => r.id !== null)
    .map((r) => ({ id: r.id as string, nombre: r.nombre, rol: r.rol }));
}

/** Lista completa de asesores para administración (con el usuario vinculado). */
export async function getAsesores(): Promise<AsesorRow[]> {
  return db
    .select({
      id: schema.asesores.id,
      usuarioId: schema.asesores.usuarioId,
      nombre: schema.asesores.nombre,
      chatwootAgentId: schema.asesores.chatwootAgentId,
      msEmail: schema.asesores.msEmail,
      telefono: schema.asesores.telefono,
      zonas: schema.asesores.zonas,
      segmentos: schema.asesores.segmentos,
      activo: schema.asesores.activo,
      asignaciones: schema.asesores.asignaciones,
      usuarioNombre: schema.usuarios.nombre,
      usuarioEmail: schema.usuarios.email,
    })
    .from(schema.asesores)
    .leftJoin(schema.usuarios, eq(schema.asesores.usuarioId, schema.usuarios.id))
    .orderBy(asc(schema.asesores.nombre));
}

/**
 * Pipeline completo: oportunidades (con nombres de cliente/lead/vendedor vía
 * leftJoin) + forecast por etapa. Scoping por vendedor para roles acotados.
 * `montoPonderado = montoEstimado * probabilidad / 100` (en JS). El forecast
 * total y el monto total abierto suman SOLO etapas distintas de ganada/perdida.
 */
export async function getOportunidadesPipeline(
  scope: DashboardScope,
): Promise<PipelineData> {
  const leadAlias = schema.leads;

  const scopeCond = isScoped(scope.rol)
    ? eq(schema.oportunidades.vendedorId, scope.userId)
    : undefined;

  const rows = await db
    .select({
      id: schema.oportunidades.id,
      nombre: schema.oportunidades.nombre,
      etapa: schema.oportunidades.etapa,
      clienteId: schema.oportunidades.clienteId,
      clienteNombre: schema.clientes.nombre,
      leadId: schema.oportunidades.leadId,
      leadNombre: leadAlias.nombre,
      vendedorId: schema.oportunidades.vendedorId,
      vendedorNombre: schema.usuarios.nombre,
      capacidadKwp: schema.oportunidades.capacidadKwp,
      montoEstimado: schema.oportunidades.montoEstimado,
      probabilidad: schema.oportunidades.probabilidad,
      fechaCierreEstimada: schema.oportunidades.fechaCierreEstimada,
      motivoPerdida: schema.oportunidades.motivoPerdida,
      createdAt: schema.oportunidades.createdAt,
    })
    .from(schema.oportunidades)
    .leftJoin(
      schema.clientes,
      eq(schema.oportunidades.clienteId, schema.clientes.id),
    )
    .leftJoin(leadAlias, eq(schema.oportunidades.leadId, leadAlias.id))
    .leftJoin(
      schema.usuarios,
      eq(schema.oportunidades.vendedorId, schema.usuarios.id),
    )
    .where(scopeCond)
    .orderBy(desc(schema.oportunidades.createdAt))
    .limit(OPORTUNIDAD_QUERY_LIMIT);

  const oportunidades: OportunidadRow[] = rows.map((row) => {
    const montoEstimado = numOrZero(row.montoEstimado);
    const probabilidad = row.probabilidad ?? 30;
    const montoPonderado = (montoEstimado * probabilidad) / 100;
    return {
      id: row.id,
      nombre: row.nombre,
      etapa: row.etapa,
      clienteId: row.clienteId,
      clienteNombre: row.clienteNombre,
      leadId: row.leadId,
      leadNombre: row.leadNombre,
      vendedorId: row.vendedorId,
      vendedorNombre: row.vendedorNombre,
      capacidadKwp: numOrNull(row.capacidadKwp),
      montoEstimado,
      probabilidad,
      montoPonderado,
      fechaCierreEstimada: row.fechaCierreEstimada,
      motivoPerdida: row.motivoPerdida,
      createdAt: row.createdAt,
    };
  });

  const porEtapa = new Map<string, PipelineForecastEtapa>();
  for (const op of oportunidades) {
    const acc = porEtapa.get(op.etapa) ?? {
      etapa: op.etapa,
      conteo: 0,
      monto: 0,
      ponderado: 0,
    };
    porEtapa.set(op.etapa, {
      etapa: op.etapa,
      conteo: acc.conteo + 1,
      monto: acc.monto + op.montoEstimado,
      ponderado: acc.ponderado + op.montoPonderado,
    });
  }

  const forecast = sortByOrder(
    [...porEtapa.values()],
    (r) => r.etapa,
    ETAPA_ORDER,
  );

  const cerradas = new Set<string>(["ganada", "perdida"]);
  const abiertas = forecast.filter((f) => !cerradas.has(f.etapa));
  const forecastTotal = abiertas.reduce((acc, f) => acc + f.ponderado, 0);
  const montoTotalAbierto = abiertas.reduce((acc, f) => acc + f.monto, 0);

  return { oportunidades, forecast, forecastTotal, montoTotalAbierto };
}

/* ─────────────────────────────────────────────────────────────────────────
 * CLIENTES / COTIZACIONES (D4) — capa de datos
 *
 * Estilo: query builder de Drizzle (eq/ilike/and/or/isNull) + leftJoin. Los
 * numeric (mode:'string') se convierten con numOrNull/numOrZero. Los id bigint
 * (cotizacion_items) se serializan a string. Scoping por rol vía isScoped():
 * vendedor/preventa ven SOLO sus clientes/cotizaciones (vendedor_id = userId).
 * ──────────────────────────────────────────────────────────────────────── */

export type TipoPersona = (typeof schema.tipoPersona.enumValues)[number];
export type CotizacionEstado =
  (typeof schema.cotizacionEstado.enumValues)[number];
export type EsquemaCfe = (typeof schema.esquemaCfe.enumValues)[number];
export type NivelTension = (typeof schema.nivelTension.enumValues)[number];
export type EquipoTipo = (typeof schema.equipoTipo.enumValues)[number];

export interface ClientesFiltros {
  tipoPersona?: TipoPersona;
  vendedorId?: string | null;
  busqueda?: string;
}

export interface ClienteRow {
  id: string;
  tipoPersona: TipoPersona;
  nombre: string;
  rfc: string | null;
  email: string | null;
  telefono: string | null;
  municipio: string | null;
  estadoMx: string | null;
  vendedorId: string | null;
  vendedorNombre: string | null;
  createdAt: string;
}

export interface ContactoRow {
  id: string;
  nombre: string;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  esPrincipal: boolean;
}

export interface ClienteOportunidadRow {
  id: string;
  nombre: string;
  etapa: string;
  montoEstimado: number;
  probabilidad: number;
  createdAt: string;
}

export interface ClienteCotizacionRow {
  id: string;
  folio: string | null;
  version: number;
  estado: CotizacionEstado;
  total: number;
  validaHasta: string | null;
  createdAt: string;
}

export interface ClienteProyectoRow {
  id: string;
  folio: string | null;
  fase: string;
  totalConIva: number | null;
}

export interface ClienteDocumentoRow {
  id: string;
  tipo: string;
  nombre: string;
  url: string;
  createdAt: string;
}

export interface ClienteDetalle {
  cliente: typeof schema.clientes.$inferSelect;
  vendedorNombre: string | null;
  contactos: ContactoRow[];
  oportunidades: ClienteOportunidadRow[];
  cotizaciones: ClienteCotizacionRow[];
  proyectos: ClienteProyectoRow[];
  documentos: ClienteDocumentoRow[];
  timeline: EventoRow[];
}

export interface CotizacionesFiltros {
  estado?: CotizacionEstado;
  clienteId?: string;
  vendedorId?: string | null;
  busqueda?: string;
}

export interface CotizacionRow {
  id: string;
  folio: string | null;
  version: number;
  clienteId: string | null;
  clienteNombre: string | null;
  vendedorId: string | null;
  vendedorNombre: string | null;
  total: number;
  estado: CotizacionEstado;
  validaHasta: string | null;
  createdAt: string;
}

export interface CotizacionItemRow {
  id: string;
  equipoId: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  importe: number;
  equipoMarca: string | null;
  equipoModelo: string | null;
}

export interface CotizacionDetalleCabecera {
  id: string;
  oportunidadId: string | null;
  clienteId: string | null;
  vendedorId: string | null;
  folio: string | null;
  version: number;
  capacidadKwp: number | null;
  paneles: number | null;
  inversor: string | null;
  subtotal: number;
  iva: number;
  total: number;
  moneda: string;
  produccionAnualKwh: number | null;
  ahorroAnualMxn: number | null;
  paybackAnios: number | null;
  esquema: EsquemaCfe | null;
  estado: CotizacionEstado;
  validaHasta: string | null;
  pdfUrl: string | null;
  createdAt: string;
}

export interface CotizacionDetalle {
  cotizacion: CotizacionDetalleCabecera;
  items: CotizacionItemRow[];
  cliente: { id: string; nombre: string; tipoPersona: TipoPersona } | null;
  oportunidad: { id: string; nombre: string; etapa: string } | null;
}

export interface CatalogoOption {
  id: string;
  tipo: EquipoTipo;
  marca: string | null;
  modelo: string | null;
  potenciaWp: number | null;
  precio: number | null;
}

const CLIENTE_QUERY_LIMIT = 500;
const COTIZACION_QUERY_LIMIT = 500;

/**
 * Lista de clientes filtrada. Scoping por vendedor para roles acotados.
 * Filtros: tipoPersona (eq), vendedorId (null = sin asignar / isNull),
 * busqueda (ilike nombre/rfc/email). Incluye nombre del vendedor vía leftJoin.
 */
export async function getClientesFiltrados(
  scope: DashboardScope,
  filtros: ClientesFiltros = {},
): Promise<ClienteRow[]> {
  const conds: SQL[] = [];

  if (isScoped(scope.rol)) {
    conds.push(eq(schema.clientes.vendedorId, scope.userId));
  }

  if (filtros.tipoPersona) {
    conds.push(eq(schema.clientes.tipoPersona, filtros.tipoPersona));
  }

  if (filtros.vendedorId !== undefined) {
    conds.push(
      filtros.vendedorId === null
        ? isNull(schema.clientes.vendedorId)
        : eq(schema.clientes.vendedorId, filtros.vendedorId),
    );
  }

  const q = filtros.busqueda?.trim();
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    const busquedaCond = or(
      ilike(schema.clientes.nombre, like),
      ilike(schema.clientes.rfc, like),
      ilike(schema.clientes.email, like),
    );
    if (busquedaCond) conds.push(busquedaCond);
  }

  const rows = await db
    .select({
      id: schema.clientes.id,
      tipoPersona: schema.clientes.tipoPersona,
      nombre: schema.clientes.nombre,
      rfc: schema.clientes.rfc,
      email: schema.clientes.email,
      telefono: schema.clientes.telefono,
      municipio: schema.clientes.municipio,
      estadoMx: schema.clientes.estadoMx,
      vendedorId: schema.clientes.vendedorId,
      vendedorNombre: schema.usuarios.nombre,
      createdAt: schema.clientes.createdAt,
    })
    .from(schema.clientes)
    .leftJoin(
      schema.usuarios,
      eq(schema.clientes.vendedorId, schema.usuarios.id),
    )
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.clientes.createdAt))
    .limit(CLIENTE_QUERY_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    tipoPersona: row.tipoPersona,
    nombre: row.nombre,
    rfc: row.rfc,
    email: row.email,
    telefono: row.telefono,
    municipio: row.municipio,
    estadoMx: row.estadoMx,
    vendedorId: row.vendedorId,
    vendedorNombre: row.vendedorNombre,
    createdAt: row.createdAt,
  }));
}

/**
 * Detalle 360° de un cliente: cabecera + contactos, oportunidades,
 * cotizaciones, proyectos, documentos (entidad cliente) y timeline. Aplica
 * scoping: un rol acotado solo ve clientes propios; si no le pertenece (o no
 * existe) devuelve null.
 */
export async function getClienteDetalle(
  scope: DashboardScope,
  id: string,
): Promise<ClienteDetalle | null> {
  const [cliente] = await db
    .select()
    .from(schema.clientes)
    .where(eq(schema.clientes.id, id))
    .limit(1);

  if (!cliente) return null;
  if (isScoped(scope.rol) && cliente.vendedorId !== scope.userId) return null;

  const [
    vendedorNombre,
    contactos,
    oportunidades,
    cotizaciones,
    proyectos,
    documentos,
    timeline,
  ] = await Promise.all([
    getVendedorNombre(cliente.vendedorId),
    getContactosDeCliente(id),
    getOportunidadesDeCliente(id),
    getCotizacionesDeCliente(id),
    getProyectosDeCliente(id),
    getDocumentosDeEntidad("cliente", id),
    getTimelineDeEntidad("cliente", id),
  ]);

  return {
    cliente,
    vendedorNombre,
    contactos,
    oportunidades,
    cotizaciones,
    proyectos,
    documentos,
    timeline,
  };
}

/** Nombre del vendedor (o null). */
async function getVendedorNombre(
  vendedorId: string | null,
): Promise<string | null> {
  if (!vendedorId) return null;
  const [row] = await db
    .select({ nombre: schema.usuarios.nombre })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.id, vendedorId))
    .limit(1);
  return row?.nombre ?? null;
}

async function getContactosDeCliente(
  clienteId: string,
): Promise<ContactoRow[]> {
  const rows = await db
    .select({
      id: schema.contactos.id,
      nombre: schema.contactos.nombre,
      cargo: schema.contactos.cargo,
      email: schema.contactos.email,
      telefono: schema.contactos.telefono,
      esPrincipal: schema.contactos.esPrincipal,
    })
    .from(schema.contactos)
    .where(eq(schema.contactos.clienteId, clienteId))
    .orderBy(desc(schema.contactos.esPrincipal), asc(schema.contactos.nombre));

  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    cargo: row.cargo,
    email: row.email,
    telefono: row.telefono,
    esPrincipal: row.esPrincipal,
  }));
}

async function getOportunidadesDeCliente(
  clienteId: string,
): Promise<ClienteOportunidadRow[]> {
  const rows = await db
    .select({
      id: schema.oportunidades.id,
      nombre: schema.oportunidades.nombre,
      etapa: schema.oportunidades.etapa,
      montoEstimado: schema.oportunidades.montoEstimado,
      probabilidad: schema.oportunidades.probabilidad,
      createdAt: schema.oportunidades.createdAt,
    })
    .from(schema.oportunidades)
    .where(eq(schema.oportunidades.clienteId, clienteId))
    .orderBy(desc(schema.oportunidades.createdAt));

  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    etapa: row.etapa,
    montoEstimado: numOrZero(row.montoEstimado),
    probabilidad: row.probabilidad ?? 30,
    createdAt: row.createdAt,
  }));
}

async function getCotizacionesDeCliente(
  clienteId: string,
): Promise<ClienteCotizacionRow[]> {
  const rows = await db
    .select({
      id: schema.cotizaciones.id,
      folio: schema.cotizaciones.folio,
      version: schema.cotizaciones.version,
      estado: schema.cotizaciones.estado,
      total: schema.cotizaciones.total,
      validaHasta: schema.cotizaciones.validaHasta,
      createdAt: schema.cotizaciones.createdAt,
    })
    .from(schema.cotizaciones)
    .where(eq(schema.cotizaciones.clienteId, clienteId))
    .orderBy(desc(schema.cotizaciones.createdAt));

  return rows.map((row) => ({
    id: row.id,
    folio: row.folio,
    version: row.version,
    estado: row.estado,
    total: numOrZero(row.total),
    validaHasta: row.validaHasta,
    createdAt: row.createdAt,
  }));
}

async function getProyectosDeCliente(
  clienteId: string,
): Promise<ClienteProyectoRow[]> {
  const rows = await db
    .select({
      id: schema.proyectos.id,
      folio: schema.proyectos.folio,
      fase: schema.proyectos.fase,
      totalConIva: schema.proyectos.totalConIva,
    })
    .from(schema.proyectos)
    .where(eq(schema.proyectos.clienteId, clienteId))
    .orderBy(desc(schema.proyectos.createdAt));

  return rows.map((row) => ({
    id: row.id,
    folio: row.folio,
    fase: row.fase,
    totalConIva: numOrNull(row.totalConIva),
  }));
}

async function getDocumentosDeEntidad(
  entidadTipo: (typeof schema.entidadTipo.enumValues)[number],
  entidadId: string,
): Promise<ClienteDocumentoRow[]> {
  const rows = await db
    .select({
      id: schema.documentos.id,
      tipo: schema.documentos.tipo,
      nombre: schema.documentos.nombre,
      url: schema.documentos.url,
      createdAt: schema.documentos.createdAt,
    })
    .from(schema.documentos)
    .where(
      and(
        eq(schema.documentos.entidadTipo, entidadTipo),
        eq(schema.documentos.entidadId, entidadId),
      ),
    )
    .orderBy(desc(schema.documentos.createdAt));

  return rows.map((row) => ({
    id: row.id,
    tipo: row.tipo,
    nombre: row.nombre,
    url: row.url,
    createdAt: row.createdAt,
  }));
}

async function getTimelineDeEntidad(
  entidadTipo: (typeof schema.entidadTipo.enumValues)[number],
  entidadId: string,
): Promise<EventoRow[]> {
  const rows = await db
    .select({
      id: schema.eventos.id,
      entidadTipo: schema.eventos.entidadTipo,
      entidadId: schema.eventos.entidadId,
      tipo: schema.eventos.tipo,
      descripcion: schema.eventos.descripcion,
      actor: schema.eventos.actor,
      createdAt: schema.eventos.createdAt,
    })
    .from(schema.eventos)
    .where(
      and(
        eq(schema.eventos.entidadTipo, entidadTipo),
        eq(schema.eventos.entidadId, entidadId),
      ),
    )
    .orderBy(desc(schema.eventos.createdAt))
    .limit(100);

  return rows.map((row) => ({
    id: String(row.id),
    entidadTipo: row.entidadTipo,
    entidadId: row.entidadId,
    tipo: row.tipo,
    descripcion: row.descripcion,
    actor: row.actor,
    createdAt: row.createdAt,
  }));
}

/**
 * Lista de cotizaciones filtrada (con nombres de cliente/vendedor vía
 * leftJoin). Scoping por vendedor para roles acotados. Filtros: estado (eq),
 * clienteId (eq), vendedorId (null = sin asignar / isNull), busqueda (ilike
 * folio).
 */
export async function getCotizacionesFiltradas(
  scope: DashboardScope,
  filtros: CotizacionesFiltros = {},
): Promise<CotizacionRow[]> {
  const conds: SQL[] = [];

  if (isScoped(scope.rol)) {
    conds.push(eq(schema.cotizaciones.vendedorId, scope.userId));
  }

  if (filtros.estado) conds.push(eq(schema.cotizaciones.estado, filtros.estado));
  if (filtros.clienteId) {
    conds.push(eq(schema.cotizaciones.clienteId, filtros.clienteId));
  }

  if (filtros.vendedorId !== undefined) {
    conds.push(
      filtros.vendedorId === null
        ? isNull(schema.cotizaciones.vendedorId)
        : eq(schema.cotizaciones.vendedorId, filtros.vendedorId),
    );
  }

  const q = filtros.busqueda?.trim();
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    conds.push(ilike(schema.cotizaciones.folio, like));
  }

  const rows = await db
    .select({
      id: schema.cotizaciones.id,
      folio: schema.cotizaciones.folio,
      version: schema.cotizaciones.version,
      clienteId: schema.cotizaciones.clienteId,
      clienteNombre: schema.clientes.nombre,
      vendedorId: schema.cotizaciones.vendedorId,
      vendedorNombre: schema.usuarios.nombre,
      total: schema.cotizaciones.total,
      estado: schema.cotizaciones.estado,
      validaHasta: schema.cotizaciones.validaHasta,
      createdAt: schema.cotizaciones.createdAt,
    })
    .from(schema.cotizaciones)
    .leftJoin(
      schema.clientes,
      eq(schema.cotizaciones.clienteId, schema.clientes.id),
    )
    .leftJoin(
      schema.usuarios,
      eq(schema.cotizaciones.vendedorId, schema.usuarios.id),
    )
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.cotizaciones.createdAt))
    .limit(COTIZACION_QUERY_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    folio: row.folio,
    version: row.version,
    clienteId: row.clienteId,
    clienteNombre: row.clienteNombre,
    vendedorId: row.vendedorId,
    vendedorNombre: row.vendedorNombre,
    total: numOrZero(row.total),
    estado: row.estado,
    validaHasta: row.validaHasta,
    createdAt: row.createdAt,
  }));
}

/**
 * Detalle de una cotización: cabecera + items (con marca/modelo del equipo vía
 * leftJoin a catálogo) + cliente y oportunidad asociados. Aplica scoping sobre
 * vendedor_id; si no pertenece al rol acotado (o no existe) devuelve null.
 */
export async function getCotizacion(
  scope: DashboardScope,
  id: string,
): Promise<CotizacionDetalle | null> {
  const [cot] = await db
    .select()
    .from(schema.cotizaciones)
    .where(eq(schema.cotizaciones.id, id))
    .limit(1);

  if (!cot) return null;
  if (isScoped(scope.rol) && cot.vendedorId !== scope.userId) return null;

  const itemRows = await db
    .select({
      id: schema.cotizacionItems.id,
      equipoId: schema.cotizacionItems.equipoId,
      descripcion: schema.cotizacionItems.descripcion,
      cantidad: schema.cotizacionItems.cantidad,
      precioUnitario: schema.cotizacionItems.precioUnitario,
      importe: schema.cotizacionItems.importe,
      equipoMarca: schema.catalogoEquipos.marca,
      equipoModelo: schema.catalogoEquipos.modelo,
    })
    .from(schema.cotizacionItems)
    .leftJoin(
      schema.catalogoEquipos,
      eq(schema.cotizacionItems.equipoId, schema.catalogoEquipos.id),
    )
    .where(eq(schema.cotizacionItems.cotizacionId, id))
    .orderBy(asc(schema.cotizacionItems.id));

  const items: CotizacionItemRow[] = itemRows.map((row) => ({
    id: String(row.id),
    equipoId: row.equipoId,
    descripcion: row.descripcion,
    cantidad: numOrZero(row.cantidad),
    precioUnitario: numOrZero(row.precioUnitario),
    importe: numOrZero(row.importe),
    equipoMarca: row.equipoMarca,
    equipoModelo: row.equipoModelo,
  }));

  const cliente = await getClienteResumen(cot.clienteId);
  const oportunidad = await getOportunidadResumen(cot.oportunidadId);

  return {
    cotizacion: {
      id: cot.id,
      oportunidadId: cot.oportunidadId,
      clienteId: cot.clienteId,
      vendedorId: cot.vendedorId,
      folio: cot.folio,
      version: cot.version,
      capacidadKwp: numOrNull(cot.capacidadKwp),
      paneles: cot.paneles,
      inversor: cot.inversor,
      subtotal: numOrZero(cot.subtotal),
      iva: numOrZero(cot.iva),
      total: numOrZero(cot.total),
      moneda: cot.moneda ?? "MXN",
      produccionAnualKwh: numOrNull(cot.produccionAnualKwh),
      ahorroAnualMxn: numOrNull(cot.ahorroAnualMxn),
      paybackAnios: numOrNull(cot.paybackAnios),
      esquema: cot.esquema,
      estado: cot.estado,
      validaHasta: cot.validaHasta,
      pdfUrl: cot.pdfUrl,
      createdAt: cot.createdAt,
    },
    items,
    cliente,
    oportunidad,
  };
}

async function getClienteResumen(
  clienteId: string | null,
): Promise<{ id: string; nombre: string; tipoPersona: TipoPersona } | null> {
  if (!clienteId) return null;
  const [row] = await db
    .select({
      id: schema.clientes.id,
      nombre: schema.clientes.nombre,
      tipoPersona: schema.clientes.tipoPersona,
    })
    .from(schema.clientes)
    .where(eq(schema.clientes.id, clienteId))
    .limit(1);
  return row ?? null;
}

async function getOportunidadResumen(
  oportunidadId: string | null,
): Promise<{ id: string; nombre: string; etapa: string } | null> {
  if (!oportunidadId) return null;
  const [row] = await db
    .select({
      id: schema.oportunidades.id,
      nombre: schema.oportunidades.nombre,
      etapa: schema.oportunidades.etapa,
    })
    .from(schema.oportunidades)
    .where(eq(schema.oportunidades.id, oportunidadId))
    .limit(1);
  return row ?? null;
}

/** Equipos disponibles del catálogo, ordenados por tipo y marca. */
export async function getCatalogoDisponible(): Promise<CatalogoOption[]> {
  const rows = await db
    .select({
      id: schema.catalogoEquipos.id,
      tipo: schema.catalogoEquipos.tipo,
      marca: schema.catalogoEquipos.marca,
      modelo: schema.catalogoEquipos.modelo,
      potenciaWp: schema.catalogoEquipos.potenciaWp,
      precio: schema.catalogoEquipos.precio,
    })
    .from(schema.catalogoEquipos)
    .where(eq(schema.catalogoEquipos.disponible, true))
    .orderBy(asc(schema.catalogoEquipos.tipo), asc(schema.catalogoEquipos.marca));

  return rows.map((row) => ({
    id: row.id,
    tipo: row.tipo,
    marca: row.marca,
    modelo: row.modelo,
    potenciaWp: numOrNull(row.potenciaWp),
    precio: numOrNull(row.precio),
  }));
}
