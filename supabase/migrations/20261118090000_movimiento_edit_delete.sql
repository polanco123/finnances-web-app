-- Edit / delete / undo support for movimiento.
-- 1. Balance trigger covers INSERT, UPDATE (monto, cuenta_id) and DELETE.
-- 2. UPDATE/DELETE policies and grants for authenticated.
-- 3. Atomic transfer RPCs: update_transferencia, delete_transferencia,
--    restore_transferencia.
-- 4. Guard trigger: transfer legs and MSI rows can only be modified through
--    the RPCs below (direct PostgREST UPDATE/DELETE is rejected).
-- Run supabase/checks/saldo_drift.sql before and after applying.
--
-- OWNERSHIP (review finding R1-001): movimiento.user_id (uuid, DEFAULT
-- auth.uid()) is the owner column. The UPDATE/DELETE policies below are scoped
-- with auth.uid() = user_id. Rows with user_id IS NULL would become
-- unreachable, so legacy rows MUST be backfilled before applying; the
-- pre-check right below aborts the migration if any remain. The existing
-- public SELECT policy ("Allow public read access") and the INSERT policy
-- ("Enable insert for users based on user_id") are pre-existing and out of
-- scope: this migration does not touch them.

-- ---------------------------------------------------------------------------
-- 0. Pre-check: fail loudly instead of silently locking ownerless rows.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_null_owner bigint;
BEGIN
  SELECT count(*) INTO v_null_owner FROM public.movimiento WHERE user_id IS NULL;
  IF v_null_owner > 0 THEN
    RAISE EXCEPTION 'movimiento has % rows with user_id IS NULL; backfill them before applying this migration', v_null_owner;
  END IF;
END;
$$;

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
-- Scoped by owner (see header). WITH CHECK also stops a user from reassigning
-- a row to another user_id.
DROP POLICY IF EXISTS movimiento_update_authenticated ON public.movimiento;
CREATE POLICY movimiento_update_authenticated
  ON public.movimiento FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS movimiento_delete_authenticated ON public.movimiento;
CREATE POLICY movimiento_delete_authenticated
  ON public.movimiento FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT UPDATE, DELETE ON public.movimiento TO authenticated;

-- ---------------------------------------------------------------------------
-- 2b. Guard trigger. Transfer legs (es_transferencia) and MSI rows (msi_id)
--     must keep their invariants (pair atomicity, plan integrity), so they can
--     only be updated or deleted by the RPCs, which set the transaction-local
--     flag app.movimiento_rpc. set_config(..., true) is scoped to the current
--     transaction, so the flag never leaks across requests, and clients cannot
--     set it through PostgREST (only RPCs exposed in public are callable).
--     INSERT is intentionally not guarded (new movements and undo restores).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_movimiento_protected_rows()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (OLD.es_transferencia IS TRUE OR OLD.msi_id IS NOT NULL
      OR (TG_OP = 'UPDATE' AND (NEW.es_transferencia IS TRUE OR NEW.msi_id IS NOT NULL)))
     AND coalesce(current_setting('app.movimiento_rpc', true), '') <> 'on' THEN
    RAISE EXCEPTION 'movimiento % is a transfer leg or MSI row and can only be changed through its RPC', OLD.id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_movimiento_protected ON public.movimiento;
CREATE TRIGGER trg_guard_movimiento_protected
  BEFORE UPDATE OR DELETE ON public.movimiento
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_movimiento_protected_rows();

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
  PERFORM set_config('app.movimiento_rpc', 'on', true);

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
  PERFORM set_config('app.movimiento_rpc', 'on', true);

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

-- Undo of delete_transferencia: re-insert both legs with ALL their original
-- columns (id, created_at, descripcion, notas, ...). p_rows is the jsonb array
-- of the two rows returned by delete_transferencia (SETOF movimiento, so it
-- carries every column). The legs are validated before inserting so a forged
-- payload cannot mint money: exactly 2 rows, same transferencia_id,
-- es_transferencia = true, one negative and one positive leg, net zero, no MSI.
-- Ownership: restored rows keep the user_id returned by delete_transferencia.
-- No explicit user_id check is coded here on purpose: the function is SECURITY
-- INVOKER, so the INSERT policy (WITH CHECK auth.uid() = user_id) rejects any
-- leg whose user_id differs from the caller (or is missing from the payload,
-- because jsonb_populate_recordset does not apply column defaults).
CREATE OR REPLACE FUNCTION public.restore_transferencia(p_rows jsonb)
RETURNS SETOF public.movimiento
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_legs integer;
  v_flagged integer;
  v_transfers integer;
  v_negative integer;
  v_positive integer;
  v_net numeric;
  v_msi integer;
  v_no_id integer;
BEGIN
  PERFORM set_config('app.movimiento_rpc', 'on', true);

  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) <> 2 THEN
    RAISE EXCEPTION 'restore_transferencia expects a jsonb array of exactly 2 legs';
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE r.es_transferencia IS TRUE AND r.transferencia_id IS NOT NULL),
         count(DISTINCT r.transferencia_id),
         count(*) FILTER (WHERE r.monto < 0),
         count(*) FILTER (WHERE r.monto > 0),
         coalesce(sum(r.monto), 0),
         count(*) FILTER (WHERE r.msi_id IS NOT NULL),
         count(*) FILTER (WHERE r.id IS NULL)
    INTO v_legs, v_flagged, v_transfers, v_negative, v_positive, v_net, v_msi, v_no_id
  FROM jsonb_populate_recordset(null::public.movimiento, p_rows) r;

  IF v_legs <> 2 OR v_flagged <> 2 OR v_transfers <> 1 OR v_no_id > 0 THEN
    RAISE EXCEPTION 'restore_transferencia expects 2 identified legs (es_transferencia) of one transfer';
  END IF;
  IF v_negative <> 1 OR v_positive <> 1 OR v_net <> 0 THEN
    RAISE EXCEPTION 'restore_transferencia expects one negative and one positive leg with net zero';
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
--   DROP TRIGGER trg_guard_movimiento_protected ON public.movimiento;
--   DROP FUNCTION public.guard_movimiento_protected_rows();
--   DROP POLICY movimiento_update_authenticated ON public.movimiento;
--   DROP POLICY movimiento_delete_authenticated ON public.movimiento;
--   REVOKE UPDATE, DELETE ON public.movimiento FROM authenticated;
--   then run supabase/checks/saldo_drift.sql and recompute if needed.
-- ---------------------------------------------------------------------------
