# SUTTA-008: Grounded Curation Data Layer

**Date:** 2026-05-11
**Status:** Ratified (2026-05-11) — pre-ratification amendments inline
**Authors:** Aditya + Opus 4.7
**Companions:**
- `docs/sutta-studio/FEATURES.md` (current bilingual implementation; this ADR motivates the data behind §2.5 / §2.6 / §2.9 fields)
- `docs/sutta-studio/TEXT_GRAPH.md` (witness/expression/claim transmission architecture — overlaps but is broader than this ADR)
- `docs/sutta-studio/POLYGLOT.md` (per-language lens charter — uses providers this ADR defines)

---

## TL;DR

Hand-curation and the LLM compiler currently treat lookup-of-real-sources as two unrelated workflows. They should share one **Provider** abstraction. Every gloss, morphological hint, commentary citation, and parallel reference has a real upstream attestation — DPD, VRI, SuttaCentral, bilara-data, BDRC, CBETA, 84000, etc. — and is reachable through a typed provider that both consumers call.

This ADR commits to that architecture, codifies the Tier-1 providers needed for MN10 re-curation, sketches the Tier-2/3 providers polyglot work will need, and adopts **OpenPecha's stand-off annotation model as the design north star** for the next major schema iteration (not built in this ADR).

The most important consequence: `Sense.epistemicBasis: 'lexical'` stops being decorative. Every such value points to a `Citation` whose excerpt is a real string from a real attested source.

---

## Context

### What's broken

The hand-curated `components/sutta-studio/demoPacket.json` is the live `/sutta/demo` artifact. Quality drops sharply after phase 14. The proximate cause is that the curation was done **from memory** — Pāli lemma → English gloss → grammatical hint, with no real lookup against PED, DPD, Aṭṭhakathā, or even SuttaCentral's already-wired `dictionary_full` endpoint. Memory-grounded curation has two failure modes:

1. **Plausible but wrong** — a sense that "sounds right" but isn't attested in any dictionary. The user's standing instruction "make beliefs pay rent" is precisely the rule against this.
2. **Stylistic flattening** — without source diversity, every word ends up with the same shape of senses and tooltips. The richness of phase-a (~14 phases of careful hand-curation) was effortful exactly because grounding *did* happen there, informally; subsequent phases skipped it.

### What already exists

| Component | File | What it does |
|---|---|---|
| SC dictionary lookup | `services/compiler/dictionary.ts` | `fetchDictionaryEntry({surface,...})` hits `https://suttacentral.net/api/dictionary_full/{lemma}`. In-memory cache. Already feeds the lexicographer LLM stage. |
| SC adapter | `services/scraping/siteAdapters.ts` (SuttaCentralAdapter) | Per-sutta `/api/bilarasuttas/{uid}/{author}` fetch. Segment-keyed Pāli + translation. Wired into chapter import. |
| 84000 discovery | `services/librarySearch/known84000.ts` + `Site84000Adapter` | Library/Tōhoku-ID discovery + HTML scrape. Not wired into Sutta Studio glosses. |
| FoJin adapter | `services/scraping/siteAdapters.ts` (FojinAdapter) + `services/librarySearch/searchService.ts` | Chinese canon discovery. Not wired into Sutta Studio glosses. |

These cover **one** lexicon source and **zero** commentary/morphology/edition/witness/parallel sources. The lexicographer LLM sees `dictionary_full` output and then guesses the rest from training data. Hand-curation has been doing essentially the same thing minus the LLM.

### What the user has said this should become

> "rather than rely on memory we need API access to dictionaries, scholars so we are grounded in reality"
> "lexicon-forge.vercel.app/sutta/demo is a very degraded artifact"
> "I want to participate in how you're constructing the data schema and everything so that we might have some ideas on how to change UI. It should be done in a more integrated way."
> "the thing that we create handcrafted can be done automated. Does that make sense?"

The last quote is load-bearing: **hand-curation is not a separate workflow. It is the LLM compiler with a careful human in the lexicographer loop.** Therefore both consumers must share the same data layer; whatever sources I look up while drafting are the same sources the LLM gets at runtime.

---

## Decision

### Principle

