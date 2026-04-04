# Raw Source Discovery & Library Search — Implementation Plan

> **Status:** Approved, waiting for implementation
> 
> **Goal:** Let users search for novels by fan title, resolve the original Chinese identity, find likely raw sources, and add a confirmed result to the library without manually searching raw sites first.

**Spec:** `docs/superpowers/specs/2026-03-29-raw-source-discovery-library-search-design.md`

---

## Phase Breakdown

### Phase 0: Search Foundations

- [ ] Add search-domain types for resolved identity and source candidates.
- [ ] Add resolver result caching in IndexedDB/settings.
- [ ] Add source classification (`official` vs `mirror`).

### Phase 1: Identity Resolver

- [ ] Add a metadata resolver service that:
  - [ ] accepts English/fan title queries
  - [ ] queries Novel Updates first
  - [ ] extracts Chinese title, author, aliases
  - [ ] falls back to web-search-assisted resolution when metadata is missing
- [ ] Normalize simplified/traditional title variants and alias sets.

### Phase 2: Source Adapters

- [ ] Add official search adapters:
  - [ ] Qidian
  - [ ] JJWXC
  - [ ] Zongheng
  - [ ] 17K
  - [ ] Fanqie
- [ ] Add mirror/fallback adapters:
  - [ ] UUkanshu
  - [ ] Piaotian
  - [ ] Dxmwx
  - [ ] Kanunu / Kanunu8

### Phase 3: Candidate Ranking

- [ ] Add candidate ranking based on:
  - [ ] title match
  - [ ] author match
  - [ ] alias overlap
  - [ ] chapter count plausibility
  - [ ] source type priority (`official > mirror`)
  - [ ] URL stability / importability
- [ ] Expose confidence and explanation strings for the UI.

### Phase 4: Library Search UI

- [ ] Add a search bar to the library page.
- [ ] Show loading, no-results, ambiguous-results, and error states.
- [ ] Show ranked candidate cards with:
  - [ ] title
  - [ ] author
  - [ ] source type
  - [ ] chapter count
  - [ ] confidence
- [ ] Require explicit user confirmation before import.

### Phase 5: Import Integration

- [ ] Persist accepted source metadata into the library registry/cache.
- [ ] Reuse resolved identity during import so the book has stable canonical metadata.
- [ ] Cache accepted results for future searches.

### Phase 6: Quality Controls

- [ ] Add tests for:
  - [ ] identity resolution
  - [ ] candidate ranking
  - [ ] ambiguous matches
  - [ ] official-vs-mirror preference
  - [ ] cached result reuse
- [ ] Add telemetry for:
  - [ ] search success rate
  - [ ] candidate acceptance rate
  - [ ] fallback-to-mirror rate

---

## Candidate File Surface

### New Files

- `services/librarySearch/identityResolver.ts`
- `services/librarySearch/sourceResolver.ts`
- `services/librarySearch/ranking.ts`
- `services/librarySearch/types.ts`
- `services/librarySearch/cache.ts`
- `tests/services/librarySearch/*.test.ts`

### Likely Modified Files

- `components/NovelLibrary.tsx`
- `services/registryService.ts`
- `services/db/operations/settings.ts`
- `services/db/types.ts`
- `store/slices/uiSlice.ts`

---

## Open Product Decisions

- [ ] Should mirror-only results be importable in v1, or view-only until confirmed?
- [ ] Should the search bar show official results first with mirrors hidden behind “More sources”?
- [ ] Should accepted results be promoted into the curated registry, or only cached locally?

---

## Delivery Notes

- Start with metadata-first resolution, not generic scraping.
- Ship official-platform support first if needed.
- Add mirror sources behind a clear `mirror` label rather than pretending they are canonical.
- Do not auto-import the top candidate.

Status for execution: **planned, approved, and waiting to be implemented**
