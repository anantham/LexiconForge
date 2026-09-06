# Complete-novel corpus preflight

Date: 2026-09-06. Result: no complete novel approved for indexing by this audit.
Public artifact verification only; no embedding requests, index build or live scan.

## Exact published inputs

The public novel repository's remote main was verified at
`58476a05c751c6a89f7ce87b7f4808f7562dc896`. Both session downloads matched their
tracked LFS pointer's exact byte length and SHA-256 before strict UTF-8/JSON
parsing. Local pointer files alone were not treated as chapter content.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| [FMoC session](https://media.githubusercontent.com/media/anantham/lexiconforge-novels/58476a05c751c6a89f7ce87b7f4808f7562dc896/novels/forty-millenniums-of-cultivation/session.json) | 79,639,891 | `4a6dcdf4a62beb591a8fa5507d4e497d6790cfd0c77df19d400bf88368cd6af6` |
| [Dungeon Defense session](https://media.githubusercontent.com/media/anantham/lexiconforge-novels/58476a05c751c6a89f7ce87b7f4808f7562dc896/novels/dungeon-defense-wn/session.json) | 271,633,227 | `9098db5400f2c0abb844c90e7109b6837a2d068a86b8d7b0a59aac1c9f31c568` |

## Findings

- FMoC metadata declares 3,521 book chapters and version `v1-st-enhanced`.
  The session identifies itself as `unknown / quick-export` and contains 3,273
  records with 3,269 distinct numbers. Numbers 1 and 2 each appear three times;
  the maximum is 3,269. This is neither the declared identity nor demonstrated
  complete coverage. Do not relabel it or remove duplicates by position to make
  a semantic index pass. Source-backed chapter reconciliation is needed.
- Dungeon Defense metadata declares 509 book chapters. The session contains
  476 records and 458 distinct numbers, with 18 repeated chapter numbers.
  Node 24.19 and the backend corpus extractor both reject both published
  artifacts for non-unique/non-contiguous chapter numbers.
- Existing [publisher PR #3](https://github.com/anantham/lexiconforge-novels/pull/3),
  freshly verified at `65f28f6cb25e02bebde4ecc61d96ab1a83da549b`, already repairs
  Dungeon Defense identities. Its existing function reproduced every stable
  ID, made exactly 29 number corrections in a disposable in-memory copy, and
  reproduced its exact proposed session SHA-256
  `d2ff34c4667a54eb0bf130d06ac939ad98acd6582451ad9fe120544412f9dcf7`.
  No novel checkout, publication or source artifact was modified.
- The corrected publication is still 476 of 509 chapters, so the existing
  publication repair does not close the full-book acceptance criterion.

## Cross-language parity on the corrected partial corpus

The actual frontend `computeSemanticCorpusIdentity` and backend extractor agree:

```json
{
  "corpusId": "dungeon-defense-wn",
  "versionId": "v1-primary",
  "contentHash": "sha256:44bb9ea19000566e7a16a38cf16c9c612f6020ce8ffdc21c13ee57deb89eb9df",
  "chapterCount": 476
}
```

The selected text comes from 283 translation records, 163 fan translations and
30 source-content fallbacks. No selected chapter text is empty. This is not a
complete English translation. Selected text totals 6,128,976 Unicode code
points. Applying existing title-plus-text chunking gives 4,016 vectors, or
8,224,768 bytes for float32 vectors alone. These are deterministic planning
counts, not an index build, total process-memory estimate or latency benchmark.

The frontend hashed the full corrected session and its selected-text projection
identically. Python hashed that projection identically to Node. The projection
retains only the exact fields consumed by the canonical corpus contract; no
novel prose or session data is attached to this receipt or sent for AI review.

## Pickup and exit criteria

Issues.md item 21 owns this preflight blocker. Reuse the existing publisher
integrity work; do not add another numbering repair, importer or compatibility
fallback. Verify a selected novel/version's actual complete coverage against its
publisher manifest before starting the immutable builder. The builder validates
the supplied corpus, not an external claim that it contains the entire novel.
Preserve the exact text-selection contract and independently verify the final
artifact hash and frontend/backend corpus hash. If only partial or mixed-language
coverage is available, label it honestly and keep full-book acceptance open.
