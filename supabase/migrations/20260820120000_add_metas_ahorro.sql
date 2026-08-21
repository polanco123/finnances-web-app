CREATE TABLE meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  monto_objetivo DECIMAL(14,2) NOT NULL,
  monto_inicial DECIMAL(14,2) NOT NULL DEFAULT 0,
  fecha_objetivo DATE,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE meta_abono (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id UUID NOT NULL REFERENCES meta(id),
  monto DECIMAL(14,2) NOT NULL,
  fecha DATE NOT NULL,
  nota TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_meta_abono_meta_fecha ON meta_abono (meta_id, fecha ASC);

ALTER TABLE meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY meta_select_authenticated ON meta FOR SELECT TO authenticated USING (true);
CREATE POLICY meta_insert_authenticated ON meta FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY meta_update_authenticated ON meta FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY meta_delete_authenticated ON meta FOR DELETE TO authenticated USING (true);

ALTER TABLE meta_abono ENABLE ROW LEVEL SECURITY;
CREATE POLICY meta_abono_select_authenticated ON meta_abono FOR SELECT TO authenticated USING (true);
CREATE POLICY meta_abono_insert_authenticated ON meta_abono FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY meta_abono_update_authenticated ON meta_abono FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY meta_abono_delete_authenticated ON meta_abono FOR DELETE TO authenticated USING (true);

-- RLS bypass and Postgres GRANTs are separate permission layers — this project
-- has hit live "permission denied for table ..." errors every time a migration
-- omitted the explicit GRANT (patrimonio_snapshot, restated again for
-- deuda_pago). Both tables' full CRUD grant is included from the start here,
-- in one statement, so this cannot be forgotten at apply time.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta, public.meta_abono TO authenticated;
