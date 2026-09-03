# Design: Presupuestos Mensuales por Categoría

## Technical Approach

Nuevo dominio `components/presupuestos/` siguiendo el split `{dominio}-service.ts` + `.tsx` + `.css` ya establecido (`components/diversion/`, `components/metas/`). Una única migración crea la tabla `presupuesto` — la **primera tabla del repo con `user_id` creada desde una migración versionada**: las 7 migraciones existentes (`meta`, `meta_abono`, `deuda_pago`, `patrimonio_snapshot`, y el `ALTER TABLE` de `categoria`/`cuenta` en `20260821090000_add_catalog_icons.sql`) usan policies `USING (true)` sin `user_id`; la única tabla real con `user_id`/`auth.uid()` es `fondo_semanal`, cuya creación nunca pasó por una migración versionada — sobrevive solo como procedimiento en `docs/SUPABASE-RLS-SETUP.md`. Esta migración sigue ese procedimiento al pie de la letra, incluyendo el `GRANT` explícito, porque el 403 reciente en `categoria` (ver `openspec/changes/archive/2026-08-21-catalog-icons/design.md`) se debió exactamente a omitir ese paso, no a RLS.

`components/presupuestos/presupuestos-service.ts` obtiene `userId` copiando **exactamente** el patrón de `components/diversion/diversion-service.ts`: una función local `requireUserId(supabase)` que llama `supabase.auth.getUser()` y lanza si no hay sesión, invocada al inicio de cada función exportada, con `.eq('user_id', userId)` explícito en cada query además de la policy RLS — no solo por defensa en profundidad, sino porque con RLS activo una query que olvida el filtro no falla, **devuelve 0 filas silenciosamente**; explicitar el filtro en cada función hace que ese bug sea visible en el código, no solo en runtime.

El cálculo de "gastado" reutiliza `fetchMovimientosEnPeriodo(desde, hasta)` de `components/categorias/categorias-service.ts` (ya exportada, sin filtro por categoría, `monto < 0` únicamente) y agrega client-side en `presupuestos-service.ts` — no se reutiliza `fetchCategoriasConGasto` completa porque esa función itera *todas* las categorías de gasto y calcula `porcentaje` sobre el total global, un shape distinto al que necesita Presupuestos (solo las categorías con presupuesto explícito del mes, sin porcentaje-del-total). Este es el mismo "zero-join" precedente que ya usan `patrimonio-service.ts` y `categorias-service.ts`: `movimiento` no tiene `user_id` (single-user real, ver Architecture Decisions), así que el filtro por mes se hace en SQL pero el cruce `categoria_id → presupuesto.categoria_id` se hace en memoria (JS), igual que `fondo_semanal` (con `user_id`) cruza contra `movimiento` (sin `user_id`) en `diversion-service.ts`.

La barra de progreso es un componente nuevo (`presupuesto-progress.tsx`), no `MetaProgressBar`: copia literalmente su técnica de clamp de ancho (`Math.max(0, Math.min(100, pct))`, ya verificada en `metas-progress.tsx:27`) pero difiere en la condición de color (`gastado > presupuestado` en vez de `montoActual < 0`) y agrega el texto de excedente que `MetaProgressBar` no tiene. La página sigue el patrón `Page → Suspense → Content` de `movimientos`/`categorias` (ambas envuelven en `Suspense` aunque solo `movimientos` usa `useSearchParams`; `categorias` lo hace por convención uniforme del proyecto, no por una API que estrictamente lo exija), y un nuevo helper `presupuestos-dates.ts` calcula el rango de un `(anio, mes)` arbitrario — el helper existente `getRangoMensual()` en `categorias-dates.ts` está anclado a "hoy", no sirve para navegar meses.

## Architecture Decisions

