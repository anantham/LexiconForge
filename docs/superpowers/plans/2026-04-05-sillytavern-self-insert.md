# SillyTavern Self-Insert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let readers select a passage in the novel translation and "enter the story" via a SillyTavern group chat with all chapter characters, spoiler-controlled to the current chapter.

**Architecture:** LexiconForge adds a portal icon to the selection toolbar. On click, it POSTs context (chapter number, characters, selected text, chapter translation) to a FastAPI bridge in novel-analyzer. The bridge resolves character cards via git spoiler control, generates a scenario via LLM, pushes everything to SillyTavern's REST API, and returns the URL.

**Tech Stack:** TypeScript/React (LexiconForge), Python/FastAPI (bridge), SillyTavern REST API (no code changes)

**Spec:** `docs/superpowers/specs/2026-04-05-sillytavern-self-insert-design.md`

---

## File Map

### LexiconForge (modify)

| File | Change |
|------|--------|
| `types.ts:364` | Add `enableSillyTavern` and `sillyTavernBridgeUrl` to `AppSettings` |
| `services/sessionManagementService.ts:58` | Add defaults for new settings |
| `components/FeedbackPopover.tsx` | Add dividers, portal icon, `onSelfInsert` prop |
| `components/chapter/SelectionOverlay.tsx` | Thread `onSelfInsert` through `SelectionOverlayProps` and `SelectionSheet` |
| `components/ChapterView.tsx` | Wire `handleSelfInsert` — gather context, POST to bridge, open tab |
| `components/SettingsModal.tsx:51,71,183` | Add `'sillytavern'` panel ID, sidebar entry, panel render |
| `services/selfInsertService.ts` | New — thin fetch wrapper for bridge API |

### LexiconForge (create)

| File | Purpose |
|------|---------|
| `components/settings/SillyTavernPanel.tsx` | Settings panel with enable toggle + bridge URL field |
| `components/icons/PortalIcon.tsx` | SVG cyclone/portal icon component |

### novel-analyzer (create)

| File | Purpose |
|------|---------|
| `bridge.py` | FastAPI app with `POST /api/self-insert` endpoint |
| `card_parser.py` | Parse vault markdown cards into dicts for `card_builder.build_v2_card()` |
| `st_client.py` | SillyTavern REST API client (CSRF, characters, worldinfo, groups) |
| `tests/test_card_parser.py` | Tests for markdown → dict parsing |
| `tests/test_bridge.py` | Tests for bridge endpoint (mocked git + ST) |

### novel-analyzer (modify)

| File | Change |
|------|--------|
| `config.json` | Add `sillytavern_url`, `bridge_port`, `exocortex_repo` |
| `requirements.txt` | Add `fastapi`, `uvicorn` |

---

## Task 1: Card Parser (novel-analyzer)

Parses the vault's markdown character cards (`## Personality`, `## Appearance`, etc.) into dicts suitable for `card_builder.build_v2_card()`.

**Files:**
- Create: `ST/novel-analyzer/card_parser.py`
- Create: `ST/novel-analyzer/tests/test_card_parser.py`
- Reference: `ST/novel-analyzer/vault_upsert.py:57-68` (header order)
- Reference: `ST/novel-analyzer/card_builder.py:68-158` (build_v2_card signature)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_card_parser.py
"""Tests for card_parser — markdown vault cards → build_v2_card kwargs."""

from card_parser import parse_character_card


SAMPLE_CARD = """# Li Yao

## Personality
[Li Yao's Personality= "orphan scavenger", "crystal processor obsessive", "street-smart survivor"]

## Appearance
[Li Yao's body= "gaunt wiry frame", "dirty yellow windbreaker", "dark sharp eyes"]

## Background
Li Yao is an orphan raised in the Artifact Graveyard.

## Speech Style
Speaks with unfiltered bluntness of someone raised in a junkyard.

## Relationships
- [[Ding Lingdang]]: Romantic partner
- [[Ou Yezi]]: Spirit merged with Li Yao

## Cultivation Level
Refinement Stage

## Scenario
You are at the Artifact Graveyard near Floating Spear City.

## First Message
*The Artifact Graveyard at dusk looks like the skeleton of a civilization.*

"Graveyard's closed after dusk."

## Example Dialogues

**Exchange 1**

{{user}}: "That circuit board — is it really worth anything?"
{{char}}: "Garbage?" *His expression shifts.*

## Image Prompt
Not yet revealed
"""


def test_parse_extracts_name():
    result = parse_character_card(SAMPLE_CARD)
    assert result["name"] == "Li Yao"


def test_parse_extracts_personality_traits():
    result = parse_character_card(SAMPLE_CARD)
    assert "orphan scavenger" in result["personality_traits"]
    assert "crystal processor obsessive" in result["personality_traits"]
    assert len(result["personality_traits"]) == 3


def test_parse_extracts_appearance():
    result = parse_character_card(SAMPLE_CARD)
    assert isinstance(result["appearance"], dict)
    assert len(result["appearance"]) > 0


def test_parse_extracts_background():
    result = parse_character_card(SAMPLE_CARD)
    assert "orphan" in result["background"]


def test_parse_extracts_speech_style():
    result = parse_character_card(SAMPLE_CARD)
    assert "bluntness" in result["speech_style"]


def test_parse_extracts_relationships():
    result = parse_character_card(SAMPLE_CARD)
    assert "Ding Lingdang" in result["relationships"]
    assert "Romantic partner" in result["relationships"]["Ding Lingdang"]


def test_parse_extracts_scenario():
    result = parse_character_card(SAMPLE_CARD)
    assert "Artifact Graveyard" in result["scenario"]


def test_parse_extracts_first_message():
    result = parse_character_card(SAMPLE_CARD)
    assert "skeleton of a civilization" in result["first_message"]


def test_parse_extracts_example_dialogues():
    result = parse_character_card(SAMPLE_CARD)
    assert len(result["example_dialogues"]) >= 1


