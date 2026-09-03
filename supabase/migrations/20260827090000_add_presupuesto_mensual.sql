CREATE TABLE presupuesto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  categoria_id UUID NOT NULL REFERENCES categoria(id),
  monto DECIMAL(14,2) NOT NULL CHECK (monto > 0),
  anio INT NOT NULL,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  -- No `activa` column: deleting a presupuesto is a hard DELETE. No foreign key
  -- points at this table, so removing a row breaks no referential integrity, and
  -- there is no use case for restoring a closed month's budget. Keeping the row
  -- around would also occupy the unique constraint below and force every create
  -- to become an upsert — which would silently overwrite an existing budget.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- user_id is part of the key: with per-user isolation, two users must each be
  -- able to budget the same categoria in the same month.
  UNIQUE (user_id, categoria_id, anio, mes)
);

-- The unique constraint above indexes (user_id, categoria_id, anio, mes) in that
-- order, which serves duplicate detection on insert but not the page's main read
-- pattern: list a user's whole month, without filtering by categoria_id.
CREATE INDEX idx_presupuesto_user_periodo ON presupuesto (user_id, anio, mes);

-- First versioned migration in this repo carrying a real user_id + auth.uid()
-- policies. Every other table here is single-user (USING (true)); the only prior
-- per-user table is fondo_semanal, whose creation never went through a migration
-- — the procedure survives only in docs/SUPABASE-RLS-SETUP.md, followed here.
ALTER TABLE presupuesto ENABLE ROW LEVEL SECURITY;

CREATE POLICY presupuesto_select_own
  ON presupuesto FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY presupuesto_insert_own
  ON presupuesto FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY presupuesto_update_own
  ON presupuesto FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY presupuesto_delete_own
  ON presupuesto FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- RLS and Postgres GRANTs are separate permission layers — this project has hit
-- live "permission denied for table ..." errors every time a migration omitted
-- the explicit GRANT (patrimonio_snapshot, deuda_pago, meta). Included from the
-- start so it cannot be forgotten at apply time.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presupuesto TO authenticated;
