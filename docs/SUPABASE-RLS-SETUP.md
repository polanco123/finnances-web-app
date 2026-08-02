# Cómo agregar RLS a una tabla nueva en Supabase

Basado en la configuración de `fondo_semanal`.

## Requisitos

- La tabla ya existe pero **sin RLS**
- Se asume que la tabla tiene una columna `user_id` de tipo `uuid` (o se va a agregar)
- Ya hay filas existentes que pueden necesitar backfill

## Paso 1: Agregar columna `user_id` (si no existe)

```sql
ALTER TABLE public.mi_tabla ADD COLUMN user_id uuid;
```

## Paso 2: Backfill de filas existentes

Si la tabla ya tiene datos, asignalos a tu usuario:

```sql
UPDATE public.mi_tabla
SET user_id = 'tu-user-id-aqui'
WHERE user_id IS NULL;
```

> El `user_id` lo obtenés de **Authentication > Users** en el dashboard de Supabase, o con `SELECT id FROM auth.users LIMIT 1;`

## Paso 3: Habilitar RLS en la tabla

```sql
ALTER TABLE public.mi_tabla ENABLE ROW LEVEL SECURITY;
```

## Paso 4: Crear las políticas

```sql
CREATE POLICY "Users can SELECT their mi_tabla"
ON public.mi_tabla FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can INSERT their mi_tabla"
ON public.mi_tabla FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can UPDATE their mi_tabla"
ON public.mi_tabla FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can DELETE their mi_tabla"
ON public.mi_tabla FOR DELETE TO authenticated
USING (auth.uid() = user_id);
```

## Paso 5: GRANT al rol authenticated

Este paso es **necesario aunque las políticas existan** — sin el GRANT base, Supabase rechaza la request con 403 antes de evaluar las políticas.

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mi_tabla TO authenticated;
```

## Verificación rápida

```sql
-- Estado de RLS
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'mi_tabla';

-- Políticas creadas
SELECT * FROM pg_policies WHERE tablename = 'mi_tabla';
```

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---------|---------------|-----|
| 403 al SELECT | RLS deshabilitado o falta GRANT | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `GRANT ... TO authenticated` |
| 403 al INSERT | Sin política INSERT o sin GRANT | Verificar política + GRANT |
| Query no devuelve filas esperadas | `user_id` null en filas existentes | Backfill con UPDATE |
| Error `auth.uid() is null` | Usuario no autenticado | Verificar sesión en el cliente |

## Resumen (lo mínimo indispensable)

```sql
ALTER TABLE public.mi_tabla ADD COLUMN user_id uuid;
ALTER TABLE public.mi_tabla ENABLE ROW LEVEL SECURITY;
-- crear políticas (ver Paso 4)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mi_tabla TO authenticated;
```
