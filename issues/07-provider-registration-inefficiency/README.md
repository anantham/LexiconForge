# Issue 7 — Provider registration may run repeatedly

> Status: **investigated** · Last updated: 2026-05-15 · Investigator: Claude Opus 4.7 (1M) · Worktree `opus-issues-investigation`

## 1. Claim (verbatim from Issues.md)

> scan for inefficinecies like registering providers again and again,

_Note: an **audit task** — sweep for redundant registration patterns, not a single-incident bug._

## 2. Reproduction

**Goal:** Does provider registration actually fire multiple times during a fresh cold boot?

**Environment:** dev server `http://localhost:5183/` (isolated worktree, port-isolated IDB), fresh IndexedDB (`fresh-install` per Connection log).

**Steps:**
1. Navigate to `http://localhost:5183/` with empty browser context.
2. Wait 3s for bootstrap + StrictMode double-mount cycle to settle.
3. Capture full console (info+) via Playwright MCP.

**Trace:** [`traces/cold-boot-console.log`](./traces/cold-boot-console.log) — 158 console messages, captured 2026-05-15T19:32:58Z.

**Observed result:**

| Marker | Source | Count in cold-boot trace |
|---|---|---|
| `Setting settings from initializeSession` | `store/bootstrap/initializeStore.ts:76` | **2** |
| `[DataRepair] Starting repair of missing model fields...` | `services/db/migrationService.ts:116` | **2** |
| `[Providers] All providers registered:` | `adapters/providers/index.ts:33` | **0** |
| `[Store:init] initializeStore – begin` | `store/bootstrap/initializeStore.ts:30` | **2** |

**Verdict:** `reproduced` for "init runs twice"; **NOT reproduced** for "providers register again and again." The provider-registration log fired zero times because `initializeProviders()` is lazy — invoked only when a translation/compile/search call is made (5 call sites, none triggered on app idle).

Module-level registration (`adapters/providers/index.ts:20-30`) runs exactly once per module evaluation, and ESM caches the module across all five dynamic-import callers (`services/translationService.ts:164`, `services/suttaStudioLLM.ts:3`, `services/ai/translatorRouter.ts:21`, `services/compiler/llm.ts:4`, `services/librarySearch/searchService.ts:9`).

**What IS firing twice is the bootstrap pipeline itself** — `[Store:init]` and `[DataRepair]` markers each appear 2× because `MainApp.tsx`'s `initializeStore()` effect re-enters under React.StrictMode double-mount (no in-flight guard at `store/bootstrap/initializeStore.ts:423`). This is precisely the symptom diagnosed in [issue #1](../01-bootup-time/) — `(A1*, B2, C2)`, theme `completion-only-guards`.

## 3. Verdict

