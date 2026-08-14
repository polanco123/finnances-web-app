CREATE TABLE deuda_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id UUID NOT NULL REFERENCES cuenta(id),
  periodo DATE NOT NULL,
  monto_planeado DECIMAL(14,2) NOT NULL,
  pagado BOOLEAN NOT NULL DEFAULT FALSE,
  monto_pagado DECIMAL(14,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cuenta_id, periodo)
);
CREATE INDEX idx_deuda_pago_cuenta_periodo ON deuda_pago (cuenta_id, periodo DESC);

ALTER TABLE deuda_pago ENABLE ROW LEVEL SECURITY;
CREATE POLICY deuda_pago_select_authenticated
  ON deuda_pago FOR SELECT TO authenticated USING (true);
CREATE POLICY deuda_pago_insert_authenticated
  ON deuda_pago FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY deuda_pago_update_authenticated
  ON deuda_pago FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- RLS bypass and Postgres GRANTs are separate permission layers — the
-- patrimonio_snapshot migration missed this initially and a live upsert
-- failed with "permission denied for table patrimonio_snapshot" until the
-- explicit GRANT was added. Both grants are included from the start here.
GRANT SELECT, INSERT, UPDATE ON public.deuda_pago TO authenticated;
