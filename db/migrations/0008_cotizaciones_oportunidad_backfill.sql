-- =====================================================================
-- 0008 — Backfill: enlazar cotizaciones huérfanas a la oportunidad abierta del
-- cliente y reflejar su total en monto_estimado (pipeline).
--
-- Reconcilia cotizaciones creadas ANTES de la sincronización automática
-- (cotizacion ↔ oportunidad). Idempotente: re-ejecutar da el mismo resultado.
-- =====================================================================

-- 1) Enlazar cada cotización sin oportunidad a la oportunidad ABIERTA más
--    reciente de su mismo cliente (las cerradas ganada/perdida se excluyen).
UPDATE cotizaciones co
SET oportunidad_id = sub.op_id
FROM (
  SELECT DISTINCT ON (op.cliente_id) op.cliente_id, op.id AS op_id
  FROM oportunidades op
  WHERE op.etapa NOT IN ('ganada', 'perdida')
  ORDER BY op.cliente_id, op.created_at DESC
) sub
WHERE co.oportunidad_id IS NULL
  AND co.cliente_id = sub.cliente_id;

-- 2) Reflejar el total de la cotización enlazada en el monto de la oportunidad
--    (solo oportunidades abiertas y cotizaciones con total > 0). Si varias
--    cotizaciones apuntan a la misma oportunidad, gana la de mayor total.
UPDATE oportunidades op
SET monto_estimado = sub.total
FROM (
  SELECT DISTINCT ON (co.oportunidad_id) co.oportunidad_id, co.total
  FROM cotizaciones co
  WHERE co.oportunidad_id IS NOT NULL
    AND co.total > 0
  ORDER BY co.oportunidad_id, co.total DESC
) sub
WHERE op.id = sub.oportunidad_id
  AND op.etapa NOT IN ('ganada', 'perdida');
