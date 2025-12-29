# LexiconForge Development Commands

## Development Server
```bash
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run preview      # Preview production build
```

## Testing
```bash
npm test             # Run Vitest tests (once)
npm run test:watch   # Run Vitest in watch mode
npm run test:ui      # Vitest with UI
npm run test:coverage # Run tests with coverage report
npm run test:e2e     # Run Playwright E2E tests
npm run test:e2e:ui  # Playwright with UI
npm run test:e2e:headed # Playwright in headed mode
npm run test:e2e:debug # Playwright debug mode
```

## Code Quality
```bash
npx tsc              # TypeScript type checking (no emit)
npm run check:loc    # Check file line counts (agent-first limits)
```

## Utility Scripts
```bash
npm run merge-fan-translations <session.json> <fan-dir/> [output.json]
npm run prepare      # Generate steering image list
```

## Git Worktree Commands (Multi-Agent Protocol)
```bash
# Create new worktree for feature work
mkdir -p ../LexiconForge.worktrees
git worktree add ../LexiconForge.worktrees/<branch-name> -b <branch-name> main

# Cleanup after PR merge
git worktree remove ../LexiconForge.worktrees/<branch-name>
git branch -d <branch-name>
git worktree prune
```

## System Commands (Darwin/macOS)
```bash
ls -la               # List files with details
find . -name "*.ts"  # Find TypeScript files
grep -r "pattern" .  # Search in files
```

## Environment Setup
Create `.env.local` with API keys:
```
VITE_GEMINI_API_KEY=...
VITE_DEEPSEEK_API_KEY=...
VITE_CLAUDE_API_KEY=...
VITE_OPENROUTER_API_KEY=...
VITE_PIAPI_API_KEY=...
```
