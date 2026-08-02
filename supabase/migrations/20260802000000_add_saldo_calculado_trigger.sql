-- Function: update saldo_calculado on new movement insert
CREATE OR REPLACE FUNCTION actualizar_saldo_calculado()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cuenta
  SET saldo_calculado = saldo_calculado + NEW.monto
  WHERE id = NEW.cuenta_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: fires after each movement insert
CREATE TRIGGER trg_actualizar_saldo
  AFTER INSERT ON movimiento
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_saldo_calculado();
