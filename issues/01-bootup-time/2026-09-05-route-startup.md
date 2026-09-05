# Route startup latency — 2026-09-05

Status: implemented and verified locally on `perf/codex-startup-latency`; not merged or deployed. Base: freshly fetched `origin/main` at `8423892`. This receipt addresses eager route loading, not the remote full-session import in historical issue 1.

## Intent and change

Opening one reader should not download the benchmark tools, other readers, and their datasets. `App.tsx` now loads each existing route on demand using React's existing lazy/Suspense pattern. MN10 and MN117 share one local packet-loading path; view and packet load concurrently. The old synchronous packet registry and special direct rendering path are removed. There is no new dependency, cache, retry scheduler, or routing framework.

One `lazyPage` helper remains to report failed feature downloads with a Reload action; it does not catch arbitrary rendering errors. Local packet failures retain their specific message. Keying local readers by work ID prevents stale contents during navigation. The demo alias keeps its query and fragment, and special sutta routes retain precedence over live compilation. Only own registry entries count as local packets; an unknown ID such as `constructor` falls through to the live route.

## Measurements

Production builds, Node 24.19.0, headless Chromium, gzip enabled, fresh browser contexts/cache disabled, 4x CPU throttling, 80ms network latency and 10 Mbit/s throughput. Three cold runs per path/version, alternating before/after order. External requests and service workers are blocked identically; no credentials, private session, or paid provider is used. Readiness is the first nonempty page H1, not the loading spinner or full time-to-interactive. Decimal KB.

| Metric | Before | After | Change |
|---|---:|---:|---:|
| Library visible, median | 1,813ms | 1,099ms | -39.4% |
| Library JavaScript decoded | 4,759KB | 1,860KB | -60.9% |
| Library JavaScript gzip | 1,136KB | 506KB | -55.5% |
| Library long-task time, median | 415ms | 119ms | -71.3% |
| Gita index visible, median | 1,569ms | 600ms | -61.8% |
| Gita index JavaScript decoded | 4,757KB | 197KB | -95.9% |
| Gita index JavaScript gzip | 1,135KB | 63KB | -94.4% |
| Gita index long-task time, median | 493ms | 0ms | No >50ms tasks observed |

Raw ready-time samples (ms): library before `[1952, 1801, 1813]`, after `[1099, 1092, 1099]`; Gita before `[1569, 1565, 1575]`, after `[600, 602, 597]`. All twelve runs had zero page errors. An earlier candidate run showed similar direction (library 1803 → 1100ms; Gita 1550 → 597ms).

These are controlled local measurements, not production-device measurements. Root startup still downloads the novel app and its dependencies; full novel acquisition, warm large databases, chapter-to-chapter latency, external fonts, network failures, and actual provider latency are not benchmarked here. The benefit is removing unrelated work before a page can appear.

## Simplicity and validation

- `App.tsx`: 162 → 160 physical lines (-1.2%); source size is essentially unchanged. The important deletion is unnecessary startup work.
- ESLint cyclomatic complexity: route dispatcher 22 → 21; local sutta renderer 3 → 3; new shared download helper 1 and Suspense shell 1. No claim of a broad complexity reduction.
- Explicit `any` types in `App.tsx`: 0 → 0.
- There was no pre-existing App routing coverage baseline. New focused routing coverage is 94.73% lines / 82.75% branches; do not compare that to an invented prior percentage.
- Focused Vitest gate: 25/25 pass (15 route cases plus existing Gita readers). Checks lazy module isolation, precedence/props, aliases, packet identity, and download failure UI.
- Production Chromium: 3/3 pass. Checks actual feature isolation and client navigation; holds an MN117 network response while navigating away and verifies it cannot overwrite MN10; aborts a route chunk and verifies visible recovery plus another usable route.
- Typecheck passes under the existing setup. Its missing React declaration limitation is tracked in QA-01; this is not a claim of full JSX prop safety.
- Production build, integrity/extension checks, and scoped whitespace checks pass. Changed TS/TSX lint has zero errors and the existing alias-effect warning. The standalone probe passes `node --check`; repository ESLint excludes `issues/`.
- The initial asynchronous unit mock for a delayed JSON import returned real data on re-import. Packet-key diagnostics identified the harness behavior; the delay/race is therefore verified through a real browser network interception instead. No production behavior was changed to appease that mock.

## Reproduce and extend

Use Node 24 and dependencies installed from the lockfile. Build unchanged `8423892` and the candidate from separate worktrees into distinct external directories:

```sh
node node_modules/vite/bin/vite.js build --outDir /tmp/lf-before --manifest
node node_modules/vite/bin/vite.js build --outDir /tmp/lf-after --manifest
```

Run each build command in its corresponding checkout. Then from the candidate:

```sh
node issues/01-bootup-time/route-startup-probe.mjs /tmp/lf-before /tmp/lf-after
node node_modules/vitest/vitest.mjs run App.test.tsx tests/components/gita/gita-page.test.tsx tests/components/gita/gita-ch2-page.test.tsx
node node_modules/playwright/cli.js test tests/e2e/route-loading.spec.ts --retries=0
```

The last command uses the existing dev-server configuration. For the production result above, a temporary Playwright config pointed the same spec at a strict-port `vite preview` of `/tmp/lf-after`, with fresh contexts, service workers blocked, one worker, and zero retries. This setup mismatch is tracked in QA-03; the production check was actually run, not inferred from dev tests. The diagnostic probe itself serves both builds on temporary loopback ports and blocks external requests.

Next useful input: a representative slow chapter/import interaction, target device/browser, and a scrubbed test novel/session. Reuse `tests/e2e/helpers/sessionHarness.ts` for fresh/warm persisted-state cases. Keep the current private browser profile out of automated fixtures. Actual provider health/latency needs its own bounded live check, separate from offline UI QA.

## Follow-ups

Root [Issues.md](../../Issues.md#agent-pickup-queue--2026-09-05-latency-and-complexity-pass) tracks the confirmed cleanup opportunities and QA setup gaps. LAT-01 is this implemented slice; LAT-02/LAT-03/QA-01/QA-02/QA-03/COPY-01 remain open. Raw debt references also live in [TECH-DEBT-INBOX](../../docs/roadmaps/TECH-DEBT-INBOX.md#2026-09-05-latency-pass). No other subsystem was refactored.
