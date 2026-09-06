# Proposal: Presupuestos Mensuales por Categoría

## Why

Hoy la única forma de limitar gasto por categoría es el `fondo_semanal` de Diversión — un presupuesto semanal atado a una sola categoría. Para cualquier otra categoría de gasto (ej. Comida, Transporte, Suscripciones) no existe forma de fijar un monto objetivo mensual ni de ver cuánto se ha gastado contra ese objetivo: `/categorias` muestra el gasto acumulado del periodo seleccionado, pero sin ningún límite de referencia. El usuario quiere control de gasto mensual por categoría, independiente del ciclo semanal de Diversión, reutilizando el mismo lenguaje visual de barra que ya existe en Metas.

## What Changes

- Nueva tabla `presupuesto` (`user_id`, `categoria_id`, `monto`, `anio`, `mes`, `created_at`) con restricción única por categoría/mes — un registro por categoría por mes; cambiar el monto de un mes no afecta a los demás. RLS por `auth.uid() = user_id`, patrón `fondo_semanal` (ver `Resolved Decisions` #10). Eliminar es baja dura, sin columna `activa` (ver `Resolved Decisions` #11).
- Nueva sección `/presupuestos` con entrada propia en el sidebar (`components/app-shell/sidebar.tsx`).
- Navegación de mes con flechas anterior/siguiente ancladas en el mes calendario actual, sin selector de rango libre (a diferencia del filtro de Categorías).
- Lista de barras horizontales, una por presupuesto creado explícitamente para el mes seleccionado — categorías con gasto pero sin presupuesto NO aparecen en esta pantalla ni se cuentan aparte; ese gasto sigue visible solo en `/categorias`.
- Barra de resumen del mes sobre la lista: total presupuestado vs. total gastado, sumado únicamente sobre los presupuestos del mes seleccionado (mismo criterio de exclusión que el punto anterior).
- Acción "Copiar presupuestos de [mes anterior]" cuando el mes seleccionado no tiene presupuestos, y creación suelta de un presupuesto vía formulario (selector de categoría + monto).
- Patrón acordeón (igual a `acct-card`/`meta-card`) para editar monto o eliminar un presupuesto — sin distinción entre mes pasado o vigente: edición y eliminación funcionan igual en cualquier mes.
- Cálculo de "gastado" reutiliza el criterio exacto de `fetchCategoriasConGasto` (`components/categorias/categorias-service.ts`): suma de `ABS(movimiento.monto)` donde `monto < 0`, filtrado por `categoria_id` y `fecha` dentro del mes calendario.
- Selector de categoría reutiliza `AutocompleteInput`/`CatalogPickerPopup` (`kind: 'categoria'`), con el catálogo filtrado a categorías de gasto (excluye `tipo = 'ingreso'`) antes de pasarlo al picker — el picker en sí no filtra por tipo, el filtrado es responsabilidad del caller (mismo patrón que `esCategoriaDeGasto` en `categorias-service.ts`).

**Corrección verificada sobre las notas previas**: la premisa "a diferencia de `MetaProgressBar`, que sí deja que la barra exceda el 100%" es incorrecta — `components/metas/metas-progress.tsx` ya clampea el ancho (`widthPct`) a `[0, 100]`; lo único que nunca se clampea es la etiqueta numérica/porcentaje. La diferencia real que exige un componente nuevo (no reutilizar `MetaProgressBar`) es otra: `MetaProgressBar` colorea en rojo cuando `montoActual < 0` (dominio de ahorro) y no tiene texto de excedente, mientras que la barra de Presupuestos debe colorear en rojo cuando `gastado > presupuestado` y mostrar el excedente como texto aparte (ej. "+$320 sobre el presupuesto") — condiciones de color y contenido distintas, no solo el clamp de ancho (que sí se puede copiar tal cual).

## Non-Goals

- Presupuestos no mensuales (semanal, anual, etc.).
- Copiar presupuestos automáticamente sin confirmación explícita del usuario.
- Notificaciones o alertas al acercarse al límite.
- Mostrar u contabilizar categorías con gasto pero sin presupuesto creado en `/presupuestos` — ese gasto permanece visible únicamente en `/categorias`, sin sección ni contador "sin presupuesto".
- Bloqueo o modo solo-lectura para meses pasados — no existe regla de "mes cerrado"; edición y eliminación son idénticas en cualquier mes.

## Capabilities

### New Capabilities
- `presupuestos-mensuales`: sección `/presupuestos` — crear/editar/eliminar presupuesto mensual por categoría (único por categoría/mes, aislado por `user_id`), barra de progreso tope-100% con excedente en texto, resumen agregado del mes, copiar presupuestos del mes anterior.

### Modified Capabilities
- `app-shell-navigation`: agrega una entrada funcional más al sidebar ("Presupuestos" → `/presupuestos`).

## Impact

| Área | Impacto | Descripción |
|------|---------|--------------|
| Supabase — tabla nueva `presupuesto` | New | Migración con `user_id uuid NOT NULL`, `UNIQUE (user_id, categoria_id, anio, mes)`, sin columna `activa` (baja dura), RLS habilitado con policies `auth.uid() = user_id` (patrón `fondo_semanal`, ver `docs/SUPABASE-RLS-SETUP.md`) |
| `app/(app)/presupuestos/page.tsx` | New | Requiere wrapper `Page → Suspense → Content` (mismo gotcha que `movimientos`/`dashboard`: selector de mes usa `new Date()` en cliente) |
| `components/presupuestos/presupuestos-service.ts` | New | CRUD de presupuesto + cálculo de gastado reutilizando el criterio de `fetchCategoriasConGasto` |
| `components/presupuestos/*` (card + acordeón, form, barra de progreso, resumen del mes) | New | Barra nueva (no reutiliza `MetaProgressBar` — ver corrección arriba); acordeón sigue el patrón de `acct-card`/`meta-card` |
| `components/app-shell/sidebar.tsx` | Modified | `NAV_ITEMS`: nueva entrada "Presupuestos" |
| `components/categorias/categorias-service.ts` | None | Reutilizado como referencia de criterio de cálculo; sin cambios |
| `/categorias`, `/metas`, `/diversion` (comportamiento existente) | None | Sin cambios — el `fondo_semanal` de Diversión y el gasto no presupuestado en Categorías siguen funcionando exactamente igual |

## Resolved Decisions

1. **Ciclo mensual**: un registro por `(user_id, categoria_id, anio, mes)`, `UNIQUE` a nivel de tabla.
2. **Categorías elegibles**: cualquier categoría de gasto, sin restricción de código; el usuario decide cuáles crear (ej. deja Diversión fuera a propósito por su presupuesto semanal propio).
3. **Copiar mes anterior**: siempre acción explícita, nunca automática al entrar al mes.
4. **Sobregasto**: barra tope-100% + roja, excedente en texto aparte — corregido y detallado arriba respecto a `MetaProgressBar`.
5. **Resumen del mes** (decisión de esta sesión): barra agregada sobre la lista, presupuestado vs. gastado, sumado solo sobre los presupuestos del mes.
6. **Categorías sin presupuesto** (decisión de esta sesión): no se listan ni se cuentan en `/presupuestos`; el gasto no presupuestado sigue solo en `/categorias`.
7. **Meses pasados** (decisión de esta sesión, sustituye la frase "mientras el mes esté vigente" de las notas): totalmente editables y eliminables, sin regla de bloqueo por mes cerrado.
8. **Categorías tipo `ingreso`**: excluidas del selector de categoría.
9. **Nombres**: español singular — `presupuesto`, `categoria_id`, `monto`, `anio`, `mes`, `created_at`.
10. **`user_id` / RLS** (decisión de esta sesión): `presupuesto` sigue el patrón `fondo_semanal`, no el de `meta`. Columna `user_id uuid NOT NULL`, RLS habilitado, y policies SELECT/INSERT/UPDATE/DELETE con `auth.uid() = user_id` — el procedimiento exacto está documentado en `docs/SUPABASE-RLS-SETUP.md`, que fue escrito tomando `fondo_semanal` como base. El servicio debe filtrar por `user_id` en cada query, igual que `diversion-service.ts`. Consecuencia a confirmar en diseño: la restricción única pasa a `UNIQUE (user_id, categoria_id, anio, mes)`, ya que con aislamiento por usuario dos usuarios distintos deben poder presupuestar la misma categoría en el mismo mes.

    Contexto verificado que sustenta esta decisión: `categoria` y `meta`/`meta_abono` NO tienen columna `user_id` — sus policies usan `USING (true)` para cualquier `authenticated` (patrón single-user). Solo `fondo_semanal` tiene `user_id` real. La suposición de las notas de que `categoria` "ya tiene `user_id`" y que eso causó el 403 reciente es incorrecta: ese 403 se debió a un `GRANT` faltante (ver `openspec/changes/archive/2026-08-21-catalog-icons/design.md`).

11. **Eliminar es baja dura** (decisión de esta sesión, confirma la postura original de las notas): `DELETE` real, sin columna `activa`. `activa` existe en `cuenta`/`categoria` porque son catálogos referenciados por movimientos históricos; a un `presupuesto` no lo referencia ninguna FK y no hay caso de uso de restaurar un mes cerrado. Consecuencia deliberada: `crearPresupuesto` es un `INSERT` simple, NUNCA un upsert — crear un presupuesto no debe modificar en silencio uno existente. Si la categoría ya tiene presupuesto ese mes, la creación se rechaza con error visible y el monto guardado queda intacto (ya exigido por el spec: `Scenario: Duplicado en el mismo mes es rechazado`). El selector de categoría además oculta las categorías ya presupuestadas del mes, de modo que el error de constraint sea red de seguridad y no flujo esperado.

## Open Questions

1. **"Copiar mes anterior" en mes parcial**: las notas solo describen el caso de mes 100% vacío. Si el mes seleccionado ya tiene algunos presupuestos, ¿el botón se sigue mostrando y salta las categorías ya presupuestadas, o solo aparece en mes totalmente vacío? Sin resolver, una implementación ingenua puede violar la restricción única.
2. **Validación de monto**: ¿se permite `0` o se exige `> 0`? No especificado en las notas.

## Risks

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| `presupuesto` es la primera tabla con `user_id` creada desde una migración versionada — el resto del esquema es single-user (`USING (true)`), así que no hay precedente de migración a copiar | Media | Seguir `docs/SUPABASE-RLS-SETUP.md` paso a paso; el servicio debe filtrar por `user_id` en toda query (patrón `diversion-service.ts`), porque olvidarlo con RLS activo devuelve 0 filas en vez de un error visible |
| Gotcha `new Date()` en selector de mes sin wrapper `Suspense` rompe el static export | Media | Aplicar el mismo patrón `Page → Suspense → Content` ya usado en `movimientos`/`dashboard` |
| "Copiar mes anterior" en mes parcial no resuelto | Media | Resolver explícitamente en diseño antes de implementar la función de copiado |
| Barra de progreso nueva no reutiliza `MetaProgressBar` | Baja | Aceptable — las condiciones de color/excedente difieren lo suficiente para no forzar una abstracción prematura entre Metas y Presupuestos |

## Rollback Plan

Presupuestos es completamente aditivo: tabla nueva, ruta nueva, módulo nuevo, entrada de sidebar nueva. Revertir significa eliminar la ruta `/presupuestos` y `components/presupuestos/`, revertir la entrada en `NAV_ITEMS` de `sidebar.tsx`, y dejar la tabla `presupuesto` sin uso en el esquema (no rompe nada, ningún otro módulo la lee) o eliminarla con una migración de seguimiento. `Categorías`, `Metas` y `Diversión` no se tocan en ningún punto.

## Success Criteria

- [ ] `/presupuestos` lista solo los presupuestos creados explícitamente para el mes seleccionado, con navegación prev/next anclada en el mes actual.
- [ ] La barra de resumen del mes muestra correctamente total presupuestado vs. total gastado, sumado solo sobre esos presupuestos.
- [ ] El cálculo de "gastado" por categoría coincide exactamente con el criterio de `fetchCategoriasConGasto`.
- [ ] La barra por categoría topa en 100% y cambia a rojo al exceder el presupuesto, mostrando el excedente como texto aparte.
- [ ] Editar y eliminar un presupuesto funciona igual en un mes pasado que en el mes vigente.
- [ ] "Copiar presupuestos de [mes anterior]" crea una fila por presupuesto del mes previo, editable después, sin violar la restricción única de categoría/mes.
- [ ] El sidebar muestra una entrada "Presupuestos" funcional, sin badge "Próximamente".
- [ ] Toda query de `presupuestos-service` filtra por `user_id`, y las policies RLS de `presupuesto` usan `auth.uid() = user_id`.

## Proposal question round

Preguntas de producto que no se resolvieron en las notas ni en la sesión, ofrecidas para una ronda de aclaración (el usuario puede responder, saltar, corregir el enfoque o pedir una segunda ronda):

1. Cuando el mes seleccionado ya tiene **algunos** presupuestos (no está vacío), ¿debe seguir ofreciéndose "Copiar mes anterior" saltando las categorías ya presupuestadas, o el botón solo aparece cuando el mes está totalmente vacío?
2. ¿Un presupuesto puede crearse o editarse con monto `0`, o el monto siempre debe ser mayor a cero?

Supuestos usados mientras tanto (a corregir si no aplican): (1) el botón de copiar solo aparece en mes totalmente vacío, igual que en las notas; (2) monto debe ser `> 0`.

La pregunta de `user_id`/RLS quedó resuelta en esta sesión — ver `Resolved Decisions` #10.
