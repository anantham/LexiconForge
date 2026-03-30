# Raw Source Discovery & Library Search — Design Spec

**Date:** 2026-03-29
**Status:** Approved, waiting for implementation
**Author:** Codex + user direction

## Problem

Adding novels to the library currently depends on already knowing a raw source URL or manually hunting through websites that host the raws. This creates unnecessary friction, especially when the user only knows the fan translation title.

## Goal

Add a library search flow that can:

1. Accept an English or fan-translation title.
2. Resolve the canonical Chinese title, author, and aliases.
3. Search likely raw sources.
4. Present ranked candidates.
5. Let the user add a confirmed novel to their library without manually finding the raw site first.

## Scope

### In Scope

- Metadata-first search from fan title to raw source.
- Candidate ranking and confirmation UI.
- Source classification as `official` or `mirror`.
- Caching resolved candidates for later reuse.

### Out of Scope

- Full-text search across chapter bodies.
- Automatic ingestion of every result without user confirmation.
- Aggressive scraping of every possible mirror on the open web.

## Design Decisions

### Search Strategy: Metadata Bridge -> Source Resolver

Use a two-stage resolver instead of treating raw-source lookup as a generic web search problem.

1. **Identity resolution**
   - Start from the user query.
   - Resolve `title_zh`, `author_zh`, and aliases using high-confidence metadata sources.
   - Primary bridge source: Novel Updates.
   - Secondary support: web search, registry aliases, existing library metadata.

2. **Source resolution**
   - Search source adapters using the resolved identity.
   - Prefer official platforms first.
   - Fall back to mirrors/fallback indexes when official results are missing or weak.

### Source Tiers

#### Tier 1: Metadata / identity sources

- Novel Updates
- Existing library registry metadata
- Cached prior resolutions

#### Tier 2: Official raw platforms

- Qidian
- JJWXC
- Zongheng
- 17K
- Fanqie
- SFACG / Ciweimao when relevant

#### Tier 3: Mirror / fallback sources

- UUkanshu
- Piaotian
- Dxmwx
- Kanunu / Kanunu8

Mirror sources are allowed for discovery and import fallback, but they are not the canonical identity layer.

## Matching & Ranking

Each candidate should be scored using:

- exact Chinese title match
- exact or near-exact author match
- alias overlap with the fan-translation title
- chapter count plausibility
- completion/serialization status plausibility
- source quality: `official > mirror`
- URL stability / importability

Suggested stored shape:

```typescript
interface RawSourceCandidate {
  titleZh: string;
  titleZhHant?: string | null;
  titleEn?: string | null;
  authorZh?: string | null;
  aliases: string[];
  platform: string;
  sourceType: 'official' | 'mirror';
  officialUrl?: string | null;
  sourceUrl: string;
  chapterCount?: number | null;
  status?: string | null;
  confidence: number;
  whyThisMatches: string[];
}
```

## User Flow

1. User types a title into the library search bar.
2. App resolves novel identity from metadata sources.
3. App searches source adapters with the resolved title/author/aliases.
4. App shows ranked candidates with confidence, source type, and chapter count where available.
5. User chooses a candidate.
6. App imports the book into the library and persists the resolved metadata for future reuse.

## UX Rules

- Do not auto-import the top hit without confirmation.
- Show whether a result is `official` or `mirror`.
- Prefer the highest-confidence official result by default.
- If only mirror results exist, show that clearly in the candidate UI.
- Cache accepted resolutions so repeated searches become instant and deterministic.

## Architecture Notes

- Implement as adapters, not site-specific conditionals scattered through the UI.
- Keep identity resolution separate from source resolution.
- Persist normalized search metadata so later deep links and library imports can reuse the resolved identity.
- Add telemetry for resolution quality, but do not leak verbose resolver internals into reader-facing UI.

## Risks

- Mirrors may have stale, partial, or duplicate entries.
- Some official sites may be JS-heavy, app-only, rate-limited, or region-constrained.
- Similar titles or author aliases can produce ambiguous matches.

## Approved Direction

This feature is approved as a future enhancement.

Implementation direction:

- `Novel Updates -> canonical Chinese identity -> official-platform search -> mirror fallback`
- official-first ranking
- user confirmation before library add

Status for engineering planning: **approved and waiting to be implemented**
