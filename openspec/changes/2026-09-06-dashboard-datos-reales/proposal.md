# Proposal: Dashboard `/` con datos reales de Supabase

## Why

El dashboard de `/` ([app/(app)/page.tsx](../../../app/(app)/page.tsx)) sigue corriendo 100% con datos mock: `MOCK_CUENTAS`, `MOCK_MOVIMIENTOS` y `CATEGORIAS_MAP` con cuatro meses hardcodeados (`2026-04` a `2026-07`). El rediseño previo (`2026-07-16-admin-panel-shell-redesign`) dejó explícito que ese cambio era "mock data only" y difirió la conexión real. Hoy ya existe toda la infraestructura para alimentarlo con datos vivos —los servicios de `cuentas`, `movimiento`, `categorias`, `patrimonio` y `presupuestos` ya consultan Supabase— y [app/(app)/reportes/page.tsx](../../../app/(app)/reportes/page.tsx) ya implementa exactamente el patrón de carga (`useEffect` + `Promise.all` + estados `loading`/`error`). Falta cerrar el círculo: que la página de inicio muestre el estado financiero real y no cifras inventadas.

## What Changes

- **Eliminar todos los datos mock** de [app/(app)/page.tsx](../../../app/(app)/page.tsx): `MockMovimiento`, `MockCategoria`, `MockCuenta`, `MOCK_CUENTAS`, `MOCK_MOVIMIENTOS`, `MOCK_CATEGORIAS_*`, `CATEGORIAS_MAP` y `ICON_MAP` local (los iconos salen del catálogo real).
- **Quitar el selector de mes** (`MESES`, estado `mesSeleccionado`, prop `meses`). El dashboard se ancla siempre al **mes calendario actual**, resuelto en cliente con `new Date()` (el wrapper `Page → Suspense → Content` ya existe y se conserva). Esto es lo confirmado en la ronda de aclaración: se simplifica a "mes actual + saldos en vivo", como `/reportes`.
- **Conservar el filtro de cuenta** (`select` + pills de `AccountCards`) pero poblado con cuentas reales. Su alcance no cambia respecto a hoy: afecta solo a **Balance general** y **Últimos movimientos**; **Top categorías**, **Resumen mensual** y **Tendencia mensual** siguen siendo agregados globales (sin `cuenta_id`), igual que ahora.
- **Nuevo módulo `components/dashboard/dashboard-service.ts`** que compone servicios existentes y agrega solo lo que falta:
  - `fetchResumenMes(anio, mes)` → `{ ingresos, gastos, neto }` sobre `movimiento` del mes, `es_transferencia` excluido, ingreso = `monto > 0`, gasto = `monto < 0`.
  - `fetchGastoMensualTrailing(meses)` → serie `{ mes, total }` para la Tendencia mensual, con **un solo fetch acotado** de los últimos N meses y agregación en cliente (mismo patrón que `fetchCategoriasDelMes` en [patrimonio-service.ts](../../../components/patrimonio/patrimonio-service.ts)).
- **Nuevo `components/dashboard/dashboard-mapper.ts`** (o helpers en el service): resolver `categoria_id` → `{ nombre, icono }` y `cuenta_id` → `nombre` para "Últimos movimientos", usando el catálogo en caché (`CATEGORIAS` de `lib/catalogs/catalog-store`) y las cuentas ya cargadas, con fallback `'Sin categoría'` / id crudo (mismo criterio tolerante que `fetchCategoriasConGasto`).
- **Reutilizar sin cambios**:
  - `fetchNetWorth()` ([patrimonio-service.ts](../../../components/patrimonio/patrimonio-service.ts)) → saldo de "Balance general" con cuenta = "Todas".
  - `fetchActiveCuentas()` ([cuentas-service.ts](../../../components/cuentas/cuentas-service.ts)) → `AccountCards` y opciones del `select`; el saldo por cuenta sale de `saldo_calculado`.
  - `fetchCategoriasConGasto(desde, hasta)` ([categorias-service.ts](../../../components/categorias/categorias-service.ts)) → alimenta directo el `BarChart` de Recharts de "Top categorías" y se deriva de ahí el "Resumen mensual" (compromisos vs. discrecionales por `categoria.tipo`).
  - `fetchMovimientosPage(null, 10)` ([movement-service.ts](../../../components/movement/movement-service.ts)) → "Últimos movimientos".
- **Reescribir `DashboardContent`** al patrón de `/reportes`: un `useEffect` con `Promise.all` de las cargas, estado `{ loading, error, data }`, pantalla de carga y de error, y estados vacíos que no lanzan (día 1 sin movimientos ⇒ ceros y listas vacías, nunca throw — mismo contrato que `patrimonio-service`).
- **Delta spec**: `dashboard-home` deja de ser "mock only". El delta **MODIFICA** los requisitos "KPI/summary data display (mock data)" y "At least one Recharts chart" para exigir datos reales de Supabase y elimina la cláusula "no live Supabase query SHALL back any of these sections".

