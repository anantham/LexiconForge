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
4. Cache completeness is measured against the selected package's chapter
   identities, not row cardinality alone. A version range is exact only when
   its inclusive size agrees with `version.stats.content.totalRawChapters`;
   otherwise completeness fails closed and the session is replayed. Legacy
   novel-level packages use `1..chapterCount`. A truthy first chapter identifier
   is not a completeness signal.
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
8. When replay retains multiple scoped rows for one chapter number, the most
   recently stored/replayed row is authoritative for hydration and navigation.
   Stable ID provides a deterministic tie break. Older rows and their
   translations are not deleted by navigation.
9. Registry package metadata is immutable input to acquisition decisions.
   Cached/translated counts may be shown through explicit display props, but
   must never overwrite the published denominator on a `NovelEntry`.
10. Final replay hydration preserves the reader's scoped chapter number, not a
    possibly obsolete revision ID. If authoritative hydration replaces the open
    row, the reader and its bookshelf resume entry are remapped to the current
    scoped ID before the completed import is exposed.

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
- Non-contiguous/grouped packages whose metadata exposes only broad endpoints
  cannot prove exact cache completeness yet, so they replay safely on reopen.
  A future exact package-manifest contract can remove that extra work.
- The version metadata's raw-chapter count is now a load-bearing publication
  invariant. A session that completes below that count produces a warning
  instead of claiming the cache is complete.
- Internal URL behavior is deterministic and independent of the supported-site
  list.

## Implementation notes

- `services/chapterCatalog.ts` owns strict internal URL parsing, virtual
  identity, expected packaged-chapter counts, and exact contiguous ranges.
- `services/chapterRevisionService.ts` owns deterministic non-destructive
  selection when stale/current rows share a scoped chapter number.
- `services/navigation/index.ts` resolves internal targets through scoped
  chapter-number lookup and returns typed acquisition errors.
- `services/readerHydrationService.ts` reports durable scoped cache count
  separately from the optional in-memory hydration limit.
- `components/NovelLibrary.tsx` distinguishes complete, partial, and empty
  caches, preserves registry denominators, and resumes partial streams without
  discarding the saved chapter. When final replay hydration changes that
  chapter's revision ID, it persists the authoritative replacement to the
  bookshelf. `NovelCard.tsx` accepts a display-only cached count for Continue
  Reading cards.
- `services/importService.ts` reuses exact packaged translations during replay
  and verifies newly stored translations by content identity. It captures the
  open scoped chapter number before final hydration and resolves that number
  against the authoritative hydrated map afterward.
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

## Amendment: exact publication manifest (2026-08-31)

**Status:** Implemented on the publication-integrity branch; deployment still
requires review, merge, and publisher-package migration.

The deferred exact package-manifest position is now adopted. A hosted version
may keep `metadata.chapterCount` as the expected size of the work, but it may
advertise reader navigation only for identities in its
`chapter-manifest.json`. The manifest binds each published `chapterNumber`,
`stableId`, and `canonicalUrl` to the version and binds the complete session
artifact by URL, byte length, and SHA-256 digest.

A version that declares `chapterManifestUrl` creates a hard boundary. The
client validates and uses its exact identity list for virtual catalog rows and
cache completeness. If acquisition or validation fails, the client returns no
metadata-projected replacement rows and blocks the session import with a
descriptive error. Versions without the field retain the legacy range contract
until migrated.

The publisher validator rejects duplicate or unordered chapter numbers,
duplicate stable IDs, metadata/session/version disagreement, range/count
disagreement, incomplete versions labelled `Complete`, tuple drift, byte-length
drift, and checksum drift before output is accepted. It never invents, drops,
or renumbers an identity.

### Amendment implementation notes

- `types/chapterManifest.ts` defines the versioned manifest and reserves an
  optional per-chapter artifact reference for the separately reviewed targeted
  acquisition phase.
- `services/library/chapterManifestService.ts` owns browser-safe structural and
  contextual validation. `services/chapterCatalog.ts` consumes exact manifest
  identities and refuses metadata fallback after a declared-manifest failure.
- `components/NovelLibrary.tsx` uses the same identity set for package cache
  completeness before deciding whether to replay a session.
- `scripts/lib/library-publication-integrity.ts` owns publisher-side tuple,
  metadata, and session-digest validation. `scripts/build-library-session.ts`
  emits the manifest, and `scripts/verify-library-publication.ts` verifies an
  existing three-file publication without rewriting it.
- Focused regressions cover manifest structure, hostile duplicate/mismatch
  cases, checksums, registry URL normalization, exact non-contiguous catalog
  projection, fail-closed behavior, and reader cache/import decisions.

## Amendment: preserve chapter revisions at distinct addresses (2026-09-06)

Chapter artifact filenames include the SHA-256 of their complete serialized
envelope. Rebuilding identical chapter bytes reuses the address; changing the
content or novel/version envelope produces a different address. Publishers must
retain previously referenced chapter files. This corrects CONS-01 without
changing the manifest format or the compatible full-session output.

### Implementation notes

- `scripts/lib/chapter-artifact-builder.ts` computes the digest once and uses it
  in both the filename and manifest reference; the chapter-number-only helper
  was removed.
- `scripts/build-library-session.ts` finishes chapter artifact output before
  replacing the session, manifest and metadata. Git/static publication still
  needs a validated complete snapshot; this is not a filesystem transaction or
  a promise that old full-session URLs are immutable.
- `tests/scripts/library-publication-output.test.ts` runs the actual CLI and
  verifies old/new chapter downloads after content and version revisions,
  deterministic unchanged output, and unchanged published pointers after an
  artifact-directory failure.
