# presupuestos-mensuales Specification

## Purpose

`/presupuestos`: crear, editar y eliminar un presupuesto mensual por categoría de gasto, con barra de progreso gastado-vs-presupuestado por categoría y resumen agregado del mes. Solo se listan y cuentan los presupuestos creados explícitamente para el mes seleccionado.

Non-Goals (heredados de la propuesta, fuera de alcance de esta especificación): presupuestos no mensuales (semanal/anual), copiado automático sin confirmación, notificaciones/alertas de límite, listar o contar categorías con gasto pero sin presupuesto, y bloqueo/solo-lectura de meses pasados.

## Requirements

### Requirement: Un presupuesto por categoría, mes y usuario

El sistema DEBE permitir como máximo un registro `presupuesto` por usuario para cada combinación `(categoria_id, anio, mes)`. Editar el `monto` de un mes NO DEBE afectar el `monto` de ningún otro mes de la misma categoría. Toda lectura y escritura DEBE limitarse al usuario autenticado.

#### Scenario: Editar un mes no afecta a otro
- GIVEN una categoría tiene presupuesto en junio y en julio
- WHEN el usuario edita el `monto` de julio
- THEN el `monto` de junio permanece sin cambios

#### Scenario: Duplicado en el mismo mes es rechazado
- GIVEN ya existe un presupuesto para "Comida" en agosto del usuario actual
- WHEN el usuario intenta crear otro presupuesto de "Comida" en agosto
- THEN el sistema bloquea la creación y muestra un error

#### Scenario: Dos usuarios pueden presupuestar la misma categoría y mes
- GIVEN el usuario A y el usuario B quieren presupuestar "Comida" en septiembre, cada uno el suyo
- WHEN cada uno crea su propio presupuesto
- THEN ambas creaciones se completan sin conflicto, y ninguno ve el presupuesto del otro

### Requirement: Lista limitada a presupuestos creados del mes

El sistema DEBE listar, para el mes seleccionado, únicamente los registros `presupuesto` creados explícitamente para ese mes; NO DEBE mostrar ni contar categorías con gasto pero sin presupuesto en ese mes.

#### Scenario: Categoría con gasto sin presupuesto queda fuera
- GIVEN "Suscripciones" tiene movimientos en el mes seleccionado pero ningún `presupuesto` para ese mes
- WHEN `/presupuestos` renderiza el mes seleccionado
- THEN "Suscripciones" no aparece en la lista ni se cuenta en el resumen

### Requirement: Resumen del mes solo suma presupuestos listados

El sistema DEBE mostrar una barra de resumen sobre la lista con el total presupuestado y el total gastado, sumados únicamente sobre los `presupuesto` listados para el mes seleccionado.

#### Scenario: Resumen excluye gasto no presupuestado
- GIVEN el mes tiene dos presupuestos, Comida ($1000/$800) y Transporte ($500/$600)
- WHEN el resumen renderiza
- THEN muestra total presupuestado $1500 y total gastado $1400, sin incluir gasto de categorías sin presupuesto

### Requirement: Cálculo de gastado idéntico a Categorías

El sistema DEBE calcular "gastado" por categoría como la suma de `ABS(movimiento.monto)` de movimientos con `monto < 0`, filtrados por `categoria_id` y `fecha` dentro del mes calendario seleccionado — mismo criterio que `fetchCategoriasConGasto`.

#### Scenario: Mismo resultado que Categorías
- GIVEN una categoría tiene los mismos movimientos visibles en `/categorias` y `/presupuestos` para el mismo mes
- WHEN el gastado se calcula en ambas pantallas
- THEN ambas reportan el mismo monto

### Requirement: Barra tope-100% con excedente en texto

El sistema DEBE topar el ancho de la barra de progreso por categoría en 100%, ponerla en rojo cuando gastado supera presupuestado, y mostrar el excedente como texto separado en vez de extender la barra.

#### Scenario: Gasto dentro del presupuesto
- GIVEN gastado es menor que presupuestado
- WHEN la barra renderiza
- THEN su ancho es proporcional a gastado/presupuestado y no es roja

#### Scenario: Gasto excede el presupuesto
- GIVEN gastado es $1320 contra un presupuestado de $1000
- WHEN la barra renderiza
- THEN su ancho topa en 100%, la barra es roja, y aparece el texto "+$320 sobre el presupuesto" (o equivalente) separado de la barra

### Requirement: Navegación de mes anclada al mes actual

El sistema DEBE ofrecer flechas anterior/siguiente para navegar entre meses calendario, ancladas en el mes actual, sin selector de rango libre.

#### Scenario: Navegar al mes anterior
- GIVEN la vista muestra el mes actual
- WHEN el usuario activa la flecha de mes anterior
- THEN la vista muestra los presupuestos del mes calendario previo, y no se ofrece un selector de rango de fechas libre

### Requirement: Cualquier mes es totalmente editable y eliminable

El sistema DEBE permitir editar y eliminar un `presupuesto` de forma idéntica sin importar si su mes es pasado o el mes vigente; no existe regla de bloqueo por mes cerrado.

#### Scenario: Editar y eliminar un presupuesto de un mes pasado
- GIVEN existe un presupuesto de un mes anterior al actual
- WHEN el usuario edita su `monto`, y en otra ocasión lo elimina
- THEN el sistema acepta ambas operaciones igual que lo haría en el mes vigente

### Requirement: Creación vía categoría y monto positivo

El sistema DEBE permitir crear un `presupuesto` seleccionando una categoría e ingresando un `monto` positivo; el selector de categoría NO DEBE incluir categorías con `tipo = 'ingreso'`.

#### Scenario: Categorías de ingreso no son seleccionables
- GIVEN el selector de categoría está abierto
- WHEN se inspeccionan sus opciones
- THEN ninguna categoría con `tipo = 'ingreso'` aparece

#### Scenario: Monto no positivo es rechazado (SUPUESTO)
> Supuesto: `monto` debe ser `> 0`; no resuelto explícitamente en la propuesta.
- GIVEN el usuario ingresa `monto=0` o un valor negativo
- WHEN intenta enviar el formulario
- THEN el sistema bloquea el envío y muestra un error de validación

### Requirement: Copiar presupuestos del mes anterior solo si el mes está vacío

El sistema DEBE ofrecer la acción "Copiar presupuestos de [mes anterior]" únicamente cuando el mes seleccionado no tiene ningún `presupuesto`, y DEBE ejecutar la copia solo por acción explícita del usuario, nunca de forma automática.

#### Scenario: Acción visible solo en mes totalmente vacío (SUPUESTO)
> Supuesto: la acción se ofrece solo cuando el mes está totalmente vacío; el copiado parcial no está especificado.
- GIVEN el mes seleccionado no tiene presupuestos y el mes anterior sí
- WHEN `/presupuestos` renderiza
- THEN la acción "Copiar presupuestos de [mes anterior]" es visible
- AND si el mes seleccionado ya tuviera al menos un presupuesto, la acción no se mostraría

#### Scenario: Copiar crea un registro por presupuesto del mes anterior
- GIVEN el mes anterior tiene 3 presupuestos y el mes seleccionado está vacío
- WHEN el usuario activa la acción de copiar
- THEN se crean 3 nuevos registros `presupuesto` para el mes seleccionado, editables después

#### Scenario: La copia nunca ocurre automáticamente
- GIVEN el mes seleccionado no tiene presupuestos
- WHEN el usuario navega a ese mes sin activar la acción de copiar
- THEN no se crea ningún `presupuesto` automáticamente
</content>
