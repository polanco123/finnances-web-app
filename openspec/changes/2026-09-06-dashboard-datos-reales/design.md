# Design: Dashboard `/` con datos reales de Supabase

## Technical Approach

A diferencia de `2026-08-27-presupuestos-mensuales`, este cambio **no toca el esquema**: no hay tabla, migración, RLS ni `GRANT` nuevos. Es un cambio de *read path* puro sobre `cuenta` y `movimiento` (ambas ya con `SELECT` concedido a `authenticated` porque `/cuentas`, `/categorias`, `/reportes` y `/movimientos` ya las leen). `categoria` no se consulta directo: se resuelve del catálogo en caché (`CATEGORIAS` de `@/lib/catalogs/catalog-store`, inicializado por `CatalogInit` en `app/(app)/layout.tsx`), igual que hoy hacen `MovementListItem` y `fetchCategoriasConGasto`.

El patrón de carga es el de `app/(app)/reportes/page.tsx` y `app/(app)/cuentas/page.tsx`: `'use client'`, wrapper `Page → Suspense → Content` (ya presente en el dashboard actual y que se conserva — el `Content` lee `new Date()` en cliente y romper eso quiebra el static export), un `useEffect` con `Promise.all` de las cargas, y estados `{ loading, error, data }` con pantallas dedicadas. El dashboard se ancla **siempre al mes calendario en curso**; se elimina por completo el selector de mes (`MESES`, `mesSeleccionado`, `CATEGORIAS_MAP`). El selector de cuenta se mantiene, ahora poblado con cuentas reales.

Se agrega **un solo módulo nuevo**, `components/dashboard/dashboard-service.ts`, que compone servicios ya existentes y aporta únicamente lo que falta:

- `fetchResumenMes(anio, mes, cuentaId?)` — un `SELECT monto, es_transferencia FROM movimiento` acotado al mes, **excluyendo transferencias** (`es_transferencia` distinto de `true`; las filas legacy pueden traer `null`), opcionalmente filtrado por `cuenta_id`. Devuelve `{ ingresos, gastos, neto }` con `ingresos = Σ monto>0`, `gastos = Σ |monto<0|`, `neto = ingresos - gastos`.
- `fetchGastoMensualTrailing(meses = 6)` — un **único** `SELECT monto, fecha, es_transferencia FROM movimiento` sobre los últimos N meses (incluido el actual), `monto < 0`, transferencias excluidas, agregado en cliente por mes calendario. Mismo patrón acotado que `fetchCategoriasDelMes` en `patrimonio-service.ts`. Devuelve `{ anio, mes, etiqueta, total }[]` en orden ascendente para el `AreaChart`.
- `resumirMes(categorias)` — puro, sin Supabase. Recibe el `CategoriaConGasto[]` de `fetchCategoriasConGasto` y lo cruza contra `CATEGORIAS` (catálogo) por `categoriaId` para bucketizar por `categoria.tipo`: `{ totalGastado, compromisos, discrecionales }`.
- `fetchDashboardData(cuentaId)` — orquestador opcional que hace el `Promise.all` y arma el objeto que consume `DashboardContent`.

Los rangos de fecha se calculan con `components/patrimonio/patrimonio-dates.ts` (`getTodayLocalDate`, `startOfMonth`, `addMonths`, `toISODate`) — **no** se crea un `dashboard-dates.ts` ni se importa `presupuestos-dates.ts`: `patrimonio-dates.ts` ya es el helper de fechas de la página hermana (`/reportes`) y ya expone exactamente lo necesario para "mes actual" y "ventana trailing".

"Top categorías — gasto" y "Tendencia mensual" siguen siendo `BarChart`/`AreaChart` de Recharts sin cambios estructurales — solo cambia el origen de `data`. "Últimos movimientos" deja de usar el markup `movement-row` local y pasa a renderizar `MovementListItem` / `MovementTransferCard` con `groupMovimientos`, igual que `/movimientos` y `/cuentas`; esto borra los helpers locales `ICON_MAP`, `getIcon` y `formatDate`.

