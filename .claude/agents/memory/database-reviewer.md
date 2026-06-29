# Memoria — database-reviewer

Aprendizajes persistentes de este agente para el proyecto **JYGASOFT Energy**
(CRM je-admin · Next.js 15 / React 19 / TypeScript / Drizzle + PostgreSQL).

> Actualiza este archivo al cerrar una tarea con algo no obvio que valga para la próxima.

## Convenciones del proyecto (no repetir errores)
- Migraciones = SQL idempotente en `db/migrations/`, aplicado con `pnpm db:apply-sql`. Sincronizar `db/schema.ts` + `SQL/Esquema_BD_Postgres.sql` + `SQL/CHANGELOG_BD.md`.
- Mutaciones = Server Actions en `lib/admin/actions.ts` (ActionResult); lecturas en `lib/admin/queries.ts`; validación con Zod.
- Compartimentación por vendedor: ver memoria global `scoping-por-vendedor`. Toda acción/lectura por id valida propiedad.
- Verificar siempre con `pnpm typecheck` y `pnpm build` antes de dar por hecho.

## Notas
(vacío — agrega aquí)
