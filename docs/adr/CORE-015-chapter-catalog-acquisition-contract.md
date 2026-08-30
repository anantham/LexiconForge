# CORE-015: Chapter Catalog and Acquisition Contract

**Status:** Implemented
**Date:** 2026-08-30
**Domain:** Reader navigation and library acquisition

## Issue

The library registry describes the chapters that belong to a packaged novel
version, while IndexedDB contains only chapters that have actually been
imported. The virtual chapter catalog correctly exposed the registry range, but
it treated projected rows as immediately navigable. Those rows used
`lexiconforge://<novel>/chapter/<number>` identity URLs, while navigation only
resolved source URLs and otherwise delegated to web scrapers. A projected but
unimported chapter therefore failed as an unsupported source.

The cache boundary had a second false assumption: one cached chapter was
treated as proof that the whole selected version was cached. An interrupted
stream could consequently become permanent because reopening the novel skipped
the acquisition path. The resulting navigation error was stored globally but
could be hidden by translation-specific inline error rules.

## Decision

1. Registry projection and local availability are separate states. Projected
   chapters remain visible for orientation, but a virtual row is labelled and
   disabled until a real scoped chapter summary or in-memory chapter replaces
   it.
2. `lexiconforge://` is an internal identity scheme, not a fetch transport.
   Canonical internal URLs are parsed strictly and resolved through
   `ChapterOps.findByNumber(chapterNumber, novelId, versionId)`. They are never
   sent to a site adapter or proxy cascade.
3. Internal links fail closed on novel-scope mismatch. Malformed paths, query
   variants, zero chapters, and ambiguous targets are rejected rather than
   repaired silently.
4. Cache completeness is measured against the selected package. The preferred
   denominator is `version.stats.content.totalRawChapters`, followed by the
   version chapter range, then novel-level chapter count when version evidence
   is absent. A truthy first chapter identifier is not a completeness signal.
5. An incomplete cache remains immediately readable at its saved position while
   the version session resumes in the background. A completed cache does not
   re-fetch.
6. Streaming import is idempotent for packaged translations. An exact stored
   translation (content, provider/model, footnotes, suggested illustrations,
   and proposal) is reused and its active selection restored instead of adding
   another version.
7. Navigation acquisition failures produce a typed result and a visible toast.
   They may also remain in global diagnostic state, but translation rendering
   is not responsible for surfacing them.

## Positions considered

- **Hide projected chapters:** removes the false affordance but loses the full
  book map that motivated the virtual catalog.
- **Fetch internal URLs through the scraper chain:** preserves clickability in
  appearance only; the identity URL has no remote document and makes transport
  policy depend on a synthetic scheme.
- **Projection plus explicit acquisition state (selected):** retains full-range
  orientation, provides scoped deterministic resolution, and makes missing
  content honest.
- **Publish per-chapter remote artifacts:** enables true random access but
  requires a cross-repository publication format and is deferred.

## Consequences

- A user cannot select a chapter until its scoped row exists. The row stays in
  the dropdown with a clear `not cached yet` label.
- Reopening an interrupted version may download and parse the session again,
  but exact packaged translations are not duplicated.
- The version metadata's raw-chapter count is now a load-bearing publication
  invariant. A session that completes below that count produces a warning
  instead of claiming the cache is complete.
- Internal URL behavior is deterministic and independent of the supported-site
  list.

## Implementation notes

- `services/chapterCatalog.ts` owns strict internal URL parsing, virtual
  identity, and expected packaged-chapter counts.
- `services/navigation/index.ts` resolves internal targets through scoped
  chapter-number lookup and returns typed acquisition errors.
- `services/readerHydrationService.ts` reports durable scoped cache count
  separately from the optional in-memory hydration limit.
- `components/NovelLibrary.tsx` distinguishes complete, partial, and empty
  caches and resumes partial streams without discarding the saved chapter.
- `services/importService.ts` reuses exact packaged translations during replay
  and verifies newly stored translations by content identity.
- `hooks/useChapterDropdownOptions.ts`,
  `components/session-info/ChapterDropdown.tsx`, and
  `store/slices/chaptersSlice.ts` expose availability and visible errors. The
  dropdown also replaces virtual rows by the displayed chapter number for
  legacy summaries whose numeric field is absent.
- Regression coverage spans catalog parsing/counts, dropdown availability,
  scoped navigation, partial-cache resume, hydration counts, idempotent stream
  replay, and toast surfacing.

## Related decisions

- [CORE-007](./CORE-007-fetch-transport-contract.md)
- [CORE-012](./CORE-012-background-work-survives-navigation.md)
- [DB-003](./DB-003-version-centric-data-model.md)
