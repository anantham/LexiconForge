# HR Tag Spacing Fix

## Problem
When AI translation models output `<hr>` tags, they sometimes place them directly adjacent to text without proper spacing:

```
...Laura sighed.<hr>The battle ended...
```

This results in the horizontal rule appearing cramped and not visually separated from the surrounding paragraphs.

## Root Cause
The `HtmlRepairService` was normalizing `<hr>` tag variants (e.g., `<hr />`, `< hr >`) to `<hr>`, but wasn't ensuring proper spacing around the tags.

## Solution
Added two new repair rules to `HtmlRepairService.ts`:

### Issue #8: Add spacing around `<hr>` tags touching text on both sides
```typescript
{
  name: 'space-hr-tags',
  description: 'Add line breaks before and after <hr> tags',
  pattern: /([^\s>])\s*<hr>\s*([^\s<])/gi,
  replacement: '$1<br><br><hr><br><br>$2'
}
```

### Issue #9: Add spacing when `<hr>` is at line edges
```typescript
{
  name: 'space-hr-edges',
  description: 'Add line breaks around <hr> at line edges',
  pattern: /([^\s>])\s*<hr>|<hr>\s*([^\s<])/gi,
  replacement: (match, before, after) => {
    if (before) return `${before}<br><br><hr>`;
    if (after) return `<hr><br><br>${after}`;
    return match;
  }
}
```

## Example Transformation

**Before:**
```
Laura sighed.<hr>The battle ended.
```

**After:**
```
Laura sighed.<br><br><hr><br><br>The battle ended.
```

## Rendering Result
When rendered in the UI, the `<br>` tags create proper paragraph spacing, and the `<hr>` renders as a horizontal rule with visual breathing room:

```
Laura sighed.

─────────────────────────

The battle ended.
```

## Files Modified
- `services/translate/HtmlRepairService.ts` - Added two new repair rules
- `tests/services/HtmlRepairService.test.ts` - Added 5 new test cases
- `tests/manual/test-hr-spacing.ts` - Manual test demonstrating the fix

## Test Coverage
✅ All 25 tests pass
✅ Build passes successfully
✅ Manual test confirms proper spacing

## Usage
The fix is automatically applied during translation via `translationService.ts` line 168:

```typescript
const { html: repairedHtml, stats } = HtmlRepairService.repair(
  result.translation,
  { enabled: true, verbose: settings.htmlRepairVerbose }
);
```

No configuration changes needed - works out of the box!

## Related Issues
This fix also handles:
- `<hr />` self-closing tags
- `< hr >` malformed tags with spaces
- `---` and `***` scene break markers (converted to `<hr>`)
- Multiple consecutive `<hr>` tags (deduplicated)
