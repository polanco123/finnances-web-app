ALTER TABLE cuenta ADD COLUMN es_fondo_retiro BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE cuenta SET es_fondo_retiro = TRUE
WHERE nombre IN ('Afore', 'Fintual PPR', 'GBM', 'Prestadero inversión', 'Yo te presto');

CREATE TABLE patrimonio_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL UNIQUE,
  patrimonio_neto DECIMAL(14,2) NOT NULL,
  patrimonio_disponible DECIMAL(14,2) NOT NULL,
  total_activos DECIMAL(14,2) NOT NULL,
  total_deudas DECIMAL(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_patrimonio_snapshot_fecha ON patrimonio_snapshot (fecha DESC);

ALTER TABLE patrimonio_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY patrimonio_snapshot_select_authenticated
  ON patrimonio_snapshot FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.patrimonio_snapshot TO authenticated;

-- service_role bypasses RLS policies but still needs explicit table grants
-- (RLS bypass and Postgres GRANTs are separate permission layers) — without
-- this, the daily snapshot Edge Function's upsert fails with
-- "permission denied for table patrimonio_snapshot".
GRANT INSERT, UPDATE, SELECT ON public.patrimonio_snapshot TO service_role;
