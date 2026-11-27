# Review Ledger: edit-delete-movement (4R, first pass)

Base f09ad8d..HEAD on feat/edit-delete-movement-pr3-ui. Statuses updated after the review-fix batch (see Status column).
Duplicates merged: R3-001 = R4-003, R3-005 = R4-002, R3-007 = R4-005, R3-008 ~ R1-001.

| id | lens | location | severity | evidence | status |
|---|---|---|---|---|---|
| R3-001 / R4-003 | reliability, resilience | movement-edit-dialog.tsx:22-27; page.tsx:170-174 | CRITICAL | Failed edit shows its error in a page banner behind the modal overlay; the dialog stays open with no feedback. No test. | fixed: dialog-level role=alert error, page banner hidden while dialog open, cleared on dismiss; dialog + page tests |
| R4-001 | resilience | page.tsx:83 (loadNextPage) | CRITICAL | Page append has no dedupe by id; an in-flight page can re-add a deleted row or duplicate a restored row (duplicate React keys). | fixed: patch epoch discards stale page + appendNewRows id dedupe; interleaving tests |
| R3-002 | reliability | page.tsx:205-224; movement-grouping.ts:41-46 | CRITICAL | Unpaired transfer leg (legs on different pages or skipped by insertSorted) renders as a plain row and can be edited/deleted alone, breaking atomicity. | fixed: lone transfer legs render non-selectable; page tests |
| R1-001 | risk | migration:58-66 | CRITICAL (WARNING if single-tenant, sign-up disabled) | UPDATE/DELETE policies USING (true) with no ownership predicate. | fixed (SQL, untested here): enforced by user_id; UPDATE/DELETE policies use auth.uid() = user_id (UPDATE also WITH CHECK), migration pre-check aborts on null user_id, restore relies on the INSERT policy; public SELECT policy pre-existing and out of scope |
| R1-002 | risk | migration:58-66; movement-service.ts | WARNING | MSI and transfer-leg restrictions live only in UI and RPCs; direct PostgREST writes bypass them. | fixed (SQL, untested here): guard trigger + transaction-local flag set by RPCs |
| R1-003 | risk | migration:168-204 | WARNING | restore_transferencia trusts client jsonb (amounts, signs, net zero); can forge balances. Same for restoreMovimiento. | fixed (SQL, untested here): restore_transferencia validates legs; restoreMovimiento only reinserts rows the client got from DELETE (INSERT stays unguarded, documented) |
| R3-004 | reliability | movement-service.ts:106-108,157-163; migration:166-170 | WARNING | Restore inserts only SELECT_FIELDS; unselected columns restored as NULL/default. | fixed: delete returns all columns (select()), restore re-sends full rows; service tests |
| R3-005 / R4-002 | reliability, resilience | use-undo-action.ts:57-67 | WARNING | dismiss() before await undo(); failed undo has no retry. | fixed: run() keeps slot and re-arms on failure, hook rethrows; hook + page tests |
| R4-004 | resilience | use-movement-actions.ts:81,95 | WARNING | catch {} drops original errors; no logging. | fixed: console.error with the original error in attempt/undo catch; tests |
| R3-003 | reliability | migration | WARNING | Trigger and RPCs have no automated tests; tasks 2.2, 2.5, 7.2 manual and pending. | open: SQL still has no automated tests (manual staging notes updated in tasks.md) |
| R3-006 | reliability | page.test.tsx | WARNING | No page-level test for hover pause, hintRefreshToken refresh, pagination scenarios. | fixed: page tests for hint refresh token, hover pause/resume, pagination interleavings, undo retry |
| R2-001 | readability | page.tsx:~182-224 | WARNING | 45-line map callback with 3 near-identical branches; extract row component. | open (deferred, readability batch) |
| R2-004 | readability | movement-form.jsx | WARNING | Duplicated validation; isEdit branching in ~8 places. | open (deferred, readability batch) |
| R2-006 | readability | *.css | WARNING | Hard-coded z-index/colors/sizes instead of tokens (unchecked vs DESIGN_SYSTEM.md). | open (deferred, readability batch) |
| R2-012 | readability | whole diff | WARNING | Large stacked diff; state base and scope per PR. | open (deferred) |
| R2-002/003/005/007/008/009/010/011, R4-005, R4-006, R3-007 | various | various | SUGGESTION | Casts, repeated MSI rule, nested defaults, selector coupling, naming, error never cleared, touch pause. | R4-005 / R3-007 fixed (error cleared on dialog dismiss); R2-* open (deferred); R4-006 open |
