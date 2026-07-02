-- 0024_usuarios_rol_text.sql
-- RBAC dinámico (Paso B): usuarios.rol pasa de ENUM (usuario_rol) a TEXT para poder
-- asignar roles a medida (clave de la tabla `roles`). Los valores existentes se
-- conservan. El tipo enum `usuario_rol` se deja creado (histórico); ya no lo usa la
-- columna. Idempotente (correr de nuevo no rompe).

ALTER TABLE usuarios ALTER COLUMN rol DROP DEFAULT;
ALTER TABLE usuarios ALTER COLUMN rol TYPE text USING rol::text;
ALTER TABLE usuarios ALTER COLUMN rol SET DEFAULT 'vendedor';
