# Interface-integrity findings — 2026-07-11 (dogfood + design track v1)

Mission frame (ratified): suttabench measures LLMs as INTERFACE COMPILERS —
populating (and eventually designing) a claim-dense interlinear reading UI.

## Dogfooding the flagship (/sutta/mn10)

The published demo packet had EMPTY canonicalSegments — the flagship page was
UNMEASURABLE by the project's own integrity/coverage instruments until today.
After injecting the 26 fixture segments:

- integrity 82.2%, 48 mismatches → classified: **2 genuine a+ā corruptions**
  (sokaparidevaānaṁ, suññaāgāragato — the same disease the production repair
  layer now fixes; both hand-corrected, goldens verified clean) and **46
  deliberate pedagogical sub-token splits** (quotative ti, sandhi compounds
  like etad+avoca taught as separate words).
- METRIC LIMITATION (next session): exact-token membership penalizes
  legitimate sub-token word splits. Fix = partition-aware matching: accept a
  run of consecutive rendered words whose concatenation equals a canonical
  token. Applies to the validator, the compare chips, and repair alignment.

## Design consequences (MN117, four compiles, same text)

| run | phases | words/phase | coverage | integrity | degraded |
|---|---|---|---|---|---|
| gemini-3-flash v1 (repaired) | 175 | 6.4 | 99% | 99.4% | 1 |
| gemini-3-flash v2 | 121 | 7.2 | 77% | 96.4% | 7 |
| gemini-3.5-flash | 122 | 3.0 | 32% | 71.1% | 69 |
| deepseek-v4-flash | 108 | 4.1 | 39% | 64.8% | 50 |

The v1/v2 pair is the controlled comparison: SAME model, same text, different
self-chosen skeleton — fine-grained design outperforms coarse on every axis.
Interface design quality is measurable and load-bearing; this is the design
track's founding observation (task #12's mechanical words-per-phase cap is
the intervention it implies).
