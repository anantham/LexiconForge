# Grounding Architecture — replacing LLM claims with verifiable citations

> Design ratified 2026-05-14, post phantom-purge. Successor to ADR SUTTA-008
> (data-layer providers). Companion to FEATURES.md §2.6 (chain-of-custody)
> and TEXT_GRAPH.md (transmission graph, long-term).
>
> This doc is a telic breadcrumb. Future agents reading curated tooltips
> with claims like "Bodhi renders X as Y" should be able to verify that
> claim by following the citation chip. The architecture exists to make
> that verification mechanical.

## Principle

> Every factual claim in a tooltip or sense has either:
> (a) a citation pointing to a verifiable source, OR
> (b) an honest "interpretation" affordance saying the curator is synthesizing.
>
> The LLM's job is **synthesis over verified inputs**, not substitution
> for a database it doesn't have access to.

This is the symmetric move to the phantom-consumer audit:
- Phantom-consumer retired **data fields** no reader sees
- This retires **LLM claims** no source backs

## What already exists (don't re-invent)

| Component | Location | Status |
|---|---|---|
| `Citation` type with `url`, `provenance`, `excerpt`, `license`, `fetchedAt` | `types/suttaStudio.ts` | ✓ Complete |
| `Sense.citationIds` pointer field | `types/suttaStudio.ts` | ✓ Complete |
| `packet.citations[]` collection | `types/suttaStudio.ts` | ✓ Complete |
| `LensPanel` chip rendering (clickable when URL exists) | `components/sutta-studio/LensPanel.tsx` | ✓ Complete |
| DPD provider — Pāli lemma lookup | `services/providers/dpd.ts` | ✓ Already populates citations |
| SC Bilara provider — translator alignments | `services/providers/scBilaraVariants.ts` | ✓ Wired, underused |
| SC Suttaplex provider — sutta metadata | `services/providers/scSuttaplex.ts` | ✓ Wired |
| SC Dictionary provider — gloss lookup | `services/providers/suttaCentralDictionary.ts` | ✓ Wired |
| `lexiconRegistry` — provider orchestration | `services/providers/lexiconRegistry.ts` | ✓ Wired |

**Current populated state**: 32 citations in `demoPacket.json`, all from DPD,
zero with URLs minted. The Citation TYPE knows about URLs; the DATA doesn't
have them.

## What's missing

### Gap A — URL minting on existing citations
The 32 DPD citations have no `url` field. Reader sees a chip, can't click through.
Trivial fix: per-citation URL template. DPD has stable URLs per lemma.

### Gap B — Translator-rendering bank (SC Bilara, per-verse)
Bilara JSON has Bodhi (partial MN coverage), Sujato (full), and others — per
sutta, per verse, machine-parseable. We have the adapter (`scBilaraVariants.ts`)
but don't currently populate citations for per-verse translator alignments.

### Gap C — Contested-term registry (hand-curated)
~50-100 terms whose translation is genuinely contested (satipaṭṭhāna, dukkha,
nibbāna, sati, dhamma, saṅkhāra, sampajañña, ...). For each: known parses +
translator alignments + primary citations (Anālayo, PED entries, etc.).

Bootstrap is small (~50 entries) but each entry requires a verified source.
Not derivable from LLM without re-introducing the hallucination problem.

### Gap D — Commentarial-gloss index (hand-curated)
~50-100 terms with significant Buddhaghosa / Aṭṭhakathā glosses. Term →
VRI tipitaka.org URL → excerpt. Requires Pāli reading skill to extract
correctly; bootstrap is the slowest piece.

### Gap E — `groundingPass` (compiler integration)
A new pass that runs AFTER LLM passes and BEFORE typesetter, walks the packet,
queries each provider, attaches `citationIds` to senses and segments.

### Gap F — UI grounded-vs-interpretive affordance
Subtle visual cue distinguishing "this claim has a source" from "this is
curator synthesis". Honesty surface: reader sees confidence by EVIDENCE, not
asserted-label.

