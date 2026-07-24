# EPUB Export

Generate professional EPUBs with embedded illustrations and stats.

## Basics

- Export from the Session Info panel (JSON or EPUB).
- Ordering: by chapter number or navigation sequence.
- Optional pages: title page, statistics page.

## Templates & Overrides

- Defaults: `services/epubService/templates/defaults.ts` (programmatic template builder).
- Overrides (Settings):
  - `epubGratitudeMessage`
  - `epubProjectDescription`
  - `epubFooter`

## XHTML/Sanitization

- Conversion and constraints handled by `services/epubService/sanitizers/xhtmlSanitizer.ts`.
- Only a safe subset of tags/attributes are preserved; invalid markup is dropped with a console warning.

## Statistics

- Costs, token usage, provider/model breakdowns, generation times, illustration counts.
- Session insights aggregate navigation/hydration/export timings captured by the telemetry service.

## Execution

- Export runs on the main thread via a dynamic `import()` of `services/epubService` (triggered from `store/slices/exportSlice.ts`); there is no worker. Progress is surfaced through the export slice.

## Future Enhancements

- Incremental export caching/hashing so repeated downloads skip unchanged chapters and assets.
- Optional gzip/zip packaging for asset-heavy exports to keep multi-chapter sessions manageable.
