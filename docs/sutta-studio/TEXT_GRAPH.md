# Sutta Studio TextGraph — Architectural Spec for Textual Transmission

> **Status:** design — implementation deferred until first polyglot MVP. No schema changes shipped from this document yet.
> **Companion:** `FEATURES.md` (current bilingual implementation).
> **Sibling:** `POLYGLOT.md` (multi-language lens architecture; uses concepts defined here).
> **Inspiration:** TEI Critical Apparatus / Linking-Segmentation-Alignment modules; BDRC/BUDA Linked Open Data; CBETA collection structure; SuttaCentral bilara segment alignment.

## Manifesto

> Scripture is not a finished object handed down from the past. It is a **living transmission object** — uttered, remembered, recited, supported, edited, translated, copied, printed, digitized, aligned, annotated, and read.

Current schema captures the last three steps of that chain (digitized, aligned, annotated). The TextGraph adds the rest: **what object are we looking at, and through what chain did it reach us?**

The discipline this enforces:
- **Tradition is not laundered into fact.** "Buddha taught MN10 at Kammāsadhamma" is a traditional attribution, not a manuscript attestation.
- **Witnesses are named.** "We're using the Sixth Buddhist Council edition (1954-56)" is a real claim about provenance.
- **Translators are credited as agents, not as transparent windows.** Sujato's English is *Sujato's English*, not "the meaning."

---

## 1. Why a separate graph (not nested in the packet)

The current `DeepLoomPacket` carries everything inline: source URL, segments, phases, compiler stamp. If we encode provenance as a nested `provenance: { manuscripts: [...], edition: {...}, translation: {...} }` field on the packet, every packet for the same work re-states the same chain. Two packets for MN10 (one with sujato translation, one with bodhi translation) would duplicate everything except the translation layer.

The TextGraph externalizes this. Packets reference graph nodes by ID; the graph is queried/rendered separately.

```ts
// Old (nested, duplicating)
type DeepLoomPacket = {
  // ...
  provenance: {
    manuscripts: [...],
    edition: { ... },
    translation: { translator: 'Sujato', ... }
  };
};

// New (referenced)
type DeepLoomPacket = {
  // ...
  textGraphRefs?: {
    workId?: string;          // → TextGraph.works
    expressionId?: string;    // → TextGraph.expressions
    baseWitnessId?: string;   // → TextGraph.witnesses
    translationWitnessId?: string;
  };
};

// Loaded separately — single source of truth per entity
type TextGraph = {
  works: Work[];
  traditions: Tradition[];
  expressions: Expression[];
  witnesses: Witness[];
  sources: SourceRef[];
  claims: Claim<unknown>[];
  alignments: Alignment[];
  concepts: ConceptNode[];
};
```

When two packets reference the same `expressionId`, they share metadata. When the Sixth Council edition gets a documentation update, it updates everywhere.

---

## 2. The five entity types

### Work

The abstract literary identity. `Satipaṭṭhāna Sutta` is one Work, regardless of language or edition.

```ts
type Work = {
  id: string;                       // "work.mn10"
  preferredLabel: string;           // "Satipaṭṭhāna Sutta"
  alternateLabels?: string[];       // ["MN 10", "Foundations of Mindfulness"]
  category?: string;                // "sutta" | "vinaya" | "abhidhamma" | "tantra" | "śāstra" | ...
  notes?: string;
};
```

### Tradition

The transmission lineage. Determines what counts as a witness.

```ts
type Tradition = {
  id: string;                       // "tradition.theravada-pali"
  name: string;                     // "Theravāda Pāli Canon"
  primaryLanguage: string;          // "pi"
  geographic?: string[];            // ["Sri Lanka", "Burma", "Thailand", "Cambodia"]
  notes?: string;
};
```

### Expression

A linguistic incarnation of a Work within a Tradition. The *Pāli Satipaṭṭhāna* is one Expression. The *Chinese 念處經* (Niànchùjīng) translation is another Expression of the same Work.

```ts
type Expression = {
  id: string;                       // "expression.mn10-pli"
  workId: string;                   // → Work
  traditionId: string;              // → Tradition
  language: string;                 // "pi" / "sa" / "zh" / "bo" / "en"
  recension?: string;               // "Mahāsaṅgīti" / "PTS" / "Burmese 6th Council"
  notes?: string;
};
```

### Witness

