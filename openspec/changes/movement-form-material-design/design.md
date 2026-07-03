## Context

La aplicación de finanzas web actualmente tiene un formulario de movimientos con estilos inline básicos. El proyecto usa Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS y shadcn/ui. Ya existe un componente `MovementListItem` con estilos Material Design usando CSS custom properties. Se necesita unificar los estilos creando un tema global.

## Goals / Non-Goals

**Goals:**
- Crear un archivo de tema CSS (`lib/theme.css`) con variables para colores primario, secundario y de acento
- Rediseñar el formulario de movimientos con estilos Material Design
- Actualizar el componente `MovementListItem` para usar el tema global
- Crear un sistema de diseño consistente para todo el proyecto

**Non-Goals:**
- No se modifica la lógica de negocio existente
- No se agregan funcionalidades nuevas al formulario
- No se modifica el esquema de base de datos
- No se agregan nuevas dependencias (se usa CSS puro con variables custom)

## Decisions

### 1. Tema global CSS
**Decisión**: Crear `lib/theme.css` con variables CSS para colores y espaciado.
**Razón**: Centraliza los estilos en un solo archivo, facilita cambios de tema y mantiene consistencia.
**Elementos del tema**:
- Colores: primario, secundario, acento, éxito, error
- Texto: primario, secundario
- Fondos: background, surface
- Bordes y sombras
- Espaciado (multiplos de 4px)
- Bordes redondeados

### 2. Formulario Material Design
**Decisión**: Rediseñar el formulario con estilos Material Design usando CSS puro.
**Razón**: Los estilos inline actuales no son mantenibles ni consistentes. Material Design proporciona una guía clara para formularios.
**Elementos a implementar**:
- Inputs con borde inferior y estado focus
- Selects con estilo personalizado
- Textareas con auto-resize
- Botones con elevación y estados hover
- Labels flotantes (opcional)

### 3. Estructura de archivos CSS
**Decisión**: Separar estilos del tema (`lib/theme.css`) de estilos del formulario (`components/movement/movement-form.css`).
**Razón**: Permite reutilizar el tema en otros componentes sin duplicar código.

### 4. Actualizar MovementListItem
**Decisión**: Actualizar `movement-list-item.css` para importar el tema global.
**Razón**: Unifica los estilos y elimina duplicación de variables CSS.

## Risks / Trade-offs

- **Mantenimiento de estilos CSS**: CSS puro requiere mantenimiento manual. → Mitigación: Usar CSS custom properties para valores reutilizables y mantener consistencia con el sistema de diseño Material.
- **Compatibilidad con Tailwind**: El proyecto usa Tailwind CSS. → Mitigación: Los estilos Material Design se complementan con Tailwind, no lo reemplazan.
- **Rendimiento**: Agregar un archivo CSS adicional. → Mitigación: El archivo es ligero y se carga una sola vez.
