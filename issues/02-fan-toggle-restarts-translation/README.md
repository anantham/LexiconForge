# Issue 2 — Fan toggle restarts translation (suspected)

> Status: **investigated · matrix mostly mis-predicted · needs user repro to confirm bug** · Last updated: 2026-05-02 · Investigator: Opus 4.7

## TL;DR — calibration finding

This issue was the deliberate "multi-theme calibration test" — the index predicted instances of **completion-only-guards** AND **jit-vs-precompute**. After investigation:

- **completion-only-guards: NOT instanced.** The codebase has *dual-layer* in-flight guards. Matrix prediction was wrong.
- **jit-vs-precompute: partially instanced**, but at the **settings axis**, not the toggle axis I was guessing about.
- **silent-feedback-gaps: not instanced.**

So the matrix made a falsifiable prediction and was falsified for one axis, partially confirmed for another. **This is exactly what we want from the matrix** — it tells us where to look, gets corrected by reality, and we update.

The user's actual complaint may be **(a)** a misperception (settings change vs view-mode change), **(b)** a race condition that survived the 2026-04 fix at `translationsSlice.ts:300-318`, or **(c)** a third code path I haven't found. **A live repro from the user is the cheapest next step.**

## 1. Claim (verbatim from Issues.md)

> check if moving from english to fan back to english RESTARTS the translation costing up more api costs, does it not check if an existing translation is in progress and wait for that to complete or fail? can't I read browse other chapters while this chapter translations? is it not async and parallel

## 2. Reproduction

**Not run live.** The static analysis below shows that the most-likely interpretation of the user's words is *defended by existing code*. Without specific repro steps from the user (which buttons, in which order, on what novel/chapter state), I can't tell whether they observed a real bug, a settings-side-effect they didn't notice, or a race I can't trigger on demand.

If the user comes back with reliable steps, this section gets filled.

## 3. Verdict

**Verdict: underspecified — cannot confirm bug from claim alone.** Confidence on each sub-claim:

| Sub-claim | Verdict | Confidence |
|---|---|---:|
| "Toggling english → fan → english restarts translation" | **Defended** by mediator + `handleTranslate` guards. If it's actually happening, it's via a path I haven't located | 0.65 |
| "Does it not check if existing translation is in progress?" | **It does check.** Two-layer defense (see §5) | 0.95 |
| "Can't I browse other chapters while one translates?" | **Per-chapter Set + per-chapter AbortController; no global lock**. Should be fine | 0.85 |
| "Is it not async and parallel?" | **It is.** Per-chapter pending tracking allows multiple in-flight translations | 0.90 |

What would raise confidence to actionable:
- Live screen recording of the user's exact toggle sequence
- Console logs from the user's session showing the trigger trail (the existing `[Retranslate] ⏳ Blocked` and `[AutoTranslateMediator]` logs are very informative)
- A flag for whether the user is changing `includeFanTranslationInPrompt` (a settings flag that legitimately causes retranslation by design)

## 4. Where the failure lives  (A / B / C)

**Pre-investigation provisional:** `(A2, B2, C2)` with themes `completion-only-guards` + `jit-vs-precompute`

**Post-investigation:** `(A1, B1, C2)` for the in-flight guard axis · `(A3, B3, C2)` for the settings-change-retriggers-translation axis

The matrix was right about one thing and wrong about another. Documenting both:

### What was right

