# BookToki Scraper Chrome Extension

A Chrome extension for naturally scraping BookToki website with CAPTCHA support.

## Features

- 🚀 **Natural Navigation**: Mimics human browsing behavior
- 🛡️ **CAPTCHA Support**: You can manually solve challenges when needed
- 💾 **HTML Saving**: Automatically saves pages for analysis
- 📱 **User-Friendly Interface**: Simple popup controls
- ⏰ **Random Delays**: Realistic timing to avoid detection

## Installation

1. **Prepare Icons** (required):
   - Create icon16.png (16x16 pixels)
   - Create icon48.png (48x48 pixels) 
   - Create icon128.png (128x128 pixels)
   
   You can use any simple book/scraping icons or create text-based icons.

2. **Install Extension**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked"
   - Select the `chrome_extension` folder

## Usage

1. **Navigate to BookToki**: Go to `http://booktoki468.com`
2. **Open Extension**: Click the extension icon in Chrome toolbar
3. **Start Scraping**: Click "🚀 Start Natural Scraping"

The extension will automatically:
- Search for "던전 디펜스" 
- Click on the first novel result
- Save the final ToC page HTML
- Handle Cloudflare challenges (you may need to solve CAPTCHAs manually)

## Manual Controls

- **💾 Save Current Page HTML**: Save any page you're currently viewing
- **🔍 Search for 던전 디펜스**: Perform just the search step
- **👆 Click First Novel Result**: Click on the novel from search results
- **⏹️ Stop Scraping**: Stop the automated process

## Files Generated

The extension will save HTML files to your Downloads folder:
- `booktoki_dungeon_defense_toc_final.html` - Final novel ToC page
- `debug_search_results.html` - Search results (if issues occur)

## How It Works

1. **Content Script** (`content.js`): Runs on BookToki pages, handles clicking and interaction
2. **Popup Interface** (`popup.html/js`): Provides user controls and progress tracking
3. **Background Worker** (`background.js`): Handles file downloads

## Advantages over Selenium

- ✅ **No detection**: Runs as legitimate browser extension
- ✅ **Real user session**: Uses your actual cookies and browser state
- ✅ **Manual CAPTCHA solving**: You can solve challenges when they appear
- ✅ **Natural interaction**: Uses real browser events, not automation
- ✅ **Persistent**: Extension stays loaded across browser sessions

## Troubleshooting

- **Extension not working**: Make sure you're on booktoki468.com
- **No icons showing**: Add the required icon files (icon16.png, icon48.png, icon128.png)  
- **CAPTCHA appears**: Solve it manually, then click continue in the extension
- **Download fails**: Check Chrome downloads permissions

## Next Steps

After successful scraping, you can:
1. Analyze the saved HTML files
2. Extract chapter links and content
3. Build a full chapter scraping workflow
4. Process the extracted text for translation projects

The extension provides the foundation - you can extend it to handle full chapter extraction workflows!