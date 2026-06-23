import { relations } from "drizzle-orm/relations";
import { usuarios, cuadrillas, cuadrillaMiembros, campanas, leads, clientes, contactos, oportunidades, cotizaciones, cotizacionItems, catalogoEquipos, proyectos, tramitesCfe, instalaciones, proyectoMateriales, pagos, actividades, documentos, calculadoraSimulaciones, formSubmissions } from "./schema";

export const cuadrillasRelations = relations(cuadrillas, ({one, many}) => ({
	usuario: one(usuarios, {
		fields: [cuadrillas.liderId],
		references: [usuarios.id]
	}),
	cuadrillaMiembros: many(cuadrillaMiembros),
	instalaciones: many(instalaciones),
}));

export const usuariosRelations = relations(usuarios, ({many}) => ({
	cuadrillas: many(cuadrillas),
	cuadrillaMiembros: many(cuadrillaMiembros),
	leads: many(leads),
	clientes: many(clientes),
	oportunidades: many(oportunidades),
	cotizaciones: many(cotizaciones),
	proyectos: many(proyectos),
	actividades_asignadoA: many(actividades, {
		relationName: "actividades_asignadoA_usuarios_id"
	}),
	actividades_createdBy: many(actividades, {
		relationName: "actividades_createdBy_usuarios_id"
	}),
	documentos: many(documentos),
}));

export const cuadrillaMiembrosRelations = relations(cuadrillaMiembros, ({one}) => ({
	cuadrilla: one(cuadrillas, {
		fields: [cuadrillaMiembros.cuadrillaId],
		references: [cuadrillas.id]
	}),
	usuario: one(usuarios, {
		fields: [cuadrillaMiembros.usuarioId],
		references: [usuarios.id]
	}),
}));

export const leadsRelations = relations(leads, ({one, many}) => ({
	campana: one(campanas, {
		fields: [leads.campanaId],
		references: [campanas.id]
	}),
	usuario: one(usuarios, {
		fields: [leads.vendedorId],
		references: [usuarios.id]
	}),
	clientes: many(clientes),
	oportunidades: many(oportunidades),
	calculadoraSimulaciones: many(calculadoraSimulaciones),
	formSubmissions: many(formSubmissions),
}));

export const campanasRelations = relations(campanas, ({many}) => ({
	leads: many(leads),
}));

export const clientesRelations = relations(clientes, ({one, many}) => ({
	usuario: one(usuarios, {
		fields: [clientes.vendedorId],
		references: [usuarios.id]
	}),
	lead: one(leads, {
		fields: [clientes.leadOrigenId],
		references: [leads.id]
	}),
	contactos: many(contactos),
	oportunidades: many(oportunidades),
	cotizaciones: many(cotizaciones),
	proyectos: many(proyectos),
}));

export const contactosRelations = relations(contactos, ({one}) => ({
	cliente: one(clientes, {
		fields: [contactos.clienteId],
		references: [clientes.id]
	}),
}));

export const oportunidadesRelations = relations(oportunidades, ({one, many}) => ({
	cliente: one(clientes, {
		fields: [oportunidades.clienteId],
		references: [clientes.id]
	}),
	lead: one(leads, {
		fields: [oportunidades.leadId],
		references: [leads.id]
	}),
	usuario: one(usuarios, {
		fields: [oportunidades.vendedorId],
		references: [usuarios.id]
	}),
	cotizaciones: many(cotizaciones),
	proyectos: many(proyectos),
}));

export const cotizacionesRelations = relations(cotizaciones, ({one, many}) => ({
	oportunidade: one(oportunidades, {
		fields: [cotizaciones.oportunidadId],
		references: [oportunidades.id]
	}),
	cliente: one(clientes, {
		fields: [cotizaciones.clienteId],
		references: [clientes.id]
	}),
	usuario: one(usuarios, {
		fields: [cotizaciones.vendedorId],
		references: [usuarios.id]
	}),
	cotizacionItems: many(cotizacionItems),
	pagos: many(pagos),
}));

export const cotizacionItemsRelations = relations(cotizacionItems, ({one}) => ({
	cotizacione: one(cotizaciones, {
		fields: [cotizacionItems.cotizacionId],
		references: [cotizaciones.id]
	}),
	catalogoEquipo: one(catalogoEquipos, {
		fields: [cotizacionItems.equipoId],
		references: [catalogoEquipos.id]
	}),
}));

export const catalogoEquiposRelations = relations(catalogoEquipos, ({many}) => ({
	cotizacionItems: many(cotizacionItems),
	proyectoMateriales: many(proyectoMateriales),
}));

export const proyectosRelations = relations(proyectos, ({one, many}) => ({
	cliente: one(clientes, {
		fields: [proyectos.clienteId],
		references: [clientes.id]
	}),
	oportunidade: one(oportunidades, {
		fields: [proyectos.oportunidadId],
		references: [oportunidades.id]
	}),
	usuario: one(usuarios, {
		fields: [proyectos.vendedorId],
		references: [usuarios.id]
	}),
	tramitesCfes: many(tramitesCfe),
	instalaciones: many(instalaciones),
	proyectoMateriales: many(proyectoMateriales),
	pagos: many(pagos),
}));

export const tramitesCfeRelations = relations(tramitesCfe, ({one}) => ({
	proyecto: one(proyectos, {
		fields: [tramitesCfe.proyectoId],
		references: [proyectos.id]
	}),
}));

export const instalacionesRelations = relations(instalaciones, ({one}) => ({
	proyecto: one(proyectos, {
		fields: [instalaciones.proyectoId],
		references: [proyectos.id]
	}),
	cuadrilla: one(cuadrillas, {
		fields: [instalaciones.cuadrillaId],
		references: [cuadrillas.id]
	}),
}));

export const proyectoMaterialesRelations = relations(proyectoMateriales, ({one}) => ({
	proyecto: one(proyectos, {
		fields: [proyectoMateriales.proyectoId],
		references: [proyectos.id]
	}),
	catalogoEquipo: one(catalogoEquipos, {
		fields: [proyectoMateriales.equipoId],
		references: [catalogoEquipos.id]
	}),
}));

export const pagosRelations = relations(pagos, ({one}) => ({
	proyecto: one(proyectos, {
		fields: [pagos.proyectoId],
		references: [proyectos.id]
	}),
	cotizacione: one(cotizaciones, {
		fields: [pagos.cotizacionId],
		references: [cotizaciones.id]
	}),
}));

export const actividadesRelations = relations(actividades, ({one}) => ({
	usuario_asignadoA: one(usuarios, {
		fields: [actividades.asignadoA],
		references: [usuarios.id],
		relationName: "actividades_asignadoA_usuarios_id"
	}),
	usuario_createdBy: one(usuarios, {
		fields: [actividades.createdBy],
		references: [usuarios.id],
		relationName: "actividades_createdBy_usuarios_id"
	}),
}));

export const documentosRelations = relations(documentos, ({one}) => ({
	usuario: one(usuarios, {
		fields: [documentos.subidoPor],
		references: [usuarios.id]
	}),
}));

export const calculadoraSimulacionesRelations = relations(calculadoraSimulaciones, ({one}) => ({
	lead: one(leads, {
		fields: [calculadoraSimulaciones.leadId],
		references: [leads.id]
	}),
}));

export const formSubmissionsRelations = relations(formSubmissions, ({one}) => ({
	lead: one(leads, {
		fields: [formSubmissions.leadId],
		references: [leads.id]
	}),
}));