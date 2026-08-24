# Delta for catalog-caching

## MODIFIED Requirements

### Requirement: Catalog initialization on app mount

The system SHALL fetch catalog data from Supabase on the first app load and cache it in `localStorage`. On subsequent loads, the system SHALL read from `localStorage` without making network requests.
(Previously: Supabase `select`s did not include `icono`.)

#### Scenario: First load — cache empty

- GIVEN `localStorage` has no `finanzas:catalog:cuentas` or `finanzas:catalog:categorias` keys
- WHEN the app mounts
- THEN the system SHALL query Supabase for active `cuenta` rows (`select id, nombre, tipo, icono; activa = true; order by nombre`)
- AND query Supabase for active `categoria` rows (`select id, nombre, tipo, es_diversion, icono; activa = true; order by nombre`)
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

### Requirement: localStorage cache structure

The system SHALL use the following `localStorage` keys:

| Key | Value Type | Description |
|-----|------------|-------------|
| `finanzas:catalog:cuentas` | JSON array of `{ id, nombre, tipo, icono }` | Active accounts |
| `finanzas:catalog:categorias` | JSON array of `{ id, nombre, tipo, es_diversion, icono }` | Active categories |

(Previously: cached shapes were `{ id, nombre, tipo }` and `{ id, nombre, tipo, es_diversion }`, without `icono`.)

#### Scenario: Cache write

- GIVEN a successful Supabase fetch for cuentas or categorías
- WHEN the system writes to `localStorage`
- THEN the data SHALL be serialized as JSON, including each item's `icono` (nullable)
- AND the key SHALL match the specification above

#### Scenario: Cache read with invalid JSON

- GIVEN `localStorage` contains a key with invalid (corrupted) JSON
- WHEN the system reads the cache
- THEN the system SHALL treat the cache as empty
- AND SHALL fetch fresh data from Supabase (same as first-load behavior)

#### Scenario: Cached item with null icono round-trips correctly

- GIVEN a cuenta or categoria has `icono = null` in Supabase
- WHEN it is written to and later read from `localStorage`
- THEN the cached `icono` field SHALL remain `null`, not an empty string or omitted key
