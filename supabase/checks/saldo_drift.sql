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
