# Golden/Prompt Contract Repair (review finding #1)

**Status:** Part 1 done (16 mechanical `wordRange` fixes). Part 2 drafted, **needs an operator
decision** on sandhi tokenization before the golden content is edited.
**Gate:** `tests/scripts/sutta-studio/golden-prompt-contract.test.ts`.

## The contract

A phase is scored by aligning the model's analysis to a **golden** and grading the matches. For
that to be fair, the golden must cover the **same Pāli word sequence the prompt shows the model**.
The prompt sequence is derived by the runner as: the phase's canonical segments' `pali`, joined and
whitespace-split, then sliced by the phase's optional `wordRange`
(`benchmark.ts` → `getSegmentsForPhase` / `applyWordRangeToSegments`).

When the golden covers only a **slice** of the prompt but the phase has **no `wordRange`**, the
model is prompted with the whole segment yet graded on a fraction of it — so it can report 100% Pāli
coverage while ignoring most of what it was given. This is the shared-segment problem ADR SUTTA-003
opened and left unfinished beyond 7 phases.

## Audit (30-phase ranked set, mn10)

| State | MATCH | of 30 |
|---|---|---|
| Before repair | **6** | 6/30 — confirms the review's mechanical count |
| After Part 1 (`wordRange`) | **22** | +16 |
| Remaining (Part 2, pending) | — | 8 |

Categories of the 24 failures:
- **16 SLICE** — golden is a correct contiguous sub-span of the prompt; the phase just lacked a
  `wordRange`. **Fixed mechanically** (Part 1) — no golden content changed.
- **8 SANDHI / OMISSION** — the golden tokenizes differently from the prompt (splits a joined token)
  or omits a word. Needs golden content edits → **Part 2, operator decision**.

## Part 1 — the 16 `wordRange` fixes (DONE)

Added to `test-fixtures/sutta-studio-anatomist-golden.json` `_phases[].wordRange`, slicing each
phase's prompt to exactly its existing golden span (the golden words were already correct):

| phase | wordRange | phase | wordRange | phase | wordRange | phase | wordRange |
|---|---|---|---|---|---|---|---|
| phase-d | [5,9) | phase-af | [0,3) | phase-ao | [9,15) | phase-bc | [4,8) |
| phase-z | [3,6) | phase-ag | [3,6) | phase-ap | [15,18) | phase-bd | [8,12) |
| phase-ab | [9,12) | phase-ai | [0,3) | phase-az | [6,11) | phase-bf | [7,10) |
| phase-ad | [3,6) | phase-aj | [3,6) | phase-ba | [11,16) | phase-bg | [10,18) |

Reproduce/verify: the contract test above passes for these 22 and goes RED without the `wordRange`
additions (all 16 listed as violations).

## Part 2 — the 8 pending phases (NEEDS DECISION)

The golden here splits a joined Pāli token the prompt presents as ONE whitespace token, or omits a
word. `wordRange` operates on whitespace tokens and cannot split one, so these can't be fixed
mechanically. Tracked in `KNOWN_SANDHI_PENDING` in the contract test.

### 2a. Quotative / sandhi splits (6 phases)

The golden splits a sandhi compound or the `ti`/`'ti` quotative into two words; the Anatomist's own
rule is **one word per space-separated token** (see the Anatomist prompt's CRITICAL WORD BOUNDARY
RULE). So the golden diverges from the tokenization the model is instructed to use.

| phase | prompt token(s) | golden words | joined form |
|---|---|---|---|
| phase-f | `"bhikkhavo"ti.` | `Bhikkhavo` + `ti` | bhikkhavoti |
| phase-h | `Bhagavā` `etadavoca:` | `Bhagavā` `etad` + `avoca` | etadavoca |
| phase-as | …`assasāmī'ti`… | `assasāmī` + `'ti` (×2) | assasāmīti |
| phase-at | …`assasissāmī'ti`… | `assasissāmī` + `'ti` (×2) | assasissāmīti |
| phase-av | …`añchāmī'ti`… | `añchāmī` + `'ti` (×2) | añchāmīti |
| phase-ax | …`assasissāmī'ti`… | `assasissāmī` + `'ti` (×2) | assasissāmīti |

**Recommended resolution:** make the golden follow the Anatomist word-boundary rule — merge each
split back into ONE word (`etadavoca`, `assasāmīti`, …) and move the split to **morpheme segments**
inside that word (`etad` + `avoca`; `assasāmī` + `ti`). The morphological analysis is preserved; only
the WORD boundary moves to match the prompt. Then add a `wordRange` to slice the prompt.

**Alternative (not recommended):** split the sandhi in the canonical source text so the prompt shows
two tokens. Rejected — the canonical SuttaCentral segmentation is the authority and should not be
re-tokenized to fit the golden.

**Decision needed:** confirm the golden should adopt one-word-per-whitespace-token (with sandhi as
segments). If yes, the merges are semi-mechanical and can be scripted for your review.

### 2b. Omissions (2 phases)

The golden drops a word that is in the prompt:

| phase | prompt (relevant span) | golden | missing |
|---|---|---|---|
| phase-an | `…araññagato vā rukkhamūlagato vā suññāgāragato…` | `…araññagato vā rukkhamūlagato suññāgāragato` | the 2nd `vā` |
| phase-aq | `So satova assasati satova passasati` | `So sato va assasati passasati` | the 2nd `satova` (and the 1st is sandhi-split `sato`+`va`) |

**Recommended resolution:** add the omitted words to the golden (and, for phase-aq, also apply the
2a sandhi policy to `satova`). Then add a `wordRange`.

## Not in scope of this repair

- The 40/30/30 formula decision and the 12-model roster (separate, operator-directed).
- Downstream golden parity: the lexicographer/weaver/typesetter goldens for the repaired phases
  should be re-checked against the sliced prompt once Part 2 lands. The contract test here covers the
  Anatomist (primary) golden only.
