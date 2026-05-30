# Community-Chant Model (Liturgy reader)

**Status:** Design accepted (2026-05-30). Foundation landed; content migration pending a curation checkpoint.
**Decision:** Option B — a content layer + a community-overlay layer, resolved into the existing `LiturgyDoc` render contract.

---

## The problem

The `/liturgy` reader stores **one `LiturgyDoc` file per (sangha, chant)**. The same
chant is forked per community, which duplicates content and proliferates files:

- `data/liturgy/heart-sutra.ts` (maple) and `data/liturgy/bodhi-heart-sutra.ts`
  (bodhi-sangha) are the **same Heart Sutra**. Same scripts (Sanskrit IAST/Devanāgarī,
  Chinese-Xuanzang T251, Japanese Sino-Japanese, Tibetan) and the **same four English
  witnesses** (Conze 1958, MAPLE sheet after Sheng-yen, Red Pine 2004, Thich Nhat Hanh
  2014). The Bodhi file's subtitle claims an Aitken / Diamond-Sangha rendering but
  carries **no distinct translation** — it is a near-pure fork.
- `enmei-jikku-kannon-gyo.ts` (maple: 3 witnesses) and
  `bodhi-enmei-jikku-kannon-gyo.ts` (bodhi: 1 witness "Bodhi Sangha"). Here the
  per-community content is **genuinely distinct** — different English *and* different
  word-by-word scholarship.

A third community — **Sariputta Ambedkar Monastery** (Rinzai-Zen sheets) — is incoming
and adds a genuinely different English Heart Sutra translation, a Song of Zazen
rendering, and a brand-new chant (*Teidai Dempo Busso No Myōgo*, the ancestral lineage).

**User goal:** at `/liturgy/<sangha>/<chant>`, cycle through *all* English translations
of that chant, defaulting to the visiting sangha's preferred one — *without* forking a
file per community ("add a translation, not an endpoint").

## Why the obvious approaches were rejected

**Original proposal — `sanghas: {slug, order, title, defaultWitnessBy}[]` overlay on
`LiturgyDoc`** (multi-membership + per-sangha default). Cross-reviewed by Codex
(gpt-5.5, xhigh). **Rejected**, because it models route membership but not the real
variant boundary:

1. The communities don't chant an *identical* text. Verified: MAPLE's Heart Sutra has
   39 `triple-script-witness` segments incl. MAPLE-only sections `heart-buddhas`,
   `heart-great-mantra`, `dharani-japanese-extended`; Bodhi's has 27 + 2 prose blocks
   and none of those. `LiturgyChantPage` renders **every** `doc.sections` entry
   unconditionally (`LiturgyChantPage.tsx:113`), so one superset doc would either leak
   MAPLE-only sections into Bodhi or silently drop content.
2. `defaultWitnessBy` as a display string is fragile: segments silently fall back to
   `witnesses[0]` when the named default is missing (`TripleScriptWitness.tsx:1019`,
   `LiturgyChantPage.tsx:65,72`) → *wrong text shown as if correct*.

**Naïve "merge into one doc, add all witnesses"** — Rejected. The two Enmei files share
only the section id `ten-phrases`; every segment uses a different id scheme
(`line-1-kan-ze-on` vs `kanzeon`) and **each community curated its own per-word glosses,
notes, and accents** for the same phrase. Blindly merging would force a re-curation of
sacred-text scholarship — exactly the silent-degradation class
(`DATA_FAILURE_MODES.md`) we must avoid.

## The model (Option B)

Three layers. The render contract (`LiturgyDoc`) is unchanged — it becomes a **resolved
view** produced by a resolver, not the authored artifact. This keeps the blast radius at
the authoring + registry layer; `LiturgyChantPage`, `LiturgyIndex`, `SanghaIndex`,
`LiturgyApp`, and the tests keep consuming `getLiturgyDoc` / `liturgyDocsForSangha` /
`LITURGY_DOCS_BY_SANGHA` / `LITURGY_INDEX` exactly as today.

