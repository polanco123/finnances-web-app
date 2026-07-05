## Why

El formulario de movimientos actualmente no distingue entre gastos e ingresos. El usuario necesita un selector para determinar si el movimiento es un gasto o ingreso, con valor por defecto de gasto. Si es un gasto, el monto debe enviarse como negativo al API.

## What Changes

- Agregar un selector de tipo de movimiento (gasto/ingreso) al formulario
- El selector tendrá un diseño de toggle/switch Material Design
- Por defecto, el formulario inicia en modo "Gasto"
- Si el tipo es "Gasto", el monto se enviará como negativo al API
- Si el tipo es "Ingreso", el monto se enviará como positivo al API

## Capabilities

### New Capabilities

- `movement-type-selection`: Selector de tipo de movimiento (gasto/ingreso) con toggle Material Design

### Modified Capabilities

- `material-form`: Agregar estilos para el toggle/switch de tipo de movimiento

## Impact

- **Archivos modificados**: `components/movement/movement-form.jsx`, `components/movement/movement-form.css`, `components/movement/movement-mapper.js`
- **Dependencias**: No se agregan nuevas dependencias
