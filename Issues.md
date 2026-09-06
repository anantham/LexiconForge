1) fix boot up time  ----ok let me be clear ---- 
initializeStore.ts:62 
(index)
step
delta (ms)
elapsed (ms)
0	'initializeStore – begin'	0	0
1	'loadSettings invoked'	1	1
2	'loadPromptTemplates start'	0	1
3	'loadPromptTemplates resolved'	15	15
4	'Using existing prompt templates'	0	16
5	'bootRepairs start'	1	16
6	'ensureModelFieldsRepaired start'	0	16
7	'ensureModelFieldsRepaired done'	0	16
8	'urlMappingsBackfill start'	0	16
9	'loadPromptTemplates resolved'	0	17
10	'Using existing prompt templates'	0	17
11	'bootRepairs start'	0	17
12	'ensureModelFieldsRepaired start'	0	17
13	'ensureModelFieldsRepaired done'	0	17
14	'urlMappingsBackfill start'	0	17
15	'urlMappingsBackfill done'	1	18
16	'normalizeStableIds start'	0	18
17	'urlMappingsBackfill done'	0	18
18	'normalizeStableIds start'	0	18
19	'normalizeStableIds done'	0	18
20	'backfillActiveTranslations start'	0	18
21	'normalizeStableIds done'	0	18
22	'backfillActiveTranslations start'	0	18
23	'backfillActiveTranslations done'	1	20
24	'translationMetadataBackfill start'	0	20
25	'backfillActiveTranslations done'	1	21
26	'translationMetadataBackfill start'	0	21
27	'translationMetadataBackfill done'	0	21
28	'novelIdBackfill start'	0	21
29	'translationMetadataBackfill done'	1	21
30	'novelIdBackfill start'	0	21
31	'novelIdBackfill done'	0	22
32	'chapterNumbersBackfill check'	0	22
33	'novelIdBackfill done'	0	22
34	'chapterNumbersBackfill check'	0	22
35	'chapterNumbersBackfill skipped'	0	22
36	'bootRepairs complete'	0	22
37	'chapterNumbersBackfill skipped'	1	23
38	'bootRepairs complete'	0	23
39	'loadUrlMappings start'	31583	31606
40	'loadUrlMappings skipped (indexes already populated)'	0	31606
41	'persisted reader state hydration skipped (explicit startup intent)'	0	31606
42	'audio initialization start'	0	31606
43	'audio initialization complete'	44	31650
44	'initializeStore complete – isInitialized true'	0	31650
Array(45)
initializeStore.ts:70 Total init time: 31650ms
TranslationRepository.ts:267 [TranslationRepo] getTranslationVersionsByStableId called 
{stableId: 'lf-library:forty-millenniums-of-cultivation%3A%3Av1-composite:ch2_swk9uw_d9kt', caller: 'at Object.getVersionsByStableId (http://localhost:…vices/db/repositories/translationFacade.ts:37:34)'}
imageSlice.ts:488 [ImageSlice:loadExistingImages] Called for chapter 
{chapterId: 'lf-library:forty-millenniums-of-cultivation%3A%3Av1-composite:ch2_swk9uw_d9kt', hasChapter: true, hasTranslationResult: true, hasSuggestedIllustrations: tru ---- we need to improve boot time what are our options


Assumptions: this trace is from a dev run under `React.StrictMode`, launched with a `?novel=` deep link, and the novel is being imported from a remote session JSON rather than opened from a fully warm local cache.

**Issues**
- The 31.6s is not in the repair steps. Those finish in ~23ms. The big gap is the uninstrumented deep-link phase inside [`store/bootstrap/initializeStore.ts:445`](/Users/aditya/Documents/Ongoing%20Local/LexiconForge/store/bootstrap/initializeStore.ts#L445), which calls full import via [`store/bootstrap/initializeStore.ts:237`](/Users/aditya/Documents/Ongoing%20Local/LexiconForge/store/bootstrap/initializeStore.ts#L237) and [`services/importService.ts:101`](/Users/aditya/Documents/Ongoing%20Local/LexiconForge/services/importService.ts#L101).
- Your boot telemetry table is contaminated by concurrent init runs. The app is mounted under [`index.tsx:14`](/Users/aditya/Documents/Ongoing%20Local/LexiconForge/index.tsx#L14), `initializeStore()` is called from an effect at [`MainApp.tsx:153`](/Users/aditya/Documents/Ongoing%20Local/LexiconForge/MainApp.tsx#L153), and the current guard at [`store/bootstrap/initializeStore.ts:423`](/Users/aditya/Documents/Ongoing%20Local/LexiconForge/store/bootstrap/initializeStore.ts#L423) only checks `isInitialized`, not “init already in flight.” The telemetry state is also module-global at [`store/bootstrap/initializeStore.ts:28`](/Users/aditya/Documents/Ongoing%20Local/LexiconForge/store/bootstrap/initializeStore.ts#L28), so two runs get merged into one table.
- The later `TranslationRepository` and `ImageSlice` logs are downstream of import/render. They are not the primary boot bottleneck in this trace.

**Options**
1. `Instrument the opaque deep-link/import phase`
Impact: high diagnostic value, low direct speedup. Effort: low. Risk: low. Reversibility: high. Time: 1-2h. Confidence: 0.95.  
Pros: tells you whether the 31s is network download, JSON parse, IndexedDB import, or hydration.  
Cons: doesn’t improve user-visible boot time by itself.  
Tradeoffs: best hypothesis-first move; no product win unless followed by a code change.  
Open questions: how large is the session payload, and is this just a slow network fetch?  
Uncertainties: how much duplicate StrictMode work is mixed into this run.

2. `Add an in-flight init guard and isolate telemetry per run`
Impact: medium in dev, low-medium in prod. Effort: low. Risk: low. Reversibility: high. Time: 1-3h. Confidence: 0.93.  
Pros: stops duplicate bootstrap work, makes telemetry trustworthy, may immediately cut this trace if the remote import is being started twice.  
Cons: does not solve the single-run deep-link import cost.  
Tradeoffs: strong cleanup and likely dev win, but not the main UX fix if production is also slow.  
Open questions: do you care primarily about dev boot or actual user cold-start?  
Uncertainties: whether any other remount path can still re-enter bootstrap.

3. `Stop blocking initializeStore on full deep-link import`
Impact: high. Effort: medium. Risk: medium. Reversibility: medium-high. Time: 0.5-1.5 days. Confidence: 0.88.  
Pros: biggest real boot-time win. You already have a streaming path used by the library at [`components/NovelLibrary.tsx:173`](/Users/aditya/Documents/Ongoing%20Local/LexiconForge/components/NovelLibrary.tsx#L173) backed by [`services/importService.ts:256`](/Users/aditya/Documents/Ongoing%20Local/LexiconForge/services/importService.ts#L256); deep-link boot currently uses the slower full import path.  
Cons: requires careful handling of reader-loading state, progress UI, and deep-link-to-specific-chapter behavior.  
Tradeoffs: more state-machine complexity, but this is the option that actually attacks the 31s critical path.  
Open questions: is “reader becomes usable after first batch” acceptable for deep links?  
Uncertainties: whether parse/IDB write time dominates even after streaming starts.

4. `Move compatibility repairs/backfills off the hot path`
Impact: low for this trace, medium long-term. Effort: medium. Risk: low-medium. Reversibility: high. Time: 0.5-1 day. Confidence: 0.82.  
Pros: cleaner architecture, less future startup drift, aligns with the repo’s own prior concerns about boot-time repairs.  
Cons: only saves milliseconds here; your trace shows repairs are not the current problem.  
Tradeoffs: architectural hygiene vs immediate latency win.  
Open questions: which repairs are truly one-time migrations?  
Uncertainties: how these ops behave on older/larger real user databases.

**Recommendation**
If the goal is actual boot-time improvement, I would do `2` first and `3` next. `2` is the low-risk fix that makes the measurements real; `3` is the meaningful product win. I would not spend effort on `4` before `3` for this specific trace.

Predicted outcomes:
- After `2`, the duplicate rows in boot telemetry should disappear, and dev boot may drop materially if duplicate imports were happening.
- After `3`, `initializeStore` should stop waiting on full remote import, so time-to-interactive should fall sharply even if background import still takes tens of seconds.

Confidence in that recommendation: `0.9`.

If you want, I can turn this into a concrete investigation plan with expected measurements before we touch code.

2) check if moving from english to fan back to english RESTARTS the translation costing up more api costs, does it not check if an existing translation is in progress and wait for that to complete or fail? can't I read browse other chapters while this chapter translations? is it not async and parallel

3) meta data of the novel is empty and has chapter 1 as title, is it not loaded? what about glossary terms? from the vault? 

4) after I click portal symbol, there is no portal animation, no spinner, no indication that the click registerd, no logs in dev console, so I keep clicking thinking maybe it did not work? 

5) same with illustration icon, no indication that image is being generated, I mean from clicking the icon to the point when the image prompt is made, after that there is the spinner and everything is great

