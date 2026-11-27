-- The live database had a trigger created outside this repository,
-- trigger_actualizar_saldo_on_update (AFTER UPDATE), that calls
-- actualizar_saldo_calculado(). Together with trg_actualizar_saldo it applied
-- every UPDATE delta to cuenta.saldo_calculado twice.
-- trg_actualizar_saldo already covers INSERT, UPDATE and DELETE.
--
-- This migration does NOT repair balances already affected: compare against the
-- saved baseline and correct those accounts explicitly.
DROP TRIGGER IF EXISTS trigger_actualizar_saldo_on_update ON public.movimiento;
