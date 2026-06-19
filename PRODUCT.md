# Product

## Register

product

## Users

**Primary user:** A Buddhist practitioner or serious dharma student — someone who already shows up at a chanting session, a sutta-study group, or a personal sitting practice. They are not browsing casually; they are in a structured encounter with a text. Typical contexts: preparing to lead a liturgy session, studying MN10 with a teacher, or exploring the Heart Sutra across traditions.

**Secondary user:** A scholar, translator, or dharma teacher who curates or vets data — someone who cares about epistemic accuracy and will notice when a gloss conflates sources or hides interpretive choices.

**What they're trying to get done:**
- *Liturgy reader:* follow along with a chant across multiple scripts; understand what each phrase actually says; hover a Pāli word and grasp its meaning without looking anything up.
- *Sutta Studio:* read a sutta interlinearly; see how Pāli morphology maps to English; rotate a word's possible meanings; see what English supplies ("ghosts") that Pāli omits; understand grammatical relationships without needing technical vocabulary.

**What they are NOT:** casual learners wanting a "Learn Buddhism in 5 minutes" app. The tool assumes real texts and rewards patient attention.

## Product Purpose

LexiconForge (working title; also "Project Indra's Net") is a **substrate generator for Buddhist textual study**, not an exegesis generator. It produces what a practitioner would otherwise have to look up — morphology, multiple translations, canonical citations, script alternatives — so they can focus on what only a human can supply: teaching, interpretation, practice.

Two live surfaces:
- **Liturgy reader** (`/liturgy/*`): hand-curated chants shown phrase-by-phrase with multi-script display (Pāli/Sanskrit/Devanāgarī/Chinese/Japanese/Tibetan), per-word pronunciation respelling, hover glosses, and multiple witness translations. Cite: `components/liturgy/`, `data/liturgy/`, `docs/sutta-studio/SUBSTRATE_NOT_EXEGESIS.md`.
- **Sutta Studio** (`/sutta/demo`): interlinear Pāli ↔ English with alignment arrows, per-word meaning rotation, grammatical-relation color cues, ghost-word opacity, refrain highlighting. Cite: `components/sutta-studio/`, `docs/sutta-studio/FEATURES.md`.

**Success looks like:** a practitioner closes a session having understood a phrase they had only ever chanted phonetically — with no jargon, no leaps of faith, no black-box translator they had to just trust.

## Brand Personality

**Three words:** Precise, Calm, Trustworthy

**Voice:** The voice of a careful dharma elder who cites their sources. Not "Sanskrit for normies." Not academic footnote-heavy either. Plain English, grounded claims, visible uncertainty. Each tooltip earns its words.

**Emotional goal:** The user should feel they are *meeting the text directly* — not receiving a translation, not being educated at, but given the handles to climb the wall of a foreign language and peek over the top themselves. Intellectual confidence without intellectual superiority.

**What this is NOT:** A product that promises authority it doesn't have. The data model explicitly marks contested claims, uncertain dates, and interpretive choices. The UI must embody that epistemic care, not paper over it.

## References

- **The project's own shipped liturgy reader is the canonical reference** (`read.adityaarpitha.com/liturgy`, `components/liturgy/shapes/TripleScriptWitness.tsx`). New surfaces extend this aesthetic; they do not redesign it. What to preserve: a centered column of classical serif (Cardo / Noto Serif) with words sitting in open space; a faint italic pronunciation line beneath non-Latin scripts; semantic-only color that tracks one concept across scripts; meaning revealed on hover rather than shown in persistent chrome. The bar for any new surface: it should feel native to this reader, not introduce a second visual language.

## Anti-references

- **Generic "Buddhist content" apps** that flatten everything into calming sans-serif + lotus imagery + earth tones. The beige-and-mindfulness aesthetic is not this.
- **Academic digital humanities portals** (some TEI viewers, early CBETA interfaces): structurally rigorous, visually punishing. Function over experience is not the model either.
- **Grammar-tutor UIs** that lead with technical vocabulary ("genitive", "oblique", "nominative"). CURATION_PROTOCOL §3.4 explicitly bans this register in reader-facing glosses. Anti-pattern: "The genitive form 'me' functions adverbially."
- **AI Buddhist commentary generators**: generic, slightly dishonest. LexiconForge explicitly does NOT produce the teacher's exegetical voice. Cite: `SUBSTRATE_NOT_EXEGESIS.md §"Practice-application voice"`.

## Design Principles

1. **Substrate, not exegesis.** Show the practitioner what to look up, not what to think. Every feature should reduce lookup friction or make the text's own structure visible — not interpret the text for the user.

2. **Epistemic honesty as visual language.** Ghost words dim at opacity. Contested claims earn a badge. Multiple witnesses sit alongside each other rather than one translation being presented as "the meaning." The visual grammar should make uncertainty legible, not paper over it.

3. **Words in blank space, not in boxes.** The reading surface has no cards, no decorative containers. Text lives in generous vertical space. Every border, every box, every badge must earn its presence against the default of nothing.

4. **Semantic color, never decorative color.** Emerald = interactive/hover. Amber/sky/rose = Three Jewels refrain accents. Amber/blue/emerald/orange = grammatical-relation palette. Color signals meaning; it is never applied for aesthetic warmth. Adding an untethered accent violates the system.

5. **Plain-register tooltip discipline.** Every reader-facing gloss passes the rent test: if plain English carries the meaning equally well, the technical term fails. This is not just a style preference — it is a hard content rule enforced by a data-quality test (see `CURATION_PROTOCOL §3.4` and `scripts/check-loc.js` type checking). Agents and future contributors must treat this as a gate, not a guideline.

## Accessibility & Inclusion

- **Text legibility first:** serif body type in generous sizing; multi-script fonts loaded per BCP-47 subtag with per-script size multipliers to equalize visual weight across Latin, Devanāgarī, CJK, Tibetan.
- **Reduced motion:** framer-motion is in use throughout; every animation needs a `prefers-reduced-motion` alternative (crossfade or instant).
- **Target WCAG AA** as the floor. Body text (slate-100 on slate-950) is high contrast. Muted text (slate-400/500) on slate-950 should be verified — `text-slate-400` on `bg-slate-950` is approximately 7:1 (passes AA large and AA normal); `text-slate-500` is approximately 4.7:1 (borderline for body — verify with actual values before relying on it).
- **Multi-script / i18n:** the reading surface must render Pāli IAST diacritics, Devanāgarī, Tibetan, CJK, and Japanese without fallback garbage. Noto Serif family + Cardo cover this — do not introduce fonts that break these scripts.
- **No keyboard trap:** hover-only affordances (tooltips, alignment arrows) should have accessible alternatives or at minimum not be the only path to the glossed content.