| Decisión | Elección | Alternativas consideradas | Justificación |
|---|---|---|---|
| `user_id` / RLS | Patrón `fondo_semanal` exacto: `user_id uuid NOT NULL`, RLS habilitado, policies `auth.uid() = user_id`, `GRANT` explícito — sigue `docs/SUPABASE-RLS-SETUP.md` | Patrón `meta`/`categoria` (`USING (true)`, sin `user_id`) | Ya resuelto en la propuesta (`Resolved Decisions` #10); confirmado aquí: es la primera migración versionada con `user_id` real del repo, sin precedente de código a copiar salvo la doc |
| Restricción única | `UNIQUE (user_id, categoria_id, anio, mes)` | `UNIQUE (categoria_id, anio, mes)` (sin `user_id`, como proponían las notas previas) | Con aislamiento por `user_id`, dos usuarios distintos deben poder presupuestar la misma categoría en el mismo mes sin chocar entre sí — sin `user_id` en la clave, el segundo usuario nunca podría crear su propio presupuesto para esa categoría/mes |
| `movimiento` sin `user_id` vs `presupuesto` con `user_id` | El "gastado" se calcula sobre **todos** los `movimiento` del rango de fechas, sin filtrar por usuario — el presupuesto de un usuario se compara contra el gasto global compartido | Filtrar `movimiento` por `user_id` también | `movimiento` no tiene columna `user_id` (confirmado: no aparece en ninguna migración ni en `categorias-service.ts`/`patrimonio-service.ts`); es exactamente el mismo comportamiento que ya tiene `fondo_semanal` (con `user_id`) al calcular "spent" contra `movimiento` (sin `user_id`) en `diversion-service.ts` — no es una brecha nueva de este cambio, es una característica ya existente del esquema: múltiples cuentas `auth` pueden compartir el mismo libro contable único |
| Eliminar un presupuesto | **Baja dura** (`DELETE FROM presupuesto WHERE id = :id AND user_id = :userId`). La tabla NO lleva columna `activa` | Baja suave (`activa = false`), como en `cuenta`/`categoria`/`meta` | Decisión explícita del usuario, confirmada tras revisar el efecto dominó de la baja suave. `activa` existe en `cuenta`/`categoria` porque son catálogos referenciados por movimientos históricos: desactivarlos preserva la integridad de los registros pasados. A un `presupuesto` no lo referencia nadie — ninguna FK apunta a él — y no existe caso de uso de "restaurar el presupuesto de marzo". Con baja dura la fila desaparece, la unique constraint queda libre y `crearPresupuesto` puede ser un `INSERT` simple (ver siguiente decisión) |
| `crearPresupuesto` es un `INSERT` simple | `INSERT` directo. Si viola `UNIQUE (user_id, categoria_id, anio, mes)`, el servicio traduce el error de Postgres (código `23505`) a un error de dominio legible y la UI lo muestra — la creación se rechaza | `INSERT ... ON CONFLICT DO UPDATE` (upsert) | Requisito explícito del usuario: crear un presupuesto NUNCA debe modificar en silencio uno ya existente. Con upsert, elegir por error una categoría que ya tenía presupuesto ese mes le cambiaría el monto sin aviso — pérdida de dato silenciosa. El rechazo explícito es además lo que ya exige el spec (`Scenario: Duplicado en el mismo mes es rechazado`). Con baja dura no existe el caso "fila fantasma soft-deleted", así que el upsert ya no compra nada |
| Prevención del conflicto en la UI | El selector de categoría del formulario excluye las categorías que YA tienen presupuesto en el mes seleccionado | Ofrecer todas las categorías de gasto y dejar que el error del `INSERT` sea la única defensa | El error de unique constraint queda como red de seguridad del servicio, no como flujo esperado del usuario: si la categoría no es seleccionable, el duplicado no se puede intentar desde la UI. El filtro se compone con el de `esCategoriaDeGasto` sobre la misma lista de `options` |
| "Copiar mes anterior" en mes parcial | El botón se muestra solo cuando el mes está 100% vacío (supuesto por defecto de la propuesta), pero `copiarPresupuestosMesAnterior` se implementa de forma defensiva: obtiene las categorías ya presupuestadas del mes destino y las excluye ANTES de insertar | Copiar sin verificar destino, dejando que la unique constraint rechace filas duplicadas | Con `INSERT` simple esto pasa de conveniencia a necesidad: sin el filtro previo, una copia sobre un mes parcial abortaría con error de constraint en vez de copiar lo que falta. Además desacopla la regla de UI (mes vacío) de la seguridad del write, así que si el producto relaja la regla más adelante (pregunta abierta #1 de la propuesta) la función ya lo soporta sin cambios |
| Validación de monto | `CHECK (monto > 0)` a nivel de tabla + validación de formulario en el cliente | Permitir `monto = 0` | Sigue el supuesto por defecto de la propuesta ("monto siempre > 0") mientras la pregunta de producto #2 no se resuelva; es más fácil relajar un `CHECK` después que añadir uno nuevo sobre datos ya existentes con `monto = 0` |
| Componente de barra | Nuevo `presupuesto-progress.tsx`, copia el clamp `[0,100]` de `metas-progress.tsx` | Reutilizar `MetaProgressBar` | Confirmado en el código (`metas-progress.tsx:27`): el clamp de ancho ya existe y es idéntico a lo que necesita Presupuestos, así que se copia tal cual; lo que difiere son la condición de color (`gastado > presupuestado` vs `montoActual < 0`) y el texto de excedente — suficiente para justificar un componente propio sin abstracción prematura entre dominios, mismo razonamiento que la propuesta ya documenta |
| Cálculo de "gastado" | Reutilizar `fetchMovimientosEnPeriodo(desde, hasta)` (ya exportada) + agregación local por `categoria_id`, restringida a las categorías presupuestadas del mes | Reutilizar `fetchCategoriasConGasto` completa | `fetchCategoriasConGasto` calcula `porcentaje` sobre el total de gasto de *todas* las categorías de gasto — dato irrelevante para Presupuestos, que solo necesita el monto por categoría presupuestada. Reutilizar el fetch de movimientos evita duplicar la query SQL; la agregación (una línea, `SUM(ABS(monto))` por `categoria_id`) sí se duplica, mismo patrón que ya usa `fetchCategoriasConGasto` internamente |
| Selector de categoría | `AutocompleteInput`/`CatalogPickerPopup` (`kind: 'categoria'`), catálogo pre-filtrado con `esCategoriaDeGasto(c.tipo)` de `data/categoria.ts` antes de pasarlo como `options` | Filtrar dentro del picker | `esCategoriaDeGasto` ya existe y es exactamente la whitelist de tipos de gasto (`compromiso`, `discrecional`, `suscripcion`, `trabajo`, `hogar`) que excluye `ingreso`; el picker no filtra por tipo (verificado en `catalog-picker-popup.tsx` — recibe `options` ya resueltas), así que el filtrado es responsabilidad del caller, igual que documenta la propuesta |
| Navegación de mes | Helper nuevo `presupuestos-dates.ts`: `getRangoDelMes(anio, mes)`, `getMesAnterior(anio, mes)`, `getMesSiguiente(anio, mes)` — hand-rolled `Date`, sin librería | Reutilizar `getRangoMensual()` de `categorias-dates.ts` | Ese helper está anclado a "hoy" (`getTodayLocalDate()`), no acepta un `(anio, mes)` arbitrario — no sirve para navegar meses pasados/futuros. Es el mismo patrón de "tercer casi-duplicado deliberado" que `categorias-dates.ts` ya documenta explícitamente en su propio comentario de cabecera (no se introduce una librería de fechas para este único caso nuevo) |
| Sidebar | Nueva entrada `{ href: '/presupuestos', label: 'Presupuestos', icon: PiggyBank }` | Activar una entrada "Próximamente" existente | Verificado en `components/app-shell/sidebar.tsx`: `NAV_ITEMS` no tiene ninguna entrada "Presupuestos" (con o sin badge) — es un ítem completamente nuevo, no una activación |

## Data Flow

```
/presupuestos PAGE — READ PATH (on mount / on mes change, browser)
────────────────────────────────────────────────────────────────
app/(app)/presupuestos/page.tsx  ('use client', Suspense, useState(anio,mes) = mes actual)
  │
  ├─▶ fetchPresupuestosDelMes(anio, mes)         presupuestos-service.ts
  │     SELECT * FROM presupuesto
  │       WHERE user_id = :userId AND anio = :anio AND mes = :mes
  │
  ▼  (categoriaIds = presupuestos.map(p => p.categoriaId))
  ├─▶ getRangoDelMes(anio, mes)                  presupuestos-dates.ts
  │     { desde, hasta }  (1º al último día del mes)
  │
  ├─▶ fetchMovimientosEnPeriodo(desde, hasta)    categorias-service.ts (reutilizada, sin cambios)
  │     SELECT ... FROM movimiento WHERE fecha BETWEEN :desde AND :hasta AND monto < 0
  │     (SIN filtro user_id — movimiento es single-user real, ver Architecture Decisions)
  │
  ▼  agregación local: gastoPorCategoria = SUM(ABS(monto)) agrupado por categoria_id,
  │  restringido a categoriaIds del paso anterior
  │
  ▼  computePresupuestoConGasto(presupuesto, gastado) por fila → PresupuestoConGasto[]
  │
  ▼  setState → render
  PresupuestosResumen(totalPresupuestado, totalGastado)   ← suma solo sobre presupuestos.length > 0
  PresupuestoCard[] (uno por presupuesto, acordeón, mirrors meta-card.tsx)
    │
    ├─ collapsed: nombre+ícono categoría, PresupuestoProgress(gastado, monto)
    │
    └─ expanded ──▶ editar monto (form inline) ──▶ updatePresupuestoMonto(id, monto)
                 └─▶ eliminar ──▶ eliminarPresupuesto(id)   (DELETE, baja dura)
                       │
                       ▼  page filtra/actualiza local presupuestos[] (sin refetch completo)

CREAR PRESUPUESTO SUELTO
────────────────────────
"+ Nuevo presupuesto" ──▶ PresupuestoForm (AutocompleteInput kind='categoria', options =
                            categorías filtradas con esCategoriaDeGasto MENOS las que ya
                            tienen presupuesto este mes, + input monto)
                              │
                              ▼
                            crearPresupuesto(categoriaId, monto, anio, mes)   [INSERT simple]
                              │
                              ├─ éxito ──▶ page resuelve el gastado real de esa
                              │             categoría con fetchGastoPorCategorias
                              │             ([categoriaId], anio, mes) y prepende
                              │             la fila a local presupuestos[].
                              │             "Sin refetch" significa no recargar la
                              │             lista completa — NO significa asumir
                              │             gastado=0: presupuestar a mitad de mes
                              │             es el caso normal, y sembrar 0 mostraría
                              │             "$0 de $1,000 — 0%" siendo falso.
                              │
                              └─ 23505 (unique) ──▶ error de dominio → la UI rechaza la creación
                                    y NO modifica el presupuesto existente

COPIAR MES ANTERIOR (solo si mes destino está vacío)
─────────────────────────────────────────────────────
"Copiar presupuestos de [mes anterior]" ──▶ copiarPresupuestosMesAnterior(anioDestino, mesDestino)
  │
  ├─▶ getMesAnterior(anioDestino, mesDestino) → { anio, mes }
  ├─▶ fetchPresupuestosDelMes(anioAnterior, mesAnterior)     origen
  ├─▶ fetchPresupuestosDelMes(anioDestino, mesDestino)       destino (ya presupuestadas)
  ▼  categorias a copiar = origen.filter(p => !destino.some(d => d.categoriaId === p.categoriaId))
  ▼  crearPresupuesto(...) [INSERT simple] por cada categoría restante
     (el filtro previo es lo que garantiza que ningún INSERT choque con la unique constraint)
  ▼  page refetch del mes destino
```

## File Changes

| Archivo | Acción | Descripción |
|---|---|---|
| `supabase/migrations/20260827090000_add_presupuesto_mensual.sql` | Create | Tabla `presupuesto`, índice, RLS (SELECT/INSERT/UPDATE/DELETE con `auth.uid() = user_id`), `GRANT` explícito |
| `components/presupuestos/presupuestos-service.ts` | Create | Tipos `Presupuesto`/`PresupuestoConGasto`; `fetchPresupuestosDelMes`, `fetchGastoPorCategorias`, `computePresupuestoConGasto`, `crearPresupuesto` (INSERT simple), `updatePresupuestoMonto`, `eliminarPresupuesto` (DELETE), `copiarPresupuestosMesAnterior`, `PresupuestoDuplicadoError` |
| `components/presupuestos/presupuestos-dates.ts` | Create | `getRangoDelMes`, `getMesAnterior`, `getMesSiguiente` — hand-rolled `Date`, sin librería |
| `components/presupuestos/presupuesto-progress.tsx` + `.css` | Create | Barra tope-100%, roja + texto de excedente cuando `gastado > monto` |
| `components/presupuestos/presupuestos-resumen.tsx` + `.css` | Create | Barra agregada del mes, presupuestado vs. gastado |
| `components/presupuestos/presupuesto-card.tsx` + `.css` | Create | Acordeón (mirrors `meta-card.tsx`/`cuentas-card.tsx`): editar monto, eliminar |
| `components/presupuestos/presupuesto-form.tsx` + `.css` | Create | Crear presupuesto: `AutocompleteInput` (kind='categoria', filtrado), monto |
| `components/presupuestos/presupuestos-mes-selector.tsx` + `.css` | Create | Flechas anterior/siguiente, sin selector de rango libre |
| `app/(app)/presupuestos/page.tsx` + `.css` | Create | `Page → Suspense → Content`, orquesta fetch/agregación, estados vacío/copiar |
| `components/app-shell/sidebar.tsx` | Modify | `NAV_ITEMS`: nueva entrada `{ href: '/presupuestos', label: 'Presupuestos', icon: PiggyBank }`; import `PiggyBank` de `lucide-react` |
| `components/categorias/categorias-service.ts` | None | Solo se reutiliza `fetchMovimientosEnPeriodo` (ya exportada), sin cambios |
| `openspec/specs/app-shell-navigation/spec.md` | Modify (delta) | Cuenta de enlaces funcionales +1 (propiedad de `sdd-spec`, no de este documento) |

## Interfaces / Contracts

```ts
// components/presupuestos/presupuestos-service.ts
import { createClient } from '@/lib/supabase/client'
import { fetchMovimientosEnPeriodo } from '@/components/categorias/categorias-service'

export interface Presupuesto {
  id: string
  categoriaId: string
  monto: number
  anio: number
  mes: number
  createdAt: string
}

/** Error de dominio para el duplicado (user_id, categoria_id, anio, mes). */
export class PresupuestoDuplicadoError extends Error {}

/** Presupuesto + gasto calculado client-side. Nunca persistido. */
export interface PresupuestoConGasto extends Presupuesto {
  gastado: number      // SUM(ABS(monto)) de movimiento, monto<0, dentro del mes calendario
  porcentaje: number   // gastado / monto * 100 — puede exceder 100
  excedente: number    // max(0, gastado - monto)
}

/** Mirrors diversion-service.ts's requireUserId exactamente. */
async function requireUserId(supabase: ReturnType<typeof createClient>): Promise<string>

/** SELECT * FROM presupuesto WHERE user_id=:userId AND anio=:anio AND mes=:mes */
export async function fetchPresupuestosDelMes(anio: number, mes: number): Promise<Presupuesto[]>

/**
 * Reutiliza fetchMovimientosEnPeriodo (sin filtro user_id — movimiento es
 * single-user real). Agrega SUM(ABS(monto)) por categoria_id, restringido a
 * categoriaIds. No lanza si una categoría no tiene gasto (devuelve 0).
 */
export async function fetchGastoPorCategorias(
  categoriaIds: string[],
  anio: number,
  mes: number,
): Promise<Map<string, number>>

/** Puro, sin llamada a Supabase. */
export function computePresupuestoConGasto(presupuesto: Presupuesto, gastado: number): PresupuestoConGasto

/**
 * INSERT simple. NUNCA modifica un presupuesto existente: si ya hay uno para
 * (user_id, categoria_id, anio, mes), Postgres rechaza con 23505 y esta función
 * lo traduce a PresupuestoDuplicadoError para que la UI muestre el error y deje
 * intacto el monto ya guardado.
 */
export async function crearPresupuesto(
  categoriaId: string,
  monto: number,
  anio: number,
  mes: number,
): Promise<Presupuesto>

export async function updatePresupuestoMonto(id: string, monto: number): Promise<Presupuesto>

/** DELETE FROM presupuesto WHERE id=:id AND user_id=:userId — baja dura */
export async function eliminarPresupuesto(id: string): Promise<void>

/**
 * Copia los presupuestos del mes anterior al mes destino, excluyendo las
 * categorías que YA tienen presupuesto en el destino ANTES de insertar — con
 * INSERT simple ese filtro previo es lo que evita el choque con la unique
 * constraint, no una conveniencia.
 */
export async function copiarPresupuestosMesAnterior(anio: number, mes: number): Promise<Presupuesto[]>
```

```ts
// components/presupuestos/presupuestos-dates.ts
export interface RangoFecha { desde: string; hasta: string }

export function getRangoDelMes(anio: number, mes: number): RangoFecha
export function getMesAnterior(anio: number, mes: number): { anio: number; mes: number }
export function getMesSiguiente(anio: number, mes: number): { anio: number; mes: number }
```

```tsx
// components/presupuestos/presupuesto-progress.tsx
interface PresupuestoProgressProps {
  gastado: number
  monto: number
}
// widthPct = monto > 0 ? Math.max(0, Math.min(100, (gastado/monto)*100)) : 0   (idéntico a metas-progress.tsx:27)
// color rojo cuando gastado > monto; texto "+$X sobre el presupuesto" aparte cuando excedente > 0
```

**SQL migration** (`supabase/migrations/20260827090000_add_presupuesto_mensual.sql`):
```sql
CREATE TABLE presupuesto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  categoria_id UUID NOT NULL REFERENCES categoria(id),
  monto DECIMAL(14,2) NOT NULL CHECK (monto > 0),
  anio INT NOT NULL,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  -- Sin columna `activa`: eliminar un presupuesto es baja dura (DELETE).
  -- Ninguna FK apunta a `presupuesto`, así que borrarlo no rompe integridad
  -- referencial, y no existe caso de uso de restaurar un presupuesto pasado.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, categoria_id, anio, mes)
);

-- Índice adicional: la unique constraint arriba indexa
-- (user_id, categoria_id, anio, mes) en ese orden, que sirve para detectar el
-- duplicado en crearPresupuesto pero no para el patrón de lectura principal
-- (listar TODO el mes de un usuario, sin filtrar por categoria_id).
CREATE INDEX idx_presupuesto_user_periodo ON presupuesto (user_id, anio, mes);

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

-- RLS y GRANT son capas de permisos separadas — el 403 reciente en `categoria`
-- (ver openspec/changes/archive/2026-08-21-catalog-icons/design.md) se debió
-- exactamente a omitir este paso, no a las policies. Se incluye desde el
-- inicio para no repetir ese incidente.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presupuesto TO authenticated;
```

**Sidebar diff** (`components/app-shell/sidebar.tsx`):
```tsx
import {
  LayoutDashboard, ArrowLeftRight, Gamepad2, Wallet, MinusCircle,
  Target, Tags, PiggyBank, BarChart3, Settings,   // + PiggyBank
} from 'lucide-react'

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { href: '/diversion', label: 'Diversión', icon: Gamepad2 },
  { href: '/cuentas', label: 'Cuentas', icon: Wallet },
  { href: '/deudas', label: 'Deudas', icon: MinusCircle },
  { href: '/metas', label: 'Metas', icon: Target },
  { href: '/categorias', label: 'Categorías', icon: Tags },
  { href: '/presupuestos', label: 'Presupuestos', icon: PiggyBank },   // NEW
  { href: '/reportes', label: 'Reportes', icon: BarChart3 },
  { href: '/configuracion', label: 'Configuración', icon: Settings, comingSoon: true },
]
```
Insertado entre "Categorías" y "Reportes" — ambas relacionadas con seguimiento de gasto por categoría; ningún ítem "Presupuestos" preexistía (verificado, ninguna entrada actual con ese `href` o label, con o sin `comingSoon`).

## Verificación

Sin test runner en el repo (restricción del proyecto) — verificación vía `npm run lint` + `npm run build` + recorrido manual:

| Escenario | Pasos | Esperado |
|---|---|---|
| Crear presupuesto suelto | "+ Nuevo presupuesto" → elegir categoría de gasto + monto | Fila creada, aparece en la lista del mes actual |
| Categoría de ingreso no seleccionable | Abrir el picker de categoría del formulario | Solo aparecen categorías con `esCategoriaDeGasto(tipo)` true |
| Gastado coincide con Categorías | Comparar el "gastado" de una categoría en `/presupuestos` contra `/categorias` (mismo mes) | Mismo monto — mismo criterio `SUM(ABS(monto))`, `monto<0` |
| Barra tope-100% + excedente | Presupuesto de $500, gasto real $820 | Barra llena roja al 100%, texto "+$320 sobre el presupuesto" |
| Editar monto en mes pasado | Navegar a un mes anterior, editar un presupuesto existente | Persiste igual que en el mes vigente, sin bloqueo |
| Eliminar y recrear en el mismo mes | Eliminar un presupuesto, crear uno nuevo para la misma categoría/mes | Funciona con un `INSERT` limpio — la baja dura liberó la fila, no queda residuo soft-deleted |
| Crear duplicado NO pisa el existente | Con "Comida" ya presupuestada en $1000 este mes, forzar la creación de otro "Comida" para el mismo mes | La creación se rechaza con error legible y el presupuesto original sigue en $1000, sin modificar |
| Duplicado no es alcanzable desde la UI | Abrir "+ Nuevo presupuesto" en un mes que ya tiene "Comida" presupuestada | "Comida" no aparece entre las categorías seleccionables |
| Copiar mes anterior | Navegar a un mes 100% vacío, click "Copiar presupuestos de [mes anterior]" | Una fila nueva por cada presupuesto del mes previo, mismo monto, editable después |
| Copiar no duplica si se reintenta | Ejecutar `copiarPresupuestosMesAnterior` dos veces seguidas sobre el mismo mes destino | Segunda ejecución no inserta duplicados (categorías ya presupuestadas se excluyen) |
| Aislamiento por usuario | Dos cuentas `auth` distintas crean presupuesto para la misma categoría/mes | Ambas tienen éxito — la unique constraint incluye `user_id` |
| RLS/GRANT funciona en vivo | Primer `crearPresupuesto` tras aplicar la migración | Sin error "permission denied for table presupuesto" |
| Sidebar | Click en "Presupuestos" | Navega a `/presupuestos`, sin badge "Próximamente" |

## Migration / Rollout

Migración de esquema real — orden de despliegue:
1. Aplicar `supabase/migrations/20260827090000_add_presupuesto_mensual.sql` contra Supabase en vivo (tabla + índice + RLS + `GRANT`, incluido desde el inicio).
2. Desplegar el código: `components/presupuestos/*`, `app/(app)/presupuestos/page.tsx`, la entrada de `sidebar.tsx`, en el mismo deploy — completamente aditivo, ninguna tabla ni página existente se toca salvo `NAV_ITEMS`.

Estado día 1: `/presupuestos` renderiza estado vacío (sin banner de "copiar" porque no hay mes anterior con datos) hasta que el usuario cree el primer presupuesto. Sin backfill.

## Open Questions

- [ ] **Verificación en apply-time** (mismo patrón que toda migración previa de este proyecto): confirmar que el `GRANT` combinado es suficiente contra el Supabase real — sin escrituras no-interactivas a esta tabla, no debería requerirse `service_role`.
- [ ] Pregunta de producto #1 de la propuesta (sin resolver): si "Copiar mes anterior" debe ofrecerse también en mes parcial saltando categorías ya presupuestadas, o solo en mes 100% vacío — el diseño ya soporta ambos casos sin cambios de servicio (ver Architecture Decisions), solo cambia cuándo se muestra el botón en la UI.
- [ ] Pregunta de producto #2 de la propuesta (sin resolver): si `monto = 0` debe permitirse — el `CHECK (monto > 0)` de esta migración asume que no, por el supuesto por defecto de la propuesta.