## Non-Goals

- Navegación de meses históricos ni selector de rango en el dashboard (se elimina; el histórico por periodo sigue en `/categorias`).
- Server Components / carga en el servidor: el dashboard sigue siendo cliente con `lib/supabase/client`, consistente con todas las demás páginas.
- Cambios en light/dark mode: el bug del selector `[data-theme="dark"]` ya se corrigió en el rediseño previo; `CHART_COLORS` + `resolvedTheme` se mantienen tal cual.
- Autenticación de `/`: ya la cubre el proxy (`lib/supabase/proxy.ts` redirige a `/auth/login` cualquier ruta sin sesión salvo `/auth/*`). El requisito "`/` requiere autenticación" del spec ya está satisfecho y no se toca.
- Nuevas tablas, migraciones o RPC en Supabase: solo `SELECT` sobre `cuenta` y `movimiento`, cuyos `GRANT`/RLS ya los exigen otras páginas en producción.
- Realtime / auto-refresh: la carga es una sola vez al montar, como `/reportes`.
- `MovementFab` y su flujo de alta: sin cambios.

## Capabilities

### Modified Capabilities

- `dashboard-home`: las cinco secciones KPI y el/los chart(s) de Recharts pasan de mock a datos reales de Supabase del mes calendario actual; se elimina el selector de mes; se elimina la restricción "no live Supabase query".

## Impact

| Área | Impacto | Descripción |
|------|---------|-------------|
| [app/(app)/page.tsx](../../../app/(app)/page.tsx) | Modified | Se borran todos los `MOCK_*` / `CATEGORIAS_MAP` / `MESES` / `ICON_MAP`; `DashboardContent` se reescribe al patrón `useEffect` + `Promise.all` + `loading`/`error` de `/reportes`; se quita el `select` de Período; los sub-componentes (`BalanceCard`, `MovementsList`, `CategoryBars`, `AccountCards`, `MonthlySummary`, `TrendChart`) pasan a recibir datos por props en vez de leer constantes de módulo |
| `components/dashboard/dashboard-service.ts` | New | `fetchResumenMes`, `fetchGastoMensualTrailing`; orquestación opcional `fetchDashboardData()` que hace el `Promise.all` |
| `components/dashboard/dashboard-mapper.ts` | New | Resolución `categoria_id`/`cuenta_id` → nombre + icono para "Últimos movimientos" (fallback tolerante) |
| [components/patrimonio/patrimonio-service.ts](../../../components/patrimonio/patrimonio-service.ts) · [components/cuentas/cuentas-service.ts](../../../components/cuentas/cuentas-service.ts) · [components/categorias/categorias-service.ts](../../../components/categorias/categorias-service.ts) · [components/movement/movement-service.ts](../../../components/movement/movement-service.ts) | None | Reutilizados sin cambios (`fetchNetWorth`, `fetchActiveCuentas`, `fetchCategoriasConGasto`, `fetchMovimientosPage`) |
| `openspec/specs/dashboard-home/spec.md` | Modified | El delta de esta carpeta modifica dos requisitos y elimina la cláusula "mock only" |
| Supabase | None | Sin tablas ni migraciones; solo `SELECT` sobre `cuenta` y `movimiento` |
| `/reportes`, `/categorias`, `/movimientos`, `/cuentas` | None | Sin cambios; comparten servicios pero este cambio no los modifica |

## Resolved Decisions

1. **Mes actual, sin selector** (ronda de aclaración de esta sesión): el dashboard muestra siempre el mes calendario en curso. Se elimina `MESES`, `mesSeleccionado` y `CATEGORIAS_MAP`. El rango del mes se calcula con un helper de fechas reutilizable (`getRangoDelMes` de `presupuestos-dates` o equivalente en `patrimonio-dates`).
2. **Filtro de cuenta acotado**: afecta solo Balance general y Últimos movimientos, como hoy. Top categorías / Resumen mensual / Tendencia son globales. Con cuenta específica seleccionada, el saldo de "Balance general" es el `saldo_calculado` de esa cuenta y los ingresos/gastos del mes se filtran por `cuenta_id`.
3. **Transferencias fuera de ingresos/gastos**: `fetchResumenMes` excluye `es_transferencia = true`. `fetchCategoriasConGasto` ya las excluye implícitamente (solo cuenta categorías con `tipo` de gasto), así que ambos cálculos quedan alineados sin doble filtro.
4. **Estados vacíos no lanzan**: sin movimientos en el mes ⇒ `{ ingresos: 0, gastos: 0, neto: 0 }`, lista y chart vacíos. Mismo contrato explícito que `patrimonio-service` para historial escaso.
5. **Iconos desde el catálogo real**: se elimina el `ICON_MAP` de emojis del archivo; "Últimos movimientos" y "Top categorías" usan `categoria.icono` del catálogo en caché, con el mismo fallback de `fetchCategoriasConGasto`.
6. **Carga en cliente**: se mantiene `lib/supabase/client` y el wrapper `Page → Suspense → Content`; no se migra a Server Components.

