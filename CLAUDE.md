# Claude Code Instructions (LexiconForge)

Source of truth: `AGENTS.md`.

## Worktrees (Required)

- Keep the main checkout clean and on `main`.
- Use one worktree per PR branch (avoid `git stash`).
- Prefer worktrees outside the repo: `../LexiconForge.worktrees/<branch-name>/`.

### Quickstart

```bash
mkdir -p ../LexiconForge.worktrees
git worktree add ../LexiconForge.worktrees/<branch-name> -b <branch-name> main
```

### Cleanup after merge

```bash
git worktree remove ../LexiconForge.worktrees/<branch-name>
git branch -d <branch-name>
git worktree prune
```

