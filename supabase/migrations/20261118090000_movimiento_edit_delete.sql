-- Edit / delete / undo support for movimiento.
-- 1. Balance trigger covers INSERT, UPDATE (monto, cuenta_id) and DELETE.
-- 2. UPDATE/DELETE policies and grants for authenticated.
-- 3. Atomic transfer RPCs: update_transferencia, delete_transferencia,
--    restore_transferencia.
-- Run supabase/checks/saldo_drift.sql before and after applying.

-- ---------------------------------------------------------------------------
-- 1. Balance trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.actualizar_saldo_calculado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.cuenta
    SET saldo_calculado = saldo_calculado + NEW.monto
    WHERE id = NEW.cuenta_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.cuenta
    SET saldo_calculado = saldo_calculado - OLD.monto
    WHERE id = OLD.cuenta_id;
    RETURN OLD;
  ELSE
    IF OLD.cuenta_id IS NOT DISTINCT FROM NEW.cuenta_id THEN
      UPDATE public.cuenta
      SET saldo_calculado = saldo_calculado + (NEW.monto - OLD.monto)
      WHERE id = NEW.cuenta_id;
    ELSE
      UPDATE public.cuenta
      SET saldo_calculado = saldo_calculado - OLD.monto
      WHERE id = OLD.cuenta_id;
      UPDATE public.cuenta
      SET saldo_calculado = saldo_calculado + NEW.monto
      WHERE id = NEW.cuenta_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_actualizar_saldo ON public.movimiento;
CREATE TRIGGER trg_actualizar_saldo
  AFTER INSERT OR UPDATE OF monto, cuenta_id OR DELETE ON public.movimiento
  FOR EACH ROW
  EXECUTE FUNCTION public.actualizar_saldo_calculado();

-- ---------------------------------------------------------------------------
-- 2. Policies and grants (RLS and GRANTs are separate layers; see
--    20260811070000_add_deuda_pago.sql). Policies are dropped by our own
--    names so the migration is re-runnable; pre-existing policies are not
--    touched (PERMISSIVE policies are OR-ed, so an extra one is harmless).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS movimiento_update_authenticated ON public.movimiento;
CREATE POLICY movimiento_update_authenticated
  ON public.movimiento FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS movimiento_delete_authenticated ON public.movimiento;
CREATE POLICY movimiento_delete_authenticated
  ON public.movimiento FOR DELETE TO authenticated USING (true);

GRANT UPDATE, DELETE ON public.movimiento TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Transfer RPCs (SECURITY INVOKER: RLS and grants of the caller apply).
--    Each function body runs in a single transaction.
-- ---------------------------------------------------------------------------

-- Edit both legs: origen (monto < 0) gets -abs(p_monto) on p_cuenta_origen,
-- destino (monto > 0) gets +abs(p_monto) on p_cuenta_destino.
CREATE OR REPLACE FUNCTION public.update_transferencia(
  p_transferencia_id uuid,
  p_monto numeric,
  p_cuenta_origen uuid,
  p_cuenta_destino uuid
)
RETURNS SETOF public.movimiento
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_legs integer;
  v_msi integer;
  v_origen integer;
  v_destino integer;
BEGIN
  IF p_monto IS NULL OR p_monto = 0 THEN
    RAISE EXCEPTION 'monto must be non-zero';
  END IF;
  IF p_cuenta_origen IS NULL OR p_cuenta_destino IS NULL
     OR p_cuenta_origen = p_cuenta_destino THEN
    RAISE EXCEPTION 'origen and destino must be different accounts';
  END IF;

  PERFORM 1 FROM public.movimiento
  WHERE transferencia_id = p_transferencia_id
  FOR UPDATE;

  SELECT count(*),
         count(*) FILTER (WHERE msi_id IS NOT NULL),
         count(*) FILTER (WHERE monto < 0),
         count(*) FILTER (WHERE monto > 0)
    INTO v_legs, v_msi, v_origen, v_destino
  FROM public.movimiento
  WHERE transferencia_id = p_transferencia_id AND es_transferencia = true;

  IF v_legs <> 2 OR v_origen <> 1 OR v_destino <> 1 THEN
    RAISE EXCEPTION 'transfer % must have exactly 2 legs (one origen, one destino)', p_transferencia_id;
  END IF;
  IF v_msi > 0 THEN
    RAISE EXCEPTION 'transfer % belongs to an MSI plan and cannot be edited', p_transferencia_id;
  END IF;

  RETURN QUERY
  WITH u AS (
    UPDATE public.movimiento m
    SET monto = CASE WHEN m.monto < 0 THEN -abs(p_monto) ELSE abs(p_monto) END,
        cuenta_id = CASE WHEN m.monto < 0 THEN p_cuenta_origen ELSE p_cuenta_destino END
    WHERE m.transferencia_id = p_transferencia_id AND m.es_transferencia = true
    RETURNING m.*
  )
  SELECT * FROM u;