**Every *factual* linguistic, textual, bibliographic, or parallelism claim in a `DeepLoomPacket` traces to a typed Provider response or an explicitly marked manual citation against a real attested source. Providers are shared between hand-curation and the live LLM compiler. The artifact carries the citation so the renderer (and the reader) can audit any factual claim back to its origin.**

#### Scope of "factual claim"

The principle applies to: morphology, lemma identification, dictionary glosses, case/number/gender/tense assignments, compound type classification, commentary references, edition identity, manuscript witnesses, parallel passages, and variant readings. These are all assertions about a source text or its transmission and must be auditable.

#### Explicit exemptions

The principle does *not* apply to:

- **Pedagogical summaries.** A tooltip line that paraphrases a grammatical point for a learner ("Marks completed action") is teaching scaffolding, not a factual claim. No citation required.
- **UI copy.** Phase headers, button labels, lens names, color-palette descriptors.
- **Human-authored interpretive notes.** When a curator (or eventually a translator) adds a `Sense.notes` field with their own reading ("In context this carries the urgency of the imperative"), that's an interpretive act, not a citation of an external source. It may *reference* citations but isn't itself one.
- **Author-acknowledged speculation.** Marked with `epistemicBasis` left unset *and* a `nuance` or `notes` field that names the interpretive move explicitly.

The line is: if it claims to describe what the source says or what someone else has said about the source, it cites. If it is the curator's act of teaching or interpreting, it doesn't have to — but it shouldn't dress itself in factual clothing.

Concrete corollaries:

- `Sense.epistemicBasis: 'lexical'` ⇒ `Sense.sourceCitationIds` is non-empty and points to a real `Citation` entry whose source is a `LexiconProvider`.
- `Sense.epistemicBasis: 'commentarial'` ⇒ same, but the citation's source is a `CommentaryProvider`.
- `MorphHint.gender/person/tenseAspect/…` ⇒ filled from a `MorphologyProvider` (DPD-backed); if absent we leave the field unset rather than guess.
- `DeepLoomPacket.provenance.edition` ⇒ filled by an `EditionProvider` (VRI).
- `PhaseView.parallels` ⇒ filled by a `ParallelProvider` (SC `suttaplex` initially; BuddhaNexus later).

### Provider abstraction

We adopt the **Provider pattern** the user proposed verbatim:

```ts
const providers = [
  new SuttaCentralDictionaryProvider(),
  new DpdProvider(),
];

const merged = mergeLexiconEntries(entries, {
  preserveSource: true,
  preferStructuredMorphology: 'dpd',
});
```

Provider interfaces (proposed, to be refined in code):

```ts
// services/providers/types.ts (new)

export interface LexiconProvider {
  readonly id: 'sc-dictionary-full' | 'dpd' | 'ms-dpd' | 'ped-dsal' | 'cpd';
  readonly license: string;          // attribution string for citations
  lookup(lemma: string, opts?: LexiconLookupOpts): Promise<LexiconEntry[]>;
}

export interface MorphologyProvider {
  readonly id: 'dpd' | 'palinlp';
  analyze(wordform: string): Promise<MorphologyCandidate[]>;
}

export interface CommentaryProvider {
  readonly id: 'vri-attha' | 'sc-commentary';
  /** Look up commentary keyed to a canonical bilara segment ID, e.g. 'mn10:1.1'. */
  lookupBySegment(canonicalSegmentId: string): Promise<CommentaryExcerpt | null>;
}

export interface EditionProvider {
  readonly id: 'vri-cscd' | 'sc-publication' | 'pts-edition';
  describe(workId: string): Promise<EditionDescriptor>;
}

export interface WitnessProvider {
  readonly id: 'bdrc' | 'cbeta' | 'gretil';
  getWitnesses(workId: string): Promise<WitnessRecord[]>;
}

export interface ParallelProvider {
  readonly id: 'sc-suttaplex' | 'buddhanexus';
  getParallels(workId: string, opts?: ParallelOpts): Promise<ParallelRef[]>;
}
```

`mergeLexiconEntries` semantics:

- **`preserveSource: true`** — never overwrite one provider's data with another's. The merged entry is a struct of `entriesBySource: Record<ProviderId, LexiconEntry>` plus a flattened convenience view.
- **`preferStructuredMorphology: 'dpd'`** — when extracting `MorphHint`, draw from DPD over SC because DPD ships parsed grammar; SC ships prose.
- **No silent fallthrough** — a missing provider response is `null`, not a guess. The lexicographer LLM (and the human curator) gets to see exactly which sources answered and which didn't.

#### Source-local handles on provider responses

Provider responses MUST expose stable identifiers so citation materialization is deterministic — not hand-glued. Every `LexiconEntry` / `MorphologyCandidate` / `CommentaryExcerpt` / `ParallelRef` returned by a provider carries:

```ts
type ProviderResponseBase = {
  /**
   * Stable identifier inside the provider's own data — e.g., DPD row id,
   * SC dictionary key, VRI paragraph id. Lets us re-fetch or re-reference
   * the exact same upstream record without ambiguity.
   */
  sourceId?: string;

  /**
   * Deterministic packet-level citation id, once materialized. Computed
   * from (providerId, sourceId, query) so the same upstream record always
   * mints the same Citation.id across packets. Format: `cite:{providerId}:{sourceId}`.
   */
  citationId?: string;
};
```

This matters because:

- **Citation materialization should be boring.** Given a provider response, derive the `Citation` entry mechanically; never invent IDs by hand. Hand-maintained `sourceCitationIds: ['ped-sati-1']` style glue is exactly the failure mode this rule prevents.
- **Cross-packet referential integrity.** If two packets cite "DPD entry for sati", they should share `citationId: 'cite:dpd:sati-1234'`. Different packets, same upstream row → same canonical id.
- **Disagreement detection** (see UI affordance §7) requires aligning responses across providers by query, then noting where their `sourceId`s disagree on lemma/morphology.

The implementation provides a `materializeCitation(response, providerId): Citation` helper that does this consistently. Every consumer (lexicographer prompt builder, hand-curation helper, validator) goes through it.

### Why this beats a single dictionary service

| Current (`services/compiler/dictionary.ts`) | Provider abstraction |
|---|---|
| One source (SC `dictionary_full`) | Multiple sources, named, merged with explicit precedence |
| In-memory session cache only | Per-provider cache strategy (in-memory for SC, on-disk static for DPD, lazy-fetch-then-commit for VRI) |
| Returns opaque `unknown` | Returns typed `LexiconEntry[]` per provider; merged convenience view |
| Lexicographer prompt loses source info | LLM prompt sees per-source blocks; can quote a specific dictionary by name |
| Hand-curation re-implements lookup from scratch | Hand-curation calls the same providers; quoted output goes into citations.excerpt |

### Bilara segment IDs are the canonical spine

Already true in the codebase; this ADR codifies it as a principle to prevent drift:

- Every `CanonicalSegment.ref.segmentId` matches a bilara key (e.g. `mn10:1.1`).
- Every `PhaseView.canonicalSegmentIds` is a list of bilara keys.
- Every `CommentaryProvider.lookupBySegment` takes a bilara key.
- Every `ParallelRef.segmentId` (when non-empty) is a bilara key in the parallel work.

This means commentary, parallels, variants, and alignments all share an addressing scheme. Schemas built later that need to reference into a sutta should reuse this rather than invent new IDs.

### Citation schema extension

The current `Citation` type:

```ts
type Citation = { id: string; short: string; detail?: string; url?: string; };
```

is too thin to carry provider output. Proposed extension (this ADR ratifies; the implementation lands with the provider code):

```ts
type CitationProvenance =
  | 'sc-dictionary-full'
  | 'dpd'
  | 'ms-dpd'
  | 'ped-dsal'
  | 'cpd'
  | 'vri-attha'
  | 'vri-cscd'
  | 'sc-bilara'
  | 'sc-suttaplex'
  | 'buddhanexus'
  | 'bdrc'
  | 'cbeta'
  | 'gretil'
  | '84000'
  | 'manual';

type Citation = {
  id: string;
  short: string;          // existing — "PED s.v. sati"
  detail?: string;        // existing — long-form citation string
  url?: string;           // existing
  // — added in this ADR —
  provenance?: CitationProvenance;
  /** The lemma / segment ID / work ID this citation answers a query for. */
  query?: string;
  /** A direct excerpt from the upstream source. Renderable without re-fetching. */
  excerpt?: string;
  /** Provider's license/attribution string. Drives the renderer's attribution UI. */
  license?: string;
  /** ISO date the upstream was fetched. Cache-key + "as-of" hint for the reader. */
  fetchedAt?: string;
};
```

