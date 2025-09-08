# Contributing

Thanks for improving LexiconForge! This guide keeps changes safe and easy to review.

## Setup

- Node 18+ recommended
- `npm install`
- `npm run dev` (Vite)

## Tests

- Run all: `npm test`
- Coverage: `npm run test:coverage`
- UI runner: `npm run test:ui`

## Docs & ADRs

- See `docs/` and `docs/adr/` for architecture.
- Update `docs/WORKLOG.md` with a timestamped summary for non‑trivial changes.

## Commit Style

- Conventional commits (e.g., `feat:`, `fix:`, `docs:`, `refactor:`)
- One logical change per commit; keep diffs focused.

## File Size Limits (Agent‑First)

- Services ≤ 200 LOC; Components ≤ 250 LOC (see ADR‑005)
- Prefer extracting helpers and modules instead of growing files

## Adding Site Adapters / Providers

- Website adapters: follow `docs/META_ADAPTER.md`
- Translation providers: implement `TranslationProvider` and register with the `Translator`

## Debugging

- See `docs/Debugging.md` for flags and safety notes
