# LexiconForge Scraper Chrome Extension

A Chrome extension for scraping multilingual aligned Buddhist texts (Polyglotta) for use with LexiconForge.

BookToki support removed 2026-08-23 — source site shut down permanently 2026-04-27.

## Supported Sites

### Polyglotta (Buddhist Texts)
- **Domain:** `www2.hf.uio.no/polyglotta`
- **Content:** Parallel Buddhist texts in multiple languages
- **Languages:** Sanskrit, Chinese (3 translators), Tibetan, English (2 translators)
- **Output:** JSON with aligned paragraphs across all language versions

## Features

- 🚀 **Natural Navigation**: Mimics human browsing behavior
- 🛡️ **CAPTCHA Support**: Manual solving when needed
- 📚 **Multi-Site Detection**: Automatically detects which site you're on
- 🕉️ **Polyglot Support**: Extracts parallel texts with paragraph-level alignment
- ⏰ **Random Delays**: Realistic timing to avoid detection
- 💾 **Session Persistence**: Resume interrupted scraping

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `chrome_extension` folder

## Usage

### BookToki (Korean Novels)

1. Navigate to `booktoki468.com` and find a novel chapter
2. Click the extension icon - it will show "🇰🇷 BookToki"
3. Set max chapters to scrape
4. Click "📚 Start Multi-Chapter Scraping"
5. Extension navigates through chapters automatically
6. JSON file downloads when complete

### Polyglotta (Buddhist Texts)

1. Navigate to a text on `www2.hf.uio.no/polyglotta`
   - Example: `?page=fulltext&view=fulltext&vid=37` (Vimalakīrtinirdeśa)
2. Click the extension icon - it will show "🕉️ Polyglotta"
3. Set max sections to scrape (each section = 1-5 seconds)
4. Click "🕉️ Start Section-by-Section Scraping"
5. Extension navigates through sections, extracting all language versions
6. JSON file downloads when complete

**Note:** Polyglotta uses section-by-section scraping to avoid 16+ minute full-page loads.

## Output Format

### BookToki Output

```json
{
  "metadata": {
    "source": "booktoki468.com",
    "totalChapters": 10
  },
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "던전 디펜스-1화",
      "content": "Korean text...",
      "nextUrl": "..."
    }
  ]
}
```

### Polyglotta Output

```json
{
  "metadata": {
    "source": "polyglotta",
    "text": { "title": "Vimalakīrtinirdeśa", "vid": "37" },
    "totalSections": 50,
    "totalParagraphs": 200
  },
  "chapters": [
    {
      "chapterNumber": 1,
      "stableId": "polyglotta_49188",
      "title": "§1",
      "polyglotContent": [
        {
          "id": "§1",
          "versions": {
            "sanskrit": { "text": "evam mayā śrutam...", "reference": "..." },
            "chinese-kumarajiva": { "text": "如是我聞...", "reference": "..." },
            "tibetan": { "text": "'di skad bdag gis...", "reference": "..." },
            "english-lamotte": { "text": "Thus have I heard...", "reference": "..." }
          }
        }
      ],
      "content": "Sanskrit text (for LexiconForge compatibility)",
      "fanTranslation": "English translation (for LexiconForge compatibility)"
    }
  ],
  "alignedParagraphs": [
    {
      "id": "§1",
      "section": "Chapter I",
      "versions": { ... }
    }
  ]
}
```

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration |
| `content.js` | BookToki content extraction |
| `content-polyglotta.js` | Polyglotta content extraction |
| `popup.html` | Extension popup UI |
| `popup.js` | Popup logic and site detection |
| `background.js` | Session management and downloads |

## Troubleshooting

- **Extension not detecting site**: Refresh the page and reopen the extension
- **Polyglotta timeout**: The site is slow; section-by-section scraping works around this
- **Missing content**: Some sections may have sparse content; this is normal
- **Download fails**: Use "Download Accumulated" button to retry

## Import to LexiconForge

The output JSON is compatible with LexiconForge's import:

1. Export the JSON from the extension
2. In LexiconForge, use Import → Import Session JSON
3. For Polyglotta:
   - `content` = Sanskrit/primary language
   - `fanTranslation` = English translation
   - `polyglotContent` = all aligned versions (for future polyglot features)

## Development

To modify the extension:

1. Edit the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

## License

Part of the LexiconForge project.
