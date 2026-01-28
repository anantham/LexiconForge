# TypeScript Health Status

**Last Updated:** January 28, 2026
**Error Count:** 7 (down from 172 in Nov 2024)

## Current Errors

| File | Error | Severity | Notes |
|------|-------|----------|-------|
| `adapters/providers/ClaudeAdapter.ts:65` | Type 'string' not assignable to '"user" \| "assistant"' | 🟡 Medium | Role type needs explicit cast |
| `components/sutta-studio/PaliWord.tsx:106,108` | Cannot find name 'RELATION_GLYPHS/HOOK' | 🟡 Medium | Missing constants import |
| `components/sutta-studio/SuttaStudioFallback.tsx:65,89` | Property 'id' does not exist on type 'Chapter' | 🟡 Medium | Type definition mismatch |
| `components/sutta-studio/XarrowUpdater.tsx:4` | Cannot find namespace 'React' | 🟢 Low | Missing React import |
| `scripts/lib/translation-sources.ts:434` | Property 'text' does not exist on type 'unknown' | 🟢 Low | Needs type assertion |

## Error Distribution

- **Sutta Studio (WIP)**: 5 errors - Active development, expected
- **Adapters**: 1 error - ClaudeAdapter role typing
- **Scripts**: 1 error - Type assertion needed

## Historical Progress

| Date | Error Count | Notes |
|------|-------------|-------|
| Nov 2024 | 172 | Post-repository extraction |
| Nov 2025 | ~20 | IndexedDB decomposition complete |
| Jan 2026 | 7 | Current state |

## Quality Gates

- **Target**: < 10 errors for merge to main
- **Sutta Studio**: Exempt during active development
- **Core adapters/services**: Must be error-free

## How to Check

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

## Related Docs

- [Archive: Original Analysis (Nov 2024)](../archive/stale-docs/TYPESCRIPT-ERROR-ANALYSIS.md)
- [Archive: Fix Plan (Nov 2024)](../archive/stale-docs/TYPESCRIPT-FIX-PLAN.md)
- [ADR: TypeScript Debt Remediation](../adr/FEAT-002-typescript-debt-remediation.md)
