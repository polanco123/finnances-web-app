# movimientos-infinite-scroll

## Purpose

Scroll-triggered, keyset-paginated loading of movimientos on `/movimientos`: 10 records per batch, fetched incrementally as the user scrolls instead of once on mount, with a full reset to page 1 on new-movimiento creation and a stable per-row `id`-based list key.

## Requirements

### Requirement: Initial page load
On first load, the system SHALL fetch and display the 10 movimientos with the most recent `created_at`, ordered descending.

#### Scenario: More than 10 movimientos exist
- GIVEN the movimiento table has more than 10 rows
- WHEN `/movimientos` loads for the first time
- THEN the system SHALL fetch exactly 10 movimientos ordered by `created_at` descending and render them

#### Scenario: Fewer than 10 movimientos exist
- GIVEN the movimiento table has fewer than 10 rows
- WHEN the page loads
- THEN the system SHALL display all available rows
- AND SHALL treat pagination as already complete (no more pages)

### Requirement: Scroll-triggered batch loading
As the user scrolls the list near its end, the system SHALL automatically fetch and append the next 10 movimientos using keyset pagination on (`created_at`, `id`) relative to the last-loaded row, without any manual "load more" control.

#### Scenario: Scrolling near the end loads the next batch
- GIVEN the initial 10 movimientos are rendered and more exist beyond them
- WHEN the user scrolls until the last rendered row nears the end of the visible area
- THEN the system SHALL fetch the next 10 movimientos whose (`created_at`, `id`) is less than the last-loaded row's
- AND SHALL append them without removing or reordering already-rendered rows

#### Scenario: No manual trigger required
- GIVEN a scroll-triggered fetch has occurred
- WHEN the next batch loads
- THEN the system SHALL NOT require the user to click a "load more" button or other manual control

### Requirement: End of data
The system SHALL stop fetching once a batch returns fewer than 10 rows, and further scrolling past that point SHALL NOT trigger more fetches or show a stuck loading indicator.

#### Scenario: Last batch is smaller than the batch size
- GIVEN a batch fetch returns 7 movimientos
- WHEN those 7 are appended
- THEN the system SHALL mark pagination as complete and SHALL NOT fetch again even if the user keeps scrolling

#### Scenario: Scrolling past a fully loaded list
- GIVEN pagination is marked complete
- WHEN the user scrolls further
- THEN the system SHALL NOT issue additional fetch requests
- AND SHALL NOT display a loading indicator at the bottom of the list

### Requirement: Reset to page 1 on new movimiento
When a movimiento is successfully created via the existing form, the system SHALL discard all accumulated pages and reset the list to just the 10 most recent movimientos.

#### Scenario: Creating a movimiento resets accumulated pages
- GIVEN the user has scrolled and loaded 3 pages (30 movimientos)
- WHEN a new movimiento is created and creation succeeds
- THEN the system SHALL discard pages 2 and 3 and refetch only the 10 most recent movimientos
- AND the newly created movimiento SHALL appear in that reset list, as the most recent entry

### Requirement: Stable list item identity
Each rendered movimiento row SHALL use the movimiento's `id` column as its list key. The system MUST NOT use array index as the key.

#### Scenario: Reset does not corrupt item identity
- GIVEN the list is reset per "Reset to page 1 on new movimiento", changing which movimientos occupy which position
- WHEN the list re-renders
- THEN each row's identity SHALL be keyed by its `id`
- AND no row SHALL retain stale data from a different movimiento that previously occupied the same position

#### Scenario: Appended batch preserves existing rows' identity
- GIVEN 10 movimientos are rendered and a scroll-triggered batch of 10 more is appended
- WHEN the appended rows render
- THEN all 20 rows SHALL keep a key derived from their own `id`, with no position-based key collisions

### Requirement: Loading indicator during pagination
While a subsequent batch (page 2+) is fetching, the system SHALL show a loading indicator distinct from the full-page "Cargando movimientos..." message, which is reserved for initial load only.

#### Scenario: Full-page message on first load only
- GIVEN no movimientos have loaded yet
- WHEN the initial fetch is in progress
- THEN the system SHALL display the full-page "Cargando movimientos..." state

#### Scenario: Inline indicator during subsequent fetch
- GIVEN the initial 10 movimientos are already rendered
- WHEN a scroll-triggered fetch for the next batch is in progress
- THEN the system SHALL show a small loading indicator at the bottom of the list instead of the full-page message
- AND already-rendered movimientos SHALL remain visible and unaffected

### Requirement: List correctness under concurrent inserts
While the user has loaded more than one page without triggering a reset, movimientos inserted by any means SHALL NOT cause already-rendered rows to be duplicated or to disappear from the visible list; scroll-triggered fetches SHALL only append rows.

#### Scenario: Concurrent insert does not duplicate or drop rendered rows
- GIVEN the user has scrolled and loaded 2 pages (20 movimientos) without triggering a reset
- WHEN a movimiento is inserted independently of this user's own reset-triggering creation flow, and the user then scrolls to trigger a further fetch
- THEN all 20 already-rendered movimientos SHALL still be present, exactly once each, unchanged
- AND the newly fetched page SHALL only add rows to the end of the list

#### Scenario: No duplicate ids across pages
- GIVEN the user scrolls through multiple pages while movimientos continue to be created elsewhere
- WHEN each new page loads
- THEN no movimiento `id` SHALL appear more than once across all rendered rows

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
</content>
