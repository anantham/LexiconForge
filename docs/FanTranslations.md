# Fan Translations - Comparison Workflow Guide

**Last Updated:** 2025-10-19

---

## Overview

Fan translations serve as valuable reference material in LexiconForge. Use them to:
- **Compare** AI translations against trusted human translations
- **Improve quality** by providing AI with reference translations
- **Benchmark performance** by testing translation quality with/without fan reference
- **Learn from patterns** in professional translation choices

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Comparison Modes](#comparison-modes)
3. [Merging Fan Translations](#merging-fan-translations)
4. [Comparison Workflow](#comparison-workflow)
5. [Settings Control](#settings-control)
6. [Best Practices](#best-practices)
7. [FAQ](#faq)

---

## Quick Start

### Prerequisites

- **Fan translation text files** (one per chapter)
- **Exported session JSON** from LexiconForge
- **Node.js** installed (for CLI tool)

### Quick Workflow

1. **Prepare fan translations**
   ```
   fan-translations/
   ├── Chapter-0001-Title.txt
   ├── Chapter-0002-Title.txt
   └── Chapter-0003-Title.txt
   ```

2. **Export your session**
   - Settings → Export → Export Session JSON
   - Save as `session.json`

3. **Merge fan translations**
   ```bash
   npm run merge-fan-translations session.json fan-translations/ output.json
   ```

4. **Import merged session**
   - Settings → Import → Import Session JSON
   - Select `output.json`

5. **Start comparing!**
   - Select any translated text
   - Click comparison button
   - See AI, fan, and raw versions side-by-side

---

## Comparison Modes

### View Modes

LexiconForge offers **three view modes** for each chapter:

#### 1. AI Translation (Default)
```
Shows: Current AI-generated translation
Use: Primary reading mode
```

#### 2. Fan Translation View
```
Shows: Human translator's version
Use: Reference, comparison, quality check
```

#### 3. Raw Text View
```
Shows: Original language text
Use: Verify source accuracy, check nuances
```

### Toggle Between Views

**UI Controls:**
- Click view toggle buttons in chapter toolbar
- Keyboard shortcuts (if implemented)

**What Displays:**
- **AI View:** Translated content with all features (footnotes, illustrations, edits)
- **Fan View:** Clean fan translation text (read-only)
- **Raw View:** Original source text (read-only)

---

## Merging Fan Translations

### CLI Tool: `merge-fan-translations`

**Purpose:** Add fan translations to existing session JSON

**Location:** `scripts/merge-fan-translations.ts`

**Usage:**
```bash
npm run merge-fan-translations <session.json> <fan-dir> [output.json]
```

**Arguments:**
- `session.json` - Exported LexiconForge session
- `fan-dir` - Directory containing fan translation `.txt` files
- `output.json` - (Optional) Output filename (default: overwrites input)

### File Naming Convention

Fan translation files must follow this pattern:
```
Chapter-NNNN-*.txt
```

**Examples:**
```
✅ Chapter-0001-Dungeon Defense Chapter 1 – Awakening.txt
✅ Chapter-0042-Title Can Be Anything.txt
✅ Chapter-0100-Final Chapter.txt

❌ chapter-1.txt (missing leading zeros)
❌ Ch001-Title.txt (wrong prefix)
❌ 0001.txt (no "Chapter-" prefix)
```

**Matching Logic:**
- Extracts chapter number from filename
- Matches against `chapterNumber` field in session
- Stores content in `fanTranslation` field

### Merge Process

**Step-by-Step:**

1. **Load session JSON**
   ```
   📖 Loading session data from: session.json
   ✅ Found 50 chapters in session
   ```

2. **Scan fan translation directory**
   ```
   📂 Found 48 fan translation files
   ✅ Loaded fan translation for chapter 1 (12,543 chars)
   ✅ Loaded fan translation for chapter 2 (11,892 chars)
   ...
   ```

3. **Match and merge**
   ```
   🔗 Matching fan translations to chapters...
   ✅ Chapter 1: Matched
   ✅ Chapter 2: Matched
   ⚠️  Chapter 3: No fan translation found
   ```

4. **Write output**
   ```
   💾 Writing merged session to: output.json

   📊 Merge Summary:
      Total chapters: 50
      Fan translations merged: 48
      Coverage: 96.0%
   ```

### Output Format

**Before merge:**
```json
{
  "stableId": "ch001_abc123",
  "chapterNumber": 1,
  "content": "Raw Korean/Japanese text...",
  "translations": [ ... ]
}
```

**After merge:**
```json
{
  "stableId": "ch001_abc123",
  "chapterNumber": 1,
  "content": "Raw Korean/Japanese text...",
  "fanTranslation": "Human translated English text...",
  "translations": [ ... ]
}
```

---

## Comparison Workflow

### Inline Text Comparison

**Use Case:** Compare specific sentences or paragraphs

**Steps:**

1. **Select text** in AI translation
   - Highlight any span of translated text
   - Floating toolbar appears

2. **Click comparison button**
   - Usually a "compare" icon or button
   - May show as "View Fan Translation"

3. **AI analyzes context**
   - Sends selected AI translation
   - Sends full chapter context
   - Requests AI to find matching fan translation excerpt

4. **Comparison appears inline**
   ```
   ┌────────────────────────────────────┐
   │ AI Translation (selected)          │
   │ The demon lord rose from his       │
   │ throne with a sinister smile.      │
   ├────────────────────────────────────┤
   │ Fan Translation (matched)          │
   │ The Demon Lord stood up from his   │
   │ throne, grinning wickedly.         │
   ├────────────────────────────────────┤
   │ Raw Text (if available)            │
   │ 魔王は玉座から立ち上がり、邪悪な     │
   │ 笑みを浮かべた。                      │
   └────────────────────────────────────┘
   ```

5. **Context shown** (optional)
   - Text before selected passage
   - Text after selected passage
   - Helps verify correct alignment

### Full Chapter Comparison

**Use Case:** Review entire chapter side-by-side

**Steps:**

1. **Switch to Fan View**
   - Click "Fan Translation" tab/button
   - Entire chapter displays fan version

2. **Compare passages manually**
   - Read through both versions
   - Note differences in style, accuracy, nuance

3. **Switch to Raw View**
   - Verify source text accuracy
   - Check for mistranslations or additions

4. **Iterate on AI translation**
   - Provide feedback on specific lines
   - Regenerate with adjusted prompts

---

## Settings Control

### Fan Translation Reference Toggle

**Location:** Settings → General → Advanced AI Controls

**Setting:** "Include Fan Translation as Reference"

**Options:**

#### ✅ Enabled (Default)
```
What happens:
- Fan translation sent to AI with every translation request
- AI uses it as "ground truth" reference
- Improves consistency with established translations
- Higher quality output

Use when:
- You trust the fan translation quality
- Want consistent terminology
- Learning a novel's naming conventions
```

#### ❌ Disabled
```
What happens:
- Fan translation NOT sent to AI
- AI translates from raw text only
- Uses previous chapters as sole context
- Tests "pure" translation ability

Use when:
- Benchmarking AI quality
- Testing different models
- Fan translation has errors
- Want independent interpretation
```

**How to Toggle:**

1. Open Settings (⚙️ icon)
2. Navigate to "General" tab
3. Scroll to "Advanced AI Controls"
4. Check/uncheck "Include Fan Translation as Reference"
5. Save settings

**Impact on Token Usage:**

- **Enabled:** +1000-5000 tokens per translation (depends on context depth)
- **Disabled:** Baseline token usage

---

## Best Practices

### When to Use Fan Translations as Reference

✅ **DO use when:**
- Fan translation is high quality (professional level)
- You want consistent terminology across chapters
- Novel has complex naming conventions (Wuxia, Xianxia)
- Learning proper character/place name translations

❌ **DON'T use when:**
- Fan translation has known errors
- You want fresh perspective on interpretation
- Testing a new model's capabilities
- Fan translation is machine-translated

### Comparison Workflow Best Practices

1. **Start with reference enabled**
   - Get baseline quality
   - Learn the established terminology

2. **Spot-check critical passages**
   - Use inline comparison for key scenes
   - Verify important dialog accuracy
   - Check technical terms

3. **Test without reference**
   - Disable fan translation for one chapter
   - Compare results
   - Decide which mode works better

4. **Iterate based on findings**
   - If AI matches fan quality → disable reference (save tokens)
   - If AI deviates badly → keep reference enabled

### Storage Management

**Fan translations add data:**
- Average: ~10-20KB per chapter
- 100 chapters: ~1-2MB total
- Stored in IndexedDB (persistent)

**Cleanup:**
- Fan translations stored in session exports
- Can remove manually by editing JSON
- Or export without fan translations (future feature)

---

## FAQ

### Q: What if I don't have fan translations?
**A:** LexiconForge works perfectly fine without them! Fan translations are optional reference material. The AI can translate from raw text alone.

### Q: Can I use machine-translated "fan" translations?
**A:** Not recommended. Poor quality reference can make AI output worse. Only use high-quality human translations.

### Q: How do I know if fan translation improved quality?
**A:**
1. Translate one chapter with reference enabled
2. Translate next chapter with reference disabled
3. Compare quality subjectively
4. Use the one that works better

### Q: What file formats are supported for fan translations?
**A:** Currently only `.txt` files. UTF-8 encoding required.

### Q: Can I add fan translations after importing a session?
**A:** Not currently. You must:
1. Export session
2. Run merge script
3. Re-import merged session

### Q: How does the comparison AI find matching text?
**A:** It uses semantic similarity and context matching. The AI:
1. Receives your selected AI translation
2. Searches full fan translation for closest match
3. Returns fan excerpt with surrounding context
4. Also provides raw text if available

### Q: Can I edit fan translations in the app?
**A:** No, fan translations are read-only. If you find errors:
1. Edit the `.txt` file
2. Re-run merge script
3. Re-import session

### Q: Do fan translations work with EPUB export?
**A:** Not currently exported. EPUB contains only AI-generated translation. Fan translations remain as reference in the app.

### Q: What's the difference between fan translation and human translation?
**A:** In LexiconForge context, they're the same thing. "Fan translation" refers to any existing human translation you're using as reference (could be official, fan-made, or your own).

---

## Technical Details

### Comparison API Request

**ComparisonService Flow:**

```typescript
// services/comparisonService.ts

requestFocusedComparison({
  chapterId: "ch001_abc123",
  selectedTranslation: "The demon lord rose...",
  fullTranslation: "Chapter 1 full AI translation...",
  fullFanTranslation: "Chapter 1 full fan translation...",
  fullRawText: "Raw source text...",
  settings: appSettings
})
```

**AI Prompt Structure:**

```
You are comparing translations. Find the fan translation excerpt that matches this AI translation:

Selected AI Translation:
"The demon lord rose from his throne with a sinister smile."

Full AI Translation:
[... entire chapter ...]

Full Fan Translation:
[... entire chapter ...]

Raw Text (optional):
[... original language ...]

Return JSON:
{
  "fanExcerpt": "matched fan translation text",
  "fanContextBefore": "text before excerpt",
  "fanContextAfter": "text after excerpt",
  "rawExcerpt": "matched raw text",
  "confidence": 0.95
}
```

### Storage Schema

**Chapter with Fan Translation:**

```typescript
interface Chapter {
  stableId: string;
  chapterNumber: number;
  title: string;
  content: string;              // Raw text (original language)
  fanTranslation?: string;      // Human translation
  translationResult?: {         // AI translation
    translatedContent: string;
    // ... other fields
  };
}
```

---

## Related Documentation

- **README:** See main guide for merge-fan-translations CLI usage
- **Settings:** See `docs/Settings.md` for fan translation toggle
- **Schemas:** See `docs/Schemas.md` for session JSON format

---

## Future Enhancements

Planned features:
- [ ] In-app fan translation editor
- [ ] Support for HTML/MD fan translation files
- [ ] Automated fan translation discovery (scraping)
- [ ] Diff highlighting between AI and fan versions
- [ ] Export EPUB with both translations
- [ ] Confidence scoring for matches
- [ ] Manual alignment override

---

**Need Help?**

- Join our Telegram: [@webnovels](https://t.me/webnovels)
- Check GitHub Issues
- See Patreon for priority support

---

**Happy Comparing! 📖**
