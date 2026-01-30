# Sutta Studio AI Output Case Studies

Track examples of wrong vs right AI outputs to improve prompts and quality.

---

## Case 1: Word Segmentation Failure

**Issue**: "Majjhima Nikāya 10" treated as single word instead of 3 words

**Wrong Output**:
```json
{
  "words": [{
    "id": "p1",
    "surface": "Majjhima Nikāya 10",
    "segments": [{ "text": "Majjhima Nikāya 10", "type": "stem" }]
  }]
}
```

**Expected Output**:
```json
{
  "words": [
    { "id": "p1", "surface": "Majjhima", "segments": [{ "text": "Majjhima", "type": "stem", "tooltip": "Middle" }] },
    { "id": "p2", "surface": "Nikāya", "segments": [{ "text": "Nikāya", "type": "stem", "tooltip": "Collection/Group" }] },
    { "id": "p3", "surface": "10", "segments": [{ "text": "10", "type": "stem", "tooltip": "Number: Ten" }] }
  ]
}
```

**Prompt Fix Needed**: Emphasize that space-separated tokens MUST become separate words, even in titles.

---

## Case 2: Ghost Word Misclassification

**Issue**: Words that exist in English independently being marked as ghost words

**Wrong**:
- Marking "have" as ghost in "I have heard" when it's part of the perfect tense
- Marking prepositions as ghosts when they carry meaning

**Correct Ghost Words**:
- Articles ("a", "the") - English requires, Pali doesn't
- Copula ("is", "are") - zero copula in Pali
- Possessive "of" when implied by genitive case
- Helper verbs for tense ("was", "will") when Pali uses different construction

**Not Ghost Words**:
- "have" in "have heard" (perfect tense marker - maps to past participle)
- Prepositions when they carry semantic meaning beyond case

**Prompt Fix**: Add examples of what IS vs IS NOT a ghost word.

---

## Template for New Cases

### Case N: [Title]

**Date**: YYYY-MM-DD
**Pass**: Skeleton / Anatomist / Lexicographer / Weaver / Typesetter
**Issue**: Brief description

**Input**:
```
[Pali text and English translation provided]
```

**Wrong Output**:
```json
[AI output that was incorrect]
```

**Expected Output**:
```json
[What the output should have been]
```

**Root Cause**: [Why the AI made this mistake]

**Prompt Fix**: [Specific prompt changes to prevent this]