def test_parse_can_build_v2_card():
    """Integration: parsed result feeds directly into build_v2_card."""
    from card_builder import build_v2_card
    result = parse_character_card(SAMPLE_CARD)
    card = build_v2_card(**result)
    assert card["spec"] == "chara_card_v2"
    assert card["name"] == "Li Yao"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/aditya/Documents/Ongoing\ Local/ST/novel-analyzer && python3 -m pytest tests/test_card_parser.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'card_parser'`

- [ ] **Step 3: Implement card_parser.py**

```python
# card_parser.py
"""Parse vault markdown character cards into dicts for card_builder.build_v2_card()."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple


def _parse_sections(content: str) -> Dict[str, str]:
    """Split markdown into {header: body} dict. '_preamble' holds pre-## text."""
    sections: Dict[str, str] = {}
    current = "_preamble"
    lines: List[str] = []
    for line in content.split("\n"):
        if line.startswith("## "):
            sections[current] = "\n".join(lines)
            current = line[3:].strip()
            lines = []
        else:
            lines.append(line)
    sections[current] = "\n".join(lines)
    return sections


def _extract_name(preamble: str) -> str:
    """Extract character name from '# Name' header."""
    for line in preamble.split("\n"):
        line = line.strip()
        if line.startswith("# "):
            # Strip any [[wiki links]]
            name = line[2:].strip()
            name = re.sub(r"\[\[([^\]]+)\]\]", r"\1", name)
            # Strip trailing " — Reading Notes" or similar
            name = re.split(r"\s*[—–-]\s*", name)[0].strip()
            return name
    return "Unknown"


def _parse_wpp_list(text: str) -> List[str]:
    """Extract quoted items from W++ format: [Name's X= "a", "b", "c"]"""
    match = re.search(r'\[.*?=\s*(.*?)\]', text, re.DOTALL)
    if match:
        return [m.strip(' "\'') for m in re.findall(r'"([^"]*)"', match.group(1))]
    # Fallback: treat as plain text, split on commas
    return [t.strip(' "\'') for t in text.split(",") if t.strip()]


def _parse_wpp_appearance(text: str) -> Dict[str, str]:
    """Extract appearance from W++ format into numbered dict."""
    items = _parse_wpp_list(text)
    return {f"detail_{i}": item for i, item in enumerate(items)}


def _parse_relationships(text: str) -> Dict[str, str]:
    """Parse '- [[Name]]: description' or '- Name: description' lines."""
    rels: Dict[str, str] = {}
    for line in text.split("\n"):
        line = line.strip()
        if not line.startswith("- "):
            continue
        line = line[2:]
        # Strip [[ ]] wiki links
        line = re.sub(r"\[\[([^\]]+)\]\]", r"\1", line)
        if ":" in line:
            name, desc = line.split(":", 1)
            rels[name.strip()] = desc.strip()
    return rels


def _parse_example_dialogues(text: str) -> List[Tuple[str, str]]:
    """Parse example dialogues into (user_line, char_line) pairs.

    Looks for {{user}}: and {{char}}: patterns, or User: and CharName: patterns.
    """
    pairs: List[Tuple[str, str]] = []
    lines = text.strip().split("\n")
    user_line = ""
    char_lines: List[str] = []
    in_char = False

    for line in lines:
        stripped = line.strip()
        if re.match(r'(\{\{user\}\}|User):', stripped, re.IGNORECASE):
            # Save previous pair
            if user_line and char_lines:
                pairs.append((user_line, "\n".join(char_lines)))
            user_line = stripped
            char_lines = []
            in_char = False
        elif re.match(r'(\{\{char\}\}|[A-Z][a-z]+ [A-Z][a-z]+):', stripped):
            in_char = True
            char_lines = [stripped]
        elif in_char and stripped:
            char_lines.append(stripped)

    # Final pair
    if user_line and char_lines:
        pairs.append((user_line, "\n".join(char_lines)))

    return pairs


def parse_character_card(markdown: str) -> Dict[str, Any]:
    """Parse a vault markdown character card into kwargs for card_builder.build_v2_card().

    Returns dict with keys: name, personality_traits, appearance, background,
    speech_style, relationships, scenario, first_message, example_dialogues,
    talkativeness, creator_comment.
    """
    sections = _parse_sections(markdown)
    name = _extract_name(sections.get("_preamble", ""))

    personality_text = sections.get("Personality", "")
    personality_traits = _parse_wpp_list(personality_text) if personality_text.strip() else []

    appearance_text = sections.get("Appearance", "")
    appearance = _parse_wpp_appearance(appearance_text) if appearance_text.strip() else {}

    background = sections.get("Background", "").strip()
    # Strip <!-- markers -->
    background = re.sub(r"<!--.*?-->", "", background).strip()

    speech_style = sections.get("Speech Style", "").strip()
    speech_style = re.sub(r"<!--.*?-->", "", speech_style).strip()

    relationships = _parse_relationships(sections.get("Relationships", ""))

    scenario = sections.get("Scenario", "").strip()
    scenario = re.sub(r"<!--.*?-->", "", scenario).strip()

    first_message = sections.get("First Message", "").strip()
    first_message = re.sub(r"<!--.*?-->", "", first_message).strip()

    example_dialogues = _parse_example_dialogues(sections.get("Example Dialogues", ""))

    return {
        "name": name,
        "personality_traits": personality_traits,
        "appearance": appearance,
        "background": background,
        "speech_style": speech_style,
        "relationships": relationships,
        "scenario": scenario,
        "first_message": first_message,
        "example_dialogues": example_dialogues,
        "talkativeness": 0.7,
        "creator_comment": f"Auto-generated from vault card for {name}",
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/aditya/Documents/Ongoing\ Local/ST/novel-analyzer && python3 -m pytest tests/test_card_parser.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/aditya/Documents/Ongoing\ Local/ST/novel-analyzer
git add card_parser.py tests/test_card_parser.py
git commit -m "feat: card_parser — parse vault markdown cards into ST V2 card kwargs"
```

---

## Task 2: SillyTavern API Client (novel-analyzer)

Thin client for ST's REST API: CSRF token, character creation, world info, group creation.

**Files:**
- Create: `ST/novel-analyzer/st_client.py`
- Create: `ST/novel-analyzer/tests/test_st_client.py`
- Reference: `ST/SillyTavern/src/endpoints/characters.js` (character create API)
- Reference: `ST/SillyTavern/src/endpoints/groups.js` (group create API)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_st_client.py
"""Tests for st_client — SillyTavern REST API client."""

import json
from unittest.mock import patch, MagicMock
import pytest
from st_client import STClient, STUnavailableError


@pytest.fixture
def client():
    return STClient(base_url="http://localhost:8000")


class TestHealthCheck:
    def test_healthy_returns_true(self, client):
        with patch("st_client.httpx") as mock_httpx:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.text = "abc123"
            mock_httpx.get.return_value = mock_resp
            assert client.health_check() is True

    def test_unhealthy_returns_false(self, client):
        with patch("st_client.httpx") as mock_httpx:
            mock_httpx.get.side_effect = Exception("Connection refused")
            assert client.health_check() is False


class TestGetCsrf:
    def test_returns_token(self, client):
        with patch("st_client.httpx") as mock_httpx:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {"token": "csrf123"}
            mock_resp.cookies = {"_csrf": "cookie123"}
            mock_httpx.get.return_value = mock_resp
            token, cookies = client.get_csrf()
            assert token == "csrf123"


class TestCreateCharacter:
    def test_sends_v2_card(self, client):
        card = {"spec": "chara_card_v2", "name": "Li Yao", "data": {}}
        with patch.object(client, "get_csrf", return_value=("tok", {})):
            with patch("st_client.httpx") as mock_httpx:
                mock_resp = MagicMock()
                mock_resp.status_code = 200
                mock_resp.json.return_value = {"file_name": "Li Yao.png"}
                mock_httpx.post.return_value = mock_resp
                result = client.create_character(card)
                assert result["file_name"] == "Li Yao.png"


class TestCreateGroup:
    def test_creates_group_with_members(self, client):
        with patch.object(client, "get_csrf", return_value=("tok", {})):
            with patch("st_client.httpx") as mock_httpx:
                mock_resp = MagicMock()
                mock_resp.status_code = 200
                mock_resp.json.return_value = {"id": "group-123"}
                mock_httpx.post.return_value = mock_resp
                result = client.create_group(
                    name="Test Group",
                    members=["Li Yao", "Ding Lingdang"],
                    scenario="A test scenario.",
                )
                assert result["id"] == "group-123"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/aditya/Documents/Ongoing\ Local/ST/novel-analyzer && python3 -m pytest tests/test_st_client.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'st_client'`

- [ ] **Step 3: Implement st_client.py**

```python
# st_client.py
"""SillyTavern REST API client."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

import httpx


class STUnavailableError(Exception):
    """Raised when SillyTavern is not reachable."""
    pass


class STClient:
    """Thin client for SillyTavern's REST API."""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip("/")

    def health_check(self) -> bool:
        """Check if ST is running by hitting the CSRF endpoint."""
        try:
            resp = httpx.get(f"{self.base_url}/csrf-token", timeout=5.0)
            return resp.status_code == 200
        except Exception:
            return False

    def get_csrf(self) -> Tuple[str, dict]:
        """Fetch CSRF token. Returns (token_string, cookies_dict)."""
        try:
            resp = httpx.get(f"{self.base_url}/csrf-token", timeout=5.0)
            resp.raise_for_status()
            token = resp.json().get("token", "")
            cookies = dict(resp.cookies)
            return token, cookies
        except Exception as e:
            raise STUnavailableError(f"Cannot reach SillyTavern at {self.base_url}: {e}")

    def _post(self, path: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """POST with CSRF token."""
        token, cookies = self.get_csrf()
        resp = httpx.post(
            f"{self.base_url}{path}",
            headers={
                "Content-Type": "application/json",
                "X-CSRF-Token": token,
            },
            cookies=cookies,
            content=json.dumps(data),
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json() if resp.text else {}

    def create_character(self, card: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update a character card in ST."""
        return self._post("/api/characters/create", card)

    def create_worldinfo(self, name: str, content: str) -> Dict[str, Any]:
        """Create a world info lorebook with a single constant entry."""
        return self._post("/api/worldinfo/edit", {
            "name": name,
            "entries": {
                "0": {
                    "keys": [],
                    "content": content,
                    "constant": True,
                    "comment": f"Auto-injected by LexiconForge self-insert",
                    "selective": False,
                    "case_sensitive": False,
                    "match_whole_words": False,
                    "position": 0,
                    "enabled": True,
                }
            },
        })

    def create_group(
        self,
        name: str,
        members: List[str],
        scenario: str,
        activation_strategy: int = 0,
        generation_mode: int = 1,
    ) -> Dict[str, Any]:
        """Create a group chat with the given characters."""
        return self._post("/api/groups/create", {
            "name": name,
            "members": members,
            "activation_strategy": activation_strategy,
            "generation_mode": generation_mode,
            "allow_self_responses": True,
            "scenario": scenario,
        })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/aditya/Documents/Ongoing\ Local/ST/novel-analyzer && python3 -m pytest tests/test_st_client.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/aditya/Documents/Ongoing\ Local/ST/novel-analyzer
git add st_client.py tests/test_st_client.py
git commit -m "feat: st_client — SillyTavern REST API client for self-insert bridge"
```

---

## Task 3: Bridge Service (novel-analyzer)

The FastAPI endpoint that orchestrates everything: git spoiler control → card parsing → LLM scenario → ST API.

**Files:**
- Create: `ST/novel-analyzer/bridge.py`
- Create: `ST/novel-analyzer/tests/test_bridge.py`
- Modify: `ST/novel-analyzer/config.json`
- Modify: `ST/novel-analyzer/requirements.txt`
- Reference: `ST/novel-analyzer/spoiler_control.py:20-58` (find_commit_for_chapter, parse_chapter_range)
- Reference: `ST/novel-analyzer/api_client.py:27-86` (APIClient.chat)
- Reference: `ST/novel-analyzer/card_builder.py:68-158` (build_v2_card)

- [ ] **Step 1: Add dependencies**

Append to `requirements.txt`:
```
fastapi>=0.115.0
uvicorn>=0.34.0
```

Add to `config.json`:
```json
{
  "sillytavern_url": "http://localhost:8000",
  "bridge_port": 5001,
  "exocortex_repo": "/Users/aditya/Library/CloudStorage/GoogleDrive-adityaprasadiskool@gmail.com/My Drive/Exocortex"
}
```

Run: `cd /Users/aditya/Documents/Ongoing\ Local/ST/novel-analyzer && pip install fastapi uvicorn`

- [ ] **Step 2: Write the failing test**

```python
# tests/test_bridge.py
"""Tests for bridge — FastAPI self-insert endpoint."""

import json
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient
from bridge import app


@pytest.fixture
def client():
    return TestClient(app)


SAMPLE_CARD_MD = """# Li Yao

## Personality
[Li Yao's Personality= "brave", "stubborn"]

## Appearance
[Li Yao's body= "wiry frame"]

## Background
An orphan scavenger.

## Speech Style
Blunt and direct.

## Relationships
- Ding Lingdang: partner

## Cultivation Level
Refinement Stage

## Scenario
A junkyard scene.

## First Message
*Li Yao looks up.*

## Example Dialogues
Not yet revealed

## Image Prompt
Not yet revealed
"""


def _mock_git_log():
    return ["abc1234 novel(fmoc): read Ch 700-750 — exploration"]


def _mock_git_show(commit, path):
    if "Li Yao" in path:
        return SAMPLE_CARD_MD
    raise FileNotFoundError(f"Not found: {path}")


class TestSelfInsertEndpoint:
    def test_success_flow(self, client):
        """Full happy path with mocked git + ST + LLM."""
        with patch("bridge._get_novel_log", return_value=_mock_git_log()), \
             patch("bridge._git_show_file", side_effect=lambda c, p, r: _mock_git_show(c, p)), \
             patch("bridge._generate_scenario", return_value="You stand in the graveyard."), \
             patch("bridge._push_to_sillytavern", return_value={"group_id": "g123"}):

            resp = client.post("/api/self-insert", json={
                "chapterNumber": 720,
                "characterNames": ["Li Yao", "Unknown Character"],
                "selectedPassage": "The formation shattered.",
                "chapterTranslation": "Full chapter text...",
                "chapterTitle": "Chapter 720",
            })
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True
            assert "Li Yao" in data["charactersLoaded"]
            assert "Unknown Character" in data["charactersSkipped"]

    def test_st_unavailable(self, client):
        with patch("bridge._get_novel_log", return_value=_mock_git_log()), \
             patch("bridge._git_show_file", side_effect=lambda c, p, r: _mock_git_show(c, p)), \
             patch("bridge._generate_scenario", return_value="A scene."), \
             patch("bridge._push_to_sillytavern", side_effect=Exception("Connection refused")):

            resp = client.post("/api/self-insert", json={
                "chapterNumber": 720,
                "characterNames": ["Li Yao"],
                "selectedPassage": "Text.",
                "chapterTranslation": "Chapter.",
                "chapterTitle": "Ch 720",
            })
            data = resp.json()
            assert data["success"] is False
            assert data["error"] == "sillytavern_unavailable"

    def test_chapter_not_read(self, client):
        with patch("bridge._get_novel_log", return_value=_mock_git_log()):
            resp = client.post("/api/self-insert", json={
                "chapterNumber": 900,
                "characterNames": ["Li Yao"],
                "selectedPassage": "Text.",
                "chapterTranslation": "Chapter.",
                "chapterTitle": "Ch 900",
            })
            data = resp.json()
            assert data["success"] is False
            assert data["error"] == "chapter_not_read"

    def test_no_characters_found(self, client):
        with patch("bridge._get_novel_log", return_value=_mock_git_log()), \
             patch("bridge._git_show_file", side_effect=FileNotFoundError("nope")):
            resp = client.post("/api/self-insert", json={
                "chapterNumber": 720,
                "characterNames": ["Nobody"],
                "selectedPassage": "Text.",
                "chapterTranslation": "Chapter.",
                "chapterTitle": "Ch 720",
            })
            data = resp.json()
            assert data["success"] is False
            assert data["error"] == "no_characters_found"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/aditya/Documents/Ongoing\ Local/ST/novel-analyzer && python3 -m pytest tests/test_bridge.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'bridge'`

- [ ] **Step 4: Implement bridge.py**

```python
# bridge.py
"""FastAPI bridge service — LexiconForge self-insert into SillyTavern."""

from __future__ import annotations

import json
import os
import subprocess
import time
from typing import Any, Dict, List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from card_parser import parse_character_card
from card_builder import build_v2_card
from spoiler_control import find_commit_for_chapter
from st_client import STClient, STUnavailableError

app = FastAPI(title="LexiconForge Self-Insert Bridge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # LF dev server; tighten in production
    allow_methods=["POST"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def _load_config() -> Dict[str, Any]:
    config_path = os.path.join(os.path.dirname(__file__), "config.json")
    with open(config_path) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Git helpers
# ---------------------------------------------------------------------------

def _get_novel_log(repo_path: str) -> List[str]:
    """Get git log of novel read commits."""
    result = subprocess.run(
        ["git", "log", "--oneline", "--grep=novel(fmoc): read"],
        cwd=repo_path,
        capture_output=True,
        text=True,
        check=True,
    )
    return [line for line in result.stdout.splitlines() if line.strip()]


def _git_show_file(commit: str, file_path: str, repo_path: str) -> str:
    """Read a file from a specific git commit without checkout."""
    result = subprocess.run(
        ["git", "show", f"{commit}:{file_path}"],
        cwd=repo_path,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise FileNotFoundError(
            f"File not found at commit {commit}: {file_path}"
        )
    return result.stdout


# ---------------------------------------------------------------------------
# LLM scenario generation
# ---------------------------------------------------------------------------

SCENARIO_SYSTEM_PROMPT = (
    "You are a scene-setter for interactive fiction. Given a passage from a "
    "novel and a chapter title, write a brief scenario (2-3 paragraphs) that "
    "establishes the scene and naturally creates space for a new "
    "observer/participant to be present. Write in second person. Do not spoil "
    "events beyond this passage. Do not name the reader — use 'you.'"
)


def _generate_scenario(
    selected_passage: str,
    chapter_title: str,
    config: Dict[str, Any],
) -> str:
    """Generate a scenario via LLM, with template fallback."""
    try:
        from api_client import APIClient

        api_cfg = config["api"]
        api_key = os.environ.get(api_cfg["api_key_env"], "")
        if not api_key:
            raise ValueError(f"API key env var {api_cfg['api_key_env']} not set")

        client = APIClient(
            base_url=api_cfg["base_url"],
            api_key=api_key,
            cost_log_path=os.path.join(
                os.path.dirname(__file__), config.get("vault_path", "."), "_cost_log.jsonl"
            ),
        )
        model = api_cfg["models"].get("sonnet", api_cfg["models"].get("opus"))
        result = client.chat(
            model=model,
            messages=[{
                "role": "user",
                "content": f"Chapter: {chapter_title}\n\nPassage:\n{selected_passage}",
            }],
            system=SCENARIO_SYSTEM_PROMPT,
            phase="self-insert",
            task="scenario-generation",
            temperature=0.8,
            max_tokens=1024,
        )
        return result["content"]
    except Exception as e:
        # Fallback template
        return f"You find yourself in the middle of {chapter_title}. {selected_passage}"


# ---------------------------------------------------------------------------
# SillyTavern push
# ---------------------------------------------------------------------------

def _push_to_sillytavern(
    st_url: str,
    characters: List[Dict[str, Any]],
    chapter_title: str,
    chapter_number: int,
    chapter_translation: str,
    scenario: str,
) -> Dict[str, Any]:
    """Push characters, world info, and group chat to SillyTavern."""
    st = STClient(base_url=st_url)

    if not st.health_check():
        raise STUnavailableError(f"SillyTavern not running at {st_url}")

    # Create characters
    member_names = []
    for card in characters:
        st.create_character(card)
        member_names.append(card["name"])

    # Create world info
    wi_name = f"FMoC Ch{chapter_number} Context"
    st.create_worldinfo(wi_name, chapter_translation)

    # Create group
    group_name = f"FMoC Ch{chapter_number} — {chapter_title[:40]}"
    group_result = st.create_group(
        name=group_name,
        members=member_names,
        scenario=scenario,
    )

    return {"group_id": group_result.get("id", f"fmoc-ch{chapter_number}-{int(time.time())}")}


# ---------------------------------------------------------------------------
# API endpoint
# ---------------------------------------------------------------------------

class SelfInsertRequest(BaseModel):
    chapterNumber: int
    characterNames: List[str]
    selectedPassage: str
    chapterTranslation: str
    chapterTitle: str


@app.post("/api/self-insert")
def self_insert(req: SelfInsertRequest):
    config = _load_config()
    repo_path = config.get(
        "exocortex_repo",
        config.get("vault_path", ".")
    )
    st_url = config.get("sillytavern_url", "http://localhost:8000")
    novel_vault_prefix = "Library/Novels/Forty Millenniums of Cultivation"

    # Step 1: Resolve git commit
    try:
        log_lines = _get_novel_log(repo_path)
    except subprocess.CalledProcessError:
        return {"success": False, "error": "bridge_error", "message": "Failed to read git log from Exocortex repo."}

    commit = find_commit_for_chapter(req.chapterNumber, log_lines)
    if not commit:
        # Find highest covered chapter for the error message
        max_ch = 0
        import re
        for line in log_lines:
            m = re.search(r"Ch (\d+)-(\d+)", line)
            if m:
                max_ch = max(max_ch, int(m.group(2)))
        return {
            "success": False,
            "error": "chapter_not_read",
            "message": f"Chapter {req.chapterNumber} hasn't been processed yet. Vault covers up to Ch {max_ch}.",
        }

    # Step 2: Read character cards from git
    loaded_cards = []
    skipped = []
    for name in req.characterNames:
        card_path = f"{novel_vault_prefix}/Character Cards/{name}.md"
        try:
            md = _git_show_file(commit, card_path, repo_path)
            parsed = parse_character_card(md)
            v2_card = build_v2_card(**parsed)
            loaded_cards.append(v2_card)
        except (FileNotFoundError, Exception):
            skipped.append(name)

    if not loaded_cards:
        return {
            "success": False,
            "error": "no_characters_found",
            "message": f"No character cards found for chapter {req.chapterNumber}.",
        }

    # Step 3: Generate scenario
    scenario = _generate_scenario(req.selectedPassage, req.chapterTitle, config)

    # Step 4: Push to SillyTavern
    try:
        push_result = _push_to_sillytavern(
            st_url=st_url,
            characters=loaded_cards,
            chapter_title=req.chapterTitle,
            chapter_number=req.chapterNumber,
            chapter_translation=req.chapterTranslation,
            scenario=scenario,
        )
    except (STUnavailableError, Exception) as e:
        return {
            "success": False,
            "error": "sillytavern_unavailable",
            "message": f"SillyTavern is not running on {st_url}. Start it with `npm start` in the ST directory.",
        }

    return {
        "success": True,
        "stUrl": st_url,
        "groupId": push_result["group_id"],
        "charactersLoaded": [c["name"] for c in loaded_cards],
        "charactersSkipped": skipped,
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/aditya/Documents/Ongoing\ Local/ST/novel-analyzer && python3 -m pytest tests/test_bridge.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/aditya/Documents/Ongoing\ Local/ST/novel-analyzer
git add bridge.py tests/test_bridge.py config.json requirements.txt
git commit -m "feat: bridge service — FastAPI self-insert endpoint for LexiconForge → SillyTavern"
```

---

## Task 4: LexiconForge — Types & Settings Defaults

Add the new settings fields and their defaults.

**Files:**
- Modify: `LexiconForge/types.ts:364` (before closing brace of AppSettings)
- Modify: `LexiconForge/services/sessionManagementService.ts:58` (after `enableAudio: false`)

- [ ] **Step 1: Add settings fields to AppSettings**

In `types.ts`, add before the closing `}` of `AppSettings` (after line 364):

```typescript
    // SillyTavern self-insert integration
    enableSillyTavern?: boolean;            // Feature gate (default: false)
    sillyTavernBridgeUrl?: string;          // Bridge endpoint URL (default: "http://localhost:5001")
```

- [ ] **Step 2: Add defaults in sessionManagementService.ts**

In `services/sessionManagementService.ts`, add after `enableAudio: false,` (line 58):

```typescript
    enableSillyTavern: false,
    sillyTavernBridgeUrl: 'http://localhost:5001',
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/aditya/Documents/Ongoing\ Local/LexiconForge && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
cd /Users/aditya/Documents/Ongoing\ Local/LexiconForge
git add types.ts services/sessionManagementService.ts
git commit -m "feat: add enableSillyTavern and sillyTavernBridgeUrl to AppSettings"
```

---

## Task 5: LexiconForge — Self-Insert Service

Thin fetch wrapper that POSTs to the bridge and returns the result.

**Files:**
- Create: `LexiconForge/services/selfInsertService.ts`

- [ ] **Step 1: Create the service**

```typescript
// services/selfInsertService.ts
/**
 * Self-insert service — calls the novel-analyzer bridge to set up
 * a SillyTavern group chat for the current chapter.
 */

export interface SelfInsertRequest {
  chapterNumber: number;
  characterNames: string[];
  selectedPassage: string;
  chapterTranslation: string;
  chapterTitle: string;
}

export interface SelfInsertResponse {
  success: boolean;
  stUrl?: string;
  groupId?: string;
  charactersLoaded?: string[];
  charactersSkipped?: string[];
  error?: string;
  message?: string;
}

export async function requestSelfInsert(
  bridgeUrl: string,
  request: SelfInsertRequest,
): Promise<SelfInsertResponse> {
  const resp = await fetch(`${bridgeUrl}/api/self-insert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!resp.ok) {
    return {
      success: false,
      error: 'bridge_error',
      message: `Bridge returned ${resp.status}: ${resp.statusText}`,
    };
  }

  return resp.json();
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/aditya/Documents/Ongoing\ Local/LexiconForge
git add services/selfInsertService.ts
git commit -m "feat: selfInsertService — fetch wrapper for bridge API"
```

---

## Task 6: LexiconForge — Portal Icon Component

SVG icon matching the existing icon component pattern (ThumbsUpIcon, PencilIcon, etc.).

**Files:**
- Create: `LexiconForge/components/icons/PortalIcon.tsx`
- Reference: `LexiconForge/components/icons/CompareIcon.tsx` (pattern)

- [ ] **Step 1: Check existing icon pattern**

Run: `ls /Users/aditya/Documents/Ongoing\ Local/LexiconForge/components/icons/`

- [ ] **Step 2: Create PortalIcon**

```typescript
// components/icons/PortalIcon.tsx
import React from 'react';

