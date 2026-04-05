# SillyTavern Self-Insert — Design Spec

**Date:** 2026-04-05
**Status:** Approved
**Scope:** LexiconForge toolbar + novel-analyzer bridge + SillyTavern REST API

## Overview

A feature that lets readers step into any moment of the novel they're reading. Select a passage in the translation, click the portal icon, and SillyTavern opens with a group chat populated by every character present in that chapter — their personalities, knowledge, and relationships frozen at exactly that point in the story via git-based spoiler control. An LLM generates a scene-setting scenario from the selected passage, and ST's persona system provides the reader's identity.

## Architecture

```
User selects text in chapter → clicks portal icon in toolbar
                                        │
                    ┌───────────────────┘
                    ▼
          LexiconForge (browser)
          ├─ Reads current chapter number from store
          ├─ Gets active character names from oscilloscope thread data
          ├─ Collects: selectedPassage, fullChapterTranslation,
          │            chapterNumber, characterNames, chapterTitle
          └─ POST to bridge endpoint
                    │
                    ▼
          novel-analyzer bridge (FastAPI, localhost:5001)
          ├─ git show <commit>:<path> for each character card (no checkout)
          │   └─ commit found via spoiler_control.find_commit_for_chapter()
          ├─ Parses markdown cards → ST V2 JSON via card_builder
          ├─ LLM call: selected passage + chapter context → scenario text
          ├─ ST API calls (localhost:8000):
          │   ├─ GET /csrf-token
          │   ├─ POST /api/characters/create (one per character)
          │   ├─ POST /api/worldinfo/edit (chapter as lorebook)
          │   └─ POST /api/groups/create (all characters, scenario set)
          └─ Returns { success, stUrl, groupId, charactersLoaded, charactersSkipped }
                    │
                    ▼
          LexiconForge opens new tab → SillyTavern group chat
          ST's own persona system provides the reader's identity
```

## Component 1: LexiconForge — Toolbar + Settings

### New settings fields

Added to `AppSettings` in `types.ts`:

```typescript
// SillyTavern self-insert integration
enableSillyTavern?: boolean;        // Feature gate (default: false)
sillyTavernBridgeUrl?: string;      // Bridge endpoint (default: "http://localhost:5001")
```

Follows existing patterns: `enableAudio`, `enableAmendments`.

### Settings panel

New section "SillyTavern Integration" in the settings UI:
- Toggle: Enable SillyTavern integration
- Text field: Bridge URL (with default value shown as placeholder)

### Selection toolbar changes

**FeedbackPopover (desktop)** and **SelectionSheet (mobile)** gain:

1. **Visual dividers** — thin `1px` vertical separators grouping icons by intent:
   - **React** — thumbs up, thumbs down, question mark
   - **Act** — paintbrush (illustrate), pencil (edit), magnifying glass (compare)
   - **Enter** — portal icon (new)

2. **Portal icon** — cyclone emoji, amber hover color (`#b45309`), tooltip: "Enter Story — Self-insert into SillyTavern". Only rendered when `settings.enableSillyTavern` is truthy.

### On portal icon click

