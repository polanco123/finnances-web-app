## 1. Mapper Updates

- [x] 1.1 Add `crearMovimientoTransferencia` function to `movement-mapper.js` that returns two movement objects (one negative for origin, one positive for destination) with `es_transferencia: true`
- [x] 1.2 Update `CAMPOS` and `MOVIMIENTO_DEFAULT` if needed for transfer-specific fields

## 2. Service Updates

- [x] 2.1 Add `insertarTransferencia(movimientoOrigen, movimientoDestino)` function to `movement-service.js` that inserts both movements sequentially using the Supabase client
- [x] 2.2 Ensure both inserts set `es_transferencia: true`

## 3. Form UI Changes

- [x] 3.1 Update `movement-form.jsx` state to support three types: `'gasto'`, `'ingreso'`, `'transferencia'`
- [x] 3.2 Modify the type toggle to cycle through all three options with appropriate labels and colors
- [x] 3.3 Add conditional rendering: when type is `'transferencia'`, show two account selectors ("Cuenta origen" and "Cuenta destino") and hide the category selector
- [x] 3.4 Add validation: prevent submission if origin and destination accounts are the same
- [x] 3.5 Auto-set `categoria_id` to the "Transferencia" category when in transfer mode

## 4. Form Submission Logic

- [x] 4.1 Update `handleSubmit` to branch on transfer type: call `crearMovimientoTransferencia` from mapper and `insertarTransferencia` from service
- [x] 4.2 Ensure gasto/ingreso paths remain unchanged (backward compatibility)
- [x] 4.3 Handle errors from dual insert and display appropriate error message

## 5. List Display Updates

- [x] 5.1 Update `movement-list-item.tsx` to detect `es_transferencia` movements and show a "Transferencia" badge
- [x] 5.2 For transfer movements, display account name with visual indicator
- [x] 5.3 Update `app/movimientos/page.tsx` to fetch `es_transferencia` field for display

## 6. Verification

- [x] 6.1 Run `npm run lint` to verify no linting errors
- [x] 6.2 Run `npm run build` to verify compilation succeeds
- [x] 6.3 Test transfer flow: select transfer mode, pick accounts, submit, verify two movements appear in list