Why `excerpt`: so the UI can render a citation badge → modal *without re-fetching at read time*. The packet is self-contained; deploy artifact has all the source quotes baked in. The renderer's job is to display, not to re-query the internet.

### Tiered source plan

#### Tier 1 — MN10 essentials (this build)

| Provider | Source | License | Storage strategy | Wired into |
|---|---|---|---|---|
| `SuttaCentralDictionaryProvider` | `/api/dictionary_full/{lemma}` | mixed (PED, NCPED, Concise PD, …) | in-memory session cache; existing | lexicographer stage (already), hand-curation |
| `DpdProvider` | `github.com/digitalpalidictionary/dpd-db` SQLite or `sc-voice/ms-dpd` condensed JSON | **CC BY-NC-SA 4.0** | static JSON / SQLite bundled in `data/dpd/` (see Open Questions on full vs ms-dpd) | lexicographer stage, hand-curation |
| `VriEditionProvider` | VRI / Tipitaka.org descriptor | freely redistributable | static `data/editions/vri-cscd.json` | `DeepLoomPacket.provenance.edition` |
| `AṭṭhakathāCommentaryProvider` | VRI mirror XML on GitHub (Pāpañcasūdanī for MN) | freely redistributable | **lazy fetch → commit per used segment**; see "Lazy fetch + commit cache" below | hand-curation; lexicographer prompt sees commentary block when present |
| `SuttaCentralBilaraProvider` | `github.com/suttacentral/bilara-data` raw fetch | CC BY-SA 4.0 / per-translator | already used by SCAdapter; codified | variant readings (`Provenance.segmentVariants`), comments |
| `SuttaCentralSuttaplexParallelProvider` | `/api/suttaplex/{uid}` + `/api/parallels/{uid}` | CC-BY | in-memory; small payload | `PhaseView.parallels` |

#### Tier 2 — Polyglot expansion (Heart Sutra wave)

| Provider | Source | License | When |
|---|---|---|---|
| `CbetaProvider` | `github.com/cbeta-org/xml-p5` (Taishō + others) | CC BY-NC vols 1-55 | Heart Sutra Chinese lens |
| `Provider84000` (Tibetan/Sanskrit) | `github.com/84000/data-tei` + `data-translation-memory` | CC BY-NC-ND 3.0 (TEI) / CC 4.0 (web) | Heart Sutra Tibetan + Sanskrit |
| `GretilProvider` (Sanskrit) | `github.com/INDOLOGY/GRETIL-mirror` | CC BY-SA 4.0 corpus / per-file varies | Heart Sutra Sanskrit |
| `SanskritHeritageProvider` (analysis) | INRIA Sanskrit Heritage / `sanskrit_parser` Python | varies | sandhi splitting; manual validator first |

#### Tier 3 — Witnesses + advanced parallels

| Provider | Source | License | Purpose |
|---|---|---|---|
| `BdrcWitnessProvider` | BDRC/BUDA via `purl.bdrc.io` resource endpoints + IIIF | mixed (open access where possible) | manuscript witness records, scan links, witness graph; **lives at the `TEXT_GRAPH.md` TextGraph layer**, not in the packet directly |
| `BuddhaNexusProvider` | BuddhaNexus text-reuse API | TBD | text-reuse detection across Pāli/Skt/Tib/Chinese; the grown-up `refrainId` / `ParallelRef` automation backend |
| `PaliNLPProvider` | `daalft/PaliNLP` morphology library | GPL | morphological candidate generation for words DPD misses |

### Lazy fetch + commit cache (VRI Aṭṭhakathā pattern)

For sources where pre-bundling is wasteful (VRI Aṭṭhakathā is ~50MB XML; MN10 needs ~50 segments worth):

1. First lookup of a segment → fetch from GitHub raw URL → parse the relevant section.
2. Persist to `data/commentaries/mn10/{segmentId}.json` (or similar layout).
3. Commit the cache file as part of the same commit that uses the data.
4. Subsequent lookups read from the local file.
5. The repo grows organically with the corpus we actually use.

