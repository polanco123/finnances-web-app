## Why

La página de movimientos actualmente muestra los datos de movimientos como JSON crudo (`<pre>{JSON.stringify(movements, null, 2)}</pre>`), lo cual no es user-friendly ni funcional para el usuario final. Se necesita un componente de lista para mostrar la información de cada movimiento en un formato legible y estructurado.

## What Changes

- Crear un nuevo componente `MovementListItem` que muestre la información de un movimiento individual en formato de lista
- El componente mostrará: monto, categoría, cuenta, fecha, hora, notas
- El componente aplicará diseño tipo Material Design con CSS puro (sombras, bordes redondeados, jerarquía visual)
- Se actualizará la página de movimientos para usar el nuevo componente en lugar del JSON crudo

## Capabilities

### New Capabilities

- `movement-display`: Visualización de información de movimientos en formato de lista con monto, categoría, cuenta, fecha/hora y notas

### Modified Capabilities

<!-- No hay capacidades existentes que cambien sus requisitos -->

## Impact

- **Archivos nuevos**: `components/movement/movement-list-item.tsx`, `components/movement/movement-list-item.css`
- **Archivos modificados**: `app/movimientos/page.tsx`
- **Dependencias**: No se agregan nuevas dependencias, se usa CSS puro con variables custom