## Architecture Decisions

| Decisión | Elección | Alternativas consideradas | Justificación |
|---|---|---|---|
| Esquema | Sin cambios. Solo `SELECT` sobre `cuenta` y `movimiento` | Vista materializada / RPC de agregación en Postgres | Todo el proyecto agrega en cliente sobre fetches acotados (`patrimonio-service`, `categorias-service`); introducir una RPC rompería ese patrón por un dashboard de una sola pantalla. Los `GRANT` ya existen |
| Alcance temporal | Mes calendario actual fijo; se elimina el selector de mes | Conservar navegación de meses con datos reales | Decisión explícita del usuario en la ronda de aclaración. El histórico por periodo ya vive en `/categorias`; duplicarlo en `/` añade estado y queries sin valor nuevo |
| Balance con cuenta específica | `saldo_calculado` de esa cuenta, tomado del resultado de `fetchActiveCuentas()` ya cargado — sin query extra | Segundo `fetchNetWorth`-like filtrado por cuenta | El dato ya está en memoria tras cargar `AccountCards`; una query más sería redundante |
| Balance con cuenta = "Todas" | `fetchNetWorth()` (Σ `saldo_calculado` de cuentas activas) | Sumar en cliente el `fetchActiveCuentas()` | Reutiliza la función ya probada de `patrimonio-service`; además garantiza que "Balance general" y `/reportes` muestren el mismo número. La reconciliación con `AccountCards` se verifica en QA |
| Ingresos/gastos/neto | `movimiento` del mes, `es_transferencia` excluido, `monto` cero-cruce | Incluir transferencias | Una transferencia genera dos filas (`+monto` y `-monto`); contarlas infla ingresos y gastos por el mismo valor y ensucia el neto con ruido interno de reacomodo de saldos |
| Tendencia mensual | `fetchGastoMensualTrailing(6)`, un fetch + agregación en cliente, **transferencias excluidas explícitamente** | Reutilizar `fetchCategoriasConGasto` por cada mes (6 queries) | 6 fetches vs. 1; y como la tendencia suma `monto < 0` sin filtrar por `tipo` de categoría, debe excluir transferencias por `es_transferencia` (a diferencia de `fetchCategoriasConGasto`, que las excluye de rebote porque la categoría de transferencia no es un `tipo` de gasto) |
| Ventana de la tendencia | 6 meses (incluido el actual) | 3 / 12 | Supuesto confirmado por el usuario. 6 entra sin scroll en el `AreaChart` a 240px y el fetch acotado se mantiene chico |
| "Últimos movimientos" y el filtro de cuenta | Respeta la cuenta seleccionada | 10 filas globales fijas | Confirmado por el usuario. Cuenta = "Todas" ⇒ `fetchMovimientosPage(null, 10)`; cuenta específica ⇒ `fetchRecentMovimientos(cuentaId, 10)` + `fetchTransferSiblings` para completar pares, replicando `app/(app)/cuentas/page.tsx` |
| Transferencias en la lista | Se muestran agrupadas vía `groupMovimientos` + `MovementTransferCard` | Ocultarlas | Confirmado por el usuario. `groupMovimientos` ya fusiona ambos legs en una tarjeta; es el comportamiento de `/movimientos` y `/cuentas`, sin código nuevo |
| Render de la lista | Reutilizar `MovementListItem` / `MovementTransferCard` | Mantener el markup `movement-row` local con `ICON_MAP` de emojis | El componente compartido ya resuelve nombre/ícono/color desde el catálogo real y maneja el caso transferencia; el `ICON_MAP` de emojis del archivo era mock y se elimina |
| Buckets del Resumen mensual | `compromiso`, `trabajo`, `hogar` → "Compromisos"; `discrecional`, `suscripcion` → "Discrecionales"; `totalGastado` = Σ de todas las categorías de gasto | Cubo propio para `trabajo`/`hogar` | Supuesto confirmado por el usuario. Mantiene el shape de tres cifras de `MonthlySummary` sin rediseñarlo |
| Refetch al cambiar de cuenta | Carga global (net worth, cuentas, categorías, tendencia) una sola vez al montar; solo el slice dependiente de cuenta (resumen del mes + últimos movimientos) se recarga al togglear la cuenta | Re-ejecutar todo el `Promise.all` en cada toggle | Las pills de cuenta deben sentirse instantáneas; recargar la tendencia y el catálogo de cuentas en cada click es trabajo desperdiciado. El `useEffect` de la parte global corre con `[]`; el de la parte scoped con `[cuentaSeleccionada]` |
| Módulo nuevo | `components/dashboard/dashboard-service.ts` únicamente | Poner los fetches sueltos dentro de `page.tsx` | Todos los dominios del repo tienen su `{dominio}-service.ts`; mantenerlo consistente. No se necesita `dashboard-mapper.ts` — la resolución de catálogo ya la hacen los componentes de `movement/` reutilizados |
| Helper de fechas | Reutilizar `patrimonio-dates.ts` | `dashboard-dates.ts` nuevo / importar `presupuestos-dates.ts` | `patrimonio-dates.ts` ya expone `getTodayLocalDate`/`startOfMonth`/`addMonths`/`toISODate` y es el helper de la página hermana `/reportes`; importar desde `presupuestos/` acoplaría dominios sin necesidad |
| Carga en cliente | Se mantiene `lib/supabase/client` + `Page → Suspense → Content` | Migrar a Server Component con `lib/supabase/server` | Todas las páginas de `(app)/` son client components con este wrapper; migrar solo el dashboard rompería la uniformidad y el `new Date()` del cliente |

