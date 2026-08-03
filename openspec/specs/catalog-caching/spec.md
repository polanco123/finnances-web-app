# catalog-caching

## Purpose

Client-side catalog management: fetches `cuenta` and `categoria` data from Supabase, caches in `localStorage`, and provides synchronous access to all consumers. Replaces the hardcoded static data files with a runtime-fetched, cached catalog system. Enables the repository to be made public without exposing personal financial data.

## ADDED Requirements

### Requirement: Catalog initialization on app mount

The system SHALL fetch catalog data from Supabase on the first app load and cache it in `localStorage`. On subsequent loads, the system SHALL read from `localStorage` without making network requests.

#### Scenario: First load — cache empty

- GIVEN `localStorage` has no `finanzas:catalog:cuentas` or `finanzas:catalog:categorias` keys
- WHEN the app mounts
- THEN the system SHALL query Supabase for active `cuenta` rows (`select id, nombre, tipo; activa = true; order by nombre`)
- AND query Supabase for active `categoria` rows (`select id, nombre, tipo, es_diversion; activa = true; order by nombre`)
- AND write the results to `localStorage` as JSON
- AND populate the in-memory catalog variables

#### Scenario: Subsequent load — cache populated

- GIVEN `localStorage` contains valid `finanzas:catalog:cuentas` and `finanzas:catalog:categorias` JSON arrays
- WHEN the app mounts
- THEN the system SHALL parse the cached JSON and populate the in-memory catalog variables
- AND SHALL NOT make any Supabase network requests for catalog data

#### Scenario: Supabase fetch fails

- GIVEN `localStorage` is empty and the Supabase query returns an error
- WHEN the app mounts
- THEN the system SHALL log a warning to the console
- AND the catalog variables SHALL remain empty arrays
- AND the app SHALL continue to render (graceful degradation, no crash)

### Requirement: Synchronous catalog access

All consumers of catalog data SHALL receive the data synchronously via exported variables (`CUENTAS`, `CATEGORIAS`, `CUENTA_DEFAULT`, `CATEGORIA_DEFAULT`). These variables are populated during `initCatalogs()` and updated by sync operations.

#### Scenario: Consumer reads catalog before init completes

- GIVEN `initCatalogs()` has not yet resolved (app is still initializing)
- WHEN a consumer reads `CUENTAS` or `CATEGORIAS`
- THEN the variables SHALL be empty arrays (initial state)
- AND the consumer SHALL render gracefully (empty dropdowns, "Sin seleccionar" defaults)

#### Scenario: Consumer reads catalog after init completes

- GIVEN `initCatalogs()` has resolved and populated the catalog variables
- WHEN a consumer reads `CUENTAS` or `CATEGORIAS`
- THEN the variables SHALL contain the full list of active items from Supabase

### Requirement: Manual sync via button

The `/cuentas` and `/categorias` pages SHALL display a "Sincronizar" button that forces a fresh fetch from Supabase and updates the cache.

#### Scenario: User clicks sync button

- GIVEN the user is on `/cuentas` or `/categorias`
- WHEN the user clicks the "Sincronizar" button
- THEN the system SHALL fetch fresh catalog data from Supabase
- AND update `localStorage` with the new data
- AND update the in-memory catalog variables
- AND reload the page to reflect the updated data

#### Scenario: Sync button loading state

- GIVEN a sync operation is in progress
- WHEN the user views the sync button
- THEN the button SHALL display "Sincronizando..." text
- AND the button SHALL be disabled to prevent duplicate requests

### Requirement: Empty-state banner

The `/cuentas` and `/categorias` pages SHALL display an informational banner when catalogs are empty (not yet synced).

#### Scenario: Catalogs empty on page load

- GIVEN `CUENTAS` (or `CATEGORIAS`) is an empty array
- WHEN the `/cuentas` (or `/categorias`) page renders
- THEN a banner SHALL display: "Datos no sincronizados. Haz clic en Sincronizar para cargar los datos desde Supabase."
- AND the sync button SHALL be visible within or near the banner

#### Scenario: Catalogs populated on page load

- GIVEN `CUENTAS` (or `CATEGORIAS`) contains items
- WHEN the `/cuentas` (or `/categorias`) page renders
- THEN the empty-state banner SHALL NOT be displayed
- AND the sync button SHALL still be visible in the page header

### Requirement: localStorage cache structure

The system SHALL use the following `localStorage` keys:

| Key | Value Type | Description |
|-----|------------|-------------|
| `finanzas:catalog:cuentas` | JSON array of `{ id, nombre, tipo }` | Active accounts |
| `finanzas:catalog:categorias` | JSON array of `{ id, nombre, tipo, es_diversion }` | Active categories |

#### Scenario: Cache write

- GIVEN a successful Supabase fetch for cuentas or categorías
- WHEN the system writes to `localStorage`
- THEN the data SHALL be serialized as JSON
- AND the key SHALL match the specification above

#### Scenario: Cache read with invalid JSON

- GIVEN `localStorage` contains a key with invalid (corrupted) JSON
- WHEN the system reads the cache
- THEN the system SHALL treat the cache as empty
- AND SHALL fetch fresh data from Supabase (same as first-load behavior)

### Requirement: No personal data in codebase

After this change, the source code SHALL NOT contain hardcoded personal financial data (UUIDs, account names, financial amounts, or real category names). All catalog data SHALL come from Supabase at runtime.

#### Scenario: Static data files are empty

- GIVEN `data/cuenta.ts` and `data/categoria.ts` are committed to the repository
- WHEN a developer reads these files
- THEN they SHALL contain only type definitions, empty arrays, and pure functions/constants
- AND SHALL NOT contain any real UUIDs, account names, or financial amounts