6) update the drop down of image models to make sure it is dynamically loaded and updated to actual models that work, set up tests to ensure we check all of them work - same with other text providers have dummy prompts to check if we get responses (since these are paid tests we should gate them and not run them often)

7) scan for inefficinecies like registering providers again and again, 

8) scan for wasted logs that are not useful - justify each log

9) do logging between chapter changes and identify all causes of delay and optimize 

10) change library word to Home symbol

11) when you do comparision with fan then change chapters the dispay thing follows into the next chapter also! http://localhost:5180/?novel=forty-millenniums-of-cultivation&version=v1-composite&chapter=lexiconforge%3A%2F%2Fforty-millenniums-of-cultivation%2Fchapter%2F305 

12) when i move away from the page and get back the background preload ahead chapters are freshly api called rather than showing the calls that were sent in the background... spinner starts from scratch

13) file:///var/folders/68/c0w7ryfj66xdbs8v0yx662h00000gn/T/TemporaryItems/NSIRD_screencaptureui_EXHMpy/Screenshot%202026-04-08%20at%2011.30.08%E2%80%AFPM.png - the eta for how long it will take is generic and should be made model specific, flash models are faster than other models, aggregation ruins the value

14) file:///var/folders/68/c0w7ryfj66xdbs8v0yx662h00000gn/T/TemporaryItems/NSIRD_screencaptureui_E17Pjj/Screenshot%202026-04-08%20at%2011.32.05%E2%80%AFPM.png - if translation fails then the retry red spinner should be clickable it should not just be like this

