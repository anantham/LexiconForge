# Amortization — What Carries Forward Between Suttas

> What this doc captures: the irreducible-gap finding from the MN10 buildout,
> the new-sutta playbook that the architecture enables, and a backlog of
> external resources we should investigate before reinventing wheels.
>
> Companion to docs/sutta-studio/GROUNDING.md (architecture) and
> docs/sutta-studio/FEATURES.md (current MVP spec).
>
> Author note: this doc is a telic breadcrumb. The finding is honest — there
> is a real ceiling to pipeline-only quality that registry growth narrows
> but does not eliminate. Future curators bringing a new sutta online should
> read this BEFORE assuming the architecture will do all the work.

## The 75-80% pipeline ceiling

Empirically (MN10 buildout, 2026-05-14): with the current architecture in
place, a freshly-compiled packet for a new sutta reaches **~75-80% of
hand-curated quality** when the contested vocabulary is in the registry.
**~50-60%** when it isn't.

The remainder — the 20-25% — is irreducibly the curator's job. This isn't
a complaint about LLMs; it's a description of what the work actually IS.

## What transfers (built once, runs forever)

| Component | Where | Carries over to new sutta |
|---|---|---|
| Pāli syllabifier | `services/sutta-studio/postPasses/syllabify.ts` | 100% — deterministic on any Pāli text |
| DPD provider + URL minting | `services/providers/dpd.ts` + `scripts/sutta-studio/mint-citation-urls.py` | 100% — any Pāli word lookup |
| SC Bilara provider | `services/providers/scBilaraVariants.ts` | 100% for suttas in bilara-data |
| Compiler pipeline | `services/compiler/index.ts` | 100% — sutta-agnostic |
| groundingPass + ContestedTermProvider | `services/sutta-studio/passes/grounding.ts` + `services/sutta-studio/grounding/` | 100% — generic interface |
| Citation/chip rendering | `components/sutta-studio/LensPanel.tsx` | 100% — sutta-agnostic |
| Tooltip-hover/audit-click model | `components/sutta-studio/SuttaStudioView.tsx` | 100% |
| V2 prompt amendments | `config/suttaStudioPromptContextV2.ts` | ~95% — may need minor sutta-specific tweaks |
| Test infrastructure | `test-fixtures/` + per-pass tests | 100% |
| Phantom-consumer audit discipline | `~/.claude/CLAUDE.md` + this codebase's history | 100% — process, not code |
| Curation log format | `docs/sutta-studio/curation/phase-N.md` | template carries over |

## What transfers partially (sutta-specific seeding)

| Component | Effort per new sutta |
|---|---|
| Contested-terms registry | ~5 new entries × 15 min = 1-1.5 hr (entries that don't exist in MN10's 11) |
| Commentarial-gloss DB (Phase 4 deferred) | One-time canon-wide investment; once seeded with ~100 terms, marginal effort per new sutta is zero |
| Translator-bank (Phase 3 deferred) | One-time wiring for SC Bilara; per-sutta coverage is automatic from bilara-data |

## What doesn't transfer (per-sutta curator labor)

| Work | Why it's irreducible |
|---|---|
| Phase-by-phase polish of doctrinal-density phases | Each sutta has its own architecture, vocabulary, rhetorical moves |
| Cross-phase narrative observations | The "grammar tightens from gen-pl to gen-sg" kind of observation requires reading the WHOLE chain; v11's prompt window is one phase |
| Pedagogical-judgment calls | Which verified facts deserve tooltip surfacing vs scrolling past |
| Voice consistency across phases | LLM voice drifts between phases |

## New sutta playbook (concrete time estimate)

Based on MN10 vs theoretical MN13 comparison:

| Step | Time | Output |
|---|---|---|
| 1. Registry expansion for new contested vocab (e.g., assāda, ādīnava, nissaraṇa for MN13) | 1-1.5 hr | Verified URLs, all 200; pipeline auto-grounds these everywhere they appear |
| 2. v11 batch pipeline run | 30 min runtime, ~$1 cost | Draft phases for all ~30 sutta phases, auto-grounded via Phase 2.5 wiring |
| 3. Hand-polish doctrinal-density phases (~10 phases × 10 min) | 1.5-2 hr | Cross-phase notes, contested-term framing, voice consistency |
| 4. Procedural phases (~20 × 3 min register sweep) | 1 hr | Quality check; accept v11+grounding output mostly |
| 5. Final inspection + commit hygiene | 30 min | WORKLOG, PR, link verification |
| **Total** | **~5-6 hr** | Sutta at golden-dataset quality |

Compare to **MN10's ~40+ cumulative session hours** — most of that was building the architecture you now have for free.

## Where the gap closes vs where it stays

### Closes (with infrastructure investment)

- **Translator-tradition surfacing** — Phase 3 (translator-bank) + registry expansion. The more terms registered, the more new suttas auto-ground at full quality.
- **Commentarial gloss attribution** — Phase 4 (commentarial-gloss seed). Once ~100 Vism terms are indexed, most doctrinal claims become automatically citable.
- **Etymology + cognates** — already 100% covered by DPD provider. No gap.
- **Pronunciation** — already 100% covered by syllabifier. No gap.

### Stays (irreducibly LLM + curator)

- **Cross-phase narrative synthesis** — connecting verified facts into pedagogical story. The architecture's purpose is to make sure the LLM does THIS job (and not substitute for a DB).
- **Voice and register** — the writerly polish that makes a sutta READABLE.
- **Pedagogical judgment** — when a sutta has too many verified facts to surface, the curator picks.

Note that the "stays" column is actually what humans + LLMs are GOOD at when freed from doing database work. The architecture's leverage point isn't replacing the curator — it's freeing the curator to do the parts that need a curator.

