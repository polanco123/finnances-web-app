## Context

La aplicación de finanzas web actualmente tiene una página de movimientos que muestra datos crudos en formato JSON. El proyecto usa Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS y shadcn/ui. Los componentes de movimiento existentes están en `components/movement/` y usan JavaScript/JSX. Los catálogos de cuentas y categorías están en `data/` y se importan desde `lib/catalogs/`.

## Goals / Non-Goals

**Goals:**
- Crear un componente `MovementListItem` que muestre información de un movimiento en formato de lista
- Mostrar: monto, categoría, cuenta, fecha/hora, notas
- Aplicar diseño tipo Material Design con sombras, bordes redondeados y jerarquía visual clara
- Crear un componente reutilizable y tipado con TypeScript

**Non-Goals:**
- No se modifica la lógica de negocio existente
- No se agregan funcionalidades de edición o eliminación
- No se modifica el esquema de base de datos
- No se agregan nuevas dependencias (se usará CSS puro con variables custom)

## Decisions

### 1. Componente funcional con TypeScript
**Decisión**: Crear `MovementListItem` como componente funcional tipado.
**Razón**: Consistencia con la arquitectura del proyecto (Next.js App Router + React 19). TypeScript mejora la mantenibilidad y detecta errores en tiempo de compilación.
**Alternativa considerada**: Usar JavaScript como los componentes existentes. Rechazado porque el proyecto está migrando a TypeScript y los archivos nuevos deben ser tipados.

### 2. Diseño Material Design con CSS puro
**Decisión**: Implementar estilos usando CSS puro con enfoque Material Design, sin depender de Tailwind CSS.
**Razón**: El usuario solicitó explícitamente no usar Tailwind y aplicar un diseño tipo Material. CSS puro permite control total sobre sombras, transiciones y jerarquía visual sin dependencias adicionales.
**Alternativa considerada**: Tailwind CSS (ya configurado en el proyecto). Rechazado por solicitud explícita del usuario.
**Elementos Material Design a implementar**:
- Sombras elevación (`box-shadow`)
- Bordes redondeados (`border-radius: 8px`)
- Jerarquía visual con tipografía y colores
- Estados hover con transiciones suaves
- Espaciado consistente (multiplos de 8px)

### 3. Estructura del componente
**Decisión**: Recibir un objeto `movimiento` como prop con tipado explícito.
**Razón**: Flexibilidad para el consumidor del componente. El tipo de datos viene de Supabase con campos conocidos.
**Estructura de datos**:
```typescript
interface MovimientoListItemProps {
  movimiento: {
    monto: number
    descripcion?: string | null
    fecha: string
    hora?: string | null
    cuenta_id: string
    categoria_id: string
    notas?: string | null
  }
}
```

### 4. Resolución de nombres de cuenta y categoría
**Decisión**: Importar `CUENTAS` y `CATEGORIAS` desde `lib/catalogs/` para resolver IDs a nombres.
**Razón**: Los catálogos ya existen y están optimizados. El componente solo necesita mostrar el nombre, no toda la info de la cuenta/categoría.

## Risks / Trade-offs

- **Rendimiento**: Si se listan muchos movimientos, el componente se renderizará muchas veces. → Mitigación: El componente es ligero, no tiene estado interno ni efectos secundarios. La paginación ya está implementada en la página (limit 10).
- **Flexibilidad**: El componente muestra información fija. → Mitigación: Se puede extender con props opcionales en el futuro si se necesita más personalización.
- **Dependencia de catálogos**: Si un ID de cuenta/categoría no existe en el catálogo, mostrará el ID en lugar del nombre. → Mitigación: Mostrar fallback con el ID o "Sin categoría/cuenta".
- **Mantenimiento de estilos CSS**: CSS puro requiere mantenimiento manual de estilos. → Mitigación: Usar CSS custom properties para valores reutilizables y mantener consistencia con el sistema de diseño Material.