## Architecture

### File layout

```
data/sutta-studio/grounding/
  contested-terms.json           # Gap C — hand-curated registry
  commentarial-glosses.json      # Gap D — hand-curated index
  url-templates.json             # Gap A — per-provider URL templates

services/sutta-studio/grounding/
  contestedTermProvider.ts       # Reads contested-terms.json
  commentarialProvider.ts        # Reads commentarial-glosses.json
  translatorBankProvider.ts      # Wraps scBilaraVariants for per-verse lookups
  urlMinter.ts                   # Reads url-templates, minted URLs on citations
  index.ts                       # Unified facade

services/sutta-studio/passes/
  grounding.ts                   # Gap E — the new pass
  grounding.test.ts

components/sutta-studio/
  LensPanel.tsx                  # Adds grounded-vs-interpretive affordance (Gap F)
```

### Data shapes

**`contested-terms.json`** (one entry per contested term):
```json
{
  "satipaṭṭhāna": {
    "parses": [
      {
        "morphology": "sati + paṭṭhāna (paṭi + sthā)",
        "gloss": "foundation, establishment",
        "translators": [
          {"name": "Bhikkhu Bodhi", "rendering": "foundations of mindfulness",
           "sourceUrl": "https://suttacentral.net/mn10/en/bodhi", "fetchedAt": "2026-05-14"}
        ],
        "citations": [
          {"type": "dictionary", "ref": "PED s.v. paṭṭhāna",
           "url": "https://dsalsrv04.uchicago.edu/cgi-bin/app/pali_query.py?qs=patthana"}
        ]
      },
      {
        "morphology": "sati + upaṭṭhāna (upa + sthā)",
        "gloss": "close-attendance, presencing",
        "translators": [
          {"name": "Bhikkhu Sujato", "rendering": "kinds of mindfulness meditation",
           "sourceUrl": "https://suttacentral.net/mn10/en/sujato"}
        ],
        "citations": [
          {"type": "monograph", "ref": "Anālayo, Satipaṭṭhāna: The Direct Path, ch. 1",
           "url": "https://www.windhorsepublications.com/product/satipatthana-the-direct-path-to-realization/"}
        ]
      }
    ],
    "narrative": "The consonant doubling (tt) masks which prefix was originally present. Anālayo argues philologically for the second parse; Bodhi follows the first; Sujato follows the second."
  }
}
```

**`commentarial-glosses.json`**:
```json
{
  "ñāya": [
    {
      "source": "Visuddhimagga",
      "ref": "Vism XXII.6",
      "url": "https://tipitaka.org/...",
      "excerpt": "ariyaṭṭhaṅgika-magga (the Noble Eightfold Path)",
      "fetchedAt": "2026-05-14"
    }
  ],
  "dukkha": [...]
}
```

**`url-templates.json`** (per provider, for Gap A):
```json
{
  "dpd": "https://dpdict.net/dpd_search.html?search={lemma}",
  "sc-bilara": "https://suttacentral.net/{suttaId}/en/{translator}",
  "vri-attha": "https://tipitaka.org/?path={path}"
}
```

### Provider interface (mirrors existing pattern)

```typescript
// services/sutta-studio/grounding/types.ts
export type GroundedClaim = {
  term: string;
  citations: Citation[];   // Uses existing Citation type
  narrative?: string;       // Optional curator synthesis (interpretation, flagged)
};

export interface GroundingProvider {
  name: string;
  lookup(query: string): Promise<GroundedClaim[]>;
}
```

### `groundingPass` flow

```
v11 phase output → groundingPass:
  for each PaliWord w:
    for each segment s:
      claims = await contestedTermProvider.lookup(s.text)
      claims = claims.concat(await commentarialProvider.lookup(s.text))
      attach claims.citations[] to packet.citations
      attach citationIds to s
    for each sense:
      bilaraClaims = await translatorBankProvider.lookup(phase.canonicalSegmentId)
      attach to sense.citationIds
  for each existing citation in packet.citations:
    if no url, mintUrl(citation) via urlMinter
  return phase with grounded citations
```