interface PortalIconProps {
  className?: string;
}

const PortalIcon: React.FC<PortalIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Spiral/portal shape */}
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9c2.12 0 4.07-.74 5.6-1.97"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5c1.18 0 2.27-.41 3.12-1.1"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 10a2 2 0 100 4 2 2 0 000-4z"
    />
    {/* Entry arrow */}
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 7l4 4-4 4M21 11h-6"
    />
  </svg>
);

export default PortalIcon;
```

- [ ] **Step 3: Commit**

```bash
cd /Users/aditya/Documents/Ongoing\ Local/LexiconForge
git add components/icons/PortalIcon.tsx
git commit -m "feat: PortalIcon SVG component for self-insert toolbar button"
```

---

## Task 7: LexiconForge — FeedbackPopover with Dividers + Portal Icon

Add visual dividers grouping icons by intent, and the portal icon gated by `enableSillyTavern`.

**Files:**
- Modify: `LexiconForge/components/FeedbackPopover.tsx`
- Reference: `LexiconForge/components/FeedbackPopover.tsx:11-19` (props interface)
- Reference: `LexiconForge/components/FeedbackPopover.tsx:90-120` (icon buttons)

- [ ] **Step 1: Add onSelfInsert prop**

In `FeedbackPopover.tsx`, add to the `FeedbackPopoverProps` interface (line 19):

```typescript
  onSelfInsert?: () => void;
  enableSillyTavern?: boolean;
