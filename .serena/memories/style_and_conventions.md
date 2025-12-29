# LexiconForge Code Style & Conventions

## Language & Configuration
- TypeScript with strict mode
- ES2022 target, ESNext modules
- JSX for React components
- Path alias: `@/*` maps to project root

## File Size Limits (Agent-First)
- Services: ≤ 200 LOC
- Components: ≤ 250 LOC  
- Files approaching ~300 LOC should be split
- Use `npm run check:loc` to verify

## Naming Conventions
- **Files:** camelCase for services (e.g., `aiService.ts`), PascalCase for components (e.g., `ChapterView.tsx`)
- **Variables/Functions:** camelCase
- **Types/Interfaces:** PascalCase
- **Constants:** SCREAMING_SNAKE_CASE for config values

## React Patterns
- Functional components with hooks
- Zustand for state management (slices pattern)
- Custom hooks in `hooks/` directory

## Type Safety
- Avoid `any` types
- Use explicit return types for functions
- Types defined in `types.ts` or colocated

## Commit Style (Conventional Commits)
```
feat: new feature
fix: bug fix
docs: documentation
refactor: code restructuring
test: adding tests
chore: maintenance
```

## Multi-Agent Coordination
- Use agent-prefixed branches: `feat/opus-<feature>`, `fix/gemini-<bug>`
- Use git worktrees outside repo: `../LexiconForge.worktrees/<branch>/`
- Update `docs/WORKLOG.md` on session start/end
- Never develop directly on `main` branch

## PR Requirements
- All changes via Pull Request (no direct main commits)
- One logical change per PR
- Include tests with implementation
- Small PRs preferred (200-400 lines)

## Error Handling
- Descriptive error messages (no silent failures)
- Use debug logging gated behind feature flags
- See `docs/Debugging.md` for logging patterns

## Design Principles (from AGENTS.md)
1. Hypothesis before action
2. Tests are signal (never bypass failing tests)
3. Modularity is mandatory
4. Human gates are sacred for architectural changes
5. Documentation is design (use ADRs)
