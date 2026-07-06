## Why

The application currently supports only single movements (gasto/ingreso). Users need to transfer money between accounts (e.g., moving cash from BBVA to Efectivo). Without a transfer feature, users must manually create two separate movements and risk forgetting to link them, making reconciliation difficult.

## What Changes

- Add a "Transferencia" toggle to the movement form that switches the form into transfer mode
- In transfer mode, the form replaces the single account selector with two selectors: "Cuenta origen" and "Cuenta destino"
- In transfer mode, the category is automatically set to "Transferencia" (hidden from user)
- On submit, the system creates TWO movements: one negative (origin account) and one positive (destination account)
- Both movements are marked with `es_transferencia: true`
- The movement list displays transfer movements with visual indication (e.g., "Transferencia: BBVA → Efectivo")

## Capabilities

### New Capabilities

- `transfer-movement`: The ability to create transfer movements between accounts, including form UI changes, dual-movement creation logic, and transfer display in the movement list

### Modified Capabilities

- `movement-type-selection`: The type selector needs to accommodate a third option ("Transferencia") alongside "Gasto" and "Ingreso", with associated form layout changes

## Impact

- `components/movement/movement-form.jsx` — Major changes: new toggle state, conditional form fields (origin/destination accounts), modified submission logic to create two movements
- `components/movement/movement-service.js` — New function to insert two movements
- `components/movement/movement-mapper.js` — New mapper function for transfer movements
- `components/movement/movement-list-item.tsx` — Display transfer-specific info (origin → destination)
- `app/movimientos/page.tsx` — May need to pass additional data for transfer display
- `data/categoria.ts` — Already has "Transferencia" category (id: transferencia), no changes needed
