# Novel Library - Curated Collection Browser

**Last Updated:** 2025-10-19

---

## Overview

The Novel Library transforms LexiconForge from a "paste URL" tool into a **Netflix-style browsable library** where you can discover, preview, and instantly load pre-translated novels with one click.

![Novel Library Grid Example]

---

## Features

###  📚 Browse Curated Novels
- **Beautiful grid layout** with cover images
- **Responsive design** adapts from 2-6 columns based on screen size
- **Hover effects** bring cards to life (lift, zoom, color changes)
- **Dark mode support** for comfortable reading

### 🔍 Novel Details
- Full metadata: genres, ratings, author, translator
- Chapter count and language pairs
- Source links (Novel Updates, etc.)
- Rich descriptions
- Cover artwork

### ⚡ One-Click Loading
- Click "Start Reading" to instantly import entire sessions
- Pre-translated chapters load from hosted JSON files
- No manual URL pasting required
- Progress notifications keep you informed

### 🔗 Deep Linking
Share novels with simple URLs:
```
https://lexiconforge.app/?novel=dungeon-defense
```

Friends can load the entire novel by clicking your link!

---

## How to Use

### Method 1: Browse and Load (Recommended)

1. **Visit LexiconForge**
   - On first visit (no active session), you'll see the landing page

2. **Browse the Library**
   - Scroll through the novel grid
   - Hover over cards to preview
   - Look for genres, ratings, and chapter counts

3. **View Details**
   - Click any novel card
   - Detail sheet slides in from the right
   - Read full description and metadata

4. **Start Reading**
   - Click the blue "Start Reading" button
   - Loading overlay appears
   - Session imports automatically (may take 5-30 seconds)
   - Switches to main app when complete
   - Chapter 1 ready to translate!

### Method 2: Share Direct Links

Share a novel with anyone:
```
https://lexiconforge.app/?novel={novel-id}
```

**Available Novel IDs:**
- `dungeon-defense` - Dungeon Defense (Korean)
- `strongest-exorcist` - The Strongest Exorcist Who Failed To Save The World (Japanese)
- `omniscient-readers-viewpoint` - Omniscient Reader's Viewpoint (Korean)

**Example:**
```
https://lexiconforge.app/?novel=dungeon-defense
```

Clicking this link automatically loads all 50 chapters of Dungeon Defense!

### Method 3: Custom Import URL

Import any session JSON from a URL:
```
https://lexiconforge.app/?import=https://example.com/session.json
```

---

## Novel Catalog

### Current Collection

The library currently features:

#### 1. **Dungeon Defense** 🏰
- **Language:** Korean → English
- **Chapters:** 50
- **Genres:** Dark Fantasy, Strategy, Psychological, Demon Lord
- **Rating:** ⭐⭐⭐⭐☆ (4.5/5)
- **Author:** Yoo Heonhwa
- **Description:** Reincarnated as a weak Demon Lord in a deadly strategy game, the protagonist must use cunning and manipulation to survive against powerful heroes.
- **Tags:** Anti-Hero, Cunning Protagonist, Dark, Game Elements, Gore

#### 2. **The Strongest Exorcist Who Failed To Save The World** 📜
- **Language:** Japanese → English
- **Chapters:** 35
- **Genres:** Fantasy, Reincarnation, Magic
- **Rating:** ⭐⭐⭐⭐☆ (4.3/5)
- **Author:** Kiichi Kosuzu
- **Description:** After failing to save his world, the strongest exorcist reincarnates with all his memories and powers to try again.

#### 3. **Omniscient Reader's Viewpoint** 👁️
- **Language:** Korean → English
- **Chapters:** 25
- **Genres:** Action, Fantasy, Apocalypse, Regression
- **Rating:** ⭐⭐⭐⭐⭐ (4.8/5)
- **Author:** Sing Shong
- **Description:** The only person who finished reading a web novel finds himself living through its apocalyptic plot, using his knowledge to survive.
- **Tags:** Clever Protagonist, Multiple POV, System, Survival

---

## Technical Details

### How It Works

1. **Catalog Registry** (`config/novelCatalog.ts`)
   - Novels stored as structured metadata
   - Each entry points to a hosted session JSON file

2. **Import Service** (`services/importService.ts`)
   - Fetches session JSON from URLs
   - Validates format and structure
   - Handles CORS, timeouts, and errors
   - Supports GitHub, Google Drive, and custom URLs

3. **State Management**
   - Landing page shows when no session active
   - Main app shows after successful import
   - Seamless transition (no page reload)

### Session JSON Structure

Each novel is stored as a complete session export containing:
- All chapter content (raw text)
- Existing translations
- Navigation links
- Metadata and settings
- Compressed and validated format

### Hosting Requirements

