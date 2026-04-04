# Image Generation - Advanced Guide

**Last Updated:** 2025-10-19

---

## Overview

LexiconForge features a powerful AI image generation system that brings pivotal story moments to life. Generate, refine, and manage multiple versions of illustrations with professional-grade controls.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Supported Models](#supported-models)
3. [Image Versioning](#image-versioning)
4. [Advanced Controls](#advanced-controls)
5. [Version Management](#version-management)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Basic Workflow

1. **Translate a Chapter**
   - AI automatically suggests illustrations for key scenes
   - Placement markers appear in text: `[ILLUSTRATION-1]`, `[ILLUSTRATION-2]`, etc.

2. **Generate First Image**
   - Click the illustration marker
   - Review the AI-generated prompt
   - Click "Generate Image"
   - Wait 10-30 seconds for generation

3. **Refine or Regenerate**
   - Not happy? Click "Regenerate" for version 2
   - Each regeneration creates a new version
   - Switch between versions with arrow buttons

4. **Advanced Controls** (Optional)
   - Expand "Advanced Controls" panel
   - Add negative prompts
   - Adjust guidance scale
   - Select steering images
   - Use LoRA style models

---

## Supported Models

### Flux Models (via PiAPI)

**Text-to-Image:**
- `flux-1-schnell` - Fast generation (5-10s)
- `flux-1-dev` - Balanced quality and speed (15-20s)
- `flux-1-pro` - Highest quality (25-35s)

**Image-to-Image (img2img):**
All Flux models support img2img with steering images

### Gemini Models (via Google)

- `imagen-3.0` - Google's latest image model
- `imagen-3.0-fast` - Faster variant
- `imagen-4.0` - Next generation (preview)

### OpenRouter Models

- `openai/gpt-5-image-mini` - GPT-5 image generation
- Other compatible image models

---

## Image Versioning

### How Versioning Works

Each illustration marker (`[ILLUSTRATION-1]`) can have **multiple versions**:

```
[ILLUSTRATION-1]
  ├── Version 1 (initial generation)
  ├── Version 2 (first regeneration)
  ├── Version 3 (with different guidance scale)
  ├── Version 4 (with steering image)
  └── Version 5 (with LoRA style)
```

### Benefits

- **Experiment freely** - Try different settings without losing previous results
- **Compare approaches** - See which guidance scale works best
- **Keep backups** - Original version always preserved
- **No destructive edits** - Can always go back

### Versioning UI

**Version Display:**
```
[v2/5]  ◀ Version 2 of 5 ▶
        ⬅ Previous  Next ➡
```

**Controls:**
- ⬅ **Previous Arrow** - Go to version 1
- ➡ **Next Arrow** - Go to version 3
- **Regenerate Button** - Create version 6
- 🗑️ **Trash Icon** - Delete current version

### Storage

- **Primary Storage:** IndexedDB (persistent, survives browser restart)
- **Cache:** CacheStorage API for fast retrieval
- **Versioning Metadata:** Stored per chapter per marker

---

## Advanced Controls

### 1. Negative Prompts

**What It Does:** Tells the AI what to **avoid** generating

**Default:**
```
low quality, blurry, distorted, text, watermark
```

**Common Examples:**
```
# For character portraits
ugly, deformed, disfigured, mutated hands, extra limbs

# For landscapes
people, humans, faces, buildings

# For action scenes
static, boring, plain, simple background

# For professional look
cartoon, anime, childish, amateur
```

**How to Use:**
1. Expand "Advanced Controls"
2. Edit "Negative Prompt" field
3. Add comma-separated terms
4. Generate or regenerate

---

### 2. Guidance Scale

**What It Does:** Controls how closely the AI follows your prompt

**Range:** 1.5 (Creative) → 5.0 (Precise)

**Guidance:**
- **1.5-2.5 (Creative)**
  - More artistic interpretation
  - Unpredictable, interesting results
  - Good for: Abstract art, stylized scenes

- **3.0-3.5 (Balanced)** ← Default
  - Good balance of creativity and control
  - Reliable results
  - Good for: Most use cases

- **4.0-5.0 (Precise)**
  - Strict adherence to prompt
  - Literal interpretation
  - Good for: Specific compositions, technical accuracy

**Visual Slider:**
```
🎨 1.5 ━━━━●━━━━━━ 5.0 🎯
        ↑
      Current: 3.5
```

---

### 3. Steering Images (img2img)

**What It Does:** Uses a reference image to guide composition and style

**Available Images** (21 images in `public/steering/`, loaded dynamically from `public/steering-images.json`):

Includes `art.webp`, `bath.jpeg`, `blow.jpeg`, `elf.jpeg`, `four maids.jpeg`, `gloss.jpeg`, `hair.jpeg`, `hypno.jpg`, `manga.png`, `pinch.jpeg`, `river.jpeg`, `run.jpg`, `shower.jpeg`, `shrine.jpeg`, `soft.webp`, `spoon.jpeg`, `succubus.webp`, `train.jpg`, `waitinginline.jpg`, `white.jpg`, `yuri.jpeg`.

New images are added by placing files in `public/steering/` and updating the manifest.

**How to Use:**
1. Select steering image from dropdown
2. Automatically switches to img2img mode
3. Preview shows thumbnail
4. Generate uses image as guidance

**Best For:**
- Controlling composition layout
- Consistent character positioning
- Specific scene framing
- Style transfer

---

### 4. LoRA Style Models

**What Are LoRAs?** Low-Rank Adaptation models that transform image style

**21 Available Styles:**

**XLabs Collection (7 styles):**
- Realism
- Anime
- Disney
- Art Deco
- Art Nouveau
- Cyberpunk
- Gothic

**CivitAI Collection (14 styles):**
- Photorealistic
- Watercolor
- Oil Painting
- Sketch
- Pixel Art
- Film Noir
- And more...

**LoRA Strength:** 0.1 (Subtle) → 2.0 (Maximum)
- 0.5-0.8: Recommended range
- 1.0+: Very strong effect

**How to Use:**
1. Expand "Advanced Controls"
2. Select LoRA model from dropdown
3. Adjust strength slider
4. Generate to apply style

**Tips:**
- Start with 0.7 strength
- Some LoRAs work better with specific prompts
- Combine with guidance scale for fine control

---

## Version Management

### Creating New Versions

**Regenerate Button:**
- Click at any time to create next version
- Previous versions preserved
- New version becomes active

**With Different Settings:**
```
Version 1: Default (guidance 3.5)
Version 2: Higher precision (guidance 4.5)
Version 3: With steering image (train.jpg)
Version 4: With LoRA (Anime style, 0.8)
Version 5: Final version (all optimizations)
```

### Navigating Versions

**Arrow Buttons:**
- ⬅ Previous version (v3 → v2)
- ➡ Next version (v3 → v4)

**Keyboard Shortcuts:** (if implemented)
- Left Arrow: Previous
- Right Arrow: Next

**Version Indicator:**
```
[v3/5]
```
Shows you're on version 3 out of 5 total versions

### Deleting Versions

**🗑️ Trash Button:**
- Appears on each version
- Click to permanently delete
- Confirmation required

**What Gets Deleted:**
1. Image from IndexedDB
2. Image from CacheStorage
3. All associated metadata
4. Version number shifts down

**Example:**
```
Before: v1, v2, v3, v4, v5
Delete v3
After:  v1, v2, v4, v5
        → v4 becomes v3
        → v5 becomes v4
```

**Deleting Last Version:**
- Removes all image state
- Marker becomes empty placeholder
- Can regenerate fresh

**Cannot Undo!** Deletion is permanent.

### Best Practices for Versions

1. **Keep Version 1** - Original baseline for comparison
2. **Delete Failed Attempts** - Free up storage
3. **Limit to 3-5 Versions** - Avoid clutter
4. **Name Your Workflow** - Remember which settings produced each version

---

## Best Practices

### Workflow for Perfect Images

1. **Start Simple**
   - Generate v1 with defaults
   - Assess what's wrong

2. **Iterate Systematically**
   - v2: Adjust guidance scale
   - v3: Add negative prompts
   - v4: Try steering image
   - v5: Apply LoRA style

3. **Keep Winners, Delete Losers**
   - Delete obviously bad versions
   - Keep 2-3 best candidates

4. **Final Polish**
   - Select best version
   - Maybe regenerate one more time with perfect settings

### Prompt Engineering Tips

**Good Illustration Prompt:**
```
A dark throne room, shadowy figures bowing before a demon lord,
torches casting dramatic light, gothic architecture, ominous atmosphere,
detailed fantasy art style
```

**With Negative Prompts:**
```
Negative: blurry, low quality, cartoon, bright colors,
modern furniture, happy atmosphere
```

**Result:** Dark, detailed, professional fantasy scene

### Storage Management

**Images Are Large!**
- Each version: ~500KB-2MB
- 100 images: ~50-200MB

**Recommendations:**
- Delete unused versions regularly
- Export session with images before clearing
- Use Settings → Memory Diagnostics to check usage

---

## Troubleshooting

### Image Generation Fails

**Error: "Provider error (502)"**
- Provider (OpenRouter/PiAPI) is having issues
- Try different model
- Wait and retry later

**Error: "Missing image data"**
- Response format issue
- Check Settings → Image Generation → Model selection
- Try Gemini/Imagen instead of Flux

### Images Not Displaying

**Blank placeholder:**
- Check browser console for errors
- Verify IndexedDB is enabled
- Try regenerating

**Old version showing:**
- Click arrow buttons to navigate
- Check version indicator `[v?/?]`

### Storage Issues

**"Storage quota exceeded":**
- Delete old image versions
- Clear browser cache
- Use Settings → Memory Diagnostics → Clear All Data

**Images disappear after restart:**
- Should NOT happen (IndexedDB is persistent)
- Check browser privacy settings
- Make sure "Clear on exit" is disabled

### Slow Generation

**Takes longer than 30s:**
- Normal for `flux-1-pro` or high-resolution images
- Use `flux-1-schnell` for faster results
- Check internet connection

---

## Technical Details

### Storage Architecture

**IndexedDB:**
```
Store: images
├── chapterId: string
├── placementMarker: string
├── version: number
├── imageData: string (base64 or data URL)
├── settings: object (guidance, negative prompt, etc.)
└── timestamp: Date
```

**CacheStorage:**
```
Cache: lexiconforge-images
├── {chapterId}-{marker}-v{N}.jpg
└── Metadata headers
```

### API Request Format

**PiAPI Flux Example:**
```json
{
  "model": "flux-1-dev",
  "task_type": "img2img",
  "input": {
    "prompt": "detailed fantasy scene...",
    "negative_prompt": "low quality, blurry",
    "guidance_scale": 3.5,
    "width": 1024,
    "height": 1024,
    "image": "data:image/jpeg;base64,/9j/4AA...",
    "lora_models": ["xlabs/realism"],
    "lora_strength": 0.7
  }
}
```

### Version Indexing

```typescript
// Key format
`${chapterId}:${placementMarker}`

// Example
"ch261_6wg0v9_kgcn:[ILLUSTRATION-1]"

// Storage maps
imageVersions[key] = 5  // Total versions
activeImageVersion[key] = 3  // Currently displayed
generatedImages[key][3] = { imageData, settings }
```

---

## Related Documentation

- **Settings:** See `docs/Settings.md` for global defaults
- **Enhanced img2img:** See `docs/ENHANCED_IMG2IMG_GUIDE.md` for advanced features
- **EPUB Export:** See `docs/EPUB.md` for embedding images

---

**Need Help?**

- Join our Telegram: [@webnovels](https://t.me/webnovels)
- Check GitHub Issues
- See Patreon for priority support

---

**Happy Illustrating! 🎨**