## External resources backlog — don't reinvent the wheel

This section lists Pāli/Buddhist-studies infrastructure we have NOT investigated. Before building anything that overlaps these, check first.

### Lexical / dictionary

- **DPD (Digital Pali Dictionary)** ✅ already wired
- **Cologne Digital Sanskrit Dictionaries** — Monier-Williams, MW Apte, etc. Useful for Sanskrit cognates. Public API at sanskrit-lexicon.uni-koeln.de.
- **PTS Pali-English Dictionary** ✅ accessible via dsalsrv04.uchicago.edu and via SuttaCentral's `/define/` route
- **CPD (Critical Pali Dictionary)** — Trenckner et al., partial coverage of the canon's vocabulary. NOT YET INVESTIGATED.

### Corpus / texts

- **SuttaCentral bilara-data** ✅ wired (per-verse translator alignments)
- **VRI Tipitaka (Burmese 6th-council edition)** — at tipitaka.org. Contains Tipitaka + Aṭṭhakathā (commentaries) + Tika (sub-commentaries). NOT YET WIRED for commentarial-gloss lookup (Phase 4 work).
- **GRETIL** — Sanskrit + Pāli text archive at uni-goettingen.de. NOT YET INVESTIGATED.
- **CBETA** — Chinese Buddhist canon. Relevant for Mahayana / parallel-text work (84000 already partially wired for Tibetan).
- **dhammatalks.org** ✅ wired (Thanissaro translations)

### Scholarship + commentaries

- **Bhikkhu Anālayo's monographs** — Satipaṭṭhāna direct path, Compassion and Emptiness, etc. Public PDFs at his author page on amaravati.org. NOT YET INDEXED — could build a small bibliographic provider.
- **Bhikkhu Bodhi's translations and intros** — printed books. Some intros are excerpted online. NOT YET INDEXED.
- **Visuddhimagga (Buddhaghosa)** — VRI digitized but not yet indexed by term-to-line citations. PHASE 4 work.
- **Comprehensive Manual of Abhidhamma (Bodhi/Nārada)** — relevant for terms like dhamma, citta, vedanā. NOT YET INVESTIGATED.

### Linguistic / morphological

- **Morphology corpus** — many academic Pāli morphological parsers exist (DPD includes one). NOT YET CROSS-CHECKED.
- **CST (Chaṭṭha Saṅgāyana Tipiṭaka)** — alternative to VRI; partly overlapping. NOT YET COMPARED.

### Visualization / UI patterns

- **Bibleweb-style interlinear readers** — patterns exist in Christian biblical studies (Logos, Accordance, BibleHub). NOT YET STUDIED for layout ideas.
- **Polyglot reader patterns** — academic editions of Indo-European texts often have interlinear + commentary tradition. NOT YET STUDIED.

## Resource discovery as ongoing work

Per the principle that we shouldn't reinvent wheels: before building any
new provider, check the above list. The DPD wiring took ~2 days; if we
discover a comprehensive Pāli grammar corpus or pre-built contested-terms
dataset that overlaps our registry work, we should pivot rather than continue
building from scratch.

The "irreducibly LLM + curator" finding above is robust — but the "what
transfers partially" column shrinks as more resources are wired. If we
discover, say, a Pāli scholarly community dataset of contested compounds
with verified citations, that could replace months of registry-building.

This doc should be updated each time a resource is discovered, evaluated,
or wired.

## Recommended investigation queue

Highest-leverage next research moves (NOT implementation):

1. **Search for existing Pāli "contested terms" datasets** — perhaps Anālayo or PTS has a digital index of philologically-contested compounds. ~2 hr search + assess.
2. **Investigate Cologne Digital Sanskrit Dictionaries** — Sanskrit cognates for our 11 contested terms. ~1 hr.
3. **Survey VRI tipitaka.org structure** — can we extract Visuddhimagga gloss locations programmatically for Phase 4? ~2-3 hr.
4. **Check Bhikkhu Bodhi MLDB intros** — are there published explanations of his translation choices? Could automate Phase 1 attribution. ~1-2 hr.
5. **Look at biblical interlinear UI patterns** — UI inspiration for grounded-vs-interpretive distinction, polyglot mode, etc. ~1-2 hr.

Each of these is RESEARCH, not building. The output is a doc note saying
"yes, X exists and is useful — recommend wiring" or "no, doesn't exist or
isn't useful — proceed with our own approach."

## The lean-toward-reverse principle applied

Before adding a new provider or new architecture:
1. Check the external-resources backlog above
2. Search the Pāli/Buddhist-studies digital infrastructure landscape
3. If something fits, wire it instead of building from scratch
4. If nothing fits, build minimally — fewer abstractions, more shipping

This doc IS the breadcrumb for that discipline. Future curators reading
this should add to the backlog whenever they encounter a new resource,
even if not yet evaluated. The backlog grows by accretion; the search-
first discipline grows by application.

## Status: where the gap currently sits

As of 2026-05-14 with the GROUNDING Phase 0/1/2/2.5 + 11-term registry
shipped:

- **MN10** — 4/39 phases hand-polished + 21/39 phases grounded. Reaching ~80% on the un-hand-polished phases via auto-grounding.
- **DN22 estimate** — Would reach ~85% out-of-the-box (verbatim quote of MN10 + expansions, all vocab in registry).
- **MN13 estimate** — Would reach ~55% out-of-the-box (different theme, ~30% vocab overlap with registry). After ~1 hr of registry expansion: ~75%.
- **Arbitrary new sutta** — ~50-75% pipeline-only quality depending on overlap.

The 20-30% irreducible gap is where the curator earns their keep.
