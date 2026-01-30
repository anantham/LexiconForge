# ADR: Sutta Studio Tooltip Design Language

**Date:** 2026-01-30
**Status:** Approved
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
