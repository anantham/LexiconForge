# Claude Code Instructions (LexiconForge)

Source of truth: `AGENTS.md`.

## Multi-Agent Coordination (Critical)

Multiple agents (Opus, Gemini, Codex/5.2) work on this repo. Follow these rules:

| Rule | Action |
|------|--------|
| **Main repo = `main` only** | Never checkout other branches there |
| **Use agent-prefixed worktrees** | `../LexiconForge.worktrees/opus-<task>/` |
| **Use agent-prefixed branches** | `feat/opus-<feature>`, `fix/opus-<bug>` |
| **No stashing** | Commit WIP or lose it |
| **WORKLOG on start/end** | Signal what you're working on |

Before starting: Check `docs/WORKLOG.md` for other agents' active work.

### WORKLOG Maintenance

Run the auto-cycling script periodically to prevent WORKLOG bloat:

```bash
./scripts/cycle-worklog.sh
```

This archives old entries when the file exceeds ~22k tokens. Archives go to `docs/archive/WORKLOG-*.md`.

## Worktrees (Required)

- Keep the main checkout clean and on `main`.
- Use one worktree per PR branch (avoid `git stash`).
- Prefer worktrees outside the repo: `../LexiconForge.worktrees/<branch-name>/`.

### Quickstart

```bash
mkdir -p ../LexiconForge.worktrees
git worktree add ../LexiconForge.worktrees/opus-<task> -b feat/opus-<task> main
```

### Cleanup after merge

```bash
git worktree remove ../LexiconForge.worktrees/<branch-name>
git branch -d <branch-name>
git worktree prune
```

