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

The shipped `bodhi-heart-sutra.ts` *appeared* to add no distinct witness — its segments
carried MAPLE's four witnesses, defaulting to `MAPLE chant sheet (after Sheng-yen)`. But
that was a **lost-translation bug**, not the intended state (see Implementation log).
Bodhi's own English exists; once restored it pools (cyclable) onto every community's
Heart Sutra page, with Sariputta's rendering to follow.

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
3. **Heart Sutra (done — witness layer):** convert both heart-sutra files to
   `CommunityChant`s, tag the 27 shared core/middle/result segments with `phraseId`,
   **restore Bodhi's own translation** (recovered from the generator's `BODHI_TEXTS`,
   verified against booklet photo IMG_2342 p.3) as the `Bodhi Sangha` witness leading
   the Bodhi route; pool via the resolver. Delete the orphaned/stale generator. The
   **source-data dedup** (extracting the identical scripts/words/Conze-Red Pine-TNH
   witnesses into one shared module so the two files stop duplicating ~2k lines) is the
   remaining, deferred hygiene step — higher risk, no user-visible change, guarded by
   the topology snapshot.
4. **Sariputta Ambedkar Monastery:** register the sangha; add its Heart Sutra witness,
   Song of Zazen community chant, and the new Teidai Dempo content (needs OCR of the
   `chants/rinzai zen chants/` sheets).

## Open curation question (resolved 2026-05-30)

Boundary confirmed by the curator: **only English witnesses pool across communities;
each community's word-by-word glosses/notes/accents stay exactly as authored.** No
single canonical word breakdown — no sacred-text re-curation. Corollary enforced in the
resolver: a *foreign* (pooled) witness has its `alignTo`/`morphemeAlignTo` **stripped**,
because alignment indexes the authoring segment's `words[]` and communities segment the
same phrase differently (MAPLE `Bup·pō` vs Bodhi `bup-pō`).

## Implementation log

- **2026-05-30 — Enmei pilot (done).** Both Enmei routes cycle all four translations,
  each leading with its own default. Browser-verified.
- **2026-05-30 — Sariputta Heart Sutra + shared-content module (done).** Built
  `heart-sutra-content.ts` — derives the canonical body segments (Sanskrit/
  Chinese/Japanese/Tibetan + word-morphemes + Conze/Red Pine/TNH) from the MAPLE
  authoring and strips community-only witnesses, so additional communities
  reference one source instead of re-copying ~2k lines. Added Sariputta Ambedkar
  Monastery's Heart Sutra (Rochester/Kapleau English, transcribed from its chant
  sheet) via `overlayWitness` — its rendering leads; the other five pool in. The
  Heart Sutra now cycles **6 translations across 3 sanghas**, each route leading
  with its own. Sariputta's witness has no `alignTo` yet (plain line — alignment
  is a deferred curation pass). NOTE: MAPLE + Bodhi still author their own copies
  of the body; retrofitting them onto `heart-sutra-content.ts` (full source dedup,
  guarded by a resolved-doc deep-equality test) remains the deferred hygiene step.
- **2026-05-30 — Heart Sutra lost-translation discovery.** The shipped
  `bodhi-heart-sutra.ts` showed **MAPLE's** translation: it was hand-authored "at MAPLE
  depth" (commit e8c8478) by copying MAPLE wholesale, which dropped Bodhi's own English.
  That English survived only in the orphaned + stale `scripts/build-bodhi-heart-sutra.py`
  (`BODHI_TEXTS`, 27 segments, booklet p.3). Verified `BODHI_TEXTS` verbatim against the
  takeout photo IMG_2342, restored it as the `Bodhi Sangha` witness, deleted the
  generator. Bodhi's page now leads with Bodhi's words; MAPLE's gains Bodhi as a 5th
  cyclable witness. Browser-verified both routes. **Lesson:** a "duplicate" can be a
  silent regression — always check whether the dup *replaced* distinct content.

## Evolution note

If a fourth/fifth community arrives with diverging *section structure* that the
per-community section authoring makes repetitive, revisit promoting `ChantContent` to
hold a shared, named section library that communities compose by reference. Not needed
at three communities.