This is the same pattern as `vendor` directories in Go, or "checked-in npm cache." It's appropriate when:
- The upstream is stable (Aṭṭhakathā doesn't change).
- The fetched fragment is small (per-segment commentary section is ~1-5 KB).
- The total used surface is bounded (one sutta at a time).

It is **not** appropriate for things that change (live API endpoints) or things we'd use the entire corpus of (DPD itself — bundle that statically).

### Stand-off annotation as the design north star

OpenPecha's STAM-style architecture (and the user's articulation of it) is the next major schema iteration: separate the **base text** from each analytical layer, where each layer references the base by canonical segment ID or character offset:

```
DeepLoomPacket  (current — nested)
└── PhaseView
    └── PaliWord
        ├── segments[] — morphology entangled with structure
        ├── senses[] — lexicon entangled with structure
        └── relation — alignment entangled with structure

OpenPecha-style  (future — stand-off)
├── BaseText                  — Pāli root, segment-keyed
├── SegmentationLayer         — word + segment boundaries
├── MorphologyLayer           — case/number/gender/tense/etc. per segment
├── LexiconLayer              — senses per segment, with provider tags
├── AlignmentLayer            — segment ↔ English token
├── TranslationLayer          — English (or other) tokens, per translator
├── CommentaryLayer           — Aṭṭhakathā excerpts, per canonical segment
├── ParallelLayer             — parallels, per phrase span
└── ProvenanceLayer           — edition + witness graph
```

**Why this ADR doesn't refactor today:** the bilingual MVP works with the nested model. The immediate pain is *grounding*, not the nested representation itself. We will instead:

- Add new things in the **shape they'd take after the refactor** (e.g., the `Citation.excerpt` field is layer-style; `provenance` is a separate top-level packet field, not nested inside phases).
- Avoid adding new fields **deep inside** `PaliWord` when they'd belong in a future top-level layer. (Example: `parallels` lives on `PhaseView`, not on `PaliWord`, because in stand-off it'd be its own layer keyed by phase ID.)
- Document the migration map (below) so the refactor is informed when it happens.

#### Actual migration cost (not optimistic)

A stand-off refactor is not a "2–4 session" job. Honest scope:

| Component | Work required |
|---|---|
| **Schema** | New `BaseText` + per-layer types; `DeepLoomPacket` shrinks to `{baseText, layers: {…}, provenance, …}`. Type rewrite + validator rewrite. |
| **Schema adapter layer** | Old nested packets must still load; the adapter converts nested → layered at read time so the renderer doesn't care. Symmetric write adapter for any code that still produces nested packets. |
| **Renderer adapter layer** | The current `PaliWord` / `EnglishWord` components walk the nested tree. They'd either get refactored to read from layers, or get a compatibility wrapper that re-nests-on-demand. |
| **Validator changes** | Cross-layer invariants (segment IDs in MorphologyLayer must exist in SegmentationLayer; AlignmentLayer must reference valid TranslationLayer tokens, etc.). |
| **Fixture migration** | Every test fixture + the hand-curated `demoPacket.json` must convert. Either one-shot script or accept that nested fixtures stay nested via adapter. |
| **Back-compat for existing packets** | Either freeze old packets at nested with a version flag and only emit stand-off going forward, or migrate them. Both viable; both have tradeoffs. |
| **Documentation** | `FEATURES.md` is largely written against nested; would need a parallel layer-section. `TEXT_GRAPH.md` already aligns. |

Realistic estimate: **6-12 sessions of focused work**, not counting whatever Tier-2 polyglot needs piled on top. Nested and stand-off will coexist for the duration; ADR-level commitment is that they coexist via adapters rather than by feature-flagging or branching the renderer.

#### Trigger conditions (don't migrate prematurely)

Begin the stand-off migration when **at least one** of the following becomes true:

1. **Nested editing is the dominant source of curation friction.** If hand-curating a phase consistently means jumping between deeply-nested arrays to update a single attribute (case, sense, gloss) across multiple words, the nested model is fighting us.
2. **Polyglot lenses need multiple `Expression`s sharing one base abstraction.** When Heart Sutra work requires the same `BaseText` rendered through Pāli / Sanskrit / Chinese / Tibetan / English lenses, the nested model can't represent that cleanly — each lens wants its own decomposition.
3. **Provider-backed citation data becomes awkward to represent without duplicating it across nested words/phases.** If multiple words/phases reference the same DPD entry and we're carrying redundant copies inline, the savings of layer-keyed lookup-once become real.

**Confidence the immediate pain is grounding, not nested structure: 0.82.** Captured per Aditya's ratification.

#### Migration sketch (not implemented)

| Today's field | Tomorrow's layer |
|---|---|
| `WordSegment.morph` | `MorphologyLayer` keyed by `segmentId` |
| `WordSegment.senses` / `PaliWord.senses` | `LexiconLayer` keyed by `segmentId` / `wordId`, with provider tags |
| `Relation` (on segments) | `AlignmentLayer` keyed by `phaseId`, list of `{from, to, type, label}` |
| `EnglishToken[]` (PhaseView.englishStructure) | `TranslationLayer` keyed by `phaseId` × `translatorId` |
| `DeepLoomPacket.provenance` | `ProvenanceLayer` (single top-level node) |
| `PhaseView.parallels` | `ParallelLayer` keyed by phase span |
| `WordSegment.tooltips` / `tooltipsBySense` | `PedagogyLayer` — separate from L1 fact layers |

This is *informed* by but not identical to `TEXT_GRAPH.md`. TextGraph deals with transmission-level entities (Work / Expression / Witness / Claim) across packets. Stand-off layers deal with analytical decomposition within one packet's content.

### License

| Artifact | Proposed license |
|---|---|
| LexiconForge code | TBD by Aditya; default placeholder pending owner decision |
| DPD-derived JSON / SQLite (`data/dpd/`) | **CC BY-NC-SA 4.0** with attribution to dpd-db |
| ms-dpd-derived JSON (if used instead) | **CC BY-NC-SA 4.0** with attribution to sc-voice/ms-dpd |
| Aṭṭhakathā cache (`data/commentaries/`) | per VRI redistribution terms; attribution to VRI Chaṭṭha Saṅgāyana |
| bilara-data fetched fragments | CC BY-SA 4.0 / per-translator (per file metadata) |
| LLM-generated content (compiler output, demoPacket.json hand-curation) | follows the project code license |

A separate `data/LICENSE-DATA.md` will spell this out with attribution strings and links to upstream licenses.

**Open path for unified licensing:** if Aditya prefers, the whole project — code included — adopts CC BY-NC-SA. The Buddhist-ethics rationale (don't let extractive commercial use take what was freely offered, ethics stripped) is a coherent values choice. This ADR doesn't decide between dual-split and unified; it just commits to attribution for the data half.

---

## UI vision the data motivates

Even though no UI ships in this ADR's build, **the data shape is justified by the UI it makes possible**. Listing it here forces the schema to be UI-considerate:

### 1. Citation badges next to senses
A small `[PED]` / `[DPD]` / `[Buddhaghosa Pp. 240]` chip rendered after each English gloss. Click → modal showing `Citation.excerpt` from each provider that answered. No re-fetch needed because we baked the excerpt into the packet.
**Schema implication:** `Citation.excerpt` + `Citation.provenance` (added in this ADR).

### 2. Commentary sidebar / inline collapsible
For the current `canonicalSegmentId`, surface `AṭṭhakathāCommentaryProvider.lookupBySegment(segId)` as a sliding sidebar or expandable per-phase panel. Pāli commentary in original + Aditya's annotation when present.
**Schema implication:** commentary is a packet-level layer keyed by segment, not buried inside `PhaseView`. Lives well under stand-off `CommentaryLayer` once we migrate.

### 3. Provenance ribbon at packet head
"Mahāsaṅgīti Tipiṭaka (Sixth Council, 1956) → SuttaCentral bilara → Sujato 2018 (CC-BY)". Click → modal with full `DeepLoomPacket.provenance` chain (manuscripts, edition, translator).
**Schema implication:** `provenance.edition` + `provenance.translation` + `provenance.manuscripts` (already added in commit `7d38402`).

### 4. "Why does this gloss say X?" hover
Hover any English gloss → tooltip with `epistemicBasis` + a one-sentence summary of the citation that supports it. Makes the system auditable.
**Schema implication:** `Sense.epistemicBasis` + `Sense.sourceCitationIds` (already added). Renderer composition pulls excerpt from `packet.citations`.

### 5. Refrain / parallel sparklines
For phrases with `refrainId` set (or detected via `BuddhaNexusProvider` later), render a sparkline showing other places in the canon this phrase appears. Click → side-by-side view.
**Schema implication:** `PhaseView.parallels` (added in `7d38402`); future automation via BuddhaNexus.

### 6. Per-language lens toggle (polyglot)
When the same Work has multiple `Expression`s (Pāli, Sanskrit, Chinese, Tibetan), the reader cycles between lenses. Each lens is its own provider stack (Tier-2 in this ADR).
**Schema implication:** `TEXT_GRAPH.md`'s `Work` / `Expression` distinction; `POLYGLOT.md`'s per-language decomposition lenses.

### 7. Source disagreement inspector
When providers disagree on gloss, morphology, derivation, or commentarial interpretation, show the competing attestations side-by-side instead of collapsing them prematurely. Example: DPD says *kāyānupassī* is bahubbīhi; PED entry suggests tappurisa; commentary takes a third view. The disagreement is the most pedagogically valuable thing in the packet — flattening it loses what makes grounded curation worthwhile.
**Schema implication:** keep per-provider entries distinct (`entriesBySource`); don't over-merge in `mergeLexiconEntries`. The `Citation` rows for the same query but different providers are the data the inspector reads. The renderer detects disagreement by grouping citations by `Citation.query` and surfacing when their `excerpt`s differ on attributes the merge cares about.

These are the affordances the data layer needs to be ready for. **The data is the contract; the UI is the deliverable.**

---

## Build order

1. **Provider abstraction + tests** — `services/providers/types.ts`, `services/providers/index.ts`, refactor `services/compiler/dictionary.ts` into `SuttaCentralDictionaryProvider`. Provider list configurable. Lexicographer prompt updated to receive per-source blocks. (One commit.)
2. **`Citation` schema extension** — add `provenance` / `query` / `excerpt` / `license` / `fetchedAt`. Round-trip tests. (Could be folded into commit 1.)
3. **`DpdProvider`** — ingestion script (`scripts/build-dpd.ts`), static JSON output (full or ms-dpd, decided in spike), provider impl, tests. (One commit.)
4. **`VriEditionProvider`** — static descriptor for the Sixth Council edition. (Small; could fold into commit 5.)
5. **`AṭṭhakathāCommentaryProvider`** — lazy-fetch-and-commit pattern, MN10 commentary section as the first cached segment set. (One commit; cache files accrete as MN10 is curated.)
6. **`SuttaCentralBilaraProvider`** (variant readings + comments codified) and **`SuttaCentralSuttaplexParallelProvider`**. (Could fold into commit 5.)
7. **Curation helper script** — `scripts/sutta-studio/lookup-phase.ts` that, given a `phaseId`, prints every provider's output for every lemma + the commentary section. Makes hand-curation grounded by default. (One commit.)
8. **Begin MN10 phase-a re-curation** using the new pipeline. Outputs touch `demoPacket.json`. (One commit per phase; user clears each.)

Estimated: 3–5 sessions to land 1–7; ~50 sessions to re-curate all 51 phases (variable per phase complexity).

---

## Open questions

1. **DPD full vs `ms-dpd`** — does `sc-voice/ms-dpd` preserve enough grammar (case/number/gender/tense/etc.) to fill `MorphHint`? If yes, smaller bundle wins; if no, fall back to full dpd-db SQLite. **Resolve during commit 3 spike.**
2. **DPD storage format** — static JSON (~50MB?) vs in-app SQLite via sql.js (smaller, more queryable, ~150KB sql.js runtime). Static JSON is simpler; SQLite is more powerful. **Resolve during commit 3 spike.**
3. ~~**License unification or split**~~ — **Ratified 2026-05-11: split.** Code stays undecided / permissive pending explicit owner decision; data under strict attribution + upstream-compatible licensing via `data/LICENSE-DATA.md`. Rationale: unified CC BY-NC-SA is philosophically coherent but complicates code reuse, dependency boundaries, and contribution defaults. Project identity can tighten later; untangling a too-broad license choice is harder.
4. **VRI XML alignment to bilara segment IDs** — VRI's Aṭṭhakathā paragraph numbering may not map cleanly to `mn10:1.1` etc. Some manual fixup likely. Cost is "tedious for the first sutta; cheap thereafter." **Estimate at start of commit 5.**
5. **CitationProvenance enum stability** — adding `'sc-dictionary-full'` etc. is a breaking enum change in a sense (no old data has it, but TS will widen typings everywhere). Manageable; flagged.
6. **Bilara-fetched fragments as committed artifacts** — same pattern as VRI; do we cache per-sutta in `data/bilara/` or rely on the GitHub raw URL at compile time and cache only in IDB? Probably the former for reproducibility. **Resolve during commit 6.**
7. ~~**OpenPecha STAM migration timing**~~ — **Ratified 2026-05-11: not before MN10 provider work begins.** Trigger on one of: (a) MN10 re-curation shows repeated friction editing nested packet structures, (b) Heart Sutra polyglot work requires multiple Expressions/languages sharing one base abstraction, (c) provider-backed citation data becomes awkward to represent without duplicating it across nested words/phases. Assumption ratified at confidence 0.82: immediate pain is grounding, not nested structure. See Stand-off section for actual migration cost.
8. **BuddhaNexus availability** — public API, structured data, or unclear? Affects when `ParallelLayer` automation arrives. **Spike before Tier-3.**
9. **GPL-licensed PaliNLP** — incompatible with CC-BY-NC-SA project license if we go unified-NC. Resolve before integrating (likely keeping PaliNLP out-of-process via subprocess call rather than linking).

---

## Non-goals

- **Building Heart Sutra polyglot lenses.** Tier-2 providers are sketched; they're not built here.
- **Refactoring to stand-off annotations.** Captured as design north star; deferred.
- **TextGraph entity model implementation.** `TEXT_GRAPH.md` remains design-only. `BdrcWitnessProvider` etc. are sketched but not built.
- **UI work.** All the UI motivations above are documented for schema discipline, not built.
- **LLM compiler quality improvements beyond richer source material.** Better merging of provider output for the lexicographer prompt is in scope; reworking the prompt strategy is not.

---

## Why this ADR exists

The schema additions in commit `7d38402` (FEATURES.md §2.1-§2.7: `epistemicBasis`, `sourceCitationIds`, `Provenance`, `ParallelRef`, expanded `GhostKind`, `CompoundType`, verb `MorphHint`) are receiving-end hooks. Without a Provider layer feeding real data into them, they're decorative — schema theatre. This ADR is the commitment that those fields are honest: every value points to a real attested source.

The user's instinct — *"the thing that we create handcrafted can be done automated"* — is the architectural keystone. Hand-curation and LLM compilation share one data layer. The golden standard `demoPacket.json` is what the compiler ought to produce; the only way for that to be true is if both come from the same wells.

---

## Pre-ratification amendments (2026-05-11)

Six amendments applied before ratification per Aditya's review:

1. **Principle scope tightened** — limited to factual linguistic / textual / bibliographic / parallelism claims; explicit exemptions for pedagogical summaries, UI copy, human interpretive notes, and author-acknowledged speculation.
2. **Provider responses carry source-local handles** — `sourceId` (provider-local) + `citationId` (deterministic from `cite:{providerId}:{sourceId}`). Citation materialization is mechanical, not hand-glued.
3. **Stand-off migration cost honest** — 6-12 sessions, not 2-4; nested + stand-off coexist via adapters; explicit table of work components.
4. **UI affordance #7 added** — source disagreement inspector. Drives `mergeLexiconEntries` toward preserving per-provider entries instead of collapsing.
5. **License: split, ratified.** Code TBD/permissive; data strict attribution.
6. **Stand-off timing: ratified.** Not before MN10 provider work; trigger on documented conditions.

---

*This ADR is ratified. The build order in § Build order is now actionable. First commit: Provider abstraction + Citation schema extension.*