1. Read `currentChapterId` and resolve `chapterNumber` from store
2. Read active character names: iterate the oscilloscope `threads` Map (not `availableThreads` — that's `ThreadMetadata[]` without `values`), filter entries where `category === 'character'` and `values[chapterNumber - 1] > 0`, extract `label` as character name
3. Read `chapterTranslation` from current chapter's `translationResult.translation`
4. Read `chapterTitle` — fallback chain: `translationResult.translatedTitle ?? chapter.title`
5. Get `selectedPassage` from the selection info already available in the overlay
6. POST to `${settings.sillyTavernBridgeUrl}/api/self-insert`:
   ```json
   {
     "chapterNumber": 750,
     "characterNames": ["Li Yao", "Ding Lingdang", "Wu Mayan"],
     "selectedPassage": "The formation plate shattered...",
     "chapterTranslation": "Full chapter text...",
     "chapterTitle": "Chapter 750: The Broken Formation"
   }
   ```
7. On success: `window.open(response.stUrl, '_blank')`
8. On error: show toast with error message

## Component 2: novel-analyzer — Bridge Service

### File: `bridge.py`

A FastAPI application with a single endpoint. Lives in the novel-analyzer directory alongside existing Python modules.

### Endpoint: `POST /api/self-insert`

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chapterNumber` | int | yes | Current chapter the reader is on |
| `characterNames` | string[] | yes | Characters active in this chapter (from oscilloscope) |
| `selectedPassage` | string | yes | The text the reader selected |
| `chapterTranslation` | string | yes | Full chapter translation text |
| `chapterTitle` | string | yes | Chapter title |

**Success response:**

```json
{
  "success": true,
  "stUrl": "http://localhost:8000",
  "groupId": "fmoc-ch750-1712345678",
  "charactersLoaded": ["Li Yao", "Ding Lingdang"],
  "charactersSkipped": ["Wu Mayan"]
}
```

**Error response:**

```json
{
  "success": false,
  "error": "sillytavern_unavailable | chapter_not_read | no_characters_found | bridge_error",
  "message": "Human-readable explanation"
}
```

### Internal pipeline

**Step 1 — Health check ST.** GET `localhost:8000/csrf-token`. If fails → return `sillytavern_unavailable` error.

**Step 2 — Resolve git commit.** Call `spoiler_control.find_commit_for_chapter(chapterNumber, log_lines)` against the Exocortex repo. If no commit found → return `chapter_not_read` error with the highest chapter covered.

**Step 3 — Read character cards.** For each name in `characterNames`, run:
```
git show <commit>:Library/Novels/Forty Millenniums of Cultivation/Character Cards/<name>.md
```
Non-destructive — no checkout. Characters whose file doesn't exist at that commit are added to `charactersSkipped`. If all characters are skipped → return `no_characters_found` error.

**Step 4 — Parse cards to ST V2 JSON.** Parse the markdown sections (Personality, Appearance, Background, Speech Style, Relationships, Scenario, First Message, Example Dialogues) and feed into `card_builder.build_v2_card()`.

**Step 5 — Generate scenario.** LLM call using novel-analyzer's `config.json` provider settings.

System prompt:
> You are a scene-setter for interactive fiction. Given a passage from a novel and a chapter title, write a brief scenario (2-3 paragraphs) that establishes the scene and naturally creates space for a new observer/participant to be present. Write in second person. Do not spoil events beyond this passage. Do not name the reader — use "you."

User prompt: the selected passage + chapter title.

**Fallback** if LLM call fails: template scenario:
> You find yourself in the middle of {chapterTitle}. {selectedPassage}

**Step 6 — Push to SillyTavern API.**

Sequence:
1. `GET localhost:8000/csrf-token` → extract token
2. For each character card: `POST /api/characters/create` with V2 JSON payload + CSRF token
3. `POST /api/worldinfo/edit` — create lorebook with chapter translation as a single `constant: true` entry:
   ```json
   {
     "name": "FMoC Ch750 Context",
     "entries": {
       "0": {
         "keys": [],
         "content": "<chapter translation text>",
         "constant": true,
         "position": 0
       }
     }
   }
   ```
4. `POST /api/groups/create`:
   ```json
   {
     "name": "FMoC Ch750 — <short chapter title>",
     "members": ["Li Yao", "Ding Lingdang"],
     "activation_strategy": 0,
     "generation_mode": 1,
     "allow_self_responses": true,
     "scenario": "<LLM-generated scenario>"
   }
   ```

**Step 7 — Return response** with ST URL and group metadata.

### Running the bridge

```bash
cd /Users/aditya/Documents/Ongoing\ Local/ST/novel-analyzer
python3 -m uvicorn bridge:app --port 5001
```

### Dependencies

Uses existing novel-analyzer modules:
- `spoiler_control` — `find_commit_for_chapter()`, `_get_novel_log()`
- `card_builder` — `build_v2_card()`
- `api_client` — LLM calls (or direct provider call)
- `config.json` — LLM provider settings, vault path, Exocortex repo path

New dependency: `fastapi`, `uvicorn` (add to `requirements.txt`).

CORS: bridge must configure `CORSMiddleware` to allow requests from LexiconForge's origin (typically `localhost:5173` in dev).

### Config additions

Add to `config.json`:

```json
{
  "sillytavern_url": "http://localhost:8000",
  "bridge_port": 5001,
  "exocortex_repo": "/Users/aditya/Library/CloudStorage/GoogleDrive-adityaprasadiskool@gmail.com/My Drive/Exocortex"
}
```

## Component 3: SillyTavern

**No code changes.** All interaction via existing REST API:
- `GET /csrf-token`
- `POST /api/characters/create`
- `POST /api/worldinfo/edit`
- `POST /api/groups/create`

ST's persona system automatically injects the reader's identity into prompts. The bridge does not read or modify persona settings.

## Error Handling

| Scenario | Detection | Response |
|----------|-----------|----------|
| ST not running | CSRF token fetch fails | Toast: "SillyTavern isn't running. Start it with `npm start` in the ST directory." |
| Bridge not running | LF fetch to bridge fails | Toast: "Self-insert bridge not available. Start it with `uvicorn bridge:app --port 5001` in novel-analyzer." |
| Chapter not read yet | No git commit covers chapter | Toast: "Chapter N hasn't been processed yet. Vault covers up to Ch M." |
| No characters found | All characters skipped (no cards at that commit) | Toast: "No character cards found for this chapter range." |
| LLM scenario fails | API error or timeout | Fallback to template: "You find yourself in the middle of {title}. {passage}" |
| Duplicate groups | N/A | Each call creates a new group (ID includes chapter + timestamp). User deletes old ones in ST. |

## Out of Scope (v1)

- **Auto-launch ST or bridge** — user starts both manually. Auto-launch ST is marked as future work.
- **Return path from ST to LF** — no "back to chapter" button in ST
- **Character avatar images** — cards have `avatar: "none"`. Image generation is future work.
- **Per-icon toolbar toggles** — just the `enableSillyTavern` feature gate
- **Keyword-triggered lorebook entries** — chapter text is a single constant entry
- **Chat continuity / resume** — each self-insert creates a fresh group chat
- **Multi-novel support** — hardcoded to FMoC vault paths

## Future Work

- **Auto-launch ST** — bridge checks port 8000, spawns `node server.js` if needed, waits for ready
- **Character avatars** — use the `Image Prompt` section in character cards to generate PNGs via Stable Diffusion
- **Smart lorebook** — break chapter text into keyword-triggered entries for better context efficiency
- **Chat continuity** — track group chat IDs per chapter, allow resuming
- **Multi-novel** — parameterize vault paths, allow novel selection
- **Return navigation** — ST plugin that adds a "Back to LexiconForge" link with chapter deep-link
