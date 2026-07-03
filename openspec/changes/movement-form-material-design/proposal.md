## Why

El formulario de movimientos actualmente usa estilos inline básicos sin un diseño consistente. Se necesita rediseñar con estilos Material Design para mejorar la experiencia de usuario y crear un archivo de tema global para unificar colores primarios, secundarios y de acento en todo el proyecto.

## What Changes

- Crear un archivo de tema CSS (`lib/theme.css`) con variables para colores primario, secundario y de acento
- Rediseñar `components/movement/movement-form.jsx` con estilos Material Design
- Actualizar `components/movement/movement-list-item.css` para usar las variables del tema global
- Agregar estilos para inputs, selects, textareas y botones con diseño Material Design

## Capabilities

### New Capabilities

- `material-theme`: Variables CSS globales para colores primario, secundario y de acento del proyecto
- `material-form`: Componentes de formulario con estilos Material Design (inputs, selects, textareas, botones)

### Modified Capabilities

<!-- No hay capacidades existentes que cambien sus requisitos -->

## Impact

- **Archivos nuevos**: `lib/theme.css`, `components/movement/movement-form.css`
- **Archivos modificados**: `components/movement/movement-form.jsx`, `components/movement/movement-list-item.css`
- **Dependencias**: No se agregan nuevas dependencias, se usa CSS puro con variables custom