The pass is **deterministic and idempotent** — same packet in, same citations out. No LLM in this pass.

### UI affordance (Gap F)

In `LensPanel`, each sense renders with one of two visual states:
- **Grounded**: has `citationIds`; chips display with their URLs; sense gets a
  subtle "📎" or just bold/normal weight
- **Interpretive**: no `citationIds`; sense renders with `italic` or a leading
  "—" mark, signaling "this is curator synthesis, not a sourced claim"

The affordance should be **honest, not penalizing**. Interpretation is allowed
and often necessary. The user just needs to know which is which.

## Bootstrap sequence

### Phase 0 — URL minting (Gap A)
**Effort**: 1-2 hours
**Risk**: very low

Build `urlMinter.ts` with templates for DPD, SC Bilara, Suttaplex, VRI.
Backfill existing 32 DPD citations with URLs. Verify clickable in audit panel.

**Validation gate**: All 32 chips clickable; spot-check 5 URLs by visiting.

### Phase 1 — Contested-term seed (Gap C, narrow)
**Effort**: 3-4 hours
**Risk**: medium (bootstrap requires real scholarship)

Seed `contested-terms.json` with the 10-15 most contested MN10 terms:
- satipaṭṭhāna, sati, dhamma, dukkha, nibbāna, ñāya, sampajañña,
  vedanā, citta, kāyānupassanā, ātāpī, viharati, saṅkhāra

For each: 1-3 parses + translator alignments + at least 1 primary citation.
Sources: PED (online at dsalsrv04.uchicago.edu), SuttaCentral, Anālayo's
intro chapters (often in Google Books preview), dhammatalks.org for
Thanissaro.

**Validation gate**: Per term, all citation URLs return 200. Two random
entries verified by clicking through and reading the source.

### Phase 2 — `contestedTermProvider` + `groundingPass` (Gap E, narrow)
**Effort**: 4-6 hours
**Risk**: low (pattern matches existing providers)

Build `contestedTermProvider.ts` that reads the registry. Build `grounding.ts`
pass that runs after lexicographer, queries the provider per Pāli word, and
attaches citations.

Wire into compiler pipeline. Re-run on phase-7 (satipaṭṭhāna phase) to
demonstrate the grounded output.

**Validation gate**: phase-7 v11 output (re-run) shows clickable chips
linking to PED, Anālayo, SuttaCentral. Curator review confirms claims
match cited sources.

### Phase 3 — Translator-bank wiring (Gap B)
**Effort**: 4-6 hours
**Risk**: medium (alignment is fuzzy — bilara is verse-level, we segment at word-level)

Build `translatorBankProvider.ts` wrapping the existing `scBilaraVariants`.
Per phase's `canonicalSegmentId`, fetch Bodhi + Sujato renderings.
Attach as phase-level citations (verse-grain, not word-grain).

Reader sees: "In MN10:2.1, Bodhi translates: '...' / Sujato translates: '...'"
with clickable links.

**Validation gate**: 5 random phases show correct Bodhi+Sujato rendering chips.

### Phase 4 — Commentarial-gloss seed (Gap D)
**Effort**: 6-10 hours
**Risk**: high (requires Pāli reading to extract glosses accurately)

Seed `commentarial-glosses.json` with ~30 of the most-glossed Theravāda
technical terms. Use VRI tipitaka.org as primary source (the Burmese-edition
commentaries are digitized with permalinks).

**Validation gate**: 5 random entries verified — click through to VRI,
check the excerpt matches.

### Phase 5 — UI grounded-vs-interpretive affordance (Gap F)
**Effort**: 1-2 hours
**Risk**: very low

Add subtle visual cue in `LensPanel`. Two states: grounded (has citationIds)
vs interpretive (no citationIds). Honest, not penalizing.

**Validation gate**: Visual review on phases 5-7 — interpretive senses
clearly marked, grounded ones clearly clickable.

## Total bootstrap