Session JSONs are hosted on:
- **GitHub** (recommended) - Free, fast, version controlled
- **Custom CDN** - Any CORS-enabled static host
- **Cloud Storage** - S3, R2, Google Drive (with sharing)

---

## For Developers

### Adding a New Novel to the Catalog

1. **Prepare the Session**
   ```bash
   # Load novel in LexiconForge
   # Fetch all chapters
   # Go to Settings → Export → Export Session JSON
   # Save as {novel-id}.json
   ```

2. **Host the Session**
   ```bash
   # Upload to GitHub repository
   gh repo create lexiconforge-novels --public
   git clone https://github.com/YOUR_USER/lexiconforge-novels
   cd lexiconforge-novels
   mkdir -p sessions covers
   cp ~/Downloads/my-novel.json sessions/
   git add sessions/my-novel.json
   git commit -m "Add My Novel session"
   git push origin main
   ```

3. **Get the Raw URL**
   - Go to GitHub: `sessions/my-novel.json`
   - Click "Raw" button
   - Copy URL: `https://raw.githubusercontent.com/USER/lexiconforge-novels/main/sessions/my-novel.json`

4. **Add to Catalog**

   Edit `config/novelCatalog.ts`:
   ```typescript
   {
     id: 'my-novel',
     title: 'My Amazing Novel',
     sessionJsonUrl: 'https://raw.githubusercontent.com/USER/lexiconforge-novels/main/sessions/my-novel.json',
     metadata: {
       originalLanguage: 'Korean',
       targetLanguage: 'English',
       chapterCount: 100,
       genres: ['Fantasy', 'Action'],
       description: 'An epic tale of...',
       coverImageUrl: 'https://i.imgur.com/example.jpg',
       author: 'Author Name',
       rating: 4.5,
       sourceUrl: 'https://www.novelupdates.com/series/my-novel/',
       sourceName: 'Novel Updates',
       translator: 'Community',
       tags: ['OP Protagonist', 'System', 'Leveling'],
       lastUpdated: '2025-10-19'
     }
   }
   ```

5. **Test and Deploy**
   ```bash
   npm run dev  # Test locally
   npm run build  # Build for production
   vercel --prod  # Deploy
   ```

### Helper Functions

```typescript
import { getAllNovels, getNovelById, getNovelsByLanguage, getNovelsByGenre } from '@/config/novelCatalog';

// Get all novels
const novels = getAllNovels();

// Get specific novel
const novel = getNovelById('dungeon-defense');

// Filter by language
const koreanNovels = getNovelsByLanguage('Korean');

// Filter by genre
const fantasyNovels = getNovelsByGenre('Fantasy');
```

### Import from URL Programmatically

```typescript
import { ImportService } from '@/services/importService';

try {
  const sessionData = await ImportService.importFromUrl(
    'https://raw.githubusercontent.com/user/repo/main/session.json'
  );
  console.log('Loaded chapters:', sessionData.chapters.length);
} catch (error) {
  console.error('Import failed:', error.message);
}
```

---

## FAQ

### Q: Can I add my own novel to the library?
**A:** Yes! Export your session JSON and host it on GitHub. Then either:
- Submit a PR to add it to the catalog
- Share the direct import URL: `?import=YOUR_URL`

### Q: How large can a session JSON be?
**A:** ImportService has a 50MB limit. For larger novels (100+ chapters), consider splitting into volumes.

### Q: What if a novel URL is broken?
**A:** The catalog will show an error. You can still use the manual URL input fallback on the landing page.

### Q: Can I update a novel's translation?
**A:** Yes! Re-export the session JSON, replace the file on GitHub, and users will get the updated version on next load.

### Q: Do novels stay cached?
**A:** Yes! After first load, chapters are stored in IndexedDB. The library helps discover new content, but previously loaded novels persist locally.

---

## Roadmap

### Planned Features
- [ ] Search bar and filters
- [ ] Sort by rating, chapters, date
- [ ] User ratings and reviews
- [ ] Community submissions (PR workflow)
- [ ] Progress tracking (% translated)
- [ ] Favorites/bookmarks
- [ ] Reading history
- [ ] Recently added section
- [ ] Popular novels ranking

---

## Related Documentation

- **Import/Export:** See `docs/Schemas.md` for session JSON format
- **Settings:** See `docs/Settings.md` for configuration
- **Technical Details:** See `docs/NOVEL_LIBRARY_STATUS.md` for implementation status

---

## Support

Have questions or want to contribute novels?

- **Telegram:** [@webnovels](https://t.me/webnovels)
- **Patreon:** [LexiconForge Support](https://www.patreon.com/lexiconforge)
- **GitHub:** Submit issues or PRs

---

**Happy Reading! 📚**
