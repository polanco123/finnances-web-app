## 1. Component Setup

- [x] 1.1 Create `components/movement/movement-list-item.tsx` with TypeScript interface for props
- [x] 1.2 Create `components/movement/movement-list-item.css` with Material Design styles
- [x] 1.3 Import CUENTAS and CATEGORIAS from `@/lib/catalogs/`

## 2. Core Implementation

- [x] 2.1 Implement currency formatting function for monto (positive/negative styling)
- [x] 2.2 Implement catalog resolution for cuenta_id and categoria_id with fallback handling
- [x] 2.3 Create Material Design responsive layout with CSS (sombras, bordes redondeados, jerarquía visual)
- [x] 2.4 Handle optional fields (descripcion, hora, notas) - display only when present
- [x] 2.5 Add hover states and transitions for interactive feedback

## 3. Integration

- [x] 3.1 Update `app/movimientos/page.tsx` to import and use MovementListItem component
- [x] 3.2 Replace `<pre>{JSON.stringify(movements, null, 2)}</pre>` with mapped MovementListItem components
- [x] 3.3 Pass movement data as props to each MovementListItem

## 4. Verification

- [x] 4.1 Run `npm run lint` to verify no linting errors
- [x] 4.2 Run `npm run build` to verify compilation succeeds
