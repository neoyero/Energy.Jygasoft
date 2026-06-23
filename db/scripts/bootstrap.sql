-- =====================================================================
-- Bootstrap de rol + base de datos para energy-web.
-- Ejecutar UNA vez como superusuario (postgres). Idempotente.
--
-- Local (PostgreSQL 18 instalado):
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f db/scripts/bootstrap.sql
--
-- Cambia la contraseña por la real antes de correr en producción.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'energy_app') THEN
    CREATE ROLE energy_app LOGIN PASSWORD 'energy_dev_pw';
  END IF;
END
$$;

SELECT 'CREATE DATABASE energy_app OWNER energy_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'energy_app')\gexec

GRANT ALL PRIVILEGES ON DATABASE energy_app TO energy_app;
