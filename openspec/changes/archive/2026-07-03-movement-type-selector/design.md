## Context

La aplicación de finanzas web actualmente tiene un formulario de movimientos que no distingue entre gastos e ingresos. El usuario necesita un selector para determinar el tipo de movimiento. El proyecto usa Next.js 15 (App Router), React 19, TypeScript, y tiene un sistema de estilos Material Design con CSS custom properties.

## Goals / Non-Goals

**Goals:**
- Agregar un selector de tipo de movimiento (gasto/ingreso) al formulario
- Implementar un toggle/switch Material Design para el selector
- Establecer "Gasto" como valor por defecto
- Enviar el monto como negativo cuando el tipo sea "Gasto"
- Enviar el monto como positivo cuando el tipo sea "Ingreso"

**Non-Goals:**
- No se modifica la lógica de negocio existente más allá del signo del monto
- No se agregan funcionalidades nuevas al formulario más allá del selector
- No se modifica el esquema de base de datos
- No se agregan nuevas dependencias

## Decisions

### 1. Toggle Switch Material Design
**Decisión**: Implementar un toggle/switch estilo Material Design en lugar de un checkbox o botón de radio.
**Razón**: El toggle switch es más intuitivo para dos estados mutuamente excluyentes y se alinea con el diseño Material Design existente.
**Alternativa considerada**: Checkbox o botón de radio. Rechazado porque el toggle switch proporciona una mejor experiencia de usuario para este caso de uso.

### 2. Manejo del signo del monto
**Decisión**: Aplicar el signo del monto en el componente del formulario antes de enviar al mapper.
**Razón**: Mantener la lógica de presentación separada de la lógica de negocio. El mapper y servicio no necesitan conocer el tipo de movimiento.
**Flujo**:
1. Usuario ingresa monto positivo
2. Selector determina tipo (gasto/ingreso)
3. Al enviar, si es gasto → monto * -1
4. Si es ingreso → monto se mantiene positivo

### 3. Estado del tipo de movimiento
**Decisión**: Usar un estado `tipoMovimiento` con valores 'gasto' o 'ingreso', con valor por defecto 'gasto'.
**Razón**: Simple y claro. El estado se inicializa como 'gasto' y se puede cambiar con el toggle.

### 4. Estilos CSS
**Decisión**: Agregar estilos para el toggle switch en `movement-form.css` usando las variables del tema existente.
**Razón**: Consistencia con el sistema de estilos Material Design ya implementado.

## Risks / Trade-offs

- **Confusión de usuario**: El usuario podría no entender que el monto siempre se ingresa positivo. → Mitigación: Agregar un label claro que indique "Gasto" o "Ingreso" junto al toggle.
- **Retroalimentación visual**: El usuario necesita ver claramente en qué modo está. → Mitigación: Cambiar el color del toggle y el label según el modo seleccionado.