## Data Flow

```
/  (DASHBOARD) — READ PATH  (browser, 'use client', Suspense → DashboardContent)
────────────────────────────────────────────────────────────────────────────────
DashboardContent
  estado: { globalData, scopedData, loading, error }, cuentaSeleccionada = 'all'
  fechas: today = getTodayLocalDate()
          desde = toISODate(startOfMonth(today))
          hasta = toISODate(new Date(y, m+1, 0))          // último día del mes actual
          (anio, mes) = (today.getFullYear(), today.getMonth() + 1)

  ── useEffect [] : CARGA GLOBAL (una vez) ────────────────────────────────
  Promise.all(
    fetchNetWorth(),                         patrimonio-service.ts   (reutilizada)
    fetchActiveCuentas(),                    cuentas-service.ts      (reutilizada)
    fetchCategoriasConGasto(desde, hasta),   categorias-service.ts   (reutilizada)
    fetchGastoMensualTrailing(6),            dashboard-service.ts    (NUEVA)
  )
    ▼
  globalData = {
    netWorth,
    cuentas,                                 → AccountCards + <select>
    categorias,                              → CategoryBars (BarChart)
    resumenMes = resumirMes(categorias),     → MonthlySummary   (puro, cruza CATEGORIAS por tipo)
    tendencia,                               → TrendChart (AreaChart)
  }

  ── useEffect [cuentaSeleccionada] : CARGA SCOPED ────────────────────────
  cuentaId = cuentaSeleccionada
  Promise.all(
    fetchResumenMes(anio, mes, cuentaId === 'all' ? undefined : cuentaId),   dashboard-service.ts (NUEVA)
    recentMovimientos(cuentaId),                                             ver abajo
  )
    ▼
  scopedData = {
    resumen : { ingresos, gastos, neto },    → BalanceCard (ingresos/gastos/neto)
    balance : cuentaId === 'all'
                ? globalData.netWorth
                : cuentas.find(c => c.id === cuentaId).saldo_calculado,      → BalanceCard (monto)
    movimientos,                             → MovementsList
  }

  recentMovimientos(cuentaId):
    cuentaId === 'all'
      └─▶ fetchMovimientosPage(null, 10)                     movement-service.ts
            → groupMovimientos(rows)
    cuentaId !== 'all'
      └─▶ fetchRecentMovimientos(cuentaId, 10)               cuentas-service.ts
          + fetchTransferSiblings(transferIds)               cuentas-service.ts
          → merge legs (patrón app/(app)/cuentas/page.tsx:87-120)
          → groupMovimientos(sortedRows)

  ── RENDER ──────────────────────────────────────────────────────────────
  BalanceCard      (balance, ingresos, gastos, neto, etiqueta cuenta + mes actual)
  <select cuenta>  (globalData.cuentas)                    ← se ELIMINA el <select> de Período
  MonthlySummary   (globalData.resumenMes)
  CategoryBars     (globalData.categorias  → BarChart, colors por tema)
  TrendChart       (globalData.tendencia   → AreaChart, colors por tema)
  MovementsList    (scopedData.movimientos → MovementListItem / MovementTransferCard)
  AccountCards     (globalData.cuentas, cuentaSeleccionada, onCuentaChange)
  <MovementFab />  (sin cambios)
```

