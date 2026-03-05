# EPUB Generation Fixes Roadmap

**Date:** 2025-12-28
**Status:** Mostly Complete

## Analysis of Current EPUB (`translated-novel-20251228180645.epub`)

### Issues Found

| Issue | Severity | Root Cause |
|-------|----------|------------|
| **H1 tags HTML-escaped** | Critical | `&lt;h1&gt;` instead of `<h1>` in chapter content |
| **Images not extracted** | Critical | Base64 stays inline (4MB chapters!), no `/images/` folder |
| **No title page** | High | `includeTitlePage` defaults to `undefined` → `false` |
| **No stats page** | High | `includeStatsPage` defaults to `undefined` → `false` |
| **Generic metadata** | Medium | "Translated Novel" / "Unknown Author" |
| **No cover image** | Medium | `NovelConfig.coverImage` field exists but unused |
| **Poor filename** | Low | `translated-novel-TIMESTAMP.epub` has no context |

### Files That Need Changes

1. `services/sessionManagementService.ts` - ✅ FIXED: Added default `includeTitlePage: true`, `includeStatsPage: true`
2. `services/translate/HtmlSanitizer.ts` - ✅ FIXED: Updated `toStrictXhtml()` to preserve all EPUB-valid tags
3. `services/epubService/generators/chapter.ts` - ✅ FIXED: Now uses `translatedContent` instead of `content`
4. `services/epubService/packagers/epubPackager.ts` - ✅ FIXED: DOM-based image extraction instead of regex
5. `services/epubService.ts` - ✅ FIXED: Better filename with title/author/chapter count
6. `services/epubService/templates/novelConfig.ts` - ✅ FIXED: Extracts title from chapter title pattern

---

## Fix 1: H1 Tag Escaping Bug

**Problem:** Chapter titles appear as `&lt;h1&gt;Eon: Chapter 1...&lt;/h1&gt;`

**Location:** `services/epubService/generators/chapter.ts` → `buildChapterXhtml()`

**Root Cause:** The chapter content is being HTML-escaped somewhere in the pipeline when it shouldn't be.

**Investigation needed:**
- [ ] Trace where `chapter.content` comes from
- [ ] Check `sanitizeHtmlAllowlist()` behavior
- [ ] Check `htmlFragmentToXhtml()` behavior

---

## Fix 2: Base64 Image Extraction

**Problem:** Images stay as inline base64 (chapters are 4MB+ each)

**Location:** `services/epubService/packagers/epubPackager.ts`

**Current regex:**
```javascript
const dataImgRegex = /(<img\b[^>]*?src=")(data:(image\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=]+))("[^>]*>)/g;
```

**Possible issues:**
1. Regex engine limits on very large strings (100KB+ base64)
2. Non-greedy `*?` might fail on complex attribute patterns
3. Base64 might contain characters not in `[A-Za-z0-9+/=]`

**Proposed fix:** Don't use regex for extraction. Use DOM parsing instead:
```javascript
const parser = new DOMParser();
const doc = parser.parseFromString(xhtml, 'text/html');
const images = doc.querySelectorAll('img[src^="data:image"]');
for (const img of images) {
  const src = img.getAttribute('src');
  // Extract and replace...
}
```

---

## Fix 3: Cover Image Support

**Problem:** `NovelConfig.coverImage` exists but is never used

**Changes needed in `epubPackager.ts`:**
1. Accept cover image in `EpubMeta` interface
2. Add cover to manifest: `<item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>`
3. Add cover page to spine (first position)
4. Create cover.xhtml page

**EPUB3 cover requirements:**
- Image in manifest with `properties="cover-image"`
- Optional cover page with the image displayed
- Metadata: `<meta name="cover" content="cover-image"/>`

---

## Fix 4: Better Filename

**Current:** `translated-novel-20251228180645.epub`

**Proposed:** `{title}_{author}_{chapterCount}ch.epub`

**Example:** `Eon_Unknown_13ch.epub` or `Dungeon-Defense_YooHeonhwa_350ch.epub`

**Implementation:**
```javascript
const sanitize = (str) => str.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 50);
const filename = `${sanitize(title)}_${sanitize(author)}_${chapters.length}ch.epub`;
```

---

## Fix 5: Better Metadata Sourcing

**Problem:** URL-based detection in `getNovelConfig()` only works for known URLs

**Proposed hierarchy:**
1. User-provided metadata (from session/UI)
2. URL pattern detection (existing)
3. Fallback defaults

**Where to get user metadata:**
- Session might have a "book title" field
- Check if there's a way to store novel metadata in the app

**Open question:** Does the app store novel title/author anywhere that we can read?

---

## Fix 6: EPUBCheck Integration for Tests

**Options:**
1. **Java-based EPUBCheck** - Requires Java, spawn child process
2. **JavaScript validation** - Custom validation in tests
3. **Hybrid** - Basic JS validation + optional EPUBCheck CI step

**Recommended approach:** Custom validation in Vitest that checks:
- [ ] mimetype file is correct and uncompressed
- [ ] container.xml points to content.opf
- [ ] content.opf has valid manifest/spine
- [ ] All manifest items exist as files
- [ ] All XHTML files parse as valid XML
- [ ] Images are properly extracted (not inline base64)
- [ ] Required metadata present (title, language, identifier)

---

## Test Coverage Plan

### New Test File: `tests/epub/epub-regression.test.ts`

```typescript
describe('EPUB Regression Tests', () => {
  // Generate a real EPUB from test data and validate

  it('should not have HTML-escaped tags in chapter content', async () => {
    // Check for &lt; &gt; in chapter files
  });

  it('should extract images to /images/ folder', async () => {
    // Check images folder exists
    // Check no data:image URLs in chapter content
  });

  it('should include title page when enabled', async () => {
    // Check title.xhtml exists in manifest/spine
  });

  it('should include stats page when enabled', async () => {
    // Check stats.xhtml exists in manifest/spine
  });

  it('should have proper metadata', async () => {
    // Check dc:title, dc:creator, dc:language
  });

  it('should have valid XHTML in all chapter files', async () => {
    // Parse each chapter as XML, check no parse errors
  });

  it('should include cover image when provided', async () => {
    // Check cover-image property in manifest
  });
});
```

---

## Implementation Order

1. **Fix H1 escaping** (Critical - content unreadable)
2. **Fix image extraction** (Critical - files too large)
3. **Add regression tests** (Prevent future issues)
4. **Add cover image support** (Medium priority)
5. **Improve filename** (Low priority)
6. **Improve metadata sourcing** (Low priority)

---

## Open Questions

1. **Where does the app store novel title/author?** Need to find this to improve metadata.
2. **Should we add a "EPUB settings" UI?** For cover image upload, custom metadata.
3. **EPUBCheck in CI?** Worth adding as optional validation step?
4. **Chapter ordering:** Currently by array order. Should we use chapter numbers?

---

## Dependencies

- JSZip (already used)
- DOMParser (browser built-in)
- No new dependencies needed for fixes
