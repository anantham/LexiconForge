# Sutta Studio — Classical / Buddhist Chinese Design

> **Purpose**: Plan a parallel pipeline for Classical and Buddhist Chinese
> texts (CBETA T0251 Heart Sutra, Lotus Sutra, Vimalakīrti, etc.) without
> retrofitting Pali assumptions. This document is a **design intent + open
> questions** doc — it captures the philosophy and concrete features but
> explicitly flags what needs expert input or grounding in real data sources
> before implementation.
>
> **Read this in pair with**: `docs/sutta-studio/PALI_ENGLISH_DESIGN.md`,
> which is the baseline rationale for the existing Pali↔English pipeline.
>
> **Status**: Design intent only. No code in this milestone. The conversation
> that produced this doc started from a user observation: "we designed that
> interface for pali to english, we need to rethink it for chinese to english
> … in an intelligent way based on the specific differences in how Mahayana
> Buddhism manifested in Chinese, Japanese sphere of influence with koans
> and with a lot more of uncertainty, whereas Sanskrit and Pali, it is a lot
> more precision-based."
>
> Open questions are tagged `> ❓ OPEN QUESTION:`. Items needing expert input
> are tagged `> 🧑‍🏫 NEEDS EXPERT INPUT:`. Grep for these tags before
> committing to any implementation.

---

## 1. The framing shift

The Pali pipeline treats *whitespace-separated word with inflectional
morphology* as the atomic unit of meaning, and *etymology + grammatical
case* as the depth axis. Both choices are correct for Pali. **Both are wrong
for Chinese.** Forcing Chinese into a Pali-shaped frame produces a
misleading study tool — not a "simplified" one.

Different traditions have different atomic units and different depth axes:

| Tradition | Atomic unit | Depth axis | Engagement mode |
|---|---|---|---|
| Pali (Theravāda) | Whitespace word | Morphological / etymological / aural | Analytical, recitation, precise |
| Sanskrit | Word + sandhi | Morphological + philosophical | Analytical, debate-driven, precise |
| Classical Chinese (Buddhist) | Character + 4-char phrase | Visual / etymological / cross-tradition / allusive | Analytical, contemplative, performative |
| Tibetan | Syllable + verb-class | Morphological + commentarial | Analytical, debate-driven |

A coherent multi-tradition Sutta Studio honors each row's depth axis on its
own terms. That's the design philosophy this document is grounded in.

> 🧑‍🏫 NEEDS EXPERT INPUT: the row labels and depth-axis claims here are
> from a generalist read; a Buddhist studies / sinology specialist should
> validate that this typology isn't subtly wrong. In particular the
> "engagement mode" column conflates pedagogical and devotional modes.

---

## 2. What the Chinese pipeline produces

A Chinese-tradition `DeepLoomPacket` for a passage like 觀自在菩薩，行深般若波羅蜜多時，照見五蘊皆空，度一切苦厄 should let a learner:

- Hover any **character** to see its visual decomposition (radical + phonetic),
  basic gloss, and (for technical terms) the Sanskrit equivalent it represents
- Hover any **multi-character compound** to see whether it's a Sanskrit
  transliteration (音譯), a semantic translation (意譯), or a literal Chinese
  phrase
- See **four-character rhythmic cells** (四字格) marked as units, with
  parallelism/chiasmus highlighted (色不異空 ↔ 空不異色)
- Read multiple senses of an ambiguous character/term **simultaneously**
  (tension mode) rather than picking one
- See cross-tradition equivalents — the same passage in Sanskrit, Tibetan,
  English, Japanese-via-Chinese — when available
- Toggle into a **recitation mode** that strips analytical scaffolding and
  surfaces phonetic data (pinyin, optionally middle-Chinese reconstruction)

The artifact is *not* "Pali Sutta Studio for Chinese". The features above are
substantive new capabilities specific to how meaning is encoded in Buddhist
Chinese.

---

## 3. The atomic unit: character, compound, or 4-character cell?

Pali's atom is the whitespace word. Chinese needs a multi-tier model:

1. **Character (字)** — the smallest written unit, generally one syllable.
   Not always a complete word in Classical Chinese (where polysyllabic
   compounds are common in Buddhist texts) but always an indivisible
   graphical unit.
2. **Compound / lexeme (詞)** — 1+ characters that lexicalize as a single
   term. 般若 (prajñā), 涅槃 (nirvāṇa), 菩薩 (bodhisattva), 心經 (Heart
   Sutra) are all 2-char compounds that should NOT be analyzed
   character-by-character (since the meaning isn't compositional). Other
   sequences like 自在 (free, self-existing) are partly compositional.
3. **Four-character cell (四字格)** — Classical Chinese's prosodic and
   often syntactic unit. 行深般若 / 波羅蜜多 / 照見五蘊 / 皆空度一 / 切苦
   厄 — the rhythm pulls 4-char cells into prominence and the parallelism
   between cells carries syntactic information that a flat
   character-by-character read would miss.
4. **Clause / sentence** — punctuation in modern editions of Buddhist Chinese
   is editorial; the original texts are unpunctuated. So clause boundaries
   are inference-time decisions.

> ❓ OPEN QUESTION: which tier is the **primary** atomic unit for the
> pipeline? Pali's primary atom (whitespace word) is unambiguous. Chinese
> is multi-tier. My instinct: primary atom is **character**, with
> compound-detection and 4-char cell-detection as separate passes that
> annotate spans of characters. But this is an early-design call, not a
> validated one.

> ❓ OPEN QUESTION: how do we handle texts where punctuation has been
> editorially added (modern CBETA editions) vs raw uncut Classical Chinese?
> The phase-grouping logic depends on having boundaries; if the boundaries
> are editorial, do we trust them?

---

## 4. Character analysis (the depth dimension)

### 4.1 Visual decomposition

Most Chinese characters are **形聲** (phonosemantic compounds):
a **semantic radical** (義符) hints at meaning, a **phonetic component**
(聲符) hints at sound. 觀 = 雚 (heron — phonetic) + 見 (see — radical) =
"to behold". Showing this decomposition is the **direct equivalent** of
Pali's "√su = root meaning 'to hear' + -ta past participle suffix +
-ṁ nominative ending."

Other character types in 六書:

| Type | Meaning | Example |
|---|---|---|
| 象形 | Pictographic — direct depiction | 山 (mountain), 水 (water), 木 (tree), 日 (sun) |
| 指事 | Indicative — abstract signs | 上 (above), 下 (below), 一/二/三 (numbers) |
| 會意 | Compound-meaning — components combine semantically | 明 = 日 (sun) + 月 (moon) = "bright"; 林 = two 木 = "forest" |
| 形聲 | Phonosemantic — semantic radical + phonetic | 江 = 氵 (water) + 工 (gōng phonetic); 觀 = 見 + 雚 |
| 轉注 | Transferred — extended meaning between graphs | (debated; minor) |
| 假借 | Borrowed — phonetic loan | (mostly archaic) |

> 🧑‍🏫 NEEDS EXPERT INPUT: 六書 is the traditional classification. Modern
> Chinese philology (Qiu Xigui, Outlier Linguistics) refines this with
> distinctions like "primary semantic" vs "phonetic with later
> reinterpretation". Do we surface 六書 as the user-facing typology, or a
> more modern framework? Different schools disagree.

> ❓ OPEN QUESTION: for which characters do we expose the visual
> decomposition? Every character? Only ones the LLM considers significant?
> In Pali we decomposed every word — but in Chinese many characters are
> common particles (之, 也, 矣) where the etymology is interesting but not
> reading-relevant.

### 4.2 Stroke order and calligraphic shape

The user's specific framing: "being able to analyze the calligraphy of the
characters is how you engage with those." Calligraphic shape (運筆 brush
movement, 筆畫 strokes, 部首 radical placement) is part of the engagement
mode for Chinese in a way that Pali transliteration isn't.

Possible UI features:

- Stroke-order animation on hover (for those learning to write)
- Visual highlight of the radical inside the character
- Optional traditional/simplified toggle (CBETA Buddhist texts are usually
  in traditional, but some readers want simplified)
- Variant character (異體字) cross-reference — Buddhist texts have many
  variants between Tang-dynasty manuscripts and modern editions

> ❓ OPEN QUESTION: how much calligraphy/stroke-order is in scope for a
> *reading* tool vs a *writing-practice* tool? The user mentioned this
> specifically as a depth axis. Need to decide whether stroke-order is a
> first-class feature or "nice to have, link out to Pleco".

> 🧑‍🏫 NEEDS EXPERT INPUT: which character-decomposition database to
> ground this in. Candidates: Unihan (open, comprehensive but flat),
> CHISE (CJK character description language, structured, open), Outlier
> Linguistics (modern philological etymology, paid licence, very high
> quality), Wiktionary (mixed quality but open). Each has different
> coverage and different licence terms.

### 4.3 Phonetic data

Pali's depth includes the aural — chanting tradition is core. Chinese has
its own aural depth via:

- **Pinyin** (modern Mandarin reading)
- **Middle Chinese reconstruction** (the phonology of the Tang dynasty,
  when most Buddhist texts were translated; explains rhyme and parallelism)
- **Sanskrit-via-Chinese reverse engineering** — when reading 般若 we want
  to see "pronounced *bo-rě* in modern Mandarin, *pat-ɲia* in Middle
  Chinese, transcribing Sanskrit *prajñā*"

The third one is uniquely Buddhist-Chinese and requires both Chinese
phonology data and a Sanskrit-Chinese equivalence table.

> ❓ OPEN QUESTION: middle-Chinese reconstructions disagree across
> reconstruction systems (Karlgren, Pulleyblank, Baxter–Sagart). Which one
> do we surface, or do we surface multiple?

---

## 5. Compound and lexeme features

### 5.1 Sanskrit-loan vs semantic translation

The single most important Buddhist-Chinese-specific feature. Every Buddhist
technical term shows up in two registers:

| Sanskrit | 音譯 (transliteration) | 意譯 (semantic translation) |
|---|---|---|
| prajñā | 般若 | 智慧 |
| nirvāṇa | 涅槃 | 寂滅, 滅度 |
| bodhisattva | 菩薩 | 覺有情 |
| anuttarā-samyak-saṃbodhi | 阿耨多羅三藐三菩提 | 無上正等正覺 |
| dharmakāya | 達磨迦耶 (rare) | 法身 |
| śūnyatā | 舜若多 (rare) | 空, 空性 |

Different translators in different eras chose different registers.
Kumārajīva (4th c) tended to use 意譯; Xuanzang (7th c) re-instated 音譯
forms for technical precision.

A Chinese Sutta Studio MUST flag which register is in play and link the
cross-equivalent. This is utterly absent from the Pali pipeline because
Pali has no equivalent — there's no "Pali transliteration of an even older
language" register inside Pali sutras.

**Concrete UI feature**: hover 般若 → show:
- *prajñā* (Sanskrit source — this is a 音譯 transliteration)
- 智慧 (semantic equivalent in 意譯 register, used by other translators)
- "Wisdom" — but specifically the perfecting/discerning kind, see 般若波羅蜜多

> 🧑‍🏫 NEEDS EXPERT INPUT: which Sanskrit-Chinese term database to
> ground this in. Candidates: Digital Dictionary of Buddhism (DDB, well-
> regarded but partially paywalled), Soothill–Hodous *Dictionary of
> Chinese Buddhist Terms* (open, dated 1937), CBETA's term registry,
> 84000's glossary, the FoJin platform's own dictionary integration
> (mentioned in their README). Each has different licensing and coverage.

> ❓ OPEN QUESTION: when no Sanskrit equivalent is registered, do we
> mark a 2-character compound as "literal Chinese" by default, or do we
> ask the LLM to guess? The risk is hallucinating a Sanskrit source for
> a phrase that's purely Chinese.

### 5.2 Compound disambiguation

