# Delta for movimientos-infinite-scroll

## ADDED Requirements

### Requirement: Local list patch after edit, delete and undo

After a successful edit, delete or undo, the system SHALL patch the loaded `movements` state locally (update, remove or re-insert rows) and MUST NOT reset pagination or refetch the full list. Re-inserted rows SHALL be placed by (`created_at`, `id`) descending order, and ids MUST remain unique. Merged transfer grouping SHALL be re-derived from the patched state. Pagination cursor and "end of data" state MUST be preserved.

#### Scenario: Edit patches in place
- GIVEN 30 movements are loaded across 3 pages
- WHEN one row is edited
- THEN only that row changes, all 30 remain, and no refetch occurs

#### Scenario: Delete removes row
- GIVEN a loaded movement is deleted
- THEN it is removed from the list and later pages still load from the existing cursor

#### Scenario: Undo re-inserts in order
- GIVEN a deleted row from page 2 is restored
- THEN it reappears between its neighbors by `created_at`/`id` with no duplicates

#### Scenario: Transfer delete and undo
- GIVEN a merged transfer is deleted then restored
- THEN both legs are removed together, then re-added and re-merged

#### Scenario: Dependent views refresh
- GIVEN the page shows balance-dependent hints
- WHEN an edit, delete or undo succeeds
- THEN those hints are refreshed
