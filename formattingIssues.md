# Formatting Issues - Historical Case Studies

**Status as of 2025-10-19:** Most issues have been resolved by `HtmlRepairService.ts`

These are case studies of formatting issues smaller/cheaper AI models make when translating. They informed the HTML repair rules implemented in `services/translate/HtmlRepairService.ts`.

---

## Issue #1: Capital `<I>` tags ✅ FIXED

**Example:**
```html
loud <I>thump</I>, as if struck by an earthquake...
<I>'Kill them however you wish.'</I>
```

**Problem:** AI uses uppercase `<I>` instead of lowercase `<i>`

**Fix:** ✅ Rule `lowercase-italic-tags` (HtmlRepairService.ts:50-54)
- Pattern: `/<I>(.*?)<\/I>/gi`
- Replacement: `<i>$1</i>` 


---

## Issue #2: Multiple/malformed `<hr>` tags ✅ FIXED

**Example:**
```html
<hr /> or <hr /><hr /><hr /><hr /><hr /><hr />
or just <hr>
```

**Problem:** Inconsistent HR tag formats and duplicates

**Fix:** ✅ Multiple rules handle this:
1. Rule `normalize-hr` (HtmlRepairService.ts:57-62) - Normalizes `<hr />` → `<hr>`
2. Rule `dedupe-hr-tags` (HtmlRepairService.ts:97-102) - Removes duplicate `<hr>` tags
3. Rule `scene-break-dashes` (HtmlRepairService.ts:73-78) - Converts `---` → `<hr>`

---

## Issue #3: Illustration markers without brackets ✅ FIXED

**Example:**
```
'Why do you not commit suicide at this very moment?'

ILLUSTRATION-1

'…!'
```

**Problem:** Illustration markers appear as bare `ILLUSTRATION-1` instead of `[ILLUSTRATION-1]`

**Fix:** ✅ Rule `bracket-illustrations` (HtmlRepairService.ts:65-70)
- Pattern: `/(?<!\[)(ILLUSTRATION-\d+)(?!\])/gi`
- Replacement: `[$1]`
- Uses negative lookbehind/lookahead to avoid double-bracketing

---

## Issue #4: HTML entities not decoded ⚠️ PARTIALLY FIXED

**Example:**
```
In the game &lt;Dungeon Attack>, Andromalius appears...
```

**Problem:** HTML entities like `&lt;` `&gt;` `&amp;` appear instead of `< > &`

**Fix:** ⚠️ Rule `decode-html-entities` EXISTS but **DISABLED BY DEFAULT** (HtmlRepairService.ts:138-166)
- **Why disabled:** Can be risky - might interfere with intentional escaping
- **To enable:** Remove `'decode-html-entities'` from `disabledRules` in repair options
- Decodes: `&lt;` `&gt;` `&amp;` `&quot;` `&#39;` `&apos;`

**Recommendation:** Enable on per-model basis if specific AI models consistently produce this issue

---

## Issue #5: Dangling closing tags ✅ FIXED

**Example:**
```html
</i>Status!</i> or </i>Kerrururuk!</i>
```

**Problem:** Closing tag appears before opening tag: `</i>Text</i>` instead of `<i>Text</i>`

**Fix:** ✅ Rule `fix-short-dangling-closers` (HtmlRepairService.ts:127-132)
- Pattern: `/<\/\s*(i|b|em|strong)\s*>([^<]{1,50}?)<\/\s*\1\s*>/gi`
- Replacement: `<$1>$2</$1>`
- **Safety limit:** Only fixes content <50 characters to avoid creating large unwanted italic chunks
- Handles: `<i>`, `<b>`, `<em>`, `<strong>` tags

**Note:** Original aggressive version was removed (see HtmlRepairService.ts:169-175) because it created unwanted large italic chunks. Current version is conservative and safe.


---

## Issue #6: HTML entities in code blocks ⚠️ PARTIALLY FIXED

**Example:**
```html
&lt;code>━━━━━━━━━━━━━━━━━━━━
Name: Laura
HP: 6
Attack: 15
Defense: 7
━━━━━━━━━━━━━━━━━━━━&lt;/code>
```

**Problem:** HTML entities `&lt;code>` instead of proper `<code>` tags

**Fix:** ⚠️ Same as Issue #4 - Rule `decode-html-entities` is **DISABLED BY DEFAULT**
- See Issue #4 above for details
- Enable via repair options if needed for specific models

---

## Issue #7: `<hr>` tags without spacing ✅ FIXED

**Example:**
```html
Mm. I worked hard today, too.
<hr>Author's Afterword<hr>
I dearly hope you never meet a bad man.
```

**Problem:** `<hr>` tags touching text without line breaks

**Fix:** ✅ Multiple rules handle this:
1. Rule `space-hr-tags` (HtmlRepairService.ts:105-110) - Adds `<br><br>` before and after `<hr>` when touching text
2. Rule `space-hr-edges` (HtmlRepairService.ts:113-122) - Adds spacing when `<hr>` is at start/end of line

**Result:** `text<hr>text` becomes `text<br><br><hr><br><br>text`

---

## Summary

**✅ Fully Fixed (5 issues):** #1, #2, #3, #5, #7
**⚠️ Partially Fixed (2 issues):** #4, #6 (rule exists but disabled by default)

All repairs are applied automatically when `enableHtmlRepair: true` in settings (enabled by default). 
