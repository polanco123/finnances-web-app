# voice-movement-entry

## Purpose

Register a gasto/ingreso/transferencia movimiento via push-to-talk voice dictation: browser-native Web Speech API capture, a "Registra"-prefixed rule-based/regex parser (no LLM/AI, fully client-side) with fuzzy account/category matching against the live catalogs, and an editable confirmation step via the existing `MovementForm` before any Supabase insert. Editing/deleting movimientos and voice-driven navigation are out of scope.

## Requirements

### Requirement: Trigger word gate
The system SHALL only attempt field parsing on recognized speech text that starts with the word "Registra" (case-insensitive). Text not starting with "Registra" SHALL NOT be partially parsed or guessed.

#### Scenario: Command starts with trigger word
- GIVEN the recognized speech text is "Registra un gasto de 500 en BBV de gasolina"
- WHEN the text is passed to the parser
- THEN the system SHALL proceed to field extraction

#### Scenario: Command missing trigger word
- GIVEN the recognized speech text is "Un gasto de 500 en BBV de gasolina" (no "Registra" prefix)
- WHEN the text is passed to the parser
- THEN the system SHALL NOT attempt field extraction or guess any field value
- AND the system SHALL surface an unrecognized-command state instead of opening the confirmation form

### Requirement: Default tipo when unspecified
When the recognized phrase contains no explicit tipo keyword ("gasto", "ingreso", or "transferencia"), the system SHALL default tipo to "gasto".

#### Scenario: No tipo keyword defaults to gasto
- GIVEN the recognized speech text is "Registra 20 pesos de diversión y en notas escribe chicles"
- WHEN the parser processes the phrase
- THEN tipo SHALL resolve to "gasto"
- AND cuenta SHALL remain unresolved because no cuenta was spoken

### Requirement: Field extraction for gasto/ingreso
For tipo gasto or ingreso, the system SHALL extract cantidad (a number, optionally followed by "pesos"), cuenta (from "en {cuenta}"), categoria (from "de {categoria}"), and notas (from "en notas escribe {notas}" or "y en notas escribe {notas}").

#### Scenario: Explicit gasto with cuenta and categoria
- GIVEN the recognized speech text is "Registra un gasto de 500 en BBV de gasolina"
- WHEN the parser processes the phrase
- THEN tipo SHALL resolve to "gasto", cantidad to 500, cuenta to the catalog match for "BBV", and categoria to the catalog match for "gasolina"

#### Scenario: Default gasto with notas, no cuenta
- GIVEN the recognized speech text is "Registra 20 pesos de diversión y en notas escribe chicles"
- WHEN the parser processes the phrase
- THEN cantidad SHALL resolve to 20, categoria to the catalog match for "diversión", and notas to "chicles"
- AND cuenta SHALL be left unresolved (not guessed)

#### Scenario: Explicit ingreso with cuenta and categoria
- GIVEN the recognized speech text is "Registra un ingreso de 5000 en Banamex Débito de Sueldo"
- WHEN the parser processes the phrase
- THEN tipo SHALL resolve to "ingreso", cantidad to 5000, cuenta to the catalog match for "Banamex Débito", and categoria to the catalog match for "Sueldo"

### Requirement: Field extraction for transferencia
For tipo transferencia, the system SHALL extract cantidad, cuenta_origen, and cuenta_destino from the pattern "de {origen} a {destino}".

#### Scenario: Transferencia between two accounts
- GIVEN the recognized speech text is "Registra una transferencia de 100 de Nu apartados a BBVA"
- WHEN the parser processes the phrase
- THEN tipo SHALL resolve to "transferencia", cantidad to 100, cuenta_origen to the catalog match for "Nu apartados", and cuenta_destino to the catalog match for "BBVA"

### Requirement: Fuzzy catalog matching
Spoken account/category text SHALL be matched against the live `CUENTAS`/`CATEGORIAS` catalogs using normalized (lowercase, accent-insensitive) substring matching. When no catalog entry matches, the field SHALL be left unresolved/empty rather than guessed, deferring correction to the editable confirmation step.

#### Scenario: Partial spoken name matches a catalog entry
- GIVEN the `CUENTAS` catalog contains an entry with normalized text "bbva debito"
- WHEN the spoken text "BBV" is matched against `CUENTAS`
- THEN the system SHALL resolve cuenta to that entry

#### Scenario: No catalog entry matches
- GIVEN the spoken text does not normalize-substring-match any entry in the target catalog (misheard or nonexistent name)
- WHEN the matcher runs
- THEN the corresponding field SHALL remain unresolved/empty
- AND the system SHALL NOT select an arbitrary or best-effort catalog entry

### Requirement: Editable confirmation before insert
After parsing, the system SHALL present the interpreted fields in an editable form (the existing `MovementForm`, pre-populated via its initial-value props) before performing any Supabase insert.

#### Scenario: User corrects a misparsed field before confirming
- GIVEN the confirmation form is pre-populated with a cuenta that does not match the user's intent
- WHEN the user changes the cuenta field and submits the form
- THEN the system SHALL insert the movimiento using the corrected cuenta value, not the originally parsed one

#### Scenario: User cancels without inserting
- GIVEN the confirmation form is displayed with parsed field values
- WHEN the user dismisses/cancels the form without submitting
- THEN the system SHALL NOT perform any Supabase insert

### Requirement: Unsupported browser handling
When both `window.SpeechRecognition` and `window.webkitSpeechRecognition` are absent, the voice-entry trigger SHALL indicate it is unavailable rather than silently failing when clicked.

#### Scenario: Trigger clicked in an unsupported browser
- GIVEN neither `SpeechRecognition` nor `webkitSpeechRecognition` exists on `window`
- WHEN the user clicks the voice-entry trigger
- THEN the system SHALL show an unsupported/unavailable indication
- AND the system SHALL NOT attempt to start speech recognition

### Requirement: Empty-catalog guard
While `CUENTAS` or `CATEGORIAS` is empty, the voice-entry trigger SHALL be disabled or show an unavailable/loading state, consistent with the existing empty-state convention on `/cuentas` and `/categorias`.

#### Scenario: Catalogs not yet synced
- GIVEN `CUENTAS` or `CATEGORIAS` is empty (catalog sync not yet complete)
- WHEN the `/movimientos` view renders the voice-entry trigger
- THEN the trigger SHALL be disabled or show an unavailable/loading state
- AND the system SHALL NOT attempt fuzzy matching against an empty catalog
