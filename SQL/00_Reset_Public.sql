-- =====================================================================
-- ⚠⚠⚠  RESET TOTAL DE LA BASE DE DATOS  ⚠⚠⚠
-- Borra TODO el contenido del esquema `public` (tablas, tipos/ENUMs,
-- funciones, triggers, secuencias, extensiones en public) y lo recrea vacío.
-- ES IRREVERSIBLE. Haz un respaldo antes si te importan los datos actuales.
--
-- Orden de ejecución para reconstruir desde cero:
--   1) 00_Reset_Public.sql        (este archivo)
--   2) Esquema_BD_Postgres.sql    (crea pgcrypto + todo el esquema)
--   3) Seed_Esencial.sql          (integraciones, admin, cargos, áreas)
--
-- Nota: los secretos del seed van cifrados; solo funcionan con el MISMO
--       CONFIG_ENC_KEY del entorno donde se generaron.
-- =====================================================================

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Restablece privilegios sobre el esquema recreado.
GRANT ALL ON SCHEMA public TO CURRENT_USER;
GRANT ALL ON SCHEMA public TO PUBLIC;
