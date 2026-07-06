## Context

The movement system currently handles single movements (gasto/ingreso) with a toggle switch. The database schema supports `es_transferencia` and the "Transferencia" category exists in the catalog. The form needs to be extended to support a transfer mode that creates paired movements.

## Goals / Non-Goals

**Goals:**
- Allow users to transfer money between accounts via a single form submission
- Create two linked movements (negative origin, positive destination) atomically
- Maintain backward compatibility with existing gasto/ingreso movements
- Provide clear visual feedback when in transfer mode

**Non-Goals:**
- Recurring/scheduled transfers
- Multi-account transfers (more than 2 accounts)
- Transfer fees or currency conversion
- Undo/delete transfer pairs (future enhancement)

## Decisions

### Decision 1: Transfer mode as a third toggle option
**Choice**: Add "Transferencia" as a third state in the type selector, alongside "Gasto" and "Ingreso".

**Rationale**: Keeps the UI simple — one control for movement type. Users understand the mental model: select what kind of movement you're making.

**Alternative considered**: Separate "Transfer" button/form. Rejected because it fragments the UX and requires navigation away from the main form.

### Decision 2: Two movements with es_transferencia flag
**Choice**: Create two movements, both with `es_transferencia: true`.

**Rationale**: The schema supports this pattern. The `es_transferencia` flag identifies transfer movements. Future: add `transferencia_id` for linking pairs.

**Alternative considered**: Single movement with origin/destination fields. Rejected because the current schema doesn't support this and would require migration.

### Decision 3: Sequential insert (not transactional)
**Choice**: Insert the two movements sequentially using two `supabase.from('movimiento').insert()` calls. If the second fails, the first remains (inconsistent state).

**Rationale**: Supabase JS client doesn't expose transaction APIs for client-side inserts. The risk of partial failure is low (network issues). A future enhancement could use a Supabase Edge Function for true atomicity.

**Alternative considered**: Use a Supabase RPC/function for atomic insert. Deferred to future iteration due to complexity.

### Decision 4: Category auto-set to "Transferencia"
**Choice**: When transfer mode is active, automatically set `categoria_id` to the "Transferencia" category and hide the category selector.

**Rationale**: Transfers are not expenses or income — they don't belong to any spending category. The "Transferencia" category already exists in the catalog.

## Risks / Trade-offs

- **Partial failure**: If the second insert fails after the first succeeds, one movement exists without its pair. Mitigation: Show clear error to user, allow manual retry. Future: use Supabase Edge Functions for atomicity.
- **Form complexity**: Adding a third toggle state increases form logic. Mitigation: Keep conditional rendering clean with explicit state checks.
- **List display**: Transfer movements appear as two separate entries in the list. Mitigation: Visual indicator (icon/badge) and "Transferencia: Origen → Destino" label.