A specific material attestation. A manuscript, a printed edition, a digital file. One Expression has many Witnesses (Sinhalese palm leaf MS at Mahāvihāra, Burmese Kammavāca, VRI digital file, SC bilara JSON).

```ts
type Witness = {
  id: string;                       // "witness.mn10-pli-vri"
  expressionId: string;             // → Expression
  kind: 'manuscript' | 'inscription' | 'printed_edition' | 'digital_transcription' | 'reconstruction';
  estimatedDate?: Claim<string>;
  place?: Claim<string>;
  script?: string;                  // "Sinhala" / "Burmese" / "Khom" / "Devanāgarī" / "Latin"
  medium?: string;                  // "palm leaf" / "paper" / "stone" / "digital"
  digitizer?: string;               // "Vipassana Research Institute" / "BDRC" / "SuttaCentral"
  digitizedDate?: string;           // ISO date
  url?: string;
  externalIds?: Record<string, string>;  // { bdrc: "W22084", gretil: "...", cbeta: "T0026" }
  notes?: string;
};
```

### SourceRef

The pragmatic citation handle — where a particular reading or annotation comes from. Lighter than a Witness; more like a footnote.

```ts
type SourceRef = {
  id: string;                       // "source.ped"
  kind: 'dictionary' | 'commentary' | 'sutta' | 'paper' | 'online' | 'translation';
  short: string;                    // "PED s.v. assasati"
  url?: string;
  authority?: string;               // "Pali Text Society"
  date?: string;                    // "1921-1925"
  note?: string;
};
```

---

## 3. The Claim wrapper (epistemic discipline)

Every uncertain or contested assertion in the graph is wrapped in `Claim<T>`:

```ts
type Claim<T> = {
  value: T;
  assertedBy?: string;              // "Mahāvaṃsa" / "Buddhaghosa" / "modern consensus"
  sourceRef?: string;               // → SourceRef.id
  confidence?: 'high' | 'medium' | 'low' | 'traditional' | 'contested';
  note?: string;
};
```

This is **the most important type in this document.**

### Two-tier ergonomics

`Claim<T>` is verbose for trivially-certain assertions. Pragmatic rule: use the wrapper only when uncertainty matters or when sources differ.

```ts
// Trivially certain — primitive value
caseField: 'gen'

// Genuinely contested — wrapped
caseField: {
  value: 'gen',
  assertedBy: 'morphological analysis',
  confidence: 'high',
  note: 'Could be ablative; merges with genitive in form. Function here is genitive.'
}
```

Renderers treat primitives as `{ value: x, confidence: 'high' }` implicitly.

### What deserves wrapping

| Case | Wrap? | Why |
|---|---|---|
| Pāli noun case from clear morphology | No | Settled |
| Sanskrit compound type (kammadhāraya vs tappurisa) | Yes | Often genuinely ambiguous |
| English gloss for a single sense | No | Translator's choice, but not "uncertain" — alternatives go in other senses |
| Date of composition | Yes | Always uncertain, often contested |
| Manuscript date | Yes | Carbon dating + paleography give ranges |
| Geographical place of teaching | Yes | Traditional vs attested distinction matters |
| Authorship of a commentary | Sometimes | If well-attested (Buddhaghosa for Pp), no. If contested, yes. |

### What this prevents

The schema cannot then accidentally laundry-launder traditional claims as facts. Code that reads `expression.dateOfTeaching: '5th century BCE'` cannot tell that's a tradition. Code that reads `expression.dateOfTeaching: { value: 'c. 5th century BCE', confidence: 'traditional' }` knows.

---

## 4. Concept nodes (cross-language anchors)

A `ConceptNode` is the abstract idea a word points to, independent of which language the word is in. *śūnyatā* / *suññatā* / *空* / *stong pa nyid* / *emptiness* all point to the same Concept.

```ts
type ConceptNode = {
  id: string;                       // "concept.emptiness"
  preferredLabel: string;           // "emptiness"
  preferredLanguage?: string;       // "en" — display preference
  canonicalTerms?: TermRef[];       // attested forms in different languages
  notes?: string;
  contested?: boolean;              // true if scholars disagree on meaning
};

type TermRef = {
  language: string;                 // "sa" / "pi" / "zh" / "bo" / "en"
  text: string;                     // "śūnyatā"
  script?: string;                  // "IAST" / "Devanāgarī" / "Han" / "Tibetan" / "Latin"
  sourceRef?: string;               // → SourceRef.id
};
```

In an Expression, a word can point to a Concept:

