# Tech Debt Reduction - Execution Summary

## What I've Created for You

### 📋 Planning Documents
1. **`TECH-DEBT-REDUCTION-PLAN.md`** - Complete 4-day plan with:
   - Exact line numbers for all changes
   - Specific file paths and methods
   - Confidence scores and time estimates
   - Success metrics for each phase

2. **`CLAUDE-CODE-SCRIPTS.md`** - Copy-paste scripts for Claude Code:
   - Pre-written bash scripts for each task
   - Exact sed commands for type fixes
   - Complete test harness creation scripts
   - LOC checker implementation

3. **`EXECUTION-SUMMARY.md`** (this file) - Quick reference guide

## 🎯 Division of Labor Strategy

### Your Role (Human with Full Claude):
✅ **Planning & Analysis** (Days 1-4 prep work)
- Read full 3,937-line files
- Identify exact line numbers
- Create decomposition blueprints
- Design repository interfaces

### Claude Code's Role:
✅ **Execution** (Days 1-4 implementation)
- Apply specific fixes using provided line numbers
- Create files from templates
- Run tests and verify changes
- Update WORKLOG.md

## 📊 Current State vs Target

### Current State (Nov 10, 2024):
- **TypeScript Errors:** 138
- **Monolithic Files:** 3 (3,937 / 2,744 / 1,969 lines)
- **Files with 'any':** 30+
- **Test Coverage:** ~0% for core services
- **Build Status:** ❌ Failing

### Target State (After Day 4):
- **TypeScript Errors:** < 50
- **Monolithic Files:** 0 (all < 800 lines)
- **Files with 'any':** < 5
- **Test Coverage:** 80% for critical paths
- **Build Status:** ✅ Green

## 🚀 Quick Start for Claude Code

### Prompt Template:
```
Hi! I'm working on technical debt reduction for LexiconForge.

Please:
1. Check if node_modules exists (ls -la node_modules | head -5)
2. Read the last entry in docs/WORKLOG.md
3. Open docs/CLAUDE-CODE-SCRIPTS.md
4. Execute Script [NUMBER] from that file

Current task: [Day 1/2/3/4] - [Specific task name]

Note: You can't read files over ~500 lines. Always use grep first to find specific sections.
```

## 📝 Day-by-Day Execution

### Day 1: Fix Builds (4-6 hours)
```bash
# Claude Code executes:
- Script 1: Fix OpenAI Type Errors (lines 79-88, 64-83)
- Script 2: Create Test Harness (without reading monolith)
- Verify: errors drop from 138 to ~100
```

### Day 2: Add Guardrails (3-4 hours)
```bash
# Claude Code executes:
- Script 3: Create LOC Checker
- Begin strict typing on small services (env.ts, stableIdService.ts)
- Add "noImplicitAny": true to tsconfig.json
```

### Day 3: Document Architecture (2-3 hours)
```bash
# Claude Code creates:
- docs/ARCHITECTURE.md (using grep to map dependencies)
- docs/INDEXEDDB-DECOMPOSITION-PLAN.md (with line numbers)
- docs/COMPONENT-DECOMPOSITION-PLAN.md
```

### Day 4: Begin Extraction (4-5 hours)
```bash
# Claude Code executes:
- Script 4: Extract ChapterRepository (lines 1105-1300)
- Create facade pattern for backward compatibility
- Run tests to verify nothing broke
```

## 🔍 Key Insights for Success

### 1. **Search-First Approach**
Claude Code should ALWAYS:
```bash
grep [pattern] [file] | head -20  # Before reading
sed -n '1105,1300p' file.ts      # Extract specific lines
wc -l file.ts                     # Check size first
```

### 2. **Incremental Changes**
- Fix one service at a time
- Run tests after each change
- Commit working state frequently

### 3. **Use Provided Line Numbers**
I've identified exact line numbers:
- OpenAI fixes: lines 79-88, 64-83
- Chapter methods: lines 1105-1300
- Translation methods: lines 1301-1800
- Settings methods: lines 2801-2900

### 4. **Verification After Each Step**
```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"  # Check error count
npm test                                      # Run tests
npm run check:loc                            # Check file sizes
```

## 📈 Progress Tracking

### Success Metrics:
| Day | Task | Success Criteria | Verification |
|-----|------|-----------------|--------------|
| 1 | Fix builds | < 100 TS errors | `npx tsc --noEmit` |
| 1 | Test harness | 5 tests passing | `npm test` |
| 2 | LOC checker | Script runs | `npm run check:loc` |
| 2 | Remove 'any' | 10 services clean | `grep ': any'` |
| 3 | Documentation | 3 docs created | `ls docs/*.md` |
| 4 | Extract repo | indexeddb < 3,700 lines | `wc -l` |

## 🎉 Expected Outcomes

After 4 days, you'll have:
1. **Green builds** - All TypeScript errors fixed
2. **Test safety net** - Interface tests prevent regressions
3. **Size guardrails** - Automated LOC checking
4. **Clear architecture** - Documented and planned
5. **Started decomposition** - First repository extracted

## 🔗 Related Files

- Current branch: `feature/import-improvements-and-flaggable-ops`
- Main tracking: `docs/WORKLOG.md`
- Detailed plan: `docs/TECH-DEBT-REDUCTION-PLAN.md`
- Scripts: `docs/CLAUDE-CODE-SCRIPTS.md`
- Tests: `tests/services/db/indexedDBService.interface.test.ts`

---

**Ready to Execute!** Start with Day 1, Script 1 in CLAUDE-CODE-SCRIPTS.md