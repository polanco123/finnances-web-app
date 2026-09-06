# Presupuestos — notas previas a OpenSpec

Documento de trabajo para alinear el alcance antes de formalizar la propuesta en `openspec/`. No es una spec — es la base para escribirla.

## Objetivo

Nueva sección "Presupuestos": permite asignar un monto mensual a una categoría de gasto existente y ver, con una barra horizontal (mismo lenguaje visual que Metas), cuánto se ha gastado en esa categoría durante el mes contra ese monto — y cuánto falta o cuánto se excedió.

## Decisiones confirmadas

| Tema | Decisión |
|---|---|
| Ciclo | **Un registro por mes.** Cada presupuesto es `(categoría, monto, año, mes)` — no un valor único recurrente. Cambiar el monto de un mes no afecta a los demás. |
| Categorías elegibles | Cualquier categoría de gasto. Sin restricción a nivel de código — el usuario decide cuáles crear (por ejemplo, dejará fuera Diversión a propósito porque ya tiene su propio presupuesto semanal en `fondo_semanal`). |
| Mes sin presupuestos | Al entrar a un mes vacío, se ofrece un botón **"Copiar presupuestos de [mes anterior]"** que crea una fila nueva por cada presupuesto del mes previo con el mismo monto (editable después). También se puede crear un presupuesto suelto sin usar el botón. |
| Sobregasto | La barra se llena hasta 100% y cambia a rojo; el excedente se indica aparte en texto (ej. "+$320 sobre el presupuesto"). No crece más allá del ancho completo — a diferencia de `MetaProgressBar`, que sí deja que la barra exceda el 100%. |

## Modelo de datos propuesto

Tabla nueva `presupuesto`:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `categoria_id` | uuid | FK a `categoria` |
| `monto` | numeric | monto presupuestado del mes |
| `anio` | int | ej. 2026 |
| `mes` | int | 1–12 |
| `activa` | boolean | soft-delete, mismo patrón que `cuenta`/`categoria`/`meta` |
| `created_at` | timestamptz | |

Restricción: `UNIQUE (categoria_id, anio, mes)` — un presupuesto por categoría por mes.

**Cálculo de "gastado"**: suma de `movimiento.monto` (valor absoluto, `monto < 0`) para esa `categoria_id` con `fecha` dentro del mes calendario seleccionado — mismo criterio que ya usa `fetchCategoriasConGasto` en `categorias-service.ts`.

## UI

- Nuevo ítem en el sidebar: "Presupuestos".
- Selector de mes (flechas anterior/siguiente, sin selector de rango libre — a diferencia del filtro de Categorías, porque el ciclo es siempre mensual).
- Lista de barras horizontales, una por presupuesto del mes: nombre de categoría, monto gastado / monto presupuestado, porcentaje, barra (verde si dentro del presupuesto, roja tope-100% si excede).
- Acción "Nuevo presupuesto": selector de categoría (reutilizar `AutocompleteInput`/`CatalogPickerPopup`, kind `categoria`) + monto.
- Al expandir una barra (mismo patrón acordeón que `acct-card`/`meta-card`): editar monto, eliminar presupuesto.
- Si el mes actual no tiene presupuestos: banner + botón "Copiar presupuestos de [mes anterior]" en vez de la lista vacía.

## Supuestos menores (avisar si alguno no aplica)

- **Navegación de mes**: flechas prev/next arrancando en el mes calendario actual — sin selector de año/mes libre por ahora.
- **Eliminar presupuesto**: baja dura (no hay razón para "reactivar" un mes ya cerrado), pero el monto se puede editar libremente mientras el mes esté vigente.
- **Categorías de tipo `ingreso`**: excluidas del selector — el feature es solo para controlar gasto.
- **`user_id` / RLS de la tabla nueva**: a confirmar contra Supabase antes de implementar. `cuenta`/`categoria`/`movimiento` no lo tenían originalmente pero `categoria` sí lo tiene ahora (causó el 403 reciente); `meta`/`meta_abono` tampoco lo usan en el código actual. Voy a asumir que `presupuesto` sí necesita `user_id` con policies `auth.uid() = user_id` (mismo patrón que `fondo_semanal`), y lo confirmamos cuando armemos el script SQL.
- **Nombre de tabla/columnas**: en español singular, siguiendo la convención existente (`cuenta`, `categoria`, `meta`).

## Fuera de alcance (por ahora)

- Presupuestos no mensuales (semanal, anual, etc.).
- Copiar automáticamente sin confirmación al iniciar el mes (siempre requiere clic explícito).
- Notificaciones o alertas cuando se acerca al límite.
