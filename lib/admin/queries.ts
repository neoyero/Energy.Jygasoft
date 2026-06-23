import { sql, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

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
