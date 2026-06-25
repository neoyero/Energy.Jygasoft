import { sql, desc, asc, eq } from "drizzle-orm";
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

export type LeadRow = typeof schema.leads.$inferSelect;

export async function getLeads(limit = 200): Promise<LeadRow[]> {
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
