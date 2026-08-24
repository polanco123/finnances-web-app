-- `cuenta` currently has only SELECT granted (documented TODO in
-- cuentas-service.ts; no prior migration ever touched this table, so its
-- exact RLS policy names are unknown and are NOT redeclared here — only the
-- net-new UPDATE capability this feature requires is added).
ALTER TABLE cuenta ADD COLUMN icono TEXT;

CREATE POLICY cuenta_update_authenticated
  ON cuenta FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

GRANT UPDATE ON public.cuenta TO authenticated;

-- `categoria` is assumed SELECT-only under the same reasoning (never
-- verified in source, symmetrical treatment to cuenta). If categoria
-- already grants UPDATE, this GRANT is a safe redundant re-grant — the
-- metas-ahorro design's precedent applies: redundant GRANT costs nothing,
-- a missing one produces a live "permission denied" error.
ALTER TABLE categoria ADD COLUMN icono TEXT;

CREATE POLICY categoria_update_authenticated
  ON categoria FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

GRANT UPDATE ON public.categoria TO authenticated;
