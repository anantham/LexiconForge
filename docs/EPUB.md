# EPUB Export

Generate professional EPUBs with embedded illustrations and stats.

## Basics

- Export from the Session Info panel (JSON or EPUB).
- Ordering: by chapter number or navigation sequence.
- Optional pages: title page, statistics page.

## Templates & Overrides

- Defaults: `services/epub/Templates.ts` (programmatic template builder).
- Overrides (Settings):
  - `epubGratitudeMessage`
  - `epubProjectDescription`
  - `epubFooter`

## XHTML/Sanitization

- Conversion and constraints handled by `services/epub/XhtmlSerializer.ts`.
- Only a safe subset of tags/attributes are preserved; invalid markup is dropped with a console warning.

## Statistics

- Costs, token usage, provider/model breakdowns, generation times, illustration counts.

## Workers

- Export runs in a worker with progress events. See `docs/Workers.md`.

