-- Drift check: cuenta.saldo_calculado vs SUM(movimiento.monto).
-- Read-only. Run in the Supabase SQL editor BEFORE and AFTER applying
-- 20261118090000_movimiento_edit_delete.sql, and after each manual
-- edit/delete/undo flow. Zero rows = every balance equals SUM(monto).
-- Pre-existing drift is reported only; it is NOT auto-corrected here.
SELECT
  c.id,
  c.saldo_calculado,
  COALESCE(SUM(m.monto), 0) AS suma_movimientos,
  c.saldo_calculado - COALESCE(SUM(m.monto), 0) AS diferencia
FROM cuenta c
LEFT JOIN movimiento m ON m.cuenta_id = c.id
GROUP BY c.id, c.saldo_calculado
HAVING c.saldo_calculado IS DISTINCT FROM COALESCE(SUM(m.monto), 0)
ORDER BY c.id;

-- Transfer integrity: every transferencia_id must have exactly 2 legs
-- (one negative, one positive) that net to zero. Zero rows = healthy.
-- Re-run after delete_transferencia / restore_transferencia flows.
SELECT
  m.transferencia_id,
  count(*) AS piernas,
  count(*) FILTER (WHERE m.monto < 0) AS negativas,
  count(*) FILTER (WHERE m.monto > 0) AS positivas,
  sum(m.monto) AS neto
FROM movimiento m
WHERE m.es_transferencia = true
GROUP BY m.transferencia_id
HAVING count(*) <> 2
    OR count(*) FILTER (WHERE m.monto < 0) <> 1
    OR count(*) FILTER (WHERE m.monto > 0) <> 1
    OR sum(m.monto) <> 0
ORDER BY m.transferencia_id;

-- Guard trigger smoke test (run manually inside a transaction and ROLLBACK):
--   BEGIN;
--   -- Must FAIL with "can only be changed through its RPC":
--   UPDATE movimiento SET monto = monto WHERE es_transferencia = true AND id = (SELECT id FROM movimiento WHERE es_transferencia = true LIMIT 1);
--   ROLLBACK;
--   BEGIN;
--   -- Must FAIL as well (same guard, DELETE path; also for msi_id IS NOT NULL rows):
--   DELETE FROM movimiento WHERE es_transferencia = true AND id = (SELECT id FROM movimiento WHERE es_transferencia = true LIMIT 1);
--   ROLLBACK;
--   -- Must SUCCEED (regular row, not guarded): UPDATE/DELETE of a row with es_transferencia IS NOT TRUE and msi_id IS NULL.
