# LexiconForge Task Completion Checklist

## Before Committing
1. **Run type checking:**
   ```bash
   npx tsc
   ```

2. **Run tests:**
   ```bash
   npm test
   ```

3. **Check file sizes:**
   ```bash
   npm run check:loc
   ```
   - Services ≤ 200 LOC
   - Components ≤ 250 LOC

4. **Run E2E tests (if UI changed):**
   ```bash
   npm run test:e2e
   ```

5. **Build verification:**
   ```bash
   npm run build
   ```

## Commit Requirements
- Use conventional commit format: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- One logical change per commit
- Include context, changes, and impact in message
- Reference issue numbers if applicable

## PR Creation
- Create feature branch: `feat/opus-<feature>`
- Push and create PR via `gh pr create`
- Wait for automated code review
- Address all review comments

## Documentation Updates
- Update `docs/WORKLOG.md` with timestamped summary
- Create ADR for significant architectural decisions
- Update relevant docs if behavior changes

## Cleanup
- Remove any diagnostic/debug code added during investigation
- Ensure no `console.log` statements left (use proper logging)
- Clean up any worktrees after PR merge:
  ```bash
  git worktree remove ../LexiconForge.worktrees/<branch>
  git branch -d <branch>
  git worktree prune
  ```