The settings-change axis: when `includeFanTranslationInPrompt` (or any other settings field that's part of the matching-version signature at [`translationsSlice.ts:274-289`](../../store/slices/translationsSlice.ts#L274)) toggles, the next translation request creates a new settings signature, doesn't match any existing version, and runs to completion. Cost: 1 API call per settings toggle that doesn't have a pre-existing matching version. **Vision-drifted (C2)**: a vision-aligned design would treat fan-reference inclusion as a *view-time* recomposition cue ("re-render this English translation alongside the fan reference") rather than as a *generation-time* setting that produces a separate persisted version.

### What was wrong

The "completion-only-guards" prediction. The actual code has **two layers**:

1. **Mediator** ([`store/autoTranslateMediator.ts:45-54`](../../store/autoTranslateMediator.ts#L45)):
   ```ts
   function shouldAutoTranslate(snap): boolean {
     return (
       snap.viewMode === 'english' &&
       !!snap.currentChapterId &&
       !snap.hasTranslation &&
       !snap.isHydrating &&
       !snap.isTranslationActive &&
       !snap.isPending
     );
   }
   ```
2. **`handleTranslate` entry guard** ([`store/slices/translationsSlice.ts:184-187`](../../store/slices/translationsSlice.ts#L184)):
   ```ts
   if (state.pendingTranslations.has(chapterId)) {
     console.warn('[Retranslate] ⏳ Blocked: translation already in progress for this chapter', { chapterId });
     return;
   }
   ```

Both guards check **in-flight state**, not just completion. The matrix's `completion-only-guards` prediction was based on the boot-time guard pattern; it doesn't apply here.

**Themes this issue actually instances:**

- [`_themes/jit-vs-precompute.md`](../_themes/jit-vs-precompute.md) — only at the *settings* axis. The toggle-and-retrigger is "view (translation) is durable, settings define identity, change-of-setting forks the view-tree" rather than "view is JIT-derived from settings".

**NEW theme proposal — settings-as-identity:** translation versions are keyed by settings-snapshot fingerprint, so any settings change creates a new persisted version. This is a special case of jit-vs-precompute (storing where one would derive), but specific enough that it might deserve its own theme if more instances appear (issue #6 image-models also has settings-fingerprint-style behavior). **N=1, holding under-threshold for now.**

## 5. Evidence and code paths

### Trigger flow

1. User changes `viewMode` (e.g. via the toggle in `ChapterView.tsx`). [`store/slices/uiSlice.ts:203-211`](../../store/slices/uiSlice.ts#L203) — `setViewMode(mode)` just persists + sets state. **Does not cancel in-flight translation.**

2. The store subscriber at [`store/autoTranslateMediator.ts:65`](../../store/autoTranslateMediator.ts#L65) fires. It compares previous and current `AutoTranslateSnapshot`. If `viewMode === 'english'` AND no translation is hydrating/active/pending AND no translation result exists, it calls `handleTranslate(currentChapterId, 'auto_translate')`.

3. `handleTranslate` enters its own guard at [`translationsSlice.ts:184`](../../store/slices/translationsSlice.ts#L184). If pending, returns early.

4. If past both guards, runs the matching-version check at [`translationsSlice.ts:268-289`](../../store/slices/translationsSlice.ts#L268) — bails if a version with EXACT settings already exists.

5. Otherwise creates AbortController, sets pending, calls `TranslationService`, persists on success.

### The settings-fingerprint signature

[`translationsSlice.ts:278-288`](../../store/slices/translationsSlice.ts#L278) — fields that are part of the version-identity fingerprint:

```ts
const providerMatch = snapshot.provider === currentSettings.provider;
const modelMatch = snapshot.model === currentSettings.model;
const promptMatch = snapshot.systemPrompt === currentSettings.systemPrompt;
const tempMatch = Math.abs((snapshot.temperature || 0.7) - (currentSettings.temperature || 0.7)) < 0.1;
const amendmentsMatch = (snapshot.enableAmendments ?? true) === (currentSettings.enableAmendments ?? true);
const fanReferenceMatch = (snapshot.includeFanTranslationInPrompt ?? false) === (currentSettings.includeFanTranslationInPrompt ?? false);
```

Any change to provider, model, system prompt, temperature (>0.1 diff), amendments, or **fan reference** produces a different fingerprint → new version → new API call when retriggered. By design, but expensive and not visible to the user.

### The race the comment hints at

[`translationsSlice.ts:300-303`](../../store/slices/translationsSlice.ts#L300):
> "Hydrate the existing translation into memory if it's missing. This covers the race where auto-translate fires before hydration loads the translation — the Blocked path used to return empty-handed, leaving the chapter without translationResult in memory."

So a known race existed: auto-translate firing *before* hydration loaded the existing translation, causing duplicate work. The 2026-04 fix at this site addresses it, but the comment leaves open whether all permutations are covered. If the user's complaint is real and reproducible, this race-vicinity is the most likely culprit.

## 6. Test coverage gap

Tests touching this area:

- [`tests/services/translationService.test.ts`](../../tests/services/translationService.test.ts) — heavy, with `includeFanTranslationInPrompt` cases
- [`tests/services/translationSettingsSnapshot.test.ts`](../../tests/services/translationSettingsSnapshot.test.ts) — tests settings snapshot generation
- [`tests/services/translationPersistenceService.test.ts`](../../tests/services/translationPersistenceService.test.ts) — persistence

**Gaps:**

1. No test for the **mediator** under rapid view-mode toggle. A vitest test that fires `setViewMode('english') → setViewMode('fan') → setViewMode('english')` in quick succession and asserts `handleTranslate` is called at most once would directly cover the user's claim.
2. No test for the **race** between auto-translate trigger and hydration completion. Reproducing the documented race deterministically (mocked timing) would prevent regressions.
3. No test that asserts "toggling `includeFanTranslationInPrompt` triggers exactly one new translation, not zero, not two." Without it, future settings-fingerprint changes can break this silently.

## 7. Archaeology

Run: `python3 scripts/issue-archaeology.py store/slices/translationsSlice.ts --git`. Skipping the full output here since the file has many sessions; the relevant signal:

- The **dual-layer guards** were added incrementally — the mediator architecture (commit 17141dd referenced in `autoTranslateMediator.ts`) consolidated three previously-racing triggers. The handleTranslate-entry guard (`pendingTranslations.has`) is older.
- The matching-version race fix at [`translationsSlice.ts:300-318`](../../store/slices/translationsSlice.ts#L300) is recent and explicitly documents the prior race — useful precedent for whatever the user's repro turns out to be.

I did not run a full archaeology trace because the verdict here doesn't hinge on attribution; it hinges on getting a live repro.

## 8. Generator function

If a real bug is present (not yet confirmed), the most likely shape is:

> **"Two state-machines defend in-flight, but neither closes the gap between completion-of-translation and propagation-of-result-to-state-read."**
>
> The mediator checks `hasTranslation` against the chapters-Map's `translationResult`. The handleTranslate-entry guard checks `pendingTranslations`. Between "persistence completes" and "chapter-Map's translationResult updates" there is a brief window where neither is true. A fast viewMode toggle landing in that window observes "no pending, no result" and fires.

This is **adjacent to** completion-only-guards but distinct enough that I'd call it `**state-propagation-windows**`. Not a theme yet (N=0 confirmed); held in this issue's notes for later promotion if a repro confirms it.

The settings-as-identity axis (where any settings change forks a new persisted version) is the more interesting generator architecturally. It's a special case of jit-vs-precompute that may merit its own theme if N≥2 from #6 and #13.

## 9. Fix directions (sketches only — no code)

### Direction A — Get a real repro before any fix

Without it, any fix is speculative. If the user can produce a screen recording + console logs of toggle-and-back triggering retranslation, the actual code path will be obvious.

### Direction B — Make the settings-fingerprint visible

If "user changes setting → costs an API call" is the actual class of bug, the cheapest fix is making it visible:
- A toast on settings change that says "this changes the translation fingerprint — the next view will re-translate"
- A confirm dialog when the change is being made via a fan-related toggle that doesn't look like a settings change

### Direction C — Treat fan-reference as view-time, not generation-time

The vision-aligned move: `includeFanTranslationInPrompt` is currently a generation-time setting that creates a separate version. It could be a view-time directive ("show fan translation alongside the current English translation as a reference") that doesn't fork the version tree. This is a meaningful redesign — out of scope for this issue but worth a follow-up issue or design doc.

## 10. Open questions

- **Asking Aditya:** can you share the exact sequence of clicks that produced the perceived double-translate? Even just "I clicked the language toggle twice" would let me reproduce.
- Did you notice whether `[AutoTranslateMediator]` and `[Retranslate]` console messages fired, and what they said? The `⏳ Blocked` message would prove the guards held; its absence would prove a guard was bypassed.
- Are you running with `includeFanTranslationInPrompt` enabled or disabled? The fingerprint behavior differs between the two states.

This issue is paused on user input. The matrix calibration finding stands regardless: **the prediction was partially wrong, the framework now records that, and the next instance of completion-only-guards has to satisfy a slightly higher bar of evidence.**