15) in comparison it should cycle between raw, fan and google translate! rather than say "selected" and repeat the text just faint underline the text under scrutiny 

16) changing versions means comments should go away and then come back, its tied to that version! and the floating comment icons also have vanished with version switch!

17) 

18) Public configuration boundary: require local broker settings and keep operator records private.

Current cleanup removes built-in endpoints, personal deployment defaults and operational
records. Existing saved settings continue to work. The client artifact scan rejects
embedded Tailnet hosts; `docs/CONVENTIONS.md` governs public-safe handoffs.
Historical refs/caches are a separate assessment; do not claim deletion from history
or copy private audit findings into this issue. Cleanup merged in [PR #174](https://github.com/anantham/LexiconForge/pull/174) at `fb80065`. Private runtime adoption remains a separate deployment check.

## Agent pickup queue — 2026-09-05 latency and complexity pass

These are scoped follow-ups, not permission for a repository-wide rewrite. Claim a ticket with an agent/branch before changing its files. Preserve the historical observations above. Raw debt receipt: [TECH-DEBT-INBOX](docs/roadmaps/TECH-DEBT-INBOX.md#2026-09-05-latency-pass). Start with deletion, then simplify; require measured evidence for performance claims.

### LAT-01 — Remove unrelated routes from cold startup

- **Status:** Merged and verified; [PR #173](https://github.com/anantham/LexiconForge/pull/173), main merge `3301e3a`. Owner: Codex. Measurements below are controlled browser evidence.
- **Files:** `App.tsx`, `App.test.tsx`, `tests/e2e/route-loading.spec.ts`.
- **Evidence / acceptance:** [Build measurements, limits, and reproduction](issues/01-bootup-time/2026-09-05-route-startup.md). Load only the selected feature; preserve deep links, route transitions, and visible download failures. This does **not** close the full-import delay in historical issue 1.

### LAT-02 — Delete abandoned app-shell subscriptions and scaffolding

- **Status:** Merged and verified; [PR #175](https://github.com/anantham/LexiconForge/pull/175), main merge `7962464`. Confidence: 0.99. The deletion remains isolated and reversible.
- **Files / evidence:** `MainApp.tsx:45-46,65-67,76-112,133-142,165-186`. `handleTranslate`, `handleFetch`, `loadPromptTemplates`, `getChapter`, `hasTranslationSettingsChanged`, `currentChapterTranslationResult`, `hasCurrentChapter`, `requestedRef`, and `settingsFingerprint` are declared but never consumed. The two derived selectors still execute on store changes; old auto-translation comments and a commented subscription remain after their behavior moved to the store.
- **Done when:** Remove the unused hooks/imports/ref/memo/commented code; preserve live job warnings and initialization/preload behavior. Existing app-shell/navigation tests pass. Measure render/subscription work before claiming a latency gain; do not replace dead code with another abstraction.
- **Receipt:** [Controlled reader measurements](issues/09-chapter-change-perf-logging/2026-09-05-app-shell.md): 2,000 → 0 chapter lookups per 1,000 unrelated updates; synthetic navigation and job warnings verified; combined source review and fresh CI pass.

- **Review:** [PR #175](https://github.com/anantham/LexiconForge/pull/175); merged after exact-source independent review and fresh five-job CI.

### LAT-03 — Stop rediscovering an unchanged broker on every settings-panel visit

- **Status:** Open; unclaimed. Confidence: 0.95 for duplication; latency benefit unmeasured. Effort: small-medium. Risk: stale discovery if refresh semantics change; reversible.
- **Files / evidence:** `components/settings/ProvidersPanel.tsx:163-190` and `components/settings/SillyTavernPanel.tsx:24-55` each schedule a 300ms timer and call `fetchIndrasNetWorkflows(..., { force: true })`. `services/providers/indrasNetImageProvider.ts:385-418` already provides a normalized-endpoint cache with a 60-second TTL, bypassed by both effects.
- **Done when:** Establish the freshness requirement; prefer deleting routine `force` overrides over adding another cache/hook. Keep explicit Refresh fresh, endpoint changes isolated, and errors visible. Count requests for Providers → SillyTavern → Providers, endpoint edits, and manual Refresh; verify selected workflow/fallback semantics.

### QA-01 — Restore meaningful React type checking

- **Status:** Open; unclaimed. Confidence: 0.99 for the setup gap. Effort: unknown until a baseline is captured. Risk: proper types may expose many existing errors; reversible.
- **Files / evidence:** `package.json`, `package-lock.json`, `tsconfig.json`. React 19 is installed but `@types/react`/`@types/react-dom` are not declared; this checkout has no `node_modules/@types/react`. Baseline `App.tsx` passed typecheck while calling `Loader` without its required `text` prop. Introducing a standard class error boundary exposed missing `props` typing.
- **Done when:** Add compatible React declarations in an isolated dependency PR, record the baseline errors, and resolve them without suppressions or placeholder declarations. An intentional invalid JSX prop must fail `tsc`. Do not describe today's green typecheck as full React prop safety.

### QA-02 — Make wrong-endpoint coverage actually observe the debounce window

- **Status:** Open; unclaimed. Confidence: 0.98. Effort: small. Risk: low; reversible.
- **Files / evidence:** `tests/components/settings/SillyTavernPanel.test.tsx:143-156` mocks endpoint validation and checks “no workflow fetch” immediately after finding a synchronously rendered status. The production fetch is delayed 300ms, so that assertion alone cannot prove it is never sent.
- **Done when:** Use the real validation helper or rely on its existing service contract tests; advance the UI timer beyond the debounce before asserting no dispatch. Demonstrate that removing the production guard fails the test. Delete duplicated assertions that cannot distinguish correct from broken behavior.

### QA-03 — Reproducible worktree and production-browser verification

- **Status:** Partial; setup/configuration implemented in #176. Representative novel and fresh/warm-cache acceptance remain open. Confidence: 0.99 for observed setup friction. Effort: medium. Risk: low if opt-in and local; reversible.
- **Files / evidence:** `playwright.config.ts`, `tests/e2e/helpers/sessionHarness.ts`, `package.json`, `.gitattributes`, and worktree setup instructions. Root Node is 26 while the project requires 24; this pass used an existing Node 24.19.0 binary. A broad `git diff --stat` in the temporary worktree invoked Git LFS cleaning for `media/demo.mp4` and failed writing the main repo's `.git/lfs/tmp`. Scoped diffs worked. The E2E config hardcodes port 5177/dev mode and may reuse an unrelated existing server; production QA needed a temporary preview config.
- **Done when:** Document one persistent worktree per branch with Node 24 and an explicit LFS/dependency setup; do not prune, reset, or stash another agent's work. Reuse the existing session harness with a scrubbed representative novel, fresh/warm cache cases, a selectable production preview URL, and trace-on-failure. Record worktree path and exact source revision in receipts; never use a personal browser profile as the automated fixture. No daemon/dashboard needed.

- **Current correction:** Existing config accepts `LF_E2E_BASE_URL`, refuses accidental dev-server reuse, and retains first-failure traces. The E2E guide now uses locked installation and documents worktree/preview/fixture evidence. No new runner or dependency.

- **Review:** [PR #176](https://github.com/anantham/LexiconForge/pull/176); setup changes pushed for review. Keep this ticket open until the fixture and receipt criteria above pass.

### COPY-01 — Remove the hardcoded sutta title from shared provenance UI

- **Status:** Open; unclaimed. Confidence: 0.99. Effort: small. Risk: factual accuracy; reversible.
- **Files / evidence:** `components/sutta-studio/AboutThisText.tsx:67-69` interpolates the packet's work ID but always appends “Satipaṭṭhāna Sutta (Foundations of Mindfulness).” The same component renders MN117 and live suttas.
- **Done when:** Delete the fixed title or read a verified title from the packet; do not infer a title from the ID. Check two different packets and a packet without title metadata.
### TEST-01 — Replace copied illustration-marker tests with production-path coverage

- **Status:** Open; unclaimed.
- **Evidence:** `tests/store/slices/illustration-marker-insertion.test.ts:14` implements its own `insertMarkerIntoHtml` and all assertions exercise that copy. It cannot detect changes to `store/slices/translationsSlice.ts`'s real action.
- **Done when:** Remove the duplicated test implementation; retain only useful cases against the real action or a justified shared production function. Check actual chapter mutation and no mutation on rejected planning; do not add a wrapper solely to satisfy test counts.


## Consolidation pickup queue — 2026-09-06

Approved sequence: privacy/startup/reader/QA (#174 → #173 → #175 → #176), portable offline graphs (#160), chapter acquisition (#169 → #170 → repaired #171 → #172), alignment (#161 → #162), then coverage/debt policy (#165/#168). Keep #163's domain acceptance and #177's live backend/device acceptance explicit. Defer #164's review automation. Recover unique local-only runtime work onto the merged configuration baseline before retiring old refs. First three PRs are merged; #176 integration checks and independent review pass, with final main-targeted CI pending. Merge records belong in WORKLOG.

### CONS-01 — Give changed chapter artifacts distinct addresses

- **Status:** Open; P2 blocker for #171 and #172 publication. Subject `3a7fee9`; confidence 0.99.
- **Files / evidence:** `scripts/lib/chapter-artifact-builder.ts:23,44,58` derives names without content/version identity; `scripts/build-library-session.ts:88` overwrites them. A Node 24.19 probe of the actual builder gives two changed versions/revisions the same URL with different hashes. Old manifests then fail integrity checks.
- **Candidate / done when:** Prefer digest filenames and manifest-last publication; retain old referenced artifacts. Prove identical bytes keep their address, changed bytes get another address, and both old/new manifests still retrieve hash-valid bytes. Keep directory safety, version checks and full-session compatibility. Hold artifact publication until repaired.

### CONS-02 — Make coverage validation match the measured scope

- **Status:** Open; P2 blocker for #165. Subject `b9f0904`; confidence 0.99.
- **Files / evidence:** `scripts/ci/validate-coverage-policy.mjs:55-67` incompletely mirrors `vitest.config.ts:42-54`. A temporary `components/review.config.ts` with a 90% floor passes validation although Vitest excludes `**/*.config.*`.
- **Candidate / done when:** Share the effective include/exclude scope, delete the no-op mapping and reject excluded-only floors in `tests/scripts/ci/coveragePolicy.test.ts`. Valid floors still pass without lowering thresholds. Explicitly settle root `App.tsx`/`MainApp.tsx` coverage before calling the baseline product-wide. Retain current coverage until corrected.

### CONS-03 — Defer review automation; reconcile its receipt schema if retained

- **Status:** Deferred; P2 blocker for #164 activation. Subject `cabd5c9`; confidence 0.99.
- **Files / evidence:** `scripts/ci/cross-family-review-gate.mjs:135` requires `reviewRunId`, while four real current-head approvals contain `reviewerRunId`. The exact gate rejects all four; changing only that key in disposable copies makes them pass. No real review was edited. The failed controller separately runs a script absent from trusted main; its ADR also duplicates CORE-015.
- **Done when, if retained:** Align producer/schema with a real-format fixture; stale/incomplete reviews still fail; fix the ADR number and prove bootstrap before separately approving activation. Independent source review can proceed without this controller.

### CONS-04 — Preserve task receipts while resolving shared worklog conflicts

- **Status:** Open coordination debt. The five initially conflicted PRs (#161/#164/#165/#168/#169) conflicted only in `docs/WORKLOG.md`; integrating #175/#176 also conflicts there alone.
- **Follow-up:** Preserve both histories now. After consolidation, assess short log pointers to existing per-task evidence instead of more repeated receipts. Do not add a synchronization bot. Recompute each child diff and refresh stale descriptions when its parent merges.


### UI-01 — Preserve the saved-default label when model lists overlap

- **Status:** Open; non-blocking cosmetic review finding.
- **File / evidence:** `components/chapter/IllustrationRouteDialog.tsx` populates its model-ID map in Saved → static Gemini → discovered order. A static entry with the saved ID overwrites the saved-default label/group; the model remains selectable and validation works. Independent Claude source review confirmed this collision path.
- **Done when:** Establish the intended grouping and preserve the saved annotation without duplicate options or another selection abstraction. No latency or submission defect is claimed.
