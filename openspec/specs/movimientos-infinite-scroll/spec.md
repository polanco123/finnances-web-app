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
</content>