**Confusion** (subsumed by issue #1) — Confidence: **0.9**.

The user's verbatim concern ("registering providers again and again") describes a symptom-shape that is **not present** at the provider-registration layer. The same generator IS present one layer up at the bootstrap/init layer; the user's mental-model conflated the two.

What would raise confidence to 0.95+: trigger a translation, observe `[Providers] All providers registered:` fire exactly **once** per request (or document any deviation). That would close the loop on the runtime layer too. **Deferred** — the static + cold-boot evidence is sufficient to verdict.

## 4. Where the failure lives (A / B / C)

**`(A2, B1, C1)`** — At the provider-registration layer specifically. (Issue #1 owns the `(A1*, B2, C2)` for the bootstrap-double-init that the user actually saw.)

Justification:
- **A2** — No ADR governs the "providers register once" invariant. The Map.set idempotency is implicit in ESM module semantics, not a spec commitment. If a future agent introduced a per-render `registerProvider` call, no ADR-grounded test would catch it.
- **B1** — Code already implements the singleton pattern correctly. Module-level registration; lazy `initializeProviders()` that's a no-op after first call.
- **C1** — Aligned with Vision (no waste; JIT registration). The lazy import keeps the boot-critical path free of provider adapter code.

### Themes (cross-cutting failure classes)

- **NOT** an instance of [`completion-only-guards`](../_themes/completion-only-guards.md) at this layer (Map.set IS idempotent). The double-init pattern that the user noticed lives one layer up and is already filed at issue #1 against that theme.
- The lazy-import pattern (`await import(...)`) is mildly aligned with [`jit-vs-precompute`](../_themes/jit-vs-precompute.md) but the alignment is incidental, not load-bearing.

## 5. Evidence and code paths

**Registration site:** `adapters/providers/index.ts:11-30` — module-level singleton

```ts
import { translator } from '../../services/translate/Translator';
import { OpenAIAdapter } from './OpenAIAdapter';
import { GeminiAdapter } from './GeminiAdapter';
import { ClaudeAdapter } from './ClaudeAdapter';
import { registerProvider } from './registry';

const openRouterAdapter = new OpenAIAdapter('OpenRouter');
const deepSeekAdapter = new OpenAIAdapter('DeepSeek');
const geminiAdapter = new GeminiAdapter();
const claudeAdapter = new ClaudeAdapter();

translator.registerProvider('DeepSeek', deepSeekAdapter);
translator.registerProvider('OpenRouter', openRouterAdapter);
translator.registerProvider('Gemini', geminiAdapter);
translator.registerProvider('Claude', claudeAdapter);

registerProvider(openRouterAdapter);  // generic-chat registry
registerProvider(deepSeekAdapter);
registerProvider(geminiAdapter);
registerProvider(claudeAdapter);
```

**Translator registry impl:** `services/translate/Translator.ts:41-43`
```ts
registerProvider(name: string, provider: TranslationProvider): void {
  this.providers.set(name, provider);  // Map.set — idempotent on key
}
```

**No-op caller façade:** `adapters/providers/index.ts:32-34`
```ts
export const initializeProviders = async () => {
  console.log('[Providers] All providers registered:', [...]);
};
```

**Five dynamic-import callers** (all cached after first import):
- `services/translationService.ts:164` — `const { initializeProviders } = await import('../adapters/providers'); ... await initializeProviders();`
- `services/suttaStudioLLM.ts:3, :31` — top-level static import + invocation in init
- `services/ai/translatorRouter.ts:21-22` — dynamic import path
- `services/compiler/llm.ts:4, :14` — static import
- `services/librarySearch/searchService.ts:9, :421` — static import

**Bootstrap layer (not this issue's site, but where the user's observed symptom originates):**
- `MainApp.tsx:153` — `useEffect(() => { initializeStore(); }, [])` — fires twice under StrictMode
- `store/bootstrap/initializeStore.ts:423` — guard checks `isInitialized` only, not `isInitializing`
- `store/bootstrap/initializeStore.ts:28` — module-global telemetry merges concurrent runs (issue #1 §)

## 6. Test coverage gap & regression-test obligations

### What's missing

- No test asserts `translator.providers` size is exactly 4 after one or many `initializeProviders()` calls.
- No test asserts the **lazy** semantics — that adapter constructors don't run until first translation/compile/search request. (Currently they DO run at first module-import; that's a separate concern from the user's claim but worth surfacing.)
- No invariant test for `services/translate/Translator.ts:41`'s idempotent `Map.set` semantics — if someone refactored to `this.providers.push(...)` (an Array) it would silently regress.

### Regression-test obligations

Since the verdict is `confusion` and the user's symptom is owned by issue #1, **no regression tests are owed here**. The relevant test obligation lives at issue #1 (single-flight init guard).

If a defensive test were nonetheless desired:

| Defect | Hypothetical regression test |
|---|---|
| Future regression that registers per-render | `tests/adapters/providers/idempotency.test.ts` — assert calling `initializeProviders()` 10× leaves `translator.providers.size === 4` and adapter instances are reference-identical across calls. |

## 7. Archaeology

Deferred — verdict is `confusion`/`subsumed`, and the relevant code (`adapters/providers/index.ts`) is the canonical happy-path implementation. The bug-shape the user worried about does not exist at this site, so there's no "wrong commit" to find.

Adjacent archaeology that IS relevant lives on issue #1 (`MainApp.tsx:153` effect introduction and `store/bootstrap/initializeStore.ts:423` guard provenance).

## 8. Generator function

Two distinct generators are entangled in the user's claim:

1. **(NOT present here)** "Setup work invoked per-render under StrictMode double-mount" — the generator that issue #1 captures. Cure: in-flight guard + module-singleton pattern.

2. **(Present, low-impact)** "No-op façade function that exists only to log success" — `initializeProviders()` returns nothing useful, has zero side-effects beyond a log, and exists in 5 call sites. Cure: drop the async-await ceremony; either inline the import or delete the façade.

**Other places generator (2) might surface:** any `init*()` or `bootstrap*()` async function that callers `await` for no observable signal. Worth a follow-up grep `grep -rE "await initialize[A-Z]" --include="*.ts"` to identify peers.

## 9. Action — which kind of fix this is

**`wait`** — issue is subsumed by issue #1. The user's symptom-of-concern (boot-time double work) is more cleanly addressed at #1's layer (`enforce_existing_ADR` action via CORE-006).

Sub-recommendation (cheap, optional): collapse the `initializeProviders()` no-op façade.

| Direction | Impact | Effort | Risk | Reversibility | Confidence |
|---|---|---|---|---|---|
| Wait — fix #1's single-flight init guard; this issue's symptom disappears as a side-effect | High (issue #1's win) | 0 here | None | High | 0.9 |
| Optional: drop the `initializeProviders` async façade; let module-eval be the sole register-once moment | Negligible | <30 min | Low (need to remove 5 call-site awaits) | High | 0.9 |
| Add the defensive idempotency unit test from §6 | Negligible runtime impact | <30 min | None | High | 0.95 |

**Recommendation:** close this issue with a link to #1 as the canonical site. Drop the no-op façade only if it surfaces during the #1 fix (don't bundle).

## 9a. Closing gate

This issue closes as `superseded` once issue #1 is `fixed`. No independent regression tests owed.

- [x] Verdict reached (`confusion`/`superseded`) with live trace evidence.
- [ ] Link from issue #1 fix's commit back to this issue's resolution.
- [x] Theme assignment: no own theme; symptoms attributed to issue #1's `completion-only-guards`.

## 10. Status

`investigated` — closed as `superseded` (by issue #1) pending #1's fix.

## 11. Open questions

- Should the no-op `initializeProviders()` façade be deleted independently of issue #1? (Cost <30min; reader cognitive cost reduction. Not on critical path.)
- Are there any production paths that *await* `initializeProviders` for ordering rather than registration? (Grep suggests no — every caller is purely defensive.)