```

Add to the destructured props in the component function.

- [ ] **Step 2: Add dividers and portal icon to the button group**

Replace the flat button group (lines 90-120) with grouped layout:

```tsx
      <div className="flex items-center gap-1 p-2">
        {/* React group */}
        <button onClick={() => handleEmojiClick('👍')} className="p-2 rounded-full hover:bg-green-600 transition-colors duration-200">
          <ThumbsUpIcon className="w-5 h-5" />
        </button>
        <button onClick={() => handleEmojiClick('👎')} className="p-2 rounded-full hover:bg-red-600 transition-colors duration-200">
          <ThumbsDownIcon className="w-5 h-5" />
        </button>
        <button onClick={() => handleEmojiClick('?')} className="p-2 rounded-full hover:bg-blue-600 transition-colors duration-200">
          <QuestionMarkIcon className="w-5 h-5" />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-600 mx-0.5" />

        {/* Act group */}
        <button onClick={() => handleEmojiClick('🎨')} className="p-2 rounded-full hover:bg-purple-600 transition-colors duration-200">
          <PaintBrushIcon className="w-5 h-5" />
        </button>
        <button onClick={onEdit} className="p-2 rounded-full hover:bg-blue-500 transition-colors duration-200" title="Edit selection">
          <PencilIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => { if (canCompare) onCompare(); }}
          className={`p-2 rounded-full transition-colors duration-200 ${canCompare ? 'hover:bg-teal-600' : 'opacity-40 cursor-not-allowed'}`}
          title={canCompare ? 'Compare with fan translation' : 'Comparison unavailable'}
          disabled={!canCompare}
        >
          <CompareIcon className="w-5 h-5" />
        </button>

        {/* Enter group — only if SillyTavern enabled */}
        {enableSillyTavern && onSelfInsert && (
          <>
            <div className="w-px h-5 bg-gray-600 mx-0.5" />
            <button
              onClick={onSelfInsert}
              className="p-2 rounded-full hover:bg-amber-700 transition-colors duration-200"
              title="Enter Story — Self-insert into SillyTavern"
            >
              <PortalIcon className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
```

Add import at top: `import PortalIcon from './icons/PortalIcon';`

- [ ] **Step 3: Verify build**

Run: `cd /Users/aditya/Documents/Ongoing\ Local/LexiconForge && npx tsc --noEmit`
Expected: No type errors (there will be callers not passing the new props yet — that's OK since they're optional)

- [ ] **Step 4: Commit**

```bash
cd /Users/aditya/Documents/Ongoing\ Local/LexiconForge
git add components/FeedbackPopover.tsx
git commit -m "feat: FeedbackPopover — add dividers, portal icon, onSelfInsert prop"
```

---

## Task 8: LexiconForge — SelectionOverlay + SelectionSheet with Portal

Thread the `onSelfInsert` and `enableSillyTavern` props through both overlays.

**Files:**
- Modify: `LexiconForge/components/chapter/SelectionOverlay.tsx`
- Modify: `LexiconForge/components/chapter/ChapterSelectionOverlay.tsx`

- [ ] **Step 1: Update SelectionOverlayProps**

In `SelectionOverlay.tsx`, add to `SelectionOverlayProps` (after line 21):

```typescript
  onSelfInsert?: () => void;
  enableSillyTavern?: boolean;
```

Pass these through to `FeedbackPopover` and `SelectionSheet`.

- [ ] **Step 2: Update SelectionSheet**

Add to `SelectionSheetProps`:

```typescript
  onSelfInsert?: () => void;
  enableSillyTavern?: boolean;
```

In the `SelectionSheet` emoji buttons div, add after the `🔍` button:

```tsx
{enableSillyTavern && onSelfInsert && (
  <>
    <div style={{width: 1, height: 28, background: '#374151'}} />
    <button className="p-3 text-xl" onClick={onSelfInsert} title="Enter Story">🌀</button>
  </>
)}
```

- [ ] **Step 3: Update ChapterSelectionOverlay**

In `ChapterSelectionOverlay.tsx`, add the new props to the `Props` interface and spread them through.

- [ ] **Step 4: Verify build**

Run: `cd /Users/aditya/Documents/Ongoing\ Local/LexiconForge && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
cd /Users/aditya/Documents/Ongoing\ Local/LexiconForge
git add components/chapter/SelectionOverlay.tsx components/chapter/ChapterSelectionOverlay.tsx
git commit -m "feat: thread onSelfInsert through SelectionOverlay and SelectionSheet"
```

---

## Task 9: LexiconForge — ChapterView Wiring

Connect the portal icon click to the full self-insert flow: gather context, call bridge, open ST.

**Files:**
- Modify: `LexiconForge/components/ChapterView.tsx`
- Reference: `LexiconForge/components/ChapterView.tsx:69` (showNotification)
- Reference: `LexiconForge/components/ChapterView.tsx:380-393` (prop assembly)
- Reference: `LexiconForge/store/slices/oscilloscopeSlice.ts` (threads Map)

- [ ] **Step 1: Add handleSelfInsert callback**

In `ChapterView.tsx`, add after the existing `useCallback` hooks (around line 266):

```typescript
import { requestSelfInsert } from '../services/selfInsertService';

// ... inside the component:

const threads = useAppStore(s => s.threads);

const handleSelfInsert = useCallback(async () => {
  if (!currentChapterId || !chapter) {
    showNotification('No chapter loaded', 'warning');
    return;
  }

  const chapterNumber = chapter.chapterNumber;
  if (!chapterNumber) {
    showNotification('Chapter number not available', 'warning');
    return;
  }

  const translation = chapter.translationResult?.translation;
  if (!translation) {
    showNotification('No translation available for this chapter', 'warning');
    return;
  }

  const chapterTitle = chapter.translationResult?.translatedTitle ?? chapter.title;
  const selectedText = selection?.text ?? '';
  if (!selectedText) {
    showNotification('Select a passage to enter the story at', 'info');
    return;
  }

  // Get character names from oscilloscope threads active at this chapter
  const characterNames: string[] = [];
  for (const [, thread] of threads) {
    if (thread.category === 'character' && thread.values[chapterNumber - 1] > 0) {
      characterNames.push(thread.label);
    }
  }

  if (characterNames.length === 0) {
    showNotification('No characters detected in this chapter', 'warning');
    return;
  }

  const bridgeUrl = settings.sillyTavernBridgeUrl || 'http://localhost:5001';

  showNotification('Setting up your story entry...', 'info');

  try {
    const result = await requestSelfInsert(bridgeUrl, {
      chapterNumber,
      characterNames,
      selectedPassage: selectedText,
      chapterTranslation: translation,
      chapterTitle: chapterTitle,
    });

    if (result.success && result.stUrl) {
      window.open(result.stUrl, '_blank');
      const loaded = result.charactersLoaded?.join(', ') ?? '';
      showNotification(`Entered story with ${loaded}`, 'success');
    } else {
      showNotification(result.message || 'Failed to set up story entry', 'error');
    }
  } catch (e) {
    showNotification(
      'Self-insert bridge not available. Start it with `uvicorn bridge:app --port 5001` in novel-analyzer.',
      'error'
    );
  }
}, [currentChapterId, chapter, threads, settings, selection, showNotification]);
```

- [ ] **Step 2: Pass to the selection overlay props**

In the props assembly object (around line 380-393), add:

```typescript
    onSelfInsert: settings.enableSillyTavern ? handleSelfInsert : undefined,
    enableSillyTavern: settings.enableSillyTavern,
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/aditya/Documents/Ongoing\ Local/LexiconForge && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
cd /Users/aditya/Documents/Ongoing\ Local/LexiconForge
git add components/ChapterView.tsx
git commit -m "feat: wire handleSelfInsert — gather context, call bridge, open ST"
```

---

## Task 10: LexiconForge — Settings Panel

Add the "SillyTavern Integration" panel to the settings modal.

**Files:**
- Create: `LexiconForge/components/settings/SillyTavernPanel.tsx`
- Modify: `LexiconForge/components/SettingsModal.tsx`

- [ ] **Step 1: Create SillyTavernPanel**

```typescript
// components/settings/SillyTavernPanel.tsx
import React from 'react';
import { useSettingsModalContext } from './SettingsModalContext';

const SillyTavernPanel: React.FC = () => {
  const { currentSettings, handleSettingChange } = useSettingsModalContext();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          SillyTavern Integration
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Select a passage and enter the story as a participant via SillyTavern group chat.
          Requires the novel-analyzer bridge and SillyTavern to be running.
        </p>
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={currentSettings.enableSillyTavern ?? false}
            onChange={(e) => handleSettingChange('enableSillyTavern', e.target.checked)}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <div>
            <span className="block font-medium text-gray-800 dark:text-gray-100">
              Enable self-insert
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
              Shows a portal icon in the selection toolbar. Click it to enter the story at the selected passage.
            </span>
          </div>
        </label>
      </div>

      {currentSettings.enableSillyTavern && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bridge URL
          </label>
          <input
            type="text"
            value={currentSettings.sillyTavernBridgeUrl ?? ''}
            onChange={(e) => handleSettingChange('sillyTavernBridgeUrl', e.target.value)}
            placeholder="http://localhost:5001"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            The novel-analyzer bridge endpoint. Start it with: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">uvicorn bridge:app --port 5001</code>
          </p>
        </div>
      )}
    </div>
  );
};