```ts
type PaliWord = {
  // existing fields
  conceptId?: string;               // → ConceptNode
};
```

The renderer uses `conceptId` to highlight all instances of a concept across visible language panels (when polyglot UI exists). Until then, `conceptId` is just metadata.

**Concept curation is per-Work.** A short text like the Heart Sutra has 30-50 concepts to register. A long sutta has hundreds. Concept registries are bigger than expected; budget time accordingly.

---

## 5. Alignment (multi-resolution cross-reference)

Alignments connect units across Witnesses or Expressions. They are not the same thing as `EnglishToken.linkedPaliId` (which is *intra-packet bridge metadata*); they are *graph-level cross-references*.

```ts
type Alignment = {
  id: string;
  level: 'work' | 'chapter' | 'passage' | 'segment' | 'phrase' | 'word' | 'morpheme' | 'concept' | 'sound';
  sourceUnitIds: string[];          // unit IDs (segment, word, morpheme — depends on level)
  targetUnitIds: string[];
  relation: 'translation' | 'transliteration' | 'calque' | 'commentarial_equivalence' | 'variant' | 'parallel' | 'uncertain';
  confidence?: 'high' | 'medium' | 'low';
  note?: string;
};
```

### Why multi-resolution

Trying to align everything at the word level is fragile. Pāli `evameva` ↔ Sanskrit `evameva` ↔ English "in this very same way" maps cleanly at *phrase* level but not word level.

Heart Sutra mantra `gate gate pāragate pārasaṃgate bodhi svāhā` ↔ Chinese `揭諦揭諦 波羅揭諦 波羅僧揭諦 菩提薩婆訶` aligns at *sound* level (transliteration), not semantic level.

The 4-fold breath formula in MN10 aligns at *passage* level across multiple suttas (parallels) and at *concept* level (the four breathing instructions) across the sutta.

A single pair of Witnesses gets *many* Alignments at different levels.

---

## 6. Putting it together — the `textGraphRefs` field

The packet only needs **references** into the graph:

```ts
type DeepLoomPacket = {
  // existing fields...
  textGraphRefs?: {
    workId?: string;
    expressionId?: string;
    baseWitnessId?: string;
    translationWitnessId?: string;
  };
};
```

The renderer, given a packet, can:
1. Look up `textGraphRefs.workId` → display Work title
2. Look up `textGraphRefs.expressionId` → display recension/lineage
3. Look up `textGraphRefs.baseWitnessId` → display "Mahāsaṅgīti VRI"
4. Look up `textGraphRefs.translationWitnessId` → display "Sujato 2018, CC0"
5. Show the chain as the "About this text" panel

If `textGraphRefs` is absent, packet renders without provenance UI. **Strictly additive.**

---

## 7. Migration from current packet-nested provenance

`FEATURES.md §2.6` proposes a packet-nested `provenance` object as a bilingual MVP step. That's the right move — it lets MN10 land provenance immediately without waiting for the graph machinery. The migration to TextGraph is later.

### Dual-write strategy

When TextGraph lands:

1. **Old packets** with nested `provenance` continue rendering. Renderer reads from `packet.provenance` directly.
2. **New packets** populate both `provenance` (for backward-compat) AND `textGraphRefs`. Renderer prefers `textGraphRefs` when present.
3. **Migration script** can lift provenance fields into TextGraph entities, generate IDs, populate `textGraphRefs`.
4. **After full migration**, deprecate `provenance` field. Remove in a future version.

This is the standard "introduce new format, dual-write, deprecate old" pattern. Low risk.

### Same pattern for `linkedPaliId` → `Alignment[]`

The current bridge metadata (`EnglishToken.linkedPaliId`, `linkedSegmentId`) is *intra-packet*. If we ever want graph-level alignment between packets, we follow the same migration:

```ts
// Old (intra-packet bridge)
{ id: "ea3", linkedSegmentId: "a3s1" }

// New (graph alignment alongside)
alignments: [
  {
    sourceIds: ["packet-mn10:a3s1"],
    targetIds: ["packet-mn10:ea3"],
    level: "morpheme",
    relation: "translation"
  }
]
```

Renderers read whichever exists; new code reads alignments.

---

## 8. Why TEI as inspiration, not implementation

TEI (Text Encoding Initiative) has solved most of these problems for 30+ years:
- **TEI Critical Apparatus module** — variant readings, lemma vs witness, manuscript collation
- **TEI Linking module** — segmentation, alignment, parallel passages

But TEI XML is heavy. It's designed for scholarly editions destined for print or full-fidelity digital editions; the data model maps cleanly to academic philology but awkwardly to a study reader's needs.

The TextGraph spec above borrows TEI's *concepts* (Witness, Lemma-Variant pairs, Alignment) but represents them as plain JSON / TypeScript. Specific differences:

| TEI | TextGraph | Why |
|---|---|---|
| `<witness>` element with hand identification | `Witness` type with `digitizer`, `script`, `place` | Simpler; we're not collating handwriting |
| `<rdg wit="#W1">` reading | `segmentVariants[segmentId]` in provenance | We rarely surface variants per word |
| `<linkGrp type="alignment">` | `Alignment` type with `level` | Multi-resolution explicit |
| `<msIdentifier>` | `Witness.repository` + `externalIds` | Linked-data via external IDs |

Future export to TEI is possible (the data is there). Future import from TEI would also be feasible (it's just a heavier source format). Neither is needed for the MVP.

---

## 9. Where to learn from existing platforms

**For the archive side (manuscripts, repositories, IIIF):**
- BDRC / BUDA — Tibetan + Sanskrit + Chinese + Pāli + Burmese + Khmer materials, RDF/Linked Open Data, IIIF image hosting. https://www.bdrc.io/
- IIIF — international standard for image annotation. Future: per-page MS scans linked to passages.

**For Chinese Buddhist canon:**
- CBETA — Taishō, Xuzangjing, Jiaxing canon, etc. https://cbeta.org/

**For early Buddhist Pāli:**
- SuttaCentral bilara-data — segment-aligned Pāli + translations. https://github.com/suttacentral/bilara-data
- VRI Tipitaka — Sixth Council digital text. https://www.tipitaka.org/

**For Sanskrit:**
- GRETIL — Indological digital text archive
- Sanskrit Heritage / sanskrit_parser — sandhi splitting, morphological analysis
- DCS (Digital Corpus of Sanskrit) — annotated corpus

**For Tibetan:**
- BDRC (above)
- Asian Classics Input Project (ACIP)

The TextGraph schema is generic enough that any of these can be a source.

---

## 10. Build order (when this work eventually starts)

This is the proposed sequence when TextGraph implementation is greenlit:

| Step | What | Effort | Reads-from / Writes-to |
|---|---|---|---|
| 1 | Add the type definitions to `types/suttaStudio.ts` (no use yet) | half-day | additive |
| 2 | Add `textGraphRefs?` to `DeepLoomPacket` (still unused) | hour | additive |
| 3 | Build a small in-memory TextGraph for MN10 (one Work, one Expression, two Witnesses, one Translation) | half-day | new file `data/text-graph/mn10.ts` |
| 4 | Add packet → graph lookup in the loader | half-day | render layer |
| 5 | "About this text" panel reads `textGraphRefs` | half-day | new UI component |
| 6 | Curate ConceptNode registry for one Work (e.g. MN10 ~30 concepts) | day | concept curation |
| 7 | Backfill `conceptId` on existing PaliWords in the demo packet | day | edit demoPacket.json |
| 8 | First Alignment between two packets (e.g., MN10 ↔ AN5.114 parallel passage) | day | new `data/text-graph/alignments.ts` |
| 9 | Cross-reference UI (parallel passages list) | day | UI |
| 10 | Migration: lift current packet-nested `provenance` into TextGraph entities, populate `textGraphRefs`. Deprecate `provenance`. | day | migration script |

Total: ~7-9 working days for someone focused. Not a session task.

---

## 11. What this document does NOT specify

- **Per-language decomposition lenses.** That's `POLYGLOT.md`.
- **Context graph (doctrinal/social/economic lenses).** Also in `POLYGLOT.md`.
- **UI layouts.** Those are component design, not data design.
- **IIIF integration / image annotation.** Future, optional.
- **Variant edition diff/merge UI.** Even further future.

---

## 12. The principle

> The data model is a graph of claims about a chain of texts. The reader sees the graph collapsed into a single packet; the renderer makes the chain visible on demand.

A packet is a **view** into the graph, not a self-contained truth. When you can't tell whether you're reading "the Pāli" or "the Pāli as edited by the Sixth Council and digitized by VRI and segmented by SuttaCentral and translated by Sujato," the design has failed.

When you can — when one click opens a panel that walks you through the chain — the design has succeeded.
