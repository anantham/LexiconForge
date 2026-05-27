#!/usr/bin/env python3
"""Drive Gemini (regular chat or Deep Research) using GEO's persistent
browser state at ~/.atlas/browser-state/gemini.google.com/.

This is the *Path B* implementation referenced in the agent automation plan.
The persistent context inherits the user's already-authenticated Gemini
session — no fresh sign-in, full account features available.

Usage:
    uv run --with playwright scripts/gemini_research.py \\
        --prompt-file PROMPT.md \\
        --output OUTPUT.md \\
        [--deep-research] \\
        [--timeout 1800] \\
        [--headless]

Args:
    --prompt-file: path to a file containing the prompt to send to Gemini
    --output: path to write the markdown response to
    --deep-research: if set, try to enable Deep Research mode before sending
                     (falls back to regular chat if the toggle can't be found)
    --timeout: seconds to wait for response to stabilize (default 600 = 10 min;
               bump for Deep Research which can run 15-30 min)
    --headless: run without a visible browser window (default: visible)

Returns:
    Exit 0 on success, writes the markdown response to --output.
    Exit 1 on error, writes a short error message to stderr.

Provenance:
    Adapted from GEO/runner/atlas_runner/browser_chat.py (BrowserGeminiProvider).
    Uses the same user-data-dir, same anti-automation flags.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path


GEMINI_STATE_DIR = Path.home() / ".atlas" / "browser-state" / "gemini.google.com"
GEMINI_URL = "https://gemini.google.com/app"


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--prompt-file", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--deep-research", action="store_true")
    parser.add_argument("--timeout", type=int, default=600)
    parser.add_argument("--headless", action="store_true")
    args = parser.parse_args()

    if not args.prompt_file.exists():
        print(f"error: prompt-file not found: {args.prompt_file}", file=sys.stderr)
        return 1
    prompt = args.prompt_file.read_text().strip()
    if not prompt:
        print("error: prompt-file is empty", file=sys.stderr)
        return 1

    if not GEMINI_STATE_DIR.exists():
        print(
            f"error: GEO persistent state dir not found at {GEMINI_STATE_DIR}.\n"
            "Run GEO's gemini provider once to establish a session.",
            file=sys.stderr,
        )
        return 1

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "error: playwright not installed. Try:\n"
            "  uv run --with playwright scripts/gemini_research.py ...",
            file=sys.stderr,
        )
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            user_data_dir=str(GEMINI_STATE_DIR),
            headless=args.headless,
            channel="chrome",
            args=["--disable-blink-features=AutomationControlled"],
            ignore_default_args=["--enable-automation"],
        )
        page = context.new_page()
        try:
            print(f"navigating to {GEMINI_URL}", file=sys.stderr)
            page.goto(GEMINI_URL, wait_until="domcontentloaded")
            time.sleep(2.0)

            title = page.title()
            print(f"page title: {title}", file=sys.stderr)
            if "Sign in" in title or "accounts.google.com" in page.url:
                print(
                    "error: landed on sign-in page — persistent session expired.\n"
                    "Run GEO's runner against Gemini to re-establish.",
                    file=sys.stderr,
                )
                return 1

            if args.deep_research:
                enabled = _try_enable_deep_research(page)
                if not enabled:
                    print("warning: could not find Deep Research toggle; using regular chat", file=sys.stderr)
                else:
                    print("Deep Research mode enabled", file=sys.stderr)

            textbox = page.get_by_role("textbox", name="Enter a prompt for Gemini")
            textbox.click()
            page.keyboard.type(prompt, delay=10)
            time.sleep(1.5)
            page.keyboard.press("Enter")
            print("prompt submitted, waiting for response…", file=sys.stderr)

            response = _wait_and_extract(page, timeout=args.timeout)
            if not response:
                print("error: empty response from Gemini", file=sys.stderr)
                return 1

            args.output.write_text(response)
            print(f"wrote {len(response)} chars to {args.output}", file=sys.stderr)
            return 0
        finally:
            try:
                context.close()
            except Exception:
                pass


def _try_enable_deep_research(page) -> bool:
    """Click the Deep Research toggle if findable. Returns True if enabled."""
    candidates = [
        ("button", "Deep Research"),
        ("button", "Research"),
        ("link", "Deep Research"),
    ]
    for role, name in candidates:
        try:
            el = page.get_by_role(role, name=name).first
            if el.is_visible(timeout=2000):
                el.click(timeout=3000)
                time.sleep(1.0)
                return True
        except Exception:
            continue
    # Last-chance: find any toggle/chip with text "Deep Research"
    try:
        el = page.locator('button:has-text("Deep Research"), [aria-label*="Deep Research"]').first
        if el.is_visible(timeout=2000):
            el.click(timeout=3000)
            time.sleep(1.0)
            return True
    except Exception:
        pass
    return False


def _wait_and_extract(page, *, timeout: int) -> str:
    """Wait for response to stabilize, then extract markdown text.

    Strategy:
    1. Poll `.markdown` child ONLY — the actual answer body. Until it exists
       and has content, the response hasn't really started.
    2. Once `.markdown` content appears, watch for the "Stop generating" button
       to disappear — strongest signal that streaming is complete.
    3. As a backup, require text stability for 5 seconds AND a minimum length.
    4. Periodically log progress so we can see what's happening.
    """
    MIN_LEN = 30
    STABLE_SECONDS = 5.0
    deadline = time.time() + timeout
    prev = ""
    stable_since = None
    last_progress = time.time()
    seen_response_start = False

    while time.time() < deadline:
        info = page.evaluate(
            """() => {
                const mr = document.querySelectorAll('model-response');
                const last = mr[mr.length - 1];
                if (!last) return { text: '', stop_visible: false, has_markdown: false, status_text: '' };
                const md = last.querySelector('.markdown');
                // Look for the "Stop generating" button anywhere on the page
                const stopBtn = document.querySelector(
                    'button[aria-label*="Stop"], button[aria-label*="stop"]'
                );
                // What is the model-response currently showing? Even if .markdown is
                // empty, the visible status might tell us something.
                return {
                    text: md ? md.innerText : '',
                    has_markdown: !!md,
                    stop_visible: stopBtn ? stopBtn.offsetParent !== null : false,
                    status_text: last.innerText.slice(0, 120),
                };
            }"""
        )
        text = (info["text"] or "").strip()
        stop_visible = info["stop_visible"]
        has_markdown = info["has_markdown"]
        status_preview = info["status_text"]

        # Progress logging every 10s
        if time.time() - last_progress >= 10:
            print(
                f"  …t={int(time.time() - (deadline - timeout))}s "
                f"len={len(text)} markdown={has_markdown} stop_btn={stop_visible} "
                f"status={status_preview[:60]!r}",
                file=sys.stderr,
            )
            last_progress = time.time()

        # Detect response start
        if has_markdown and len(text) >= MIN_LEN and not seen_response_start:
            print(f"  response started (len {len(text)})", file=sys.stderr)
            seen_response_start = True

        # Completion: response visible AND stop button gone AND stable for 2s
        if seen_response_start and not stop_visible:
            if text == prev:
                if stable_since is None:
                    stable_since = time.time()
                elif time.time() - stable_since >= 2.0:
                    print(f"  response complete (stop button gone, stable 2s)", file=sys.stderr)
                    return text
            else:
                stable_since = None
                prev = text

        # Backup completion: ignoring stop button, just text stability
        elif seen_response_start and len(text) >= MIN_LEN and text == prev:
            if stable_since is None:
                stable_since = time.time()
            elif time.time() - stable_since >= STABLE_SECONDS:
                print(f"  response stable for {STABLE_SECONDS}s (no stop-button check)", file=sys.stderr)
                return text
        else:
            stable_since = None
            if has_markdown:
                prev = text

        time.sleep(1.5)

    # Timeout: return whatever we have
    print(f"  TIMEOUT after {timeout}s; returning len={len(prev)}", file=sys.stderr)
    return prev


if __name__ == "__main__":
    sys.exit(main())