export default SillyTavernPanel;
```

- [ ] **Step 2: Wire into SettingsModal**

In `SettingsModal.tsx`:

a. Add import: `import SillyTavernPanel from './settings/SillyTavernPanel';`

b. Add `'sillytavern'` to the `SettingsPanelId` type (line 51):
```typescript
type SettingsPanelId = 'providers' | 'prompt' | 'advanced' | 'display' | 'audio' | 'diff' | 'templates' | 'metadata' | 'gallery' | 'export' | 'sillytavern';
```

c. Add sidebar entry in the `features` section (after the `diff` item, around line 73):
```typescript
{ id: 'sillytavern', label: 'SillyTavern' },
```

d. Add panel render (after the `diff` panel render, around line 184):
```typescript
{activePanel === 'sillytavern' && <SillyTavernPanel />}
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/aditya/Documents/Ongoing\ Local/LexiconForge && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
cd /Users/aditya/Documents/Ongoing\ Local/LexiconForge
git add components/settings/SillyTavernPanel.tsx components/SettingsModal.tsx
git commit -m "feat: SillyTavern settings panel with enable toggle and bridge URL"
```

---

## Task 11: End-to-End Manual Test

Verify the full flow works with real services.

**Files:** None (testing only)

- [ ] **Step 1: Start SillyTavern**

```bash
cd /Users/aditya/Documents/Ongoing\ Local/ST/SillyTavern && npm start
```

Verify: opens browser at `http://localhost:8000`

