# Verification Report: Presupuestos Mensuales por Categoria

**Change**: `2026-08-27-presupuestos-mensuales`
**Modo**: openspec (artefactos en disco) + apply-progress en Engram (`sdd/2026-08-27-presupuestos-mensuales/apply-progress`, obs #194)
**Fecha de verificacion**: 2026-09-02
**Verdict**: **PASS WITH WARNINGS** (inspeccion de codigo y build/lint) - NO equivale a verificacion completa: existen bloqueadores CRITICOS que solo el operador puede cerrar (ver mas abajo).

## Alcance y limitacion metodologica (leer antes del resto del reporte)

Este proyecto no tiene runner de tests (`package.json` solo define `dev`, `build`, `start`, `lint`, `predeploy`, `deploy`; cero dependencias jest/vitest/playwright; cero archivos `*.test.*` fuera de `node_modules`). Tampoco existe un registro `sdd-init/{project}` de capacidades de testing en Engram. Esta es una brecha estructural del proyecto, no introducida por este cambio.

Consecuencia metodologica explicita: segun la regla dura de sdd-verify ("A spec scenario is compliant only when a covering test passed at runtime"), ningun escenario de spec tiene cobertura de test en runtime. Toda la verificacion de abajo es por inspeccion de codigo mas `npm run build` mas `npm run lint`, no por ejecucion de pruebas automatizadas. Se reporta esto como CRITICO-1 (brecha de proyecto), separado de los defectos de implementacion (de los cuales no se encontro ninguno).

No se afirma que Strict TDD se haya cumplido. No se invento ningun comando de test.

## Evidencia de ejecucion

| Comando | Resultado | Notas |
|---|---|---|
| `npm run build` | exit 0 (OK) | `/presupuestos` presente como ruta estatica en la salida. Sin reintento necesario en esta corrida. |
| `npx eslint components/presupuestos app/(app)/presupuestos components/app-shell/sidebar.tsx` | 0 errores | 1 warning preexistente: `sidebar.tsx:50`, `<img>` sin `next/image` (LCP) - no introducido por este cambio, coincide con lo reportado en apply-progress. |
| Test automatizado | N/A | No existe test runner en el proyecto (ver seccion anterior). |

## Completitud de tasks.md

44 items totales, 38 marcados `[x]`, 6 sin marcar. Los 6 pendientes son manuales, requieren navegador y Supabase real, y no son ejecutables por este agente de verificacion:

| ID | Descripcion | Estado |
|---|---|---|
| A.5 | Confirmar que el primer `crearPresupuesto` en vivo tras la migracion no da "permission denied for table presupuesto" | Pendiente - operador |
| C.10 | Forzar un duplicado via `crearPresupuesto` en vivo y confirmar `PresupuestoDuplicadoError` (no error crudo de Postgres) y que el `monto` original no cambio | Pendiente - operador |
| D1.5 | Renderizar la barra con gastado=820, monto=500: confirmar rojo, tope 100%, texto "+$320 sobre el presupuesto" separado | Pendiente - operador |
| D2.5 | Abrir el picker de categoria en un mes donde "Comida" ya tiene presupuesto: confirmar que "Comida" no aparece, y que ninguna categoria tipo=ingreso aparece nunca | Pendiente - operador |
| D3.3 | Expandir una card de un mes anterior al actual, editar el monto, luego eliminar: confirmar que ambas operaciones se completan sin bloqueo | Pendiente - operador |
| H.3 | Recorrer completa la tabla Verificacion de design.md contra la app en vivo | Pendiente - operador |

Estos 6 items se reportan como CRITICO-2 mas abajo, por la regla dura del skill: unchecked tasks always remain CRITICAL. No se marcaron como completados, no se simularon.

## Matriz de cumplimiento de especificacion (specs/presupuestos-mensuales/spec.md)

Todos los requisitos fueron verificados por inspeccion de codigo contra la implementacion real (sin cobertura de test en runtime, ver limitacion metodologica arriba).

| Requirement | Evidencia | Estado |
|---|---|---|
| Un presupuesto por categoria, mes y usuario | Migracion: UNIQUE (user_id, categoria_id, anio, mes). crearPresupuesto es INSERT simple, traduce 23505 a PresupuestoDuplicadoError (presupuestos-service.ts:124-147). updatePresupuestoMonto solo toca monto, filtrado por id + user_id (linea 150-164), no afecta otros meses. | Cumple (inspeccion) |
| Lista limitada a presupuestos creados del mes | fetchPresupuestosDelMes solo trae filas existentes del mes; page.tsx renderiza unicamente ese array, sin union con categorias sin presupuesto. | Cumple |
| Resumen del mes solo suma presupuestos listados | page.tsx:216-217, presupuestos.reduce sobre el array ya fetcheado, nunca sobre el catalogo completo de categorias. | Cumple |
| Calculo de gastado identico a Categorias | Ver seccion dedicada "Gasto calculation parity" abajo. | Cumple, criterio identico confirmado linea por linea |
| Barra tope-100% con excedente en texto | presupuesto-progress.tsx:28-30, widthPct clamp [0,100]; excedido = gastado > monto; texto excedente fuera de la barra (lineas 52-56). | Cumple |
| Navegacion de mes anclada al mes actual | presupuestos-mes-selector.tsx: solo dos botones flecha, sin selector de rango libre; page.tsx inicializa useState con new Date() (mes actual). | Cumple |
| Cualquier mes es totalmente editable y eliminable | presupuesto-card.tsx no tiene ninguna rama condicionada a presupuesto.mes. | Cumple |
| Creacion via categoria y monto positivo | presupuesto-form.tsx:60-64 rechaza monto<=0 client-side; DB ademas impone CHECK (monto > 0) (migracion linea 5). Selector filtra con esCategoriaDeGasto (linea 50). | Cumple |
| Copiar presupuestos del mes anterior solo si vacio | page.tsx:193-211, el boton de copiar solo se renderiza dentro de la rama presupuestos.length === 0. copiarPresupuestosMesAnterior excluye categorias ya presupuestadas del destino antes de insertar (presupuestos-service.ts:203-205). | Cumple |

## Verificacion de los 7 puntos senalados como sensibles

### 1. Gasto calculation parity - CONFIRMADO, coinciden exactamente
fetchGastoPorCategorias (presupuestos-service.ts:86-106) llama a fetchMovimientosEnPeriodo(desde, hasta) (reutilizada sin cambios de categorias-service.ts:45-57), que ya filtra monto < 0 y fecha BETWEEN desde/hasta en SQL. La agregacion local hace Math.abs(mov.monto) sumado por categoria_id, restringido a las categoriaIds pedidas. Es el mismo criterio bit a bit que usa fetchCategoriasConGasto (categorias-service.ts:70-106): mismo fetch base, mismo ABS, mismo filtro monto<0, mismo rango de fecha por mes calendario. Unica diferencia: fetchCategoriasConGasto tambien calcula porcentaje sobre el total global (irrelevante para Presupuestos, documentado en design.md). Sin drift.

### 2. No seeded-zero bug regression - CONFIRMADO, el fix esta presente
page.tsx:99-121 (handleCreated): resuelve gastado real via fetchGastoPorCategorias([creado.categoriaId], creado.anio, creado.mes), con fallback a 0 unicamente si esa llamada falla (catch explicito, comentado como "el presupuesto ya se creo; perder la fila seria peor"). No hay ninguna ruta de codigo que siembre gastado=0 como comportamiento normal. El comentario en el codigo documenta explicitamente el bug corregido citado por el usuario.

### 3. Duplicate handling - CONFIRMADO, sin upsert
crearPresupuesto (presupuestos-service.ts:124-147) es un .insert(...) puro, no hay .upsert() ni onConflict en ningun punto del archivo (confirmado por lectura completa del servicio). Captura error.code === '23505' y lanza PresupuestoDuplicadoError, dejando la fila existente intacta (no se ejecuta ningun UPDATE en esa rama).

### 4. Per-user isolation - CONFIRMADO en todas las funciones de escritura/lectura de presupuesto
requireUserId se invoca al inicio de fetchPresupuestosDelMes, crearPresupuesto, updatePresupuestoMonto, eliminarPresupuesto, cada una con .eq('user_id', userId) explicito ademas de RLS. La unica funcion que no filtra por user_id es fetchGastoPorCategorias, y es correcto que no lo haga: opera sobre movimiento, tabla sin columna user_id (confirmado, no aparece en categorias-service.ts ni en ninguna migracion), documentado como decision de arquitectura deliberada en design.md, mismo patron que diversion-service.ts usa contra fondo_semanal. No es un descuido.

### 5. Income categories excluded - CONFIRMADO en el formulario; copiado hereda la exclusion indirectamente
presupuesto-form.tsx:50-52 filtra esCategoriaDeGasto(c.tipo) antes de excluir categorias ya presupuestadas. copiarPresupuestosMesAnterior no vuelve a filtrar por tipo, pero no necesita hacerlo: solo copia filas presupuesto que ya existen en el mes origen, y esas filas solo pudieron crearse pasando por el formulario filtrado (no hay ninguna otra via de creacion en el codigo). Nota SUGGESTION mas abajo sobre esta dependencia implicita.

### 6. Bar caps at 100% - CONFIRMADO, y la diferencia frente a MetaProgressBar es la documentada
presupuesto-progress.tsx:28-29: mismo clamp Math.max(0, Math.min(100, porcentaje)) que metas-progress.tsx:27, pero la condicion de color es gastado > monto (linea 29) contra montoActual < 0 en metas-progress.tsx:28, dominios distintos, tal como corrige la propuesta. PresupuestoProgress ademas renderiza el texto de excedente que MetaProgressBar no tiene; MetaProgressBar en cambio renderiza un badge "Cumplida" que PresupuestoProgress no tiene. Componentes correctamente no unificados.

### 7. Sidebar delta accuracy - CONFIRMADO, el delta coincide con el codigo real
sidebar.tsx:26-37 (NAV_ITEMS) contiene exactamente 9 entradas funcionales: Dashboard, Movimientos, Diversion, Cuentas, Deudas, Metas, Categorias, Presupuestos, Reportes, en ese orden, con Presupuestos insertada entre Categorias y Reportes tal como especifica design.md. Solo Configuracion lleva comingSoon: true. El delta en specs/app-shell-navigation/spec.md:7,17-21 dice "nine functional links" y lista las mismas nueve, coincidiendo exactamente con NAV_ITEMS. Sin drift.

## Drift entre design.md y el codigo como entregado

Ningun drift material encontrado. Unico punto documentado y ya resuelto en apply-progress: el Data Flow original de design.md decia "sin refetch" de forma ambigua, lo que produjo el bug de gastado-sembrado-en-cero corregido en PR 5 (ver punto 2 arriba); el propio design.md ya fue actualizado para aclarar que "sin refetch" significa "no recargar la lista completa", no "asumir gasto cero", el texto actual en disco ya refleja el codigo.

## Hallazgos

### CRITICO

1. Sin cobertura de test en runtime (brecha de proyecto, no de este cambio). No existe test runner ni archivos de test en el repositorio. Por la regla dura del skill de verificacion, ningun escenario de spec tiene "covering test passed at runtime": toda la matriz de cumplimiento de arriba es por inspeccion de codigo, no por ejecucion de pruebas. Esto bloquea un veredicto PASS limpio segun el contrato del skill, aunque el codigo inspeccionado no presenta defectos. No bloquea el archivado de este cambio especifico (es una condicion preexistente aceptada en todo el proyecto), pero debe registrarse como deuda tecnica transversal.

2. 6 tareas manuales sin completar, operador-only (A.5, C.10, D1.5, D2.5, D3.3, H.3). Listadas en la seccion "Completitud de tasks.md" con el checklist ejecutable exacto. Bloquean el archivado hasta que el operador las complete con navegador y Supabase real.

### WARNING

Ninguno adicional a los ya cubiertos como CRITICO. La implementacion en si no presenta defectos de codigo detectables por esta verificacion.

### SUGGESTION

1. copiarPresupuestosMesAnterior no re-filtra tipo='ingreso' explicitamente. Hoy es seguro porque solo copia filas presupuesto preexistentes (que ya pasaron por el filtro del formulario), pero es una dependencia implicita: si en el futuro se agrega otra via de creacion de presupuesto que no pase por presupuesto-form.tsx, esta funcion copiaria categorias de ingreso sin darse cuenta. No bloquea este cambio.

2. Acoplamiento de estilo de AutocompleteInput (defecto preexistente, ya documentado y mitigado en apply-progress): AutocompleteInput hardcodea clases movement-form__*; el workaround aplicado en presupuesto-form.css es correcto pero es un parche repetido (mismo workaround implicito en diversion-form.tsx). Vale la pena un ticket aparte para que AutocompleteInput acepte clases por props.

3. div dentro de button en el header del acordeon (presupuesto-card.tsx:111-134): markup invalido, pero es el patron ya establecido en meta-card.tsx:82-101; no es deuda nueva de este cambio, se senala solo como recordatorio del patron heredado.

## Checklist manual ejecutable para el operador (H.3 + A.5, C.10, D1.5, D2.5, D3.3)

Ejecutar contra la app en vivo con Supabase real. Cada fila indica el resultado que constituye un PASS:

| # | Paso | PASS si |
|---|---|---|
| A.5 | Crear el primer presupuesto tras aplicar la migracion | No aparece "permission denied for table presupuesto" |
| C.10 | Con "Comida" ya presupuestada este mes, forzar otra creacion de "Comida" en el mismo mes | El error mostrado es el mensaje de dominio ("Ya existe un presupuesto para esta categoria en este mes"), no un error crudo de Postgres; el monto original de "Comida" no cambia |
| D1.5 | Ver una barra con gastado=820, monto=500 | Barra roja, ancho topado en 100% (no se desborda), texto "+$320.00 sobre el presupuesto" visible por separado debajo de la barra |
| D2.5 | Abrir "+ Nuevo presupuesto" en un mes donde "Comida" ya tiene presupuesto | "Comida" no aparece en el picker; ninguna categoria de tipo ingreso aparece nunca, en ningun mes |
| D3.3 | Expandir la card de un presupuesto de un mes anterior al actual, editar su monto, guardar, luego eliminarlo | Ambas operaciones se completan sin ningun mensaje o bloqueo relacionado con "mes cerrado" o similar |
| H.3 | Recorrer cada fila de la tabla Verificacion de design.md (crear suelto, categoria de ingreso no seleccionable, gastado coincide con Categorias, barra tope-100%+excedente, editar en mes pasado, eliminar+recrear, duplicado no pisa el existente, duplicado inalcanzable desde la UI, copiar mes anterior, copiar no duplica en reintento, aislamiento por usuario, RLS/GRANT sin 403, sidebar) | Cada fila produce el resultado Esperado documentado en design.md |

## Resolucion de skill

`~/.claude/skills/sdd-verify/SKILL.md`, `~/.claude/skills/_shared/sdd-phase-common.md`, y `.opencode/skills/ui-styling/SKILL.md` (ruta exacta inyectada por el orquestador) fueron leidos antes de revisar componentes/CSS.
