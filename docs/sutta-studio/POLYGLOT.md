# Sutta Studio Polyglot — Multi-Language Lens Charter

> **Status:** charter — implementation not yet started, requires multi-month commitment + scholar collaboration to do honestly.
> **Companions:** `FEATURES.md` (current bilingual implementation), `TEXT_GRAPH.md` (architectural spec for transmission/witness/claim — uses ConceptNode defined here).

This document is **not a build plan**. It is a design north star for what Sutta Studio could become beyond bilingual Pāli ↔ English. Treat it as a charter to test future schema changes against, not as a backlog to execute against.

## Manifesto

> Each language teaches its own hidden machinery.

Pāli compresses grammar into endings.
Sanskrit compresses relations into sandhi and compounds.
Chinese compresses Buddhist translation history into terse characters and technical terms.
Tibetan compresses Sanskrit scholastic structure into syllable-by-syllable translationese.
English compresses interpretation into fluency.

A polyglot study reader should reveal what each language compresses. A "Chinese decomposition" UI that imitates the structure of a "Pāli decomposition" UI loses the point of Chinese. **Don't design one universal word splitter. Design a shared alignment engine plus language-specific decomposition lenses.**

---

## 1. The four questions per language

Every language lens should answer four orthogonal questions:

| Question | Pāli | Sanskrit | Chinese | Tibetan |
|---|---|---|---|---|
| **What is the visible unit?** | word (whitespace) | word + sandhi cluster | character / phrase / Buddhist term | syllable (tsek-separated) |
| **What is the spoken unit?** | syllable, accent | akṣara, phoneme, sandhi | reading (Mandarin / Middle Chinese / on'yomi / etc.) | Wylie + phonetic (different conventions) |
| **What is the grammatical unit?** | case ending, verb form, particle | case + sandhi + compound member | particle, classical syntax (topic-comment), supplied copulas | particle, syntactic mirroring of Sanskrit, evidentials |
| **What is the doctrinal/conceptual unit?** | term recognition (e.g. *satipaṭṭhāna*) | term recognition (e.g. *prajñāpāramitā*) | technical term (semantic, transliteration, hybrid) | term recognition + Sanskrit equivalence |

The current Pāli lens handles questions 1, 3, and 4 reasonably and ignores question 2 (sound). Each new language gets its own version of all four.

---

## 2. Per-language sketches

### 2.1 Pāli (current bilingual MVP — `FEATURES.md`)

The baseline. Word + segment morphology + grammar relations + ghost tokens + sense polysemy. Documented in `FEATURES.md`.

### 2.2 Sanskrit lens

Sanskrit's hidden machinery is **sandhi and compounds**. The visible word is often not the lexical unit. The interesting layers:

```
grapheme → transliteration → akṣara → phoneme → sandhi → word → compound → concept
```

Example: `Prajñāpāramitāhṛdayasūtra`

```
Surface:           Prajñāpāramitāhṛdayasūtra
Compound split:    prajñā-pāramitā-hṛdaya-sūtra
Compound type:     tappurisa (genitive — "discourse of the heart of the perfection of wisdom")
Member glosses:    wisdom / perfection / heart-essence / discourse
Morphology:        nominative singular neuter
Sound:             pra-jñā-pā-ra-mi-tā-hṛ-da-ya-sū-tra
Phoneme detail:    p-r-a / j-ñ-ā / ... (where sandhi joined what)
```

Schema additions needed:

```ts
type SanskritAnalysis = {
  transliterationScheme?: 'IAST' | 'SLP1' | 'Devanāgarī' | 'HarvardKyoto';
  phonemes?: Phoneme[];
  syllables?: Syllable[];
  sandhi?: SandhiAnalysis[];        // joins between adjacent words
  morphology?: MorphAnalysis[];
  compound?: CompoundAnalysis;
};

type SanskritSegment = {
  surface: string;
  lemma?: string;
  pos?: 'noun' | 'verb' | 'particle' | 'compound_member';
  case?: 'nom' | 'acc' | 'ins' | 'dat' | 'abl' | 'gen' | 'loc' | 'voc';
  number?: 'sg' | 'du' | 'pl';
  gender?: 'm' | 'f' | 'n';
  compoundRole?: 'head' | 'modifier' | 'coordinand' | 'uncertain';
};
```

**Existing tooling to lean on:**
- Sanskrit Heritage Engine (INRIA): segmentation, sandhi, morphological analysis
- `sanskrit_parser` (Python): valid-segmentation generation with INRIA dictionary backend
- DCS (Digital Corpus of Sanskrit): annotated reference corpus

**Sandhi splitting is an unsolved problem in general.** Heuristic + dictionary lookup gets ~90%; manual review for the remaining 10%. For the Heart Sutra (~270 words) full manual review is feasible.

### 2.3 Chinese lens

Chinese's hidden machinery is **translation history compressed into terse characters**. The visible character is often the lexical unit, but for Buddhist texts many "words" are actually transliterations of Sanskrit terms. Conflating these flattens what makes Buddhist Chinese what it is.

#### The xíngshēng correction

> **Most Chinese characters are not pictograms.** The dominant traditional type is *xíngshēng* — semantic-phonetic compounds where one component gives a meaning clue and another gives a pronunciation clue. Unicode notes that "ideograph" is only historically appropriate for some ancient forms.

A "Chinese decomposition" UI that says "空 literally means cave plus work, therefore emptiness means..." is fake profundity. The honest UI says: "Character structure: component analysis / dictionary radical / phonetic hint. Buddhist usage: 空 translates *śūnyatā* / emptiness in this passage."

Take Xuanzang's Heart Sutra opening:

```
觀自在菩薩，行深般若波羅蜜多時，照見五蘊皆空
```

Decomposition stack:

```
Passage:           觀自在菩薩，行深般若波羅蜜多時，照見五蘊皆空
Phrase / clause:   觀自在菩薩 | 行深般若波羅蜜多時 | 照見五蘊皆空
Buddhist terms:    觀自在菩薩 | 般若波羅蜜多 | 五蘊 | 空
Characters:        觀 | 自 | 在 | 菩 | 薩 | 行 | 深 | ...
Component analysis: 觀 = 雚 (phonetic) + 見 (semantic — "to see")
Readings:          Mandarin: guān, zì, zài, pú, sà, ...
                   (Middle Chinese reconstruction available for nerds)
```

Buddhist Chinese term kinds (key distinction):

```ts
type ChineseTermKind =
  | 'semantic_translation'      // 五蘊 for *skandha* — Chinese morpheme equivalent
  | 'transliteration'           // 般若 (bōrě) for *prajñā* — phonetic loan, not meaning
  | 'hybrid'                    // 般若波羅蜜多心經 — transliterations + 心經 (semantic "heart sutra")
  | 'native_chinese_function'   // 之 (possessive particle), 也 (sentence-final), etc.
  | 'punctuation_supplied';     // ，。— modern punctuation added to classical text
```

Schema additions:

```ts
type ChineseAnalysis = {
  termKind?: ChineseTermKind;
  segmentation?: 'classical' | 'modern' | 'buddhist_term';  // segmentation choice is interpretive
  readings?: {
    mandarin?: string;
    middleChinese?: string;       // reconstructed
    kanonOnyomi?: string;         // Japanese on'yomi (for Sino-Japanese context)
    sinoKorean?: string;
    sinoVietnamese?: string;
  };
  components?: ComponentAnalysis;  // semantic + phonetic breakdown via Unihan/IDS
  conceptId?: string;              // → ConceptNode (for cross-language alignment)
};
```

**Existing tooling:**
- Unicode Unihan database (radical, components, readings)
- IDS (Ideographic Description Sequences) — CHISE-IDS, CJKVI-IDS — describe spatial composition of characters
- CBETA — Chinese Buddhist canon corpus

**Critical:** Chinese segmentation in classical/literary texts is *interpretive*. Different scholars segment 般若波羅蜜多 as one Buddhist term or four characters. The UI must mark the segmentation choice as a claim, not a fact.

### 2.4 Tibetan lens

Tibetan's hidden machinery is **syllable structure and Sanskrit-mirroring scholastic translation**. The visible unit is the syllable (tsek-separated), not a whitespace word.

Tibetan script is an abugida; consonants stack vertically (root, prefix, superscript, subscript, suffix, second-suffix). Each syllable terminates with `་` (tsek).

Example: `ཤེས་རབ་ཀྱི་ཕ་རོལ་ཏུ་ཕྱིན་པ` (*shes rab kyi pha rol tu phyin pa* — "perfection of wisdom")

Decomposition stack:

```
Tibetan surface:    ཤེས་རབ་ཀྱི་ཕ་རོལ་ཏུ་ཕྱིན་པ
Syllables:          ཤེས་ | རབ་ | ཀྱི་ | ཕ་ | རོལ་ | ཏུ་ | ཕྱིན་ | པ
Wylie:              shes rab kyi pha rol tu phyin pa
Phonetic:           she rap kyi pa rö tu chin pa     (Lhasa pronunciation)
Term / morpheme:    shes rab = prajñā
                    pha rol tu phyin pa = pāramitā
Grammar particles:  kyi = genitive linker
                    tu = directional/allative particle
Sanskrit equiv:     śūnyatā... (because Tibetan Buddhist translation is highly literal)
```

Schema additions:

```ts
type TibetanAnalysis = {
  wylie?: string;                  // Wylie transliteration
  phonetic?: string;               // pronunciation guide (which dialect?)
  syllableStructure?: SyllableStructure;  // root + prefix + super + sub + suffix + 2suffix
  particleRole?: 'genitive' | 'allative' | 'ablative' | 'agentive' | 'evidential' | 'connective' | 'other';
  sanskritEquivalent?: string;     // for terms translated from Sanskrit
  conceptId?: string;
};
```

**Existing tooling:**
- BDRC / BUDA (Tibetan canon, biographies, scholarly literature)
- Asian Classics Input Project (ACIP)
- Tibetan-Himalayan Library

### 2.5 English lens

English is the *interpretation layer*, not a source. It should not have its own decomposition; it should be attached to a specific Translation (Witness in TextGraph terms — see `TEXT_GRAPH.md`).

```ts
type EnglishTranslationLayer = {
  id: string;
  expressionId: string;            // which Expression this translates
  translator: string;              // "Bhikkhu Sujato" / "Edward Conze" / "Red Pine"
  year?: string;
  license?: string;
  methodology?: string;            // brief note: literal / interpretive / poetic / scholarly
  alignmentTo: string;             // segment-level alignment to base Witness
};
```

Critically: **multiple English translations can attach to the same Expression.** The Heart Sutra has Conze (1958), Red Pine (2004), and many others — each is a Translation Witness, not "the English."

The UI should let users compare:

```
Pāli/Sanskrit source
------------------------------------------------
Sujato | Bodhi | Conze | Red Pine | literal study gloss
```

This makes visible that English is *not the meaning*; English is a set of interpretive decisions.

---

## 3. The shared abstraction (TextLayer / TextUnit / Alignment)

```ts
type TextLayer = {
  id: string;
  language: 'sa' | 'pi' | 'bo' | 'zh' | 'en' | 'ja' | 'ko' | 'vi' | 'mn' | string;
  script: string;
  sourceRef?: string;              // → SourceRef.id
  units: TextUnit[];
  analyses?: LanguageAnalysis[];
};

type TextUnit = {
  id: string;
  text: string;
  level:
    | 'passage'
    | 'clause'
    | 'phrase'
    | 'term'
    | 'word'
    | 'character'
    | 'component'
    | 'syllable'
    | 'phoneme'
    | 'morpheme';
  span?: [number, number];          // character offsets within parent
  parentId?: string;
  childrenIds?: string[];
  conceptId?: string;               // → ConceptNode (cross-language anchor)
  analysis?: Record<string, unknown>;  // language-specific shape
};

type LanguageAnalysis =
  | { kind: 'sanskrit'; data: SanskritAnalysis }
  | { kind: 'chinese'; data: ChineseAnalysis }
  | { kind: 'tibetan'; data: TibetanAnalysis }
  | { kind: 'pali'; data: PaliAnalysis };
```

Each language plugs in via the discriminated union. Adding a new language is adding a new variant — no other code changes.

`Alignment` (from `TEXT_GRAPH.md` §5) connects units across TextLayers with multi-resolution levels (`concept` / `term` / `phrase` / `word` / `morpheme` / `sound`).

---

## 4. The Heart Sutra MVP

Heart Sutra is the right pilot:
- Short (~270 Sanskrit words)
- Stable enough for a prototype
- Rich enough to force every layer (Sanskrit compounds, Chinese technical Buddhist vocabulary, Tibetan translationese, mantra/transliteration, modern English interpretation)
- Has multiple traditions with mature scholarship (Conze 1958 critical edition, Donald Lopez's *Elaborations on Emptiness*, Red Pine, etc.)

### MVP passage

Start with one famous passage, not the whole sutra:

```
色不異空，空不異色；
色即是空，空即是色。
```

Align to Sanskrit / Tibetan / English.

### MVP concepts

Only 8-12 concepts:
- form (rūpa / 色 / gzugs / form)
- emptiness (śūnyatā / 空 / stong pa nyid / emptiness)
- not-different (na pṛthak / 不異 / mi 'gyur / not different)
- is / identity (eva / 即是 / yin / is)
- aggregate (skandha / 蘊 / phung po / aggregate)
- bodhisattva (bodhisattva / 菩薩 / byang chub sems dpa' / awakening-being)
- prajñāpāramitā (prajñāpāramitā / 般若波羅蜜多 / shes rab kyi pha rol tu phyin pa / perfection of wisdom)
- suffering (duḥkha / 苦 / sdug bsngal / suffering)
- attainment (prāpti / 得 / thob pa / attainment)
- mantra (gate gate pāragate ... / 揭諦揭諦... / gate gate ... / gone gone ...)

### MVP language lenses

Build only three carefully:
- **Sanskrit lens**: sandhi + compound + morphology + sound
- **Chinese lens**: term segmentation + character/component + Buddhist usage
- **Tibetan lens**: syllable stack + Wylie + grammar particles + Sanskrit equivalence

English remains a translation/interpretation lens (multiple translations attach to each Expression).

### Honest scope estimate

**For one Heart Sutra passage with these three lenses, done well:**

- Schema additions (ChineseTermKind, TibetanAnalysis, SanskritAnalysis, etc.): 1-2 days
- Build the polyglot UI (4-panel responsive layout, lens switcher, concept highlighting): 1-2 weeks
- Curate the Sanskrit panel (sandhi splits, compound types, morphology): 1 week + scholar review
- Curate the Chinese panel (term segmentation justified, character analysis, term kinds): 1 week + scholar review
- Curate the Tibetan panel (syllable analysis, Wylie + phonetic, particle roles, Sanskrit equivalents): 1-2 weeks + scholar review
- Concept registry (10 concepts × 4 languages × cross-referenced): 3-5 days
- QA, polish, documentation: 1 week

**Total: 6-10 working weeks for one passage of the Heart Sutra with three lenses, assuming periodic scholar review.**

The full Heart Sutra (or multiple passages) multiplies this. Doing a full polyglot Sutta Studio across the canon is **multi-year** work that almost certainly requires institutional collaboration (e.g., 84000.co, SuttaCentral, BDRC, CBETA partnerships).

---

## 5. UI: comparison modes

You don't want one comparison view. You want several.

### Edition comparison mode

Comparing two versions of the *same text* (e.g., variant readings between manuscripts).

```
┌─────────────────────┬──────────────────────┐
│ Pāli VRI (6th Council) │ Pāli PTS (Romanized) │
├─────────────────────┼──────────────────────┤
│ ...evameva kho...   │ ...evameva kho...   │
│ [variants underlined]│ [variants underlined]│
└─────────────────────┴──────────────────────┘
```

Like git diff for scripture.

### Language comparison mode

Comparing across traditions (Sanskrit / Chinese / Tibetan / English).

```
┌──────────┬──────────┬──────────┬──────────┐
│ Sanskrit │ Chinese  │ Tibetan  │ English  │
├──────────┼──────────┼──────────┼──────────┤
│ rūpaṃ    │ 色即是空  │ gzugs   │ form is  │
│ śūnyatā  │ 空即是色  │ stong... │ emptiness│
│ ...      │ ...      │ ...      │ ...      │
└──────────┴──────────┴──────────┴──────────┘
```

Each panel uses its own lens (Sanskrit panel shows sandhi tooltips, Chinese panel shows term kind badges, etc.).

### Translation comparison mode

Source fixed, multiple English translations side by side.

```
┌─────────────────────────────────────────┐
│ Sanskrit: rūpaṃ śūnyatā śūnyataiva rūpam│
├─────────────────────────────────────────┤
│ Sujato     │ Bodhi     │ Conze   │ Red Pine│
│ form is... │ form is...│ form... │ form... │
└─────────────────────────────────────────┘
```

Shows the reader: English is not "the meaning" — it's a set of interpretive choices.

### Context comparison mode

Same text, multiple analytical lenses (the §6 ContextGraph).

```
┌─────────────────────────────────────────┐
│ Text segment                             │
├─────────────────────────────────────────┤
│ Doctrinal │ Social │ Economic │ Transmission │
│ "knowing" │ addressed to renunciants │ supported by dāna │ formula for memorization │
└─────────────────────────────────────────┘
```

---

## 6. ContextGraph (the historical-context lens)

This is the second most ambitious piece in this charter. It's also the one most likely to do harm if done sloppily.

### The principle

> Do not make socio-economic context a "cause" that explains Buddhism away. Make it a lens.

The UI should not say:
> Buddhism arose because merchants needed X.

It should say:
> This teaching circulated in a world of urbanization, state formation, trade, renunciant movements, patronage, caste/class hierarchy, and oral specialist institutions. These conditions shaped what kinds of liberation practices could be taught, remembered, funded, and transmitted.

That distinction is everything. Sloppy context is worse than no context.

### Schema sketch

```ts
type ContextGraph = {
  contextClaims: ContextClaim[];
  institutions: Institution[];     // Mahāvihāra, Sangha, monastery types
  actors: HistoricalActor[];       // bhāṇaka tradition, Sayadaws, modern translators
  places: Place[];                 // Kammāsadhamma, Aluvihare, Yangon
  economicForms: EconomicForm[];   // dāna, monastic land tenure, modern publishing
  socialForms: SocialForm[];       // caste, class, gender, renunciant status
};

type ContextClaim = {
  id: string;
  scope:
    | { kind: 'work'; workId: string }
    | { kind: 'passage'; passageId: string }
    | { kind: 'tradition'; traditionId: string }
    | { kind: 'period'; periodId: string };
  theme:
    | 'political_context'
    | 'economic_context'
    | 'patronage'
    | 'urbanization'
    | 'oral_transmission'
    | 'monastic_labor'
    | 'gender'
    | 'caste_class'
    | 'trade_routes'
    | 'ritual_competition'
    | 'state_support'
    | 'translation_institution';
  claim: string;
  confidence: 'high' | 'medium' | 'low' | 'traditional' | 'contested';
  sources: SourceRef[];            // → TextGraph.sources
};
```

This lets us distinguish:

| Claim | Confidence |
|---|---|
| "Buddha taught MN10 at Kammāsadhamma" | traditional |
| "Buddhist monastics depended on dāna throughout the early period" | high |
| "This exact sutta was shaped by merchant patronage" | low / contested |

### The cost of doing this well

Curating ContextClaims for even one work requires reading academic literature: Schopen, Strong, Gombrich, Bronkhorst, Walters, Trainor, Mrozik, et al. Each claim needs a citation. Without proper sourcing, the schema becomes a vector for confident-sounding but unsourced narratives — exactly the failure mode the schema is meant to prevent.

**This is not a feature you can ship without doing the reading.** Or without scholarly review.

### Recommended scope

Start with **one work** (e.g., MN10 Satipaṭṭhāna Sutta). Budget 2-4 weeks of reading + 1 week of curation for a meaningful ContextClaims set. Compare against a published academic survey (e.g., a chapter in *The Cambridge Handbook of Buddhist Ethics*) for sanity check.

Until that work is done, the ContextGraph should not exist in the UI. Better to have no context lens than a sketchy one.

---

## 7. The cycle the user should be able to perform

For each aligned segment:

| Lens | Shows |
|---|---|
| **Text** | Raw language panels |
| **Grammar** | Per-language structural analysis (Sanskrit sandhi, Chinese term kind, Tibetan particles) |
| **Translation** | Translator decisions: ghosts, supplied words, interpretive choices |
| **Concepts** | Highlights cross-language concept anchors |
| **Context** | Doctrinal / social / economic / transmission lenses |
| **Transmission** | Witnesses, editions, manuscript chain (from TextGraph) |
| **Variants** | Edition differences, contested readings |

Same data. Different lens.

---

## 8. The deeper design sentence

A normal reader gives you scripture as a finished object.

This app should show scripture as a **living transmission object**:
> uttered / remembered / recited / supported / edited / translated / copied / printed / digitized / aligned / annotated / read

And then it should let the user ask:
> What did this word mean?
> What did this grammar do?
> What did this translator choose?
> What institution preserved this?
> What economy supported the people who remembered it?
> What variants survived?
> What disappeared?

That is the bridge. **Not just Pāli to English — text to world, world to liberation, liberation back into text.**

---

## 9. Honest constraints (read this before starting)

1. **This is multi-month work, not session work.** A single passage of the Heart Sutra with three language lenses, done well, is 6-10 weeks. The full vision is multi-year.

2. **It requires scholar collaboration.** Sanskrit pandit, Buddhist Chinese specialist, Tibetan translator, religious studies scholar (for context). Solo curation will produce visibly amateur work.

3. **It requires institutional partnerships.** BDRC for Tibetan manuscripts, CBETA for Chinese canon, SuttaCentral for early Buddhist materials. None of these are hostile — but real integration takes coordination.

4. **The ContextGraph is the highest-risk piece.** Context-as-lens is right philosophically; sloppy execution would be reductive sociology dressed as scholarship. Do not build this without doing the academic reading.

5. **Sanskrit sandhi parsing is unsolved in general.** Heuristic + dictionary lookup is ~90% accurate. For short texts (Heart Sutra) full manual review is feasible. For long texts it isn't.

6. **The current Pāli ↔ English implementation is not a finished thing yet.** Polyglot ambitions should not block bilingual completion. Finish MN10 first; THEN consider whether to invest months in this.

---

## 10. What to do tonight

**Nothing in this document.** This is a charter — a north star to test future work against, a seed to plant for future commits to germinate from.

**Tonight's work** is in `FEATURES.md`: finish MN10 bilingual demo with rich annotations using existing + small additive schema features.

**When polyglot is greenlit later**, the build order is approximately:

1. Read this document with fresh eyes
2. Pick a pilot passage (Heart Sutra one paragraph)
3. Pick three lenses (Sanskrit + Chinese + Tibetan, English as overlay)
4. Add the schema types (TextLayer, TextUnit, language-specific Analysis)
5. Curate the pilot passage one panel at a time, with scholar review per panel
6. Build the polyglot UI as the data gives it shape
7. Validate with a real reader (someone studying the Heart Sutra)
8. Decide whether to scale or stop

The decision to start is itself a multi-month commitment. Make it deliberately, not casually.