| Phase | Effort | Cumulative |
|---|---|---|
| 0 — URL minting | 1-2 hr | 1-2 hr |
| 1 — Contested terms seed | 3-4 hr | 4-6 hr |
| 2 — Provider + pass | 4-6 hr | 8-12 hr |
| 3 — Translator bank | 4-6 hr | 12-18 hr |
| 4 — Commentarial seed | 6-10 hr | 18-28 hr |
| 5 — UI affordance | 1-2 hr | 19-30 hr |

**Phase 0 alone closes the biggest credibility gap.** Citations stop being
asserted labels and become clickable receipts.

## What the LLM is still doing (irreducible)

After all six phases land, the LLM is still responsible for:

1. **Cross-phase narrative synthesis** — connecting verified facts into
   pedagogical story ("the grammar tracks the conceptual movement").
   This is interpretation; the inputs are verifiable; the synthesis is LLM.
2. **Pedagogical framing** — deciding which verified facts deserve surfacing
   in tooltips vs which are footnotes.
3. **Tone, register, voice** — making the tooltip readable.
4. **Detecting when a claim NEEDS surfacing** — recognizing that a contested
   term has appeared and the contest matters here.

These are real LLM jobs. The architecture's purpose is to make sure the
LLM is doing THESE jobs, not substituting for a database it doesn't have.

## Anti-patterns to guard against

| Anti-pattern | How it manifests | Guard |
|---|---|---|
| **Phantom-source** | Citation registered but URL doesn't resolve, or excerpt doesn't match source | Validation gate on each bootstrap phase: spot-check URLs return 200, excerpts match |
| **LLM-as-DB-fallback** | "If contested-terms doesn't have an entry, ask LLM" — re-introduces hallucination | NEVER fallback to LLM for factual claims. Missing entries = mark as interpretive, surface to curator backlog |
| **Citation theater** | Chips render but don't actually link anywhere useful | UI affordance must distinguish grounded vs interpretive HONESTLY |
| **Registry inflation** | Adding contested-term entries the curator hasn't actually verified | Each entry MUST have a verified primary citation, not a claim about a source |
| **Tangled provider hierarchy** | New providers reimplementing existing patterns | All new providers MUST conform to `GroundingProvider` interface and live under `services/sutta-studio/grounding/` |

## Connection to existing principles

This architecture instantiates:

- **Phantom-consumer audit** — every claim has a real consumer (the audit panel chip); the registry IS the consumer-population work.
- **Lean toward the reverse direction** — the architecture SHRINKS what the LLM claims, not what it does. The LLM's footprint contracts.
- **Leave telic breadcrumbs** — this doc is the breadcrumb; future agents reading curated tooltips see the WHY.

## Open questions

1. **Word-level alignment with Bodhi/Sujato** — bilara is verse-level.
   How do we surface per-WORD translator renderings? Tracking issue, not
   blocking. Phase 3 ships verse-level; word-level is Phase 6+.
2. **Anālayo / Bodhi book citations** — printed sources without clean
   permalinks. Provisional: cite Google Books preview URLs. Long-term:
   chapter-level references in a structured bibliography.
3. **Thanissaro coverage** — dhammatalks.org is HTML, not bilara JSON.
   Scraper needed. Acceptable for Phase 3 because his is the lower-volume
   tradition in MN10 coverage.
4. **Languages beyond English** — current architecture is Pāli + English.
   Tibetan / Chinese parallels would require additional translator banks
   (84000.co for Tibetan, fojin for Chinese). Deferred to per-language
   modules; same Citation shape.

## Next move (proposal)

Phase 0 today, ~1-2 hours. URL minting on the existing 32 citations is the
single highest-leverage move:
- Smallest effort
- Largest credibility lift (chips go from "asserted label" to "verifiable
  receipt")
- Validates the whole architectural arc without committing to the bigger
  pieces

If Phase 0 looks good, do Phase 1 (contested-terms seed) next — the
satipaṭṭhāna and dukkha entries alone change the polish workflow.