Some 2-character sequences are lexicalised compounds (must be read
together); others are coincidental adjacency (read separately). Examples:

- 般若 = compound (prajñā). Read together. Don't decompose.
- 心經 = compound ("Heart Sutra" — title). Read together.
- 五蘊 = compound (the five aggregates). Read together.
- 自在 in 觀自在 = compound (technical term: free / unobstructed).
- 自在 elsewhere = "by oneself + at" coincidental.

> ❓ OPEN QUESTION: how does the pipeline decide compound boundaries?
> Options: (a) ground in a Buddhist-Chinese lexicon (DDB has compounds
> tagged); (b) LLM-driven with the lexicon as reference; (c) hybrid —
> lexicon for known terms, LLM for unknown. Pali avoided this problem
> because whitespace did the work.

### 5.3 Buddhist-technical-term identification

Distinct from compound detection: which compounds are *Buddhist technical
terminology* vs ordinary literary Chinese? 法 in a Buddhist text means
*dharma* (with all its layered meanings); 法 in a Confucian text usually
means *law/method*. Without context, a generic LLM may not flag these.

The pipeline should mark Buddhist technical terms visually so a learner
knows "this word has layered Buddhist-philosophical meaning, not just its
plain Chinese sense."

---

## 6. Phrase-level features

### 6.1 Four-character cells (四字格)

Classical Chinese, especially Buddhist Chinese, structures meaning around
four-character prosodic units:

```
觀自在菩薩 / 行深般若 / 波羅蜜多時 / 照見五蘊皆空 / 度一切苦厄
```

(Note: the cells aren't always exactly 4 chars — 觀自在菩薩 is 5,
波羅蜜多時 is 5. Buddhist transliteration of long Sanskrit names breaks
the strict 4-char rule. A real implementation needs flexible cell-finding,
not hard 4-char chunking.)

The rhythm is structural and the parallelism between cells often carries
syntactic information. Pali phasing rules (group by sutta macrostructure —
Title Block, Opening Formula, Nidāna) don't apply. The Chinese phasing
rule should be: cluster consecutive cells that share parallel/chiastic
structure.

### 6.2 Parallelism and chiasmus

Heart Sutra's most famous passage:

```
色不異空，空不異色。色即是空，空即是色。
受想行識，亦復如是。
```

This is a chiastic A-B-B-A with an explicit "and so are sensation,
perception, mental formation, and consciousness" reduction. A reader who
doesn't see the chiastic structure is missing half the meaning.

UI feature: detect parallel/chiastic phrase pairs and visually link them
(shared underline color, like Pali refrains but for syntactic mirroring).

> ❓ OPEN QUESTION: parallelism detection is plausible LLM work, but
> chiasmus is more subtle. Do we mark each character with a "parallel-
> partner" link, or use a phrase-level grouping? The Pali model uses
> word-level relations; a Chinese chiasmus needs phrase-level relations.

### 6.3 Allusion and quotation tracking

Buddhist Chinese frequently quotes earlier Chinese classics
(Confucian/Daoist) and earlier Buddhist texts, with the meaning shifted by
context. 道 in a Buddhist sutra carries Daoist resonance even when used in
a Buddhist-technical sense; 仁 in a Buddhist context recontextualises
Confucian benevolence.

A study tool that doesn't surface this is flattening Chinese intellectual
history.

> 🧑‍🏫 NEEDS EXPERT INPUT: building an allusion-tracking layer is a
> serious philological project. The LLM can plausibly flag *some* known
> quotations but will miss subtle ones. Realistic scope: detect the most
> common 50-100 cross-tradition resonance markers (道, 仁, 自然, 無爲, etc.)
> and flag when they appear. Anything beyond this needs a real
> philologist-curated dataset.

### 6.4 Phase grouping rules

Pali rules don't apply. Provisional Chinese rules:

- Sutra title (e.g., 般若波羅蜜多心經) is its own phase.
- Opening (e.g., 如是我聞 "Thus I have heard") is its own phase if present.
  Mahayana texts often skip or expand this.
- 4-char cell groups: cluster cells that share parallel structure into
  one phase.
