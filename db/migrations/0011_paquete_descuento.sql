-- =====================================================================
-- 0011 — Descuento general del paquete.
-- % aplicado a CADA línea al armar la cotización: precio = precio_fijo*(1-%/100).
-- Idempotente.
-- =====================================================================
ALTER TABLE paquetes ADD COLUMN IF NOT EXISTS descuento_pct numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE paquetes DROP CONSTRAINT IF EXISTS paquetes_descuento_pct_check;
ALTER TABLE paquetes ADD CONSTRAINT paquetes_descuento_pct_check
  CHECK (descuento_pct >= 0 AND descuento_pct <= 100);
