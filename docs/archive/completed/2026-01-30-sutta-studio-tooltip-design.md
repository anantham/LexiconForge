# ADR: Sutta Studio Tooltip Design Language

**Date:** 2026-01-30
**Status:** ✅ Integrated into prompts
**Author:** Claude + Aditya

## Context

Tooltips in Sutta Studio explain Pali morphology to users who may not have linguistic training. Early tooltips used academic jargon like "vocative plural", "nominative singular", "past participle" without explanation, making them inaccessible.

## Decisions

### 1. Jargon with Explanation Pattern

**Keep technical terms, but always explain them.**

| Pattern | Example |
|---------|---------|
| `Jargon — plain explanation` | "Indeclinable — never changes form" |
| `Jargon — analogy` | "Absolutive — like English '-ing' but completed" |

**Why:** Users learn the proper terminology while understanding it. They can then cross-reference other resources.

### 2. Semantic Emoji Vocabulary

Use emojis as instant visual markers for grammatical functions:

| Emoji | Meaning | Use for |
|-------|---------|---------|
| 📍 | Location | Locative case ("in/at/among") |
| 🔗 | Belonging | Genitive case ("of/whose") |
| 📢 | Calling out | Vocative case ("Hey you!") |
| 👥 | Group | Plural markers |
| 🎯 | Receiving | Dative case ("to whom") |
| ❓ | Questioning | Interrogative words |
| ⚡ | Critical insight | Translation choices that change meaning |
| ⚖️ | Scholarly debate | Multiple valid interpretations |
| 👂 | Hearing | √su and derivatives |
| 🏠 | Dwelling | √hṛ, viharati |
| ✨ | Purity | √sudh, visuddhi |
| 😢😭 | Grief/crying | soka, parideva |
| 🌊 | Crossing over | samatikkama |
| 🕯️ | Extinguishing | nibbāna |
| 👀👁️ | Seeing | √dṛś, sacchi, anupassī |
| 💭 | Mindfulness | sati, √smṛ |
| 🔥 | Burning/ardor | ātāpī, √tap |
| 🧠 | Knowing | √jñā, sampajāno |
| 🗣️ | Speaking | √vac |
| 🏷️ | Naming | nāma |
| 📜 | Formula | Opening/closing formulas |
| ⏮️ | Past tense | Completed actions |

### 3. Replace Latin Grammar Terms

Don't assume users know Latin grammatical terminology.

| Avoid | Use Instead |
|-------|-------------|
| "Vocative plural" | 📢 "Hey you all!" — calling out to a group |
| "Nominative singular" | The one doing the action |
| "Accusative" | The thing being acted on / receiving |
| "Genitive" | 🔗 "Of the..." — belonging to |
| "Dative" | 🎯 "To him" — receiving |
| "Locative" | 📍 "In/at/among" — where it happens |
| "Instrumental" | "By/with" — the tool or agent |

### 4. No Redundant Labels

Context makes type obvious — don't state it.

| Avoid | Use Instead |
|-------|-------------|
| "Prefix: Apart / Special" | "Apart / Special" |
| "Suffix: -āya" | Just explain what -āya does |

### 5. Explain Root Notation

When showing roots like √su, explain what it means:

| Pattern | Example |
|---------|---------|
| `👂 √su: To hear` | Emoji + root + meaning |

### 6. Polycycle Enrichment

Each key term should have ~5 senses covering:
- Standard translation
- Etymological meaning
- Practice-oriented interpretation
- Different tradition readings
- Poetic/evocative rendering

### 7. Ripple Effects

When a sense changes, related English words should update via `ripples`:

```typescript
{
  english: 'convergent',
  nuance: 'All paths merge here',
  ripples: { ghost1: 'is the point of' }
}
```

### 8. Critical Interpretation Markers

Use ⚡ for translation choices that fundamentally change practice meaning:

```
⚡ THIS CHANGES EVERYTHING:
"Having removed" vs "Removing" vs "So as to remove"
• "Already removed" → practice requires purity first
• "Removing" → observation IS the removing
✓ Consensus: observation itself removes
```

## Content Categories

Tooltips should draw from multiple dimensions of understanding:

### 1. Etymology & Root Meaning

The word's origins and literal components.