## Open Questions

1. **Ventana de la Tendencia mensual**: ¿cuántos meses hacia atrás? Supuesto: **6**.
2. **"Últimos movimientos" con cuenta seleccionada**: ¿se mantienen 10 filas globales o pasan a ser los 10 de la cuenta activa (vía `fetchRecentMovimientos`)? Supuesto: respeta el filtro de cuenta.
3. **Transferencias en "Últimos movimientos"**: ¿se muestran agrupadas reutilizando `groupMovimientos` (como `/movimientos`) o se ocultan? Supuesto: mostrarlas agrupadas.
4. **Buckets del Resumen mensual**: hoy el mock hace `compromiso` → "Compromisos" y `discrecional` + `suscripcion` → "Discrecionales". ¿Dónde caen `trabajo` y `hogar` (también son `GASTO_TIPOS`)? Supuesto: sumarlos a "Compromisos".

## Risks

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| El fetch de N meses para la Tendencia puede traer muchas filas de `movimiento` | Media | Un solo `SELECT monto, fecha` acotado por rango + agregación en cliente (patrón `fetchCategoriasDelMes`); no traer columnas de más |
| Resolver `categoria_id`/`cuenta_id` en la lista depende del catálogo en caché (`CatalogInit`); si no cargó, nombres vacíos | Baja | Fallback `'Sin categoría'` / id crudo, idéntico a `fetchCategoriasConGasto`; el catálogo ya se inicializa en `(app)/layout.tsx` |
| El refactor podría reintroducir `new Date()` fuera del `Suspense` y romper el static export | Media | Conservar el wrapper `Page → Suspense → Content` existente; toda lectura de fecha vive dentro de `DashboardContent` |
| Doble criterio de "gasto" entre `fetchResumenMes` (`es_transferencia`) y `fetchCategoriasConGasto` (`tipo` de categoría) | Baja | Documentado en Resolved Decisions #3; validar en diseño que el neto del Balance y la suma de Top categorías cuadren cuando no hay transferencias |
| `saldo_calculado` vs. `fetchNetWorth` (suma de `saldo_calculado` de cuentas activas): si el "Balance general" global no usa la misma fuente que `AccountCards`, no reconcilia | Baja | "Balance general" con cuenta = "Todas" debe ser la suma de los `saldo_calculado` de las mismas cuentas que pinta `AccountCards` |

## Rollback Plan

El cambio es acotado a la ruta `/`: revertir [app/(app)/page.tsx](../../../app/(app)/page.tsx) a su versión mock y borrar `components/dashboard/`. No hay migraciones, tablas ni cambios de esquema que deshacer, y ningún otro módulo importa `components/dashboard/`. El delta spec vuelve a archivarse sin fusionar.

## Success Criteria

- [ ] `/` no contiene ninguna constante `MOCK_*` ni `CATEGORIAS_MAP`; todo dato proviene de Supabase.
- [ ] "Balance general" (cuenta = Todas) es igual a `fetchNetWorth()` y a la suma de los saldos de `AccountCards`.
- [ ] Ingresos, gastos y neto del mes corresponden a `movimiento` del mes calendario actual, con transferencias excluidas.
- [ ] "Top categorías — gasto" renderiza el `BarChart` de Recharts con `fetchCategoriasConGasto` del mes actual.
- [ ] "Tendencia mensual" renderiza el `AreaChart` de Recharts con la serie real de los últimos N meses.
- [ ] "Resumen mensual" y "Últimos movimientos" muestran datos reales; el filtro de cuenta ajusta Balance y Últimos movimientos.
- [ ] Se eliminó el selector de Período; el selector de Cuenta lista cuentas reales.
- [ ] Mes sin movimientos: el dashboard renderiza ceros y listas vacías sin lanzar error.
- [ ] Light y dark mode siguen correctos (sin regresión respecto al rediseño previo).

## Proposal question round

Preguntas de producto abiertas para una ronda de aclaración (podés responder, saltar, corregir el enfoque o pedir otra ronda):

1. Tendencia mensual: ¿6 meses hacia atrás, u otra ventana?
2. "Últimos movimientos": ¿respeta el filtro de cuenta activa o siempre son los 10 globales?
3. Transferencias en "Últimos movimientos": ¿agrupadas como en `/movimientos`, u ocultas?
4. Resumen mensual: ¿`trabajo` y `hogar` cuentan como "Compromisos", como "Discrecionales", o necesitan su propio bucket?

Supuestos usados mientras tanto: (1) 6 meses; (2) respeta el filtro de cuenta; (3) agrupadas; (4) suman a "Compromisos".
