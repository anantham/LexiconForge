# Website Adapter Implementation Guide

This document outlines the complete process for adding support for a new web novel website to LexiconForge.

## Prerequisites

- Basic understanding of HTML/CSS selectors
- Access to the target website for analysis
- Knowledge of TypeScript/JavaScript

## Step-by-Step Implementation Process

### Step 1: Analyze Website Structure

**Goal**: Identify the CSS selectors needed to extract content from the target website.

**Tools needed**:
- Web browser with developer tools
- `curl` command or browser network inspection
- WebFetch tool (for initial analysis)

**What to identify**:
1. **Chapter title element** - Usually `<h1>`, `<h2>`, or specific class
2. **Main content container** - The div/element containing the actual story text
3. **Previous chapter link** - Link to navigate to previous chapter
4. **Next chapter link** - Link to navigate to next chapter
5. **Elements to remove** - Ads, scripts, comments, social media buttons

**Example analysis commands**:
```bash
# Fetch raw HTML
curl -s "https://example.com/chapter/1/" | head -100

# Search for title patterns
curl -s "https://example.com/chapter/1/" | grep -A 20 -B 5 "chapter\|title"

# Search for navigation patterns
curl -s "https://example.com/chapter/1/" | grep -A 10 -B 5 "prev\|next\|前\|次"
```

### Step 2: Create Adapter Class

**Location**: `services/adapters.ts`

**Template**:
```typescript
class YourSiteAdapter extends BaseAdapter {
    extractTitle = () => {
        const titleEl = this.doc.querySelector('YOUR_TITLE_SELECTOR');
        return titleEl?.textContent?.trim() ?? null;
    };

    extractContent = () => {
        const contentEl = this.doc.querySelector('YOUR_CONTENT_SELECTOR');
        if (!contentEl) return null;
        
        // Remove unwanted elements
        contentEl.querySelectorAll('script, .ads, .social').forEach(el => el.remove());
        
        // Special handling for furigana (Japanese reading guides)
        contentEl.querySelectorAll('rt').forEach(el => el.remove());
        
        return contentEl.textContent?.trim() ?? null;
    };

    getPrevLink = () => {
        const prevLink = this.doc.querySelector('YOUR_PREV_SELECTOR');
        const href = prevLink?.getAttribute('href');
        return href ? new URL(href, this.url).href : null;
    };

    getNextLink = () => {
        const nextLink = this.doc.querySelector('YOUR_NEXT_SELECTOR');
        const href = nextLink?.getAttribute('href');
        return href ? new URL(href, this.url).href : null;
    };
}
```

**Key considerations**:
- Use specific CSS selectors to avoid conflicts
- Handle relative URLs by converting to absolute URLs
- Remove elements that might interfere with content extraction
- Consider special cases (furigana for Japanese sites, encoding for Chinese sites)

### Step 3: Register Website Support

**Location**: `config/constants.ts`

**Add to SUPPORTED_WEBSITES_CONFIG array**:
```typescript
export const SUPPORTED_WEBSITES = [
  'existing-site.com',
  'your-new-site.com',  // Add here
];
```

### Step 4: Register Adapter in Factory Function

**Location**: `services/adapters.ts` in the `getAdapter` function

**Add condition**:
```typescript
const getAdapter = (url: string, doc: Document): BaseAdapter | null => {
    if (url.includes('existing-site.com')) return new ExistingSiteAdapter(url, doc);
    if (url.includes('your-new-site.com')) return new YourSiteAdapter(url, doc);  // Add here
    return null;
}
```

### Step 5: Test Implementation

**Testing approaches**:
1. **Manual testing**: Use the application to fetch a known chapter URL
2. **Browser console testing**: Test selectors directly in browser dev tools
3. **Unit testing**: Create test cases with sample HTML

**Common issues to check**:
- Title extraction returns correct chapter title
- Content extraction gets full text without ads/scripts
- Navigation links return absolute URLs
- Special characters (Japanese, Chinese) display correctly
- Empty content or missing elements are handled gracefully

## Real-World Example: ncode.syosetu.com

### Analysis Results
- **Title**: `h1.p-novel__title` 
- **Content**: `.js-novel-text.p-novel__text`
- **Previous**: `.c-pager__item--before` (text: "前へ")
- **Next**: `.c-pager__item--next` (text: "次へ")

### Implementation
```typescript
class SyosetuAdapter extends BaseAdapter {
    extractTitle = () => {
        const titleEl = this.doc.querySelector('h1.p-novel__title');
        return titleEl?.textContent?.trim() ?? null;
    };

    extractContent = () => {
        const contentEl = this.doc.querySelector('.js-novel-text.p-novel__text');
        if (!contentEl) return null;
        
        contentEl.querySelectorAll('script, .c-ad').forEach(el => el.remove());
        return contentEl.textContent?.trim() ?? null;
    };

    getPrevLink = () => {
        const prevLink = this.doc.querySelector('.c-pager__item--before');
        const href = prevLink?.getAttribute('href');
        return href ? new URL(href, this.url).href : null;
    };

    getNextLink = () => {
        const nextLink = this.doc.querySelector('.c-pager__item--next');
        const href = nextLink?.getAttribute('href');
        return href ? new URL(href, this.url).href : null;
    };
}
```

## Special Cases & Considerations

### Encoding Issues
Some sites (especially Chinese) may require special encoding handling:
```typescript
// In fetchAndParseUrl function, special handling for GBK encoding
if (url.includes('chinese-site.com')) {
    const buffer = await response.arrayBuffer();
    htmlString = new TextDecoder('gbk').decode(buffer);
}
```

### Text Cleaning
- **Furigana removal**: `contentEl.querySelectorAll('rt').forEach(el => el.remove())`
- **Ad removal**: `contentEl.querySelectorAll('.ad, .advertisement').forEach(el => el.remove())`
- **Script removal**: `contentEl.querySelectorAll('script').forEach(el => el.remove())`

### Navigation Patterns
Different sites use various navigation patterns:
- **Link rel attributes**: `this.doc.querySelector('link[rel="next"]')`
- **Text-based matching**: Find links by text content ("Next", "Previous", "次", "前")
- **CSS classes**: `.next-chapter`, `.prev-chapter`

### Error Handling
Always handle cases where elements might not exist:
```typescript
extractContent = () => {
    const contentEl = this.doc.querySelector('YOUR_SELECTOR');
    if (!contentEl) return null;  // Graceful failure
    
    // Processing...
    return contentEl.textContent?.trim() ?? null;
};
```

## Testing Checklist

- [ ] Title extraction works correctly
- [ ] Content extraction gets full chapter text
- [ ] Previous/next links are valid absolute URLs
- [ ] Content is clean (no ads, scripts, unwanted elements)
- [ ] Special characters display correctly
- [ ] Handles missing elements gracefully
- [ ] Website added to SUPPORTED_WEBSITES
- [ ] Adapter registered in getAdapter function
- [ ] Tested with multiple chapters from the site

## Debugging Tips

1. **Use browser dev tools** to test selectors live
2. **Check the network tab** to see if the site loads content dynamically
3. **Test with multiple chapters** to ensure consistency
4. **Verify encoding** for international sites
5. **Check for CORS issues** that might require proxy handling

## File Modification Summary

For each new website adapter, you need to modify:

1. **`services/adapters.ts`**:
   - Add new adapter class
   - Update `getAdapter()` function

2. **`config/constants.ts`**:
   - Add website to `SUPPORTED_WEBSITES_CONFIG` array

That's it! The existing proxy system and UI will automatically work with the new adapter.