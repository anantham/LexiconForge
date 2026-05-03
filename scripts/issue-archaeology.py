#!/usr/bin/env python3
"""issue-archaeology.py

Map a suspect file (or substring) to the agent sessions that touched it.

Scans Claude Code transcripts in
  ~/.claude/projects/-Users-aditya-Documents-Ongoing-Local-LexiconForge/*.jsonl
and emits, per session that edited the path:

  - sessionId, timestamp range, model(s) used, gitBranch
  - first non-empty user message (the seed prompt)
  - tool-use names (Edit / Write / Bash / etc.)
  - other files touched in the same session (siblings)

Then optionally cross-references against `git log` for the path so you can see
which commit lands closest to which session.

Usage:
  python3 scripts/issue-archaeology.py <path-substring> [--git] [--max-prompt N]

Examples:
  python3 scripts/issue-archaeology.py store/bootstrap/initializeStore.ts --git
  python3 scripts/issue-archaeology.py services/importService.ts
  python3 scripts/issue-archaeology.py FeedbackPopover

Notes:
  - Path matching is substring-based on the value passed to Edit/Write/Read.
  - "Sibling files touched" means any file the session also Edited or Wrote.
  - First user prompt skips slash-commands, system reminders, and tool results.
"""
from __future__ import annotations
import argparse
import glob
import json
import os
import subprocess
import sys
from collections import defaultdict
from datetime import datetime

PROJECTS_DIR = os.path.expanduser(
    "~/.claude/projects/-Users-aditya-Documents-Ongoing-Local-LexiconForge"
)


def iter_records(path: str):
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def extract_text(content) -> str:
    """Pull a flat string out of a content field (string or list of blocks)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    out.append(block.get("text", ""))
                elif "text" in block:
                    out.append(str(block.get("text", "")))
        return "\n".join(out)
    return ""


def looks_like_real_user_prompt(text: str) -> bool:
    if not text or not text.strip():
        return False
    t = text.strip()
    if t.startswith("<") and t.endswith(">"):
        return False
    if t.startswith("Caveat:") or t.startswith("[Request interrupted"):
        return False
    if "<system-reminder>" in t or "<command-name>" in t:
        # commands sometimes include user text; only treat as user if there's
        # also unwrapped text
        stripped = t
        for tag in ("<system-reminder>", "</system-reminder>",
                    "<command-name>", "</command-name>",
                    "<command-message>", "</command-message>",
                    "<command-args>", "</command-args>",
                    "<local-command-stdout>", "</local-command-stdout>"):
            stripped = stripped.replace(tag, "")
        # if after stripping wrapper-only content we still have free text, accept
        if not stripped.strip():
            return False
    return True


def file_path_from_tool_input(name: str, inp) -> str | None:
    if not isinstance(inp, dict):
        return None
    if name in ("Edit", "Write", "Read", "NotebookEdit", "MultiEdit"):
        return inp.get("file_path") or inp.get("path") or inp.get("notebook_path")
    if name in ("Bash",):
        # not file-specific, but capture the command snippet for context
        return None
    if name in ("mcp__plugin_serena_serena__create_text_file",
                "mcp__plugin_serena_serena__replace_content",
                "mcp__plugin_serena_serena__replace_symbol_body",
                "mcp__plugin_serena_serena__insert_after_symbol",
                "mcp__plugin_serena_serena__insert_before_symbol"):
        return inp.get("relative_path") or inp.get("file_path")
    return None


def scan_sessions(path_substring: str):
    """Walk every JSONL, return per-session aggregates for sessions
    that Edit/Write/MultiEdit-ed something matching path_substring."""
    sessions = defaultdict(lambda: {
        "session_id": None,
        "jsonl_path": None,
        "first_user_prompt": None,
        "first_user_ts": None,
        "ts_min": None,
        "ts_max": None,
        "models": set(),
        "git_branches": set(),
        "tools_used": defaultdict(int),
        "files_edited": defaultdict(int),
        "files_read": defaultdict(int),
        "matched_edits": [],   # list of (ts, tool, file)
        "match_count": 0,
    })

    needle = path_substring.lower()

    for jsonl in sorted(glob.glob(os.path.join(PROJECTS_DIR, "*.jsonl"))):
        sid = os.path.splitext(os.path.basename(jsonl))[0]
        # do a cheap substring scan first to skip files that never mention the path
        try:
            with open(jsonl, "r", encoding="utf-8", errors="replace") as fh:
                content_sample = fh.read()
        except OSError:
            continue
        if needle not in content_sample.lower():
            continue

        agg = sessions[sid]
        agg["session_id"] = sid
        agg["jsonl_path"] = jsonl

        for rec in iter_records(jsonl):
            t = rec.get("type")
            ts = rec.get("timestamp")
            if ts:
                if agg["ts_min"] is None or ts < agg["ts_min"]:
                    agg["ts_min"] = ts
                if agg["ts_max"] is None or ts > agg["ts_max"]:
                    agg["ts_max"] = ts
            gb = rec.get("gitBranch")
            if gb:
                agg["git_branches"].add(gb)

            if t == "user":
                msg = rec.get("message") or {}
                content = msg.get("content") if isinstance(msg, dict) else None
                text = extract_text(content) if content else ""
                if (
                    agg["first_user_prompt"] is None
                    and looks_like_real_user_prompt(text)
                ):
                    agg["first_user_prompt"] = text.strip()[:1200]
                    agg["first_user_ts"] = ts

            elif t == "assistant":
                msg = rec.get("message") or {}
                if isinstance(msg, dict):
                    model = msg.get("model")
                    if model:
                        agg["models"].add(model)
                    content = msg.get("content")
                    if isinstance(content, list):
                        for block in content:
                            if not isinstance(block, dict):
                                continue
                            if block.get("type") == "tool_use":
                                tname = block.get("name", "?")
                                agg["tools_used"][tname] += 1
                                inp = block.get("input")
                                fp = file_path_from_tool_input(tname, inp)
                                if fp:
                                    if tname == "Read":
                                        agg["files_read"][fp] += 1
                                    else:
                                        agg["files_edited"][fp] += 1
                                    if needle in fp.lower():
                                        agg["match_count"] += 1
                                        agg["matched_edits"].append(
                                            (ts, tname, fp)
                                        )

    # only keep sessions that actually edited (not just read) the path
    return {
        sid: a for sid, a in sessions.items()
        if a["match_count"] > 0
        and any(needle in fp.lower() for fp in a["files_edited"])
    }


def git_log_for_path(path: str, max_commits: int = 50):
    try:
        out = subprocess.check_output(
            [
                "git", "log",
                f"-n{max_commits}",
                "--follow",
                "--date=iso-strict",
                "--pretty=format:%H|%ad|%an|%s",
                "--", path,
            ],
            cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            stderr=subprocess.DEVNULL,
            text=True,
        )
    except subprocess.CalledProcessError:
        return []
    out = out.strip()
    if not out:
        return []
    rows = []
    for line in out.splitlines():
        parts = line.split("|", 3)
        if len(parts) == 4:
            rows.append({"sha": parts[0], "date": parts[1],
                         "author": parts[2], "subject": parts[3]})
    return rows


def best_commit_for_session(commits, ts_min, ts_max):
    """Find the commit whose date falls inside [ts_min, ts_max], or the
    closest one after ts_max."""
    if not (ts_min and ts_max):
        return None
    candidates = []
    for c in commits:
        if ts_min <= c["date"] <= ts_max:
            candidates.append(("inside", c))
    if candidates:
        return candidates[-1][1]
    # else nearest-after
    after = [c for c in commits if c["date"] > ts_max]
    if after:
        return min(after, key=lambda c: c["date"])
    return None


def fmt_session(agg, commit=None) -> str:
    out = []
    out.append(f"### session `{agg['session_id']}`")
    out.append(
        f"- **Time range:** {agg['ts_min']} → {agg['ts_max']}"
    )
    out.append(f"- **Models:** {', '.join(sorted(agg['models'])) or '_unknown_'}")
    out.append(
        f"- **gitBranch(es):** {', '.join(sorted(agg['git_branches'])) or '_unknown_'}"
    )
    out.append(f"- **Transcript:** `{agg['jsonl_path']}`")
    if commit:
        out.append(
            f"- **Likely commit:** `{commit['sha'][:10]}` "
            f"({commit['date']}) — {commit['subject']}"
        )
    if agg["first_user_prompt"]:
        prompt_preview = agg["first_user_prompt"]
        # collapse whitespace for the preview
        preview = " ".join(prompt_preview.split())
        out.append(
            f"- **First user prompt** ({agg['first_user_ts'] or '?'}):"
            f"\n  > {preview[:500]}"
        )
    tools = sorted(agg["tools_used"].items(),
                   key=lambda kv: -kv[1])[:10]
    out.append(
        "- **Tools used:** "
        + ", ".join(f"{n}×{c}" for n, c in tools)
    )
    out.append(
        f"- **Matched edits ({agg['match_count']}):**"
    )
    for ts, tn, fp in agg["matched_edits"][:10]:
        out.append(f"  - {ts} `{tn}` → `{fp}`")
    edited = sorted(agg["files_edited"].items(), key=lambda kv: -kv[1])
    siblings = [fp for fp, _ in edited if path_arg_lower not in fp.lower()][:15]
    if siblings:
        out.append("- **Sibling files edited in same session:**")
        for fp in siblings:
            out.append(f"  - `{fp}`")
    return "\n".join(out)


def main():
    global path_arg_lower
    p = argparse.ArgumentParser()
    p.add_argument("path", help="path substring to search for in tool inputs")
    p.add_argument("--git", action="store_true",
                   help="cross-reference with git log for the path")
    args = p.parse_args()
    path_arg_lower = args.path.lower()

    sessions = scan_sessions(args.path)
    if not sessions:
        print(f"No sessions found that edited a path matching {args.path!r}.",
              file=sys.stderr)
        sys.exit(1)

    commits = git_log_for_path(args.path) if args.git else []

    # sort by ts_min ascending
    ordered = sorted(sessions.values(),
                     key=lambda a: a["ts_min"] or "")

    print(f"# Archaeology for `{args.path}`")
    print(f"_{len(ordered)} session(s) edited this path._")
    print()
    if commits:
        print(f"## Git log ({len(commits)} commits)")
        for c in commits:
            print(f"- `{c['sha'][:10]}` {c['date']} — {c['subject']} _({c['author']})_")
        print()
    print("## Sessions")
    for agg in ordered:
        commit = best_commit_for_session(commits, agg["ts_min"], agg["ts_max"]) if commits else None
        print(fmt_session(agg, commit))
        print()


if __name__ == "__main__":
    main()