## File Changes

| Archivo | Acción | Descripción |
|---|---|---|
| `components/dashboard/dashboard-service.ts` | Create | `fetchResumenMes`, `fetchGastoMensualTrailing`, `resumirMes` (puro), `fetchDashboardData` (orquestador); tipos `ResumenMes`, `PuntoTendencia`, `ResumenCategorias` |
| `app/(app)/page.tsx` | Modify | Borra `MockMovimiento`/`MockCategoria`/`MockCuenta`, `MESES`, `MOCK_CUENTAS`, `MOCK_MOVIMIENTOS`, `MOCK_CATEGORIAS_*`, `CATEGORIAS_MAP`, `ICON_MAP`, `getIcon`, `formatDate`, `getMonthLabel`. Reescribe `DashboardContent` al patrón `useEffect` + `Promise.all` + `loading`/`error`. Elimina la card `<select>` de "Período". `BalanceCard`/`MonthlySummary`/`CategoryBars`/`TrendChart`/`MovementsList`/`AccountCards` pasan a recibir datos por props. `MovementsList` renderiza `MovementListItem`/`MovementTransferCard` |
| `app/(app)/page.css` | Modify | Elimina las reglas `.movement-row*` (reemplazadas por el CSS propio de `MovementListItem`); conserva el resto del layout del grid y las cards |
| `components/patrimonio/patrimonio-dates.ts` | None | Se reutiliza (`getTodayLocalDate`, `startOfMonth`, `addMonths`, `toISODate`), sin cambios |
| `components/patrimonio/patrimonio-service.ts` · `components/cuentas/cuentas-service.ts` · `components/categorias/categorias-service.ts` · `components/movement/*` | None | Reutilizados sin cambios (`fetchNetWorth`, `fetchActiveCuentas`, `fetchRecentMovimientos`, `fetchTransferSiblings`, `fetchCategoriasConGasto`, `fetchMovimientosPage`, `groupMovimientos`, `MovementListItem`, `MovementTransferCard`) |
| `openspec/specs/dashboard-home/spec.md` | Modify (delta) | Ya escrito en `specs/dashboard-home/spec.md` de esta carpeta (propiedad de `sdd-spec`) |

## Interfaces / Contracts

