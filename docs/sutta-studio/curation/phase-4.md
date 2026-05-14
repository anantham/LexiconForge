# Phase 4 — dukkhadomanassānaṁ atthaṅgamāya

> "For the disappearance of pain and dejection" — third dative-of-purpose in
> the satipaṭṭhāna formula chain. Curated 2026-05-14 in **pipeline+polish mode**
> as the first worked example of Path B (per-phase polish of the v11 batch
> outputs).

## Worked-example time budget

| Step | Time |
|---|---|
| Read v11 output, eyeball structure | 2 min |
| Decide what to keep, what to refine | 2 min |
| Write hand-curated JSON (add metadata, cross-phase notes, deeper etymology) | 8 min |
| Splice into demoPacket, validate | 2 min |
| Write this log | 4 min |
| **Total** | **~18 min** |

Slightly above the 15-min estimate. Likely converges toward 10-12 min as the rhythm settles — the curation log is the bulk of my "writing time" and the per-phase log gets shorter once the cross-phase patterns are familiar.

## What v11 produced (kept as-is)

- **Segmentation**: dukkha + domanass + āna + ṁ for p9; attha + ṅ + gam + āya for p10. The 4-segment parse of `atthaṅgam` is unusual (most grammars treat ṅ as sandhi-trace, not a morpheme) but pedagogically clearer. I kept it and added a caveat in the ṅ tooltip itself.
- **isAnchor on p10** (the verb-noun atthaṅgama, the action). Correct anchor pick.
- **morph fields** on both suffixes (gen-pl on -ānaṁ, dat-sg on -āya).
- **Relation arrow** p9s4 → p10, ownership, "Disappearance OF".
- **Plain-first tooltip register** throughout. No emoji, no bracketed grammar prefixes.
- **Etymological tooltips** — dukkha as "bad axle hole", attha as "sun setting". Both pedagogically vivid; both kept.
- **Three senses per word** with reasonable polysemy.

## What I added in polish

1. **Metadata on all 6 senses**: `epistemicBasis` (mostly `curatorial`), `confidence` (high/medium based on translator-tradition weight), `notes` citing Sujato / Bhikkhu Bodhi / Thanissaro per sense.
2. **Cross-phase note on -ānaṁ** suffix: explicit reference to phase-2's sattānaṁ and phase-3's sokaparidevānaṁ. The genitive-of-purpose pattern is the spine of this formula.
3. **Cross-phase note on -āya** suffix: explicit reference that this is the third dative-of-purpose in a 5-strong chain (phases 2/3/4/5/6).
4. **Gender field** on -āya morph (masculine).
5. **Caveat on the ṅ segment**: traditional grammar wouldn't parse this as a separate morpheme; v11's 4-segment parse is a pedagogical choice.
6. **Distinction note on dukkha vs. soka/parideva/domanassa**: makes the formula's emotional vocabulary cluster legible. domanassa is the inner displeasure that pairs with somanassa (happiness) elsewhere in the canon — that paradigmatic anchor matters.

## Concern flagged — translator citations

I claimed:
- Sujato uses "pain & distress" for dukkha-domanassa
- Bhikkhu Bodhi uses "suffering & grief"
- Thanissaro uses "extinguishing" for atthaṅgamāya in some contexts

These claims come from training-memory familiarity, not from a verified tradition database. I'm ~80-85% confident each is correct in published translations, but a rigorous curation would check actual texts. The **F task** (translator-tradition database) would solve this systematically — once that database exists, these citations are grounded; until then, the notes are claimed-from-memory.

## Concern flagged — bulk of polish work is metadata that could be deterministic

Of the ~8 minutes spent writing the hand-curated JSON, ~5 of them went to adding `epistemicBasis` + `confidence` + per-sense `notes`. The cross-phase notes (~2 min) and etymological depth (~1 min) are the genuine curatorial value-add — the metadata work is mostly rule-based.

This is exactly what the A3 metadata-filler post-pass (citation-linker + epistemicBasis-infer + morph-from-POS) was designed to close. If we built that module BEFORE continuing Path B, per-phase polish drops to maybe 5-7 minutes — just the cross-phase notes, missing senses, and translator citations. The metadata gets filled mechanically.

Sequencing tradeoff:
- **Continue Path B as-is**: 40 phases × ~15 min = ~10 hr. Each phase is a complete artifact.
- **Pause Path B → A3 metadata module → resume Path B**: 5-7 hr (A3) + 40 × ~6 min (~4 hr) = ~10 hr total. Same time budget BUT we end with reusable infrastructure for every future sutta. DN22 polish would also be ~6 min/phase instead of 15.

Raising for the curator to decide.

## What this phase teaches about the formula

Phase-4 is where the satipaṭṭhāna formula's emotional vocabulary cluster comes into focus:

| Phase | Vocabulary | Affective register |
|---|---|---|
| 3 | soka + parideva | grief + lamentation (the audible, social face of loss) |
| 4 | dukkha + domanassa | suffering + inner dejection (the felt, private face) |

These are not synonyms — they're complementary. Phase 3 addresses what others can witness (you grieving aloud); phase 4 addresses what only you know (the inner displeasure). The Buddha's vocabulary scaffolding is therapeutic: he names the visible affliction first, then the inner.

This is the kind of cross-phase observation v11 cannot make — it doesn't see prior phases in its prompt. The curator's value-add IS exactly this.