- [ ] **Step 2: Start the bridge**

```bash
cd /Users/aditya/Documents/Ongoing\ Local/ST/novel-analyzer && python3 -m uvicorn bridge:app --port 5001 --reload
```

Verify: `curl http://localhost:5001/docs` returns the FastAPI docs page

- [ ] **Step 3: Enable in LexiconForge**

1. Open LexiconForge in browser
2. Go to Settings → Features → SillyTavern
3. Toggle "Enable self-insert" ON
4. Verify bridge URL shows `http://localhost:5001`
5. Save settings

- [ ] **Step 4: Test the flow**

1. Navigate to a chapter that has been processed by the novel-reader pipeline
2. Select a passage of text in the translation
3. Verify the portal icon appears in the selection toolbar (after the divider)
4. Click the portal icon
5. Verify: toast shows "Setting up your story entry..."
6. Verify: SillyTavern opens in a new tab with a group chat
7. Verify: group chat has the correct characters
8. Verify: scenario text references the selected passage
9. Start chatting — verify the characters respond in-character

- [ ] **Step 5: Test error cases**

1. Stop SillyTavern → click portal → verify toast: "SillyTavern isn't running..."
2. Stop bridge → click portal → verify toast: "Self-insert bridge not available..."
3. Navigate to a chapter beyond what's been processed → click portal → verify toast about chapter coverage
4. Disable the feature in settings → verify portal icon disappears

- [ ] **Step 6: Final commit**

```bash
cd /Users/aditya/Documents/Ongoing\ Local/LexiconForge
git add -A
git commit -m "feat: SillyTavern self-insert — complete integration"
```