END;
$$;

-- Delete both legs and return the deleted rows (the client keeps them to undo).
CREATE OR REPLACE FUNCTION public.delete_transferencia(p_transferencia_id uuid)
RETURNS SETOF public.movimiento
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_legs integer;
  v_msi integer;
BEGIN
  PERFORM 1 FROM public.movimiento
  WHERE transferencia_id = p_transferencia_id
  FOR UPDATE;

  SELECT count(*), count(*) FILTER (WHERE msi_id IS NOT NULL)
    INTO v_legs, v_msi
  FROM public.movimiento
  WHERE transferencia_id = p_transferencia_id AND es_transferencia = true;

  IF v_legs <> 2 THEN
    RAISE EXCEPTION 'transfer % must have exactly 2 legs', p_transferencia_id;
  END IF;
  IF v_msi > 0 THEN
    RAISE EXCEPTION 'transfer % belongs to an MSI plan and cannot be deleted', p_transferencia_id;
  END IF;

  RETURN QUERY
  WITH d AS (
    DELETE FROM public.movimiento m
    WHERE m.transferencia_id = p_transferencia_id AND m.es_transferencia = true
    RETURNING m.*
  )
  SELECT * FROM d;
END;
$$;

-- Undo of delete_transferencia: re-insert both legs with their original
-- id / created_at. p_rows is the jsonb array of the two deleted rows.
CREATE OR REPLACE FUNCTION public.restore_transferencia(p_rows jsonb)
RETURNS SETOF public.movimiento
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_legs integer;
  v_ids integer;
  v_msi integer;
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) <> 2 THEN
    RAISE EXCEPTION 'restore_transferencia expects a jsonb array of exactly 2 legs';
  END IF;

  SELECT count(*),
         count(DISTINCT r.transferencia_id),
         count(*) FILTER (WHERE r.msi_id IS NOT NULL)
    INTO v_legs, v_ids, v_msi
  FROM jsonb_populate_recordset(null::public.movimiento, p_rows) r
  WHERE r.es_transferencia = true AND r.transferencia_id IS NOT NULL;

  IF v_legs <> 2 OR v_ids <> 1 THEN
    RAISE EXCEPTION 'restore_transferencia expects 2 legs of one transfer';
  END IF;
  IF v_msi > 0 THEN
    RAISE EXCEPTION 'MSI transfers cannot be restored through this function';
  END IF;

  RETURN QUERY
  WITH i AS (
    INSERT INTO public.movimiento
    SELECT * FROM jsonb_populate_recordset(null::public.movimiento, p_rows)
    RETURNING *
  )
  SELECT * FROM i;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_transferencia(uuid, numeric, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_transferencia(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_transferencia(jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Rollback (manual):
--   restore the INSERT-only trigger/function from 20260802000000, then
--   DROP FUNCTION public.update_transferencia(uuid, numeric, uuid, uuid);
--   DROP FUNCTION public.delete_transferencia(uuid);
--   DROP FUNCTION public.restore_transferencia(jsonb);
--   DROP POLICY movimiento_update_authenticated ON public.movimiento;
--   DROP POLICY movimiento_delete_authenticated ON public.movimiento;
--   REVOKE UPDATE, DELETE ON public.movimiento FROM authenticated;
--   then run supabase/checks/saldo_drift.sql and recompute if needed.
-- ---------------------------------------------------------------------------
