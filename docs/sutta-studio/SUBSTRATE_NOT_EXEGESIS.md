# Substrate, Not Exegesis

> **Status:** design rationale, captured 2026-05-16. The liturgy reader proposed
> at the end of this note is now **shipped** (`components/liturgy/`,
> `services/liturgy/`, `data/liturgy/`, routes under `/liturgy`). The product
> thesis below remains the load-bearing principle behind that work.
>
> Folded from a working conversation (previously `docs/context/`) so the reasoning
> survives in the repo rather than only in a local chat log. See also
> [`FEDERATION_FEASIBILITY.md`](./FEDERATION_FEASIBILITY.md),
> [`POLYGLOT.md`](./POLYGLOT.md),
> [`COMMUNITY_CHANT_MODEL.md`](./COMMUNITY_CHANT_MODEL.md), and ADR
> [`LITURGY-001`](../adr/LITURGY-001-liturgy-generator-pipeline.md).

## The starting point: a hand-written chant note

A practitioner's chant note weaves four layers at once:

1. **Phonological** — Pāli romanization, Japanese romaji, Devanāgarī, Chinese
   characters, transliterated dharani.
2. **Etymological** — root verbs (√nam, √śri, √gam, √budh), prefix decomposition
   (upa + sampadā), compound analysis (Pāṇā + atipātā).
3. **Doctrinal** — three jewels, direct vs. indirect cause (in / en), big mind
   vs. small mind, the Tiantai Four Truths framework behind the vows.
4. **Exegetical** — "What would happen if the first thought of our day was
   Kanzeon?", "We are stewards rather than absolute owners", "Big mind is all
   inclusive".

The first three are analysis. The fourth is teaching. They sit together because a
person wrote them as one document, but they are produced by different processes.

## Pipeline coverage: an honest map

What the Sutta Studio pipeline can and cannot produce for these notes:

| Feature in the notes | Pipeline today | Why / why not |
|---|---|---|
| Pāli word-by-word morphology (Mettā Sutta, Refuges, Precepts) | ✅ produces | DPD has it; this is exactly what the Anatomist + Lexicographer passes are for. |
| Etymological roots back to √verbal roots | ⚠️ partial | DPD carries the data; the tooltip layer surfaces lemma + segment but tends not to foreground "from √śri 'to lean on'." Could be exposed more aggressively in the existing UI. |
| Devanāgarī script alongside IAST Pāli | ❌ doesn't render | Pāli is shown in IAST. Devanāgarī would need an extra transliteration step + font. Mechanical to add, never built. |
| Multiple translator renderings (Bodhi, Sujato, Thanissaro side by side) | ✅ produces | GROUNDING Phase 3 translator-bank does exactly this for SC suttas. |
| Vism / commentarial references for technical terms (kusala, upasampadā) | ✅ produces | Eudoxos Phase 4; kusala shows as a chip linking to the Vism glossary. |
| Cross-references to related concepts ([[appamāda]], [[Sati]], [[pamāda]]) | ❌ doesn't render | The pipeline emits citation chips but not Obsidian-style wikilinks. The data graph exists implicitly in the contested-terms registry; we just don't expose it as a navigable concept index. |
| Japanese-language sutras (Enmē Jikku Kannon Gyō) | ❌ nothing | Not Pāli, not in SuttaCentral. Sino-Japanese morphology is a different toolset we don't have. |
| Sino-Japanese kanji decomposition (観 = "perceive with penetrating awareness", 世 = "world") | ❌ nothing | The Cluster 6 lens (Chan/Zen Chinese): radical analysis, semantic-phonetic compound (xíngshēng) recognition. Different infrastructure. |
| Dharani transliteration scholarship (Sho Sai Shu, back-mapping Japanese-via-Chinese-via-Sanskrit) | ❌ nothing | Dharanis are phonetic transliterations of (often Hybrid) Sanskrit through Chinese into Japanese readings. Recovering the underlying Sanskrit is specialized academic work (Klaus Wille, Jonathan Silk territory). LLMs confabulate this confidently rather than admit ignorance. |
| Tiantai / Mahayana doctrinal context (Zhiyi as compiler of the Four Vows) | ❌ nothing | The pipeline doesn't carry tradition-history context. Could be a doctrinal-context registry alongside contested-terms, but no consumer yet. |
| Practice-application voice ("What would happen if...", "We are stewards rather than absolute owners") | ❌ nothing, and shouldn't try | Teacher's voice. LLMs producing this would be generic Buddhist-flavored prose, not the author's synthesis or their sangha's. The honest option is to recognize it as the human contribution. |
| Cross-tradition synthesis (Pāli refuges + Mahayana vows + Lakota dedication in one document) | ❌ nothing | Architecture C: bibliographic linking over a host document. A different beast. |
| Personal interpretive synthesis ("We are essentially connected to all living beings in the ten directions and three times") | ❌ nothing, and never should | Dharma teaching. It belongs to a lineage, not a pipeline. |