- Verse/prose distinction: many Mahayana sutras alternate prose narration
  with verse (gāthā / 偈頌). Verse blocks should be their own phases.
- Dhāraṇī passages (mantras / spells, often pure transliteration of
  Sanskrit) get their own phase with the recitation-mode marker.

> ❓ OPEN QUESTION: how do we detect verse vs prose without reliable
> editorial markup? CBETA tags some but not all. LLM can probably do this
> but needs to be told to look.

---

## 7. The polysemy / ambiguity philosophy

This is where the design choice diverges most from Pali, and where the
user's framing about "Mahayana with koans, more uncertainty" matters most.

### 7.1 Pali model: pick from a fixed set of senses

Pali's Lexicographer pass: **3 senses for content words, 1-2 for function
words.** The implicit pedagogy is that polysemy is bounded — there are 3
defensible readings of `Ekāyano` (Direct / Solitary / Convergent), and
clicking cycles through them. The user picks one as "the right one" for
their reading.

This works because Pali commentary tradition (Buddhaghosa et al) argues
*for* particular readings. The traditional answer is "Direct" — the
others are scholarly alternatives.

### 7.2 Chinese problem: ambiguity is sometimes intentional

Chan/Zen Buddhism (and the Mahayana texts that fed it) actively cultivates
不立文字 ("not establishing words/letters"), 教外別傳 ("transmission
outside the teachings"). The Heart Sutra's 色即是空 / 空即是色 isn't a
sentence with a determinate meaning — it's a dialectical erasure that
*resists* closure.

Forcing a learner to "pick one of three senses" for these texts is
working against the text. The right design surfaces multiple readings
without ranking them.

### 7.3 Proposed: tension mode

Two modes for the Lexicographer-equivalent pass:

| Mode | When to use | UI behavior |
|---|---|---|
| **Resolved** | Default for narrative passages, technical exposition, definitions | 1-3 senses, click to cycle, "primary" sense flagged |
| **Tension** | Koan-adjacent passages, dialectical verses, deliberately paradoxical text | Multiple senses shown **simultaneously** with no primary; rendering style indicates "this is intentionally non-resolvable" |

A passage like the Heart Sutra's central chiasmus would be tagged tension
mode. A passage like 觀自在菩薩 (a name + identifier) would be resolved
mode (it's just a name).

> ❓ OPEN QUESTION: who tags which mode? LLM-driven? Human-curated? Mixed?
> Risk of LLM defaulting to "tension mode" for everything to avoid
> committing.

> ❓ OPEN QUESTION: does tension mode actually help learners, or does it
> just look impressive while frustrating people who want to read? Some
> usability testing needed before this becomes a design commitment.

> 🧑‍🏫 NEEDS EXPERT INPUT: is "tension mode" a real pedagogical pattern
> with academic grounding, or am I post-hoc rationalising a UI feature?
> Buddhist studies pedagogy may have established conventions for handling
> deliberately-ambiguous texts that I'm unaware of.

### 7.4 Provisional koan markers

For texts with explicit koan / 公案 status (later Chan texts —
《無門關》《碧巖錄》— and verses inside earlier sutras that became
koan material):

- A visible "koan" badge on the passage
- Tension mode forced on
- Optional "do not show English" toggle (some traditions hold that even
  reading the translation defeats the purpose; the koan must be sat with
  unmediated)

This is a genuinely new feature with no Pali equivalent.

---

## 8. Modes of engagement

The Pali pipeline has two implicit modes: **read** (clean) and **study**
(arrows + tooltips). Chinese needs more.

| Mode | When | What it shows | What it hides |
|---|---|---|---|
| Read | Default casual read | Chinese + English in parallel, characters at normal size | Decomposition, ambiguity markers |
| Study | Default learner mode | Character decomposition, Sanskrit equivalents, parallelism, tooltips | (nothing — this is the firehose) |
| Tension | Koan-adjacent texts | Multiple readings visible simultaneously, no primary sense | The pretense that there's a single right answer |
| Recitation | Chanting tradition | Phonetic data (pinyin, optional Middle Chinese), verse structure, no English | All analytical scaffolding |
| Cross-tradition | Comparing translations | Same passage in Sanskrit / Chinese / Tibetan / English in parallel columns | Anything that doesn't help cross-comparison |

> ❓ OPEN QUESTION: 5 modes is a lot. Should some collapse? E.g., is
> "tension" just a flag inside study mode rather than its own mode?
> Recitation mode might be a separate page entirely.

> ❓ OPEN QUESTION: which mode is the *default* for a fresh visitor?
> Pali's default is study. For Chinese a casual reader probably wants
> read mode; a learner wants study; a practitioner wants recitation.
> This is a UX choice, not a linguistic one.

---

## 9. Cross-tradition / multi-script layer

Heart Sutra exists as:

- **Sanskrit**: Devanagari manuscripts, romanized critical editions
- **Tibetan**: Kangyur (Toh 21), in 84000.co's database
- **Chinese**: 5+ versions in CBETA (T0251 Xuanzang's short, T0253–T0257 long, T1711 commentary)
- **Korean**: transliterations + native translations
- **Japanese**: T0256 (Sanskrit transliterated *into Chinese characters* —
  uniquely Japanese-Buddhist phenomenon)
- **English**: 84000's academic translation, Conze's classic, hundreds of
  others

A Chinese-tradition learner often wants to compare two or more of these
side by side — especially Chinese ↔ Sanskrit (to see what the translator
chose) and Chinese ↔ English (to read).

This is a feature space the Pali pipeline doesn't engage with at all
(Pali Sutta Studio shows Pali + one English translation; alternate Pali
versions don't exist for Theravāda canonical texts the same way).

Provisional design:

- Studio URL accepts `?stitch=fojin:9,84000:toh21,sc:hridaya` style
  multi-source identifiers
- Each source rendered as a parallel column or a togglable layer
- Alignment is by passage / verse, not by character (that's M3+ research)

> ❓ OPEN QUESTION: identifier scheme for cross-tradition stitching. Each
> provider has its own ID (CBETA T-numbers, SuttaCentral uids, 84000 toh
> numbers, Sanskrit manuscript shelfmarks). Need a clean way to express
> "the Heart Sutra across all these" without forcing one provider's IDs
> as canonical.

---

## 10. The IR — what changes from the Pali envelope

Compared to the Pali doc's §4 inventory:

| Pali field | Chinese answer |
|---|---|
| `SourceProvider = 'suttacentral'` | Add `'fojin'`, `'cbeta'`, `'84000'`, `'cbeta-online'` (already partially done in M1) |
| `CanonicalSegment.pali: string` | Rename to `text` (language-neutral); add `lang` discriminator |
| `CanonicalSegment.baseEnglish?: string` | Generalise to `translations: Record<langCode, string>` |
| `PhaseView.paliWords: PaliWord[]` | Rename `Word`. For Chinese, "word" maps to either character, compound, or 4-char cell — driven by a `wordKind: 'character' \| 'compound' \| 'cell'` discriminator |
| `WordSegment.type: 'root' \| 'prefix' \| 'suffix' \| 'stem'` | For Chinese: `'radical' \| 'phonetic' \| 'component' \| 'whole'` (matching 形聲 etc.) |
| `MorphHint.case` | Drop entirely for Chinese. Add `register: '音譯' \| '意譯' \| 'literal'` instead |
| `RelationType: 'ownership' \| 'direction' \| 'location' \| 'action'` | Different signal: Chinese particles. Add types like `'topic-marker'` (者/也), `'locative-particle'` (於/在), `'genitive-particle'` (之), `'instrumental-particle'` (以), `'parallel-mirror'` (for chiasmus) |
| Word class `'content' \| 'function' \| 'vocative'` | Drop vocative (no morphological vocative in Chinese). Add `'transliteration'` (Sanskrit loan) and `'technical'` (Buddhist term) |
| Refrains | Keep concept; specific refrains are different (formulaic phrases like 如是我聞, 一時佛在...) |
| Ghosts (English-only structural words) | Same concept transfers cleanly |
| `linkedPaliId` | Rename `linkedSourceId` (this generalisation is needed for Pali too) |
| `EnglishToken` ghosts | Add `targetLang` for non-English targets |

> ❓ OPEN QUESTION: do we generalise the Pali envelope first (touching the
> existing Pali pipeline) or branch — keep the Pali pipeline intact and
> build a separate Chinese envelope that converges later? The branch path
> is safer in the short term but creates duplication.

---

## 11. Validator changes

`services/suttaStudioValidator.ts` will need new rules and have some old
rules generalised.

New rules for Chinese:

- 4-char cell coverage: every cell must be covered by exactly one phase
- Sanskrit-equivalent integrity: if a word is marked `register: '音譯'`,
  it must have a non-null `sanskritEquivalent` field
- Tension-mode constraint: tension-mode words must have ≥2 senses; no
  single sense flagged "primary"
- Compound boundary integrity: compound spans must align with character
  boundaries (no half-character spans)

Generalised rules:

- "linkedPaliId resolves" → "linkedSourceId resolves"
- "every canonical segment covered" → unchanged

---

## 12. What we already have vs what's new

This is the most useful row in this doc — pragmatic delta from the
existing Pali pipeline.

### Already in place (no work)

- Five-pass pipeline structure
- Polysemy rendering (cycle on click)
- Ghost token concept
- Anchor / refrain visual emphasis
- Tooltip pedagogy
- Phase chunking (≤8 unit cap, though "unit" needs redefinition)
- Layout blocks (max 5 per block)
- Validator framework
- IR envelope (DeepLoomPacket, PhaseView, etc.)
- M2 paragraph-level Chinese ↔ English via AI translation
  (already shipped — works for basic reading)

### New design needed (real work)

1. Character-decomposition data source + integration
2. Sanskrit-Chinese term equivalence database
3. Anatomist-equivalent prompt for Classical Chinese
4. Compound detection (rule-based + LLM hybrid)
5. 4-char cell detector
6. Parallelism / chiasmus detector
7. Tension-mode classifier and renderer
8. Recitation mode (separate UI surface)
9. Cross-tradition stitching identifiers
10. New register / register-cross-link UI
11. Buddhist-technical-term flagging
12. Allusion / cross-tradition resonance marker (low-priority, hard)

### Generalise the IR (medium work, touches existing code)

13. Rename `pali` → `text`, `paliWords` → `words`, etc.
14. `SourceProvider` union widening (partly done in M1)
15. `MorphHint` becomes optional / language-tagged
16. `RelationType` becomes a string literal type instead of fixed enum

### Out of scope / explicitly deferred

- Stroke order animation (link out to Pleco / similar)
- Middle Chinese phonological reconstruction (research project)
- Automated allusion detection beyond top ~100 markers
- Multi-script Devanagari / Tibetan rendering (M4+)

---

## 13. Open questions consolidated

Grep these from the body of this document. Listed here for ease of
reference / triage:

1. **Atomic unit primacy**: character vs compound vs 4-char cell as primary?
2. **Editorial punctuation trust**: how much do we rely on modern editorial markup?
3. **六書 vs modern philology** typology for character classification
4. **Decomposition coverage** — every character or only significant ones?
5. **Calligraphy depth** — first-class feature or external link?
6. **Middle Chinese reconstruction** — which system?
7. **Compound boundary detection** — lexicon, LLM, or hybrid?
8. **Hallucinated Sanskrit sources** for unknown compounds — how to gate?
9. **Phrase-level relations** vs word-level for chiasmus
10. **Verse/prose detection** without reliable editorial markup
11. **Tension-mode tagging** — who decides, LLM or human?
12. **Tension-mode usability** — does this help learners or confuse them?
13. **Number of UI modes** — collapse some?
14. **Default mode** for new visitors
15. **Cross-tradition identifier scheme**
16. **IR generalisation approach** — refactor in place or branch?

---

## 14. Items needing expert input

Grep `🧑‍🏫 NEEDS EXPERT INPUT` from the body. Listed here:

1. **Typology validation**: the framing of "atomic unit + depth axis" by
   tradition; needs Buddhist studies / sinology specialist validation.
2. **Character decomposition framework**: 六書 vs modern philology vs
   Outlier-style etymology — depends on user audience and licensing.
3. **Character-decomposition database**: Unihan, CHISE, Outlier, Wiktionary
   — pick one (or layer multiple) based on coverage + licence + quality.
4. **Sanskrit-Chinese term database**: DDB, Soothill, CBETA, 84000, FoJin
   — pick + integrate.
5. **Allusion / quotation tracker**: requires real philologist curation;
   LLM-only will miss subtle cases.
6. **Tension mode pedagogy**: is this a real pedagogical tradition or a
   plausible-sounding UI feature? Need confirmation from a Buddhist
   educator before building it.

---

## 15. Recommended grounding sources (catalogue)

Starting point for the data integration work; not a final pick.

### Character data
- **Unihan** (Unicode consortium) — open, comprehensive, flat. Good
  baseline for everything.
- **CHISE** (Character Information Service Environment) — open,
  structured CDP (Character Description Language). Better for
  decomposition than Unihan.
- **Outlier Linguistics** — paid licence, best modern philology. Probably
  too expensive for an MVP.
- **Wiktionary** — open, mixed quality. Useful as fallback / gap-filler.

### Buddhist Sanskrit-Chinese terms
- **Digital Dictionary of Buddhism (DDB)** — academic, partially paywalled
  (subscription for non-students). Authoritative.
- **Soothill–Hodous (1937)** — open, dated but useful baseline.
- **CBETA term registry** — open, integrated with the source corpus.
- **84000 glossary** — open (Apache 2), Tibetan-Sanskrit-English focused
  but has Chinese cross-refs.
- **FoJin's own dictionary integration** — README claims 32 dictionaries
  with 748K entries; actual API surface unknown.

### Sutra corpora
- **CBETA** (Chinese Buddhist Electronic Text Association) — the canonical
  Chinese Buddhist corpus. Open.
- **84000** — Tibetan canon translations (via Toh numbers). Open.
- **SuttaCentral** — Pali canon, already integrated. Open.
- **GRETIL** — Sanskrit texts (Indology archive). Open.

### Phonology
- **Karlgren** / **Pulleyblank** / **Baxter–Sagart** middle Chinese
  reconstructions — academic, available but in different formats.
  Pick one for v1.

> ❓ OPEN QUESTION: licensing-wise, can we ship Soothill / DDB excerpts in
> the app, or do we need to fetch on demand from external sources? This
> affects the offline reading story.

---

## 16. Immediate next actions (when ready to implement)

When this document is reviewed and the open questions have answers, the
implementation order I'd recommend:

1. **Generalise the IR** (rename `pali` → `text`, widen `SourceProvider`).
   Touch the existing Pali pipeline; verify Pali tests still pass.
2. **Pick character-decomposition source**, build a `CharacterDecomposer`
   service with a fallback chain (Unihan → CHISE → null).
3. **Build a Sanskrit-Chinese term lookup** service with one chosen
   database. Returns `{sanskritEquivalent, register, alternateChinese}`.
4. **Write the Chinese Anatomist prompt** as a parallel to the Pali one.
   Reference the character + term services as ground-truth, not raw LLM
   inference.
5. **Test on Heart Sutra T0251** (~260 chars, single juan, well-studied).
   Iterate prompt until output is acceptable.
6. **Add 4-char cell detector + parallelism marker** as a Skeleton-pass
   variant.
7. **Tension mode** as a flag on phases, with simple side-by-side rendering
   when active.
8. **Cross-tradition stitching** UI when ≥2 sources present.

Each step is a milestone with its own test. Pali stays untouched until
step 1's generalisation; even then, Pali tests gate the change.

This is multi-day to multi-week work; it should NOT be undertaken without
the open questions in §13–14 answered, otherwise we'll churn. Hence: this
is a design-only doc by request.