| Element | Example |
|---------|---------|
| Root | √su: "to hear" |
| Compounds | Du (bad) + Kha (axle-hole) = dukkha |
| Sandhi | paṭi + a → pacc (sound changes) |
| Derivation | How the word was built |

### 2. Semantic Range

The spectrum of valid translations.

| Approach | Example for "sati" |
|----------|-------------------|
| Standard | mindfulness |
| Etymological | remembering, memory |
| Practice-oriented | presence, lucidity |
| Poetic | keeping in mind |
| Tradition-specific | recollection (Theravāda) |

### 3. Cultural & Historical Context

What this word meant in its world.

| Element | Example |
|---------|---------|
| Social role | Bhikkhu = one who shares, lives on alms |
| Place names | Kammāsadamma = "Where the Spotted One was Tamed" (ogre legend) |
| Ritual context | "Evaṁ me sutaṁ" = oral transmission formula |
| Who spoke | Ānanda reciting at First Council |

### 4. Scholarly Debates

Where experts disagree — marked with ⚖️

| Topic | Example |
|-------|---------|
| Spelling variants | Damma vs Dhamma (taming vs teaching) |
| Translation choices | "Ekāyano" — direct? solitary? convergent? |
| Grammatical analysis | Is this a gerund or participle? |

### 5. Interpretation Traditions

How different schools read the same text.

| Tradition | Might emphasize |
|-----------|-----------------|
| Theravāda | Technical precision, commentarial tradition |
| Mahāyāna | Broader metaphorical readings |
| Secular/Modern | Psychological, phenomenological framing |
| Academic | Historical-critical, comparative |

### 6. Practice Implications

What this means for actual meditation — marked with ⚡ when critical.

| Element | Example |
|---------|---------|
| Instructions | "Kāye kāyānupassī" = observe body AS body (not as self) |
| Common mistakes | Thinking you must be pure BEFORE practicing |
| Key insights | Observation IS the method of removal |
| Temporal reading | "Having removed" vs "removing" changes everything |

### 7. Grammatical Function

What role this word plays in the sentence.

| Function | Emoji | Plain English |
|----------|-------|---------------|
| Subject | — | The one doing it |
| Object | — | The thing being acted on |
| Location | 📍 | Where it happens |
| Belonging | 🔗 | Whose / of whom |
| Receiving | 🎯 | To whom |
| Calling | 📢 | Addressing someone |
| Questioning | ❓ | Asking |
| Time | ⏰ | When |
| Purpose | 🎯 | For the sake of |

### 8. Morphological Notes

How the word changes form — explained accessibly.

| Term | Explanation | Example |
|------|-------------|---------|
| Indeclinable | Never changes form | nāma, evaṁ |
| Agent noun | "One who does X" — identity | kāyānupassī |
| Absolutive | Action completed before main verb | vineyya |
| Causative | Making someone do X | āmantesi (made them listen) |

### 9. Evidence & Sources

Claims should be grounded. Types of evidence:

| Type | Example | How to cite |
|------|---------|-------------|
| Dictionary | PTS Pali-English Dictionary | "PTS: ..." |
| Commentary | Buddhaghosa's Visuddhimagga | "Vism: ..." |
| Comparative | Sanskrit cognate confirms meaning | "Skt √śru confirms..." |
| Textual | Same word used elsewhere | "cf. DN 22, MN 118" |
| Scholarly | Academic analysis | "Anālayo argues..." |
| Manuscript | Variant readings | "Some mss. read..." |

**Evidence markers:**
- ✓ = Scholarly consensus
- ⚖️ = Debated among scholars
- 📚 = See commentary for more
- 🔍 = Comparative evidence

**Example with evidence:**
```
'√su (Skt √śru): To hear',
'Sigmatic Aorist: su → so (guṇa) + s-marker',
'✓ Geminated -ss- preserves Skt śr cluster weight'
```

---

## Consequences

**Positive:**
- Accessible to beginners
- Educational — users learn terminology
- Visual scanning via emojis
- Rich polycycle encourages exploration
- Critical insights highlighted

**Negative:**
- More content to maintain
- Emoji rendering varies by platform
- Translation choices are opinionated

## Examples

### Before (inaccessible)
```
{ tooltips: ['Vocative plural', 'Direct address'] }
```

### After (accessible + educational)
```
{ tooltips: ['📢 "Hey you all!" — calling out to a group', 'Vocative — the "address" form'] }
```
