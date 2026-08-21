# Delta for movimientos-infinite-scroll

## ADDED Requirements

### Requirement: Transfer pair grouping into a merged display item

As movimientos load (initial page and subsequent scroll-triggered pages), the system SHALL derive a display list from the flat `movements` state where any two rows sharing the same non-null `transferencia_id` are collapsed into a single synthetic merged display item, evaluated after each load (initial fetch and every appended batch). Rows with a null `transferencia_id`, or a `transferencia_id` whose sibling is not yet loaded, SHALL render individually and be unaffected by this grouping.

#### Scenario: Both legs present after a load are grouped

- **GIVEN** the `movements` state contains an origen row and a destino row sharing the same non-null `transferencia_id`, both loaded (whether from the same page or across different pages)
- **WHEN** the display list is derived for rendering
- **THEN** the system SHALL produce exactly one merged display item for this pair in the rendered list, in place of two individual items

#### Scenario: Only one leg present renders individually

- **GIVEN** the `movements` state contains a row with a non-null `transferencia_id` whose sibling has not yet been loaded
- **WHEN** the display list is derived for rendering
- **THEN** the system SHALL render this row as its own individual display item
- **AND** grouping SHALL re-evaluate automatically on the next load (initial or scroll-triggered) without requiring a full list reset

### Requirement: Stable key for merged display items

A merged display item SHALL use a stable list key derived from the pair's shared `transferencia_id` (e.g. `transferencia_id` itself, or a composite that includes it), distinct in format from the plain `id`-based key used for individual (ungrouped) rows, so that a merged item's key never collides with any individual row's `id`-based key. This key SHALL remain stable across re-renders and across additional pages loading, as long as the same pair remains merged.
(Reconciles with the existing "Stable list item identity" requirement: individual rows continue to use their `id` as key; only merged items use the new `transferencia_id`-derived key.)

#### Scenario: Merged item key does not collide with individual row keys

- **GIVEN** a merged display item derived from a pair with `transferencia_id` value `T1`, alongside individual rows keyed by their own `id` values
- **WHEN** the list renders
- **THEN** the merged item's key SHALL be distinguishable from any individual row's `id`-based key (e.g. namespaced or prefixed so it cannot equal a raw `id` value)
- **AND** no two rendered display items SHALL share the same key

#### Scenario: No key warnings across the unmerged-to-merged transition during scroll

- **GIVEN** page 1 has loaded an origen row (rendered individually, keyed by its own `id`) and the user continues scrolling
- **WHEN** page 2 loads and includes the matching destino row, causing the pair to collapse into a merged display item
- **THEN** the individual origen item's key SHALL be removed from the rendered list and replaced by the merged item's `transferencia_id`-derived key
- **AND** the transition SHALL NOT produce a duplicate-key or missing-key condition (e.g. React key warnings) at any point during or after the transition

### Requirement: Grouping preserves list correctness under pagination and concurrent inserts

Grouping matched `transferencia_id` pairs into a merged item SHALL NOT cause any row to visually disappear, be duplicated, or be double-counted, and SHALL be consistent with the existing "List correctness under concurrent inserts" requirement. Scroll-triggered fetches SHALL continue to only append rows to the underlying `movements` state; grouping is purely a rendering-time derivation over that state and SHALL NOT mutate or drop entries from it.
(Reconciles with the existing "List correctness under concurrent inserts" requirement, extending it to also cover the display-item derivation step.)

#### Scenario: Transferencia origen on page 1, destino on page 2 — no disappearance or duplication

- **GIVEN** a transferencia's origen row loads as part of page 1 and its destino row has not yet loaded
- **WHEN** page 1 finishes rendering
- **THEN** the origen row SHALL be visible as a correct, individual (unmerged) card, with its own signed amount and account name
- **WHEN** the user scrolls further and page 2 loads, containing the destino row
- **THEN** the display list SHALL transition to showing exactly one merged card for this pair (not two individual cards, and not zero cards)
- **AND** no other already-rendered row from page 1 SHALL disappear or be duplicated as a result of this transition

#### Scenario: Concurrent insert of an unrelated movimiento does not disrupt grouping

- **GIVEN** the user has loaded 2 pages including one already-merged transfer pair
- **WHEN** an unrelated movimiento (not part of any transferencia) is inserted independently and the user scrolls to trigger a further fetch
- **THEN** the already-merged transfer card SHALL remain merged and unchanged
- **AND** all other already-rendered display items SHALL remain present exactly once each, consistent with the existing "Concurrent insert does not duplicate or drop rendered rows" scenario
