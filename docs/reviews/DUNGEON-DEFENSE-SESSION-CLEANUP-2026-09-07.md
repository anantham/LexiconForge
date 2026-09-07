# Dungeon Defense backup cleanup

Date: 2026-09-07. The operator requested removing unrelated chapters from
`session-files/dungeon-defense.json` while preserving the evolving book.

## Exact artifact

| State | Bytes | SHA-256 |
| --- | ---: | --- |
| Original tracked LFS object | 272730207 | `b10acb696404882090c67dbe5c84aa8858f170c6e7ab948f78ea0298d5290046` |
| Cleaned object | 272217317 | `b4d9977f10f740c1496f1b3dc567207db2fb9aad32b427a536dae4e21f195f88` |

The original bytes were retained and checked against the tracked LFS pointer
before replacement. The cleaned JSON remains `lexiconforge-full-1`; it does
not acquire a guessed published version or new translation.

## Changes and preservation

- Remove 33 chapters belonging to Necromancer Academy's Genius Summoner and
  their 66 URL mappings. Retain 476 Dungeon Defense chapters and 951 mappings.
- Correct 29 stored chapter numbers using the already implemented publisher
  integrity helper. All 476 original stable IDs reproduce from source text,
  title and verified position; numbered chapter titles independently agree
  with the contiguous range 1–476. No IDs or prose were regenerated.
- Every retained chapter payload compares equal after accounting for the
  verified number corrections. This preserves all 416 saved translation
  versions, 7 feedback items, and illustration payloads.
- Preserve all 104 comparison records, four prompt templates, settings, and
  valid navigation. The saved reading position remains chapter 256.
- Every retained mapping and comparison record refers to a retained chapter.
  No retained previous/next URL points to one of the excluded chapter URLs.

## Verification

- Strict JSON parse, exact size/hash, full chapter identity/order and
  structural preservation checks pass on the final serialized bytes.
- The actual frontend corpus hash still matches the existing local evaluation
  revision because its selected text and verified numbering are unchanged.
  This cleanup does not require another embedding run.
- Node 24.19 production frontend, fresh disposable Chromium profile, external
  requests blocked: native upload of the complete cleaned file imports 476
  Dungeon Defense chapters numbered 1–476, restores chapter 256 and produces
  no application/page error. One observed import took 1,953 ms; this is a
  single local observation, not a general latency guarantee.

No novel prose or private evaluation artifacts are attached to this receipt.
Cleanup and selected-revision integrity do not certify semantic quality,
production owner admission, incremental refresh or physical-device behavior.