```ts
// components/dashboard/dashboard-service.ts
import { createClient } from '@/lib/supabase/client'
import { CATEGORIAS } from '@/lib/catalogs/catalog-store'
import {
  getTodayLocalDate, startOfMonth, addMonths, toISODate,
} from '@/components/patrimonio/patrimonio-dates'

export interface ResumenMes {
  ingresos: number   // Σ monto donde monto > 0, transferencias excluidas
  gastos: number     // Σ |monto| donde monto < 0, transferencias excluidas
  neto: number       // ingresos - gastos
}

export interface PuntoTendencia {
  anio: number
  mes: number         // 1-12
  etiqueta: string     // ej. "sep 2026", para el eje X del AreaChart
  total: number        // Σ |monto| donde monto < 0, transferencias excluidas
}

export interface ResumenCategorias {
  totalGastado: number     // Σ de todas las categorías de gasto del mes
  compromisos: number      // tipo ∈ { compromiso, trabajo, hogar }
  discrecionales: number   // tipo ∈ { discrecional, suscripcion }
}

/**
 * SELECT monto, es_transferencia FROM movimiento
 *   WHERE fecha >= :desde AND fecha <= :hasta
 *     [AND cuenta_id = :cuentaId]
 * Filtra en cliente: es_transferencia !== true (las filas legacy traen null).
 * Mes sin movimientos ⇒ { 0, 0, 0 }, nunca lanza (salvo error de Supabase).
 *
 * @throws On Supabase error
 */
export async function fetchResumenMes(
  anio: number,
  mes: number,
  cuentaId?: string,
): Promise<ResumenMes>

/**
 * Un solo SELECT monto, fecha, es_transferencia FROM movimiento sobre los
 * últimos `meses` meses calendario (incluido el actual), monto < 0,
 * transferencias excluidas. Agrega en cliente por bucket (anio, mes).
 * Meses sin gasto aparecen con total 0. Orden ascendente por fecha.
 * Mismo patrón acotado que patrimonio-service.ts's fetchCategoriasDelMes.
 *
 * @throws On Supabase error
 */
export async function fetchGastoMensualTrailing(meses?: number): Promise<PuntoTendencia[]>

/**
 * Puro, sin Supabase. Cruza `categorias` contra el catálogo CATEGORIAS por
 * categoriaId para leer `tipo` y bucketizar. Una categoría sin match en el
 * catálogo cuenta solo en totalGastado (ni compromiso ni discrecional).
 */
export function resumirMes(
  categorias: import('@/components/categorias/categorias-service').CategoriaConGasto[],
): ResumenCategorias

/**
 * Orquestador de la carga global del dashboard. NO incluye el slice
 * dependiente de cuenta (resumen del mes + últimos movimientos), que la
 * página carga por separado en su propio useEffect([cuentaSeleccionada]).
 *
 * @throws On Supabase error
 */
export async function fetchDashboardData(): Promise<{
  netWorth: number
  cuentas: import('@/components/cuentas/cuentas-service').Cuenta[]
  categorias: import('@/components/categorias/categorias-service').CategoriaConGasto[]
  resumenMes: ResumenCategorias
  tendencia: PuntoTendencia[]
}>
```

```tsx
// app/(app)/page.tsx — nuevos contratos de props de los sub-componentes
interface BalanceCardProps {
  balance: number
  ingresos: number
  gastos: number
  neto: number
  cuentaLabel: string   // "Todas las cuentas" | cuenta.nombre
  mesLabel: string       // ej. "Septiembre 2026"
}

interface CategoryBarsProps {
  categorias: CategoriaConGasto[]   // de fetchCategoriasConGasto, ya ordenadas desc
  colors: { primary: string; accent: string }
}

interface MonthlySummaryProps {
  resumen: ResumenCategorias
}

interface TrendChartProps {
  tendencia: PuntoTendencia[]
  colors: { primary: string; accent: string }
}

interface MovementsListProps {
  items: DisplayItem[]   // salida de groupMovimientos
}

interface AccountCardsProps {
  cuentas: Cuenta[]
  cuentaId: string
  onCuentaChange: (id: string) => void
}
```

## Verificación

Sin test runner en el repo (restricción del proyecto) — verificación vía `npm run lint` + `npm run build` + recorrido manual y **cuadres cruzados** contra páginas ya en producción:

| Escenario | Pasos | Esperado |
|---|---|---|
| Sin mock en el bundle | `grep -n "MOCK_" app/(app)/page.tsx` | Sin coincidencias; tampoco `CATEGORIAS_MAP` ni `MESES` |
| Balance "Todas" cuadra con `/cuentas` | Comparar "Balance general" (cuenta = Todas) con el patrimonio de `/reportes` y con la suma de saldos de `/cuentas` | Los tres números coinciden |
| Balance por cuenta | Seleccionar una cuenta en el `<select>` o su pill | "Balance general" = `saldo_calculado` de esa cuenta; ingresos/gastos/neto solo de esa cuenta |
| Ingresos/gastos sin transferencias | Mes con al menos una transferencia entre cuentas propias | La transferencia no altera ingresos, gastos ni neto |
| Top categorías cuadra con `/categorias` | Comparar montos por categoría del mes actual entre `/` y `/categorias` | Mismos montos (misma función `fetchCategoriasConGasto`) |
| Resumen mensual | Revisar "Compromisos" vs "Discrecionales" | Compromisos = Σ tipos `compromiso`+`trabajo`+`hogar`; Discrecionales = Σ `discrecional`+`suscripcion`; total = Σ todas |
| Tendencia mensual | Inspeccionar el `AreaChart` | 6 puntos (mes actual + 5 previos), total por mes = gasto real, sin inflado por transferencias |
| Sin selector de mes | Inspeccionar el grid | No existe la card "Período"; sí existe la card "Cuenta" con cuentas reales |
| Mes sin movimientos | Forzar `cuentaId` sin gasto en el mes / entorno recién sembrado | Ingresos/gastos/neto en 0, listas y charts vacíos, sin error ni excepción |
| Últimos movimientos respeta cuenta | Togglear entre "Todas" y una cuenta | La lista cambia a los 10 de esa cuenta; transferencias aparecen como tarjeta fusionada |
| Cambio de cuenta es ágil | Click rápido entre varias pills | Solo se recargan balance + últimos movimientos; tendencia y cuentas no parpadean |
| Dark mode | Alternar tema | Cards, texto, ejes y series de ambos charts usan valores dark de `--theme-*` / `CHART_COLORS.dark`; sin regresión vs. hoy |
| Auth | Abrir `/` sin sesión | Redirige a `/auth/login` (proxy, sin cambios) |

## Migration / Rollout

Sin migración de esquema. Despliegue en un solo paso: `components/dashboard/dashboard-service.ts` (nuevo) + `app/(app)/page.tsx` y `app/(app)/page.css` (modificados) en el mismo deploy. Completamente aditivo salvo la reescritura de la ruta `/`; ninguna otra página se toca.

Estado día 1 / entorno recién sembrado: el dashboard renderiza ceros y listas vacías sin error. Sin backfill.

Rollback: revertir `app/(app)/page.tsx` + `app/(app)/page.css` a la versión mock y borrar `components/dashboard/`. Nada más importa ese módulo.

## Open Questions

- [ ] **Etiqueta del eje X de la tendencia**: `"sep 2026"` (mes abreviado + año) vs. solo `"sep"`. El diseño asume `"sep 2026"`; con 6 meses cabe, pero si en móvil se ve apretado se recorta a mes abreviado en apply-time.
- [ ] **`hasta` del mes actual**: se usa el último día del mes calendario (no "hoy") para que `fetchCategoriasConGasto` y `fetchResumenMes` compartan rango exacto. No hay movimientos futuros en la práctica, así que es equivalente a "hoy"; se deja documentado por si aparece un movimiento con `fecha` futura.
- [ ] **`page.css`**: confirmar en apply-time qué reglas `.movement-row*` son exclusivas de la lista vieja y cuáles comparte otra card antes de borrarlas.