## Why the pipeline doesn't produce the whole note

1. **Scope mismatch.** Most of these texts are not Pāli canon. Enmē Jikku Kannon
   Gyō, the Four Vows, the Sho Sai Shu are East Asian Mahāyāna / Zen, none in
   SuttaCentral. The pipeline is built around SC + DPD, so it shines for
   Theravāda and goes silent for everything else.
   ([`FEDERATION_FEASIBILITY.md`](./FEDERATION_FEASIBILITY.md) maps what extending
   it would take.)
2. **Language-toolset mismatch.** We have one decomposition lens (Pāli morphology
   via DPD). The notes use four (Pāli, Sanskrit-with-Devanāgarī, Sino-Japanese,
   Chinese-mediated dharani). Each new lens is the multi-week work
   [`POLYGLOT.md`](./POLYGLOT.md) describes.
3. **Genre mismatch.** The pipeline produces structural analysis: neutral,
   citation-grounded, deterministic. The notes do that and add exegesis:
   interpretive, applied, voice-bearing. These are complementary, not
   substitutable. Asking the pipeline to produce exegesis is asking the wrong
   instrument.
4. **The teacher's voice is not a generator output.** Even a "Zen exegesis LLM"
   that mimicked some teacher's voice would not be *this* author's voice or
   sangha's. The honest framing: the pipeline produces the linguistic substrate;
   the teaching layer is the human contribution, and that is correct.

## The thesis

**Become the substrate generator for exegesis, not the exegesis generator.**

The pipeline produces what a practitioner would otherwise have to look up:
morphology, multiple translations, canonical citations, commentarial references.
It does not produce what they already know: that this verse is what we begin the
day with, that this precept is about stewardship, that big mind is the unfolding
Suzuki Roshi described. That is the part that makes a note a teaching document
rather than a study guide.

Give the practitioner everything they need to stop wasting time on lookups, so
they can focus on what they actually have to say. This is also a stronger product
position than "AI Buddhist commentary," which would be generic and slightly
dishonest.

## What this became: the liturgy reader

The practitioner's stated intent, in their own words:

> I want to be able to first create the artifact, a shareable webpage endpoint
> where people can browse these chants and understand what they are saying, it's
> liturgy. Then once we do the hand-curation we will make design choices on how
> to present it. Later we can think of scaling it, making it part of a pipeline.
> We have a pipeline that works; now the goal is multilingual perspectives and
> all these four layers and maybe even more.

That artifact-first direction became the shipped liturgy reader: `/liturgy` and
`/liturgy/<slug>` routes showing hand-curated chants with the layered breakdown
(phrase → script alternatives → word-by-word with roots → translation →
collapsible commentary), rendered in the existing dark theme. Curated content
lives under `data/liturgy/`; see [`COMMUNITY_CHANT_MODEL.md`](./COMMUNITY_CHANT_MODEL.md)
for the one-chant-many-sanghas model that followed.

The remaining "❌ nothing" rows above are the honest backlog for the multilingual
ambition: the Chan/Zen Chinese lens, Devanāgarī parallel script, a navigable
concept index, and the Architecture C chant-sheet importer that resolves
citations over a host document without pretending to write the notes.
