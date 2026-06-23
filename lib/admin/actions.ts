"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { auth } from "@/auth";

type LeadEstado = (typeof schema.leadEstado.enumValues)[number];
type OportEtapa = (typeof schema.oportunidadEtapa.enumValues)[number];

/**
 * Exige sesión autenticada y devuelve el tag del actor. Estas Server Actions son
 * endpoints HTTP propios, así que NO basta el middleware: se valida aquí también.
 */
async function actorTag(): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  return session.user.id ? `usuario:${session.user.id}` : "panel";
}

export async function updateLeadEstado(id: string, estado: LeadEstado) {
  const actor = await actorTag();
  await db.transaction(async (tx) => {
    await tx.update(schema.leads).set({ estado }).where(eq(schema.leads.id, id));
    await tx.insert(schema.eventos).values({
      entidadTipo: "lead",
      entidadId: id,
      tipo: "cambio_estado",
      descripcion: `Estado → ${estado}`,
      payload: { estado },
      actor,
    });
  });
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}`);
}

export async function updateOportunidadEtapa(id: string, etapa: OportEtapa) {
  const actor = await actorTag();
  await db.transaction(async (tx) => {
    await tx
      .update(schema.oportunidades)
      .set({ etapa })
      .where(eq(schema.oportunidades.id, id));
    await tx.insert(schema.eventos).values({
      entidadTipo: "oportunidad",
      entidadId: id,
      tipo: "cambio_etapa",
      descripcion: `Etapa → ${etapa}`,
      payload: { etapa },
      actor,
    });
  });
  revalidatePath("/admin/oportunidades");
}

/** Convierte un lead en cliente + oportunidad (deal). */
export async function convertLead(id: string) {
  const actor = await actorTag();

  await db.transaction(async (tx) => {
    const [lead] = await tx
      .select()
      .from(schema.leads)
      .where(eq(schema.leads.id, id))
      .limit(1);
    if (!lead) throw new Error("Lead no encontrado");

    const tipoPersona =
      lead.segmento === "negocio" ? "pm_comercial" : "pf_residencial";

    const [cliente] = await tx
      .insert(schema.clientes)
      .values({
        tipoPersona,
        nombre: lead.nombre ?? "Sin nombre",
        email: lead.email,
        telefono: lead.telefono,
        municipio: lead.municipio,
        cp: lead.cp,
        vendedorId: lead.vendedorId,
        leadOrigenId: lead.id,
      })
      .returning({ id: schema.clientes.id });

    const [oport] = await tx
      .insert(schema.oportunidades)
      .values({
        clienteId: cliente.id,
        leadId: lead.id,
        vendedorId: lead.vendedorId,
        nombre: `Oportunidad ${lead.nombre ?? lead.telefono ?? lead.email ?? ""}`.trim(),
        etapa: "calificacion",
        capacidadKwp: lead.sizingKwp,
        montoEstimado: lead.inversionMax,
      })
      .returning({ id: schema.oportunidades.id });

    await tx
      .update(schema.leads)
      .set({ estado: "convertido" })
      .where(eq(schema.leads.id, id));

    await tx.insert(schema.eventos).values([
      {
        entidadTipo: "lead",
        entidadId: lead.id,
        tipo: "convertido",
        descripcion: "Lead convertido a cliente + oportunidad",
        payload: { clienteId: cliente.id, oportunidadId: oport.id },
        actor,
      },
      {
        entidadTipo: "cliente",
        entidadId: cliente.id,
        tipo: "creado",
        descripcion: "Cliente creado desde lead",
        payload: { leadId: lead.id },
        actor,
      },
      {
        entidadTipo: "oportunidad",
        entidadId: oport.id,
        tipo: "creado",
        descripcion: "Oportunidad creada desde lead",
        payload: { leadId: lead.id, clienteId: cliente.id },
        actor,
      },
    ]);
  });

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}`);
  revalidatePath("/admin/oportunidades");
}