```
ChantContent        the community-neutral identity of a chant: a contentId + the
                    canonical phrase identities. The unit truly shared across
                    communities is the *phrase* (its source-script text), keyed by a
                    stable phraseId.

CommunityChant      how ONE sangha chants ONE content: its sections/segments (authored
                    as today, each segment tagged with the canonical phraseId), its
                    witness(es), its own word scholarship, plus framing (title,
                    subtitle, order, time, sources.ritual, curator, frequency) and a
                    defaultWitnessBy.

resolveCommunityChant(cc, allCommunityChantsForContent) -> LiturgyDoc
                    1. Take cc's sections/segments verbatim (preserves topology + word
                       scholarship — no curation).
                    2. For each segment, POOL English witnesses from every community's
                       version of the same phraseId, deduped by `by`.
                    3. Order the pooled witnesses so cc.defaultWitnessBy leads (so the
                       existing witnesses[0] default Just Works; renderer unchanged).
```

### What is shared vs per-community

| Aspect | Shared (by phraseId) | Per-community (on CommunityChant) |
|---|---|---|
| Source-script text | identity only (witness-pool key) | each authors its own scripts[] |
| English witnesses | **pooled across communities** | which one is default |
| Word glosses / notes / accents | — | **kept as authored** (no re-curation) |
| Section topology / order | — | each selects its own |
| Title / subtitle / sources / curator | — | each its own |

The **only** thing that crosses community boundaries is the English *witness*, keyed by
`phraseId`. That is precisely the user's "cycle all translations" ask, and nothing else
needs to move — so no sacred-text scholarship is rewritten.

### Heart Sutra is the special case

Bodhi's Heart Sutra adds *no distinct witness*, so it is a true fork to retire: Bodhi
becomes a thin `CommunityChant` selecting its section subset from the shared Heart Sutra
content, contributing no duplicate witnesses. Sariputta later contributes its one
genuinely new English rendering, which then appears (cyclable) on every community's
Heart Sutra page.

## Migration sequence (each step ships green)

0. **Foundation (this pass, additive, nothing deleted):** add `phraseId?` to
   `TripleScriptWitnessSegment`; add `ChantContent` / `CommunityChant` types; write
   `data/liturgy/resolve.ts` (`resolveCommunityChant`); unit-test the witness-pool +
   default-ordering on synthetic data. Registry untouched; resolver unused until step 2.
1. **Regression guards first:** route-topology snapshot (every `(sangha, slug)` → exact
   section + segment IDs) and a default-witness coverage test (every rendered TSW
   segment must contain the route's `defaultWitnessBy`, else fail loudly).
2. **Enmei pilot:** tag both Enmei files' segments with shared `phraseId`s, convert to
   `CommunityChant`s, register via the resolver. Validate witness pooling end-to-end
   (Bodhi page shows Soto/Red Cedar/Literal + Bodhi; MAPLE page defaults to its own).
3. **Heart Sutra:** make `heart-sutra.ts` the shared content; Bodhi → thin section-subset
   `CommunityChant`; delete `bodhi-heart-sutra.ts` **and** the orphaned generator
   `scripts/build-bodhi-heart-sutra.py`.
4. **Sariputta Ambedkar Monastery:** register the sangha; add its Heart Sutra witness,
   Song of Zazen community chant, and the new Teidai Dempo content (needs OCR of the
   `chants/rinzai zen chants/` sheets).

## Open curation question (checkpoint before step 2)

Confirm the boundary: **only English witnesses pool across communities; each community's
word-by-word glosses/notes/accents stay exactly as that community authored them.** This
is the no-re-curation contract above. (Alternative — converging on a single canonical
word breakdown per phrase — is more work and a curatorial judgment on sacred text;
deferred unless explicitly wanted.)

## Evolution note

If a fourth/fifth community arrives with diverging *section structure* that the
per-community section authoring makes repetitive, revisit promoting `ChantContent` to
hold a shared, named section library that communities compose by reference. Not needed
at three communities.
