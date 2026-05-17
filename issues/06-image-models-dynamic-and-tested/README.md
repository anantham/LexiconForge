# Issue 6 — Image-model dropdown should load dynamically + be tested

> Status: **investigated** · Last updated: 2026-05-15 · Investigator: Claude Opus 4.7 (1M) · Worktree `opus-issues-investigation`

## 1. Claim (verbatim from Issues.md)

> update the drop down of image models to make sure it is dynamically loaded and updated to actual models that work, set up tests to ensure we check all of them work - same with other text providers have dummy prompts to check if we get responses (since these are paid tests we should gate them and not run them often)

## 2. Reproduction

**Goal:** verify whether the image-model dropdown is dynamic, whether the listed models actually work, and whether tests exist for model availability.

**Environment:** dev server `http://localhost:5183/`, static code inspection.

**Live empirical verification deferred** — exercising each listed model would require paid API calls (the user explicitly notes: "these are paid tests we should gate them and not run them often"). Static investigation of the registry sources is sufficient to verdict.

**Observed result (static):**

| Provider category | Source | Dynamic? | Last verified |
|---|---|---|---|
| Gemini (Imagen, Flash) | `config/constants.ts:43-54` — `AVAILABLE_IMAGE_MODELS['Gemini']` | **Static** | Unknown — hardcoded |
| PiAPI Flux | Same constant (filed under "Gemini" key) | **Static** | Unknown — hardcoded |
| OpenRouter image models | `services/openrouterImageModelAdapter.ts` — fetches from `openrouter.ai/api/v1/models`, caches under IDB key `openrouter-image-models-v2` | **Dynamic** ✅ | At cache fetch time |

Merge logic at `components/settings/ProvidersPanel.tsx:355-414` combines static + dynamic, sorts by provider then price.

**Static-list models with date-stamped IDs (likely-stale):**
- `imagen-4.0-generate-preview-06-06` — preview release ID with June-2026 date stamp (today is 2026-05-15 → already past). Could be deprecated.
- `imagen-4.0-ultra-generate-preview-06-06` — same.
- `gemini-2.0-flash-preview-image-generation` — preview.
- `Qubico/flux1-*` — PiAPI proprietary IDs, no version timestamp.

**Trace:** none captured (deferred until paid API tests are enabled).

## 3. Verdict

**Real bug** (split — partial dynamic, partial static; no model-availability tests) — Confidence: **0.85**.

The system is **partially aligned** with the user's intent:
- ✅ OpenRouter image models ARE dynamic (FEAT-003-compliant).
- ❌ Gemini/Imagen/PiAPI models are static hardcoded lists (FEAT-003 contradiction for OpenRouter category; underspecified for the rest).
- ❌ **No "does this model actually work" tests** exist for any image model.
- ❌ Static-list IDs contain date-stamped preview IDs that almost certainly drift faster than the manual update cadence.
- ❌ Categorization bug: all static models filed under `AVAILABLE_IMAGE_MODELS['Gemini']` even when they're not Gemini (PiAPI Flux is misfiled).

## 4. Where the failure lives (A / B / C)

**Split classification** — confirmed from index:
- **OpenRouter category:** `(A1, B1, C1)` — FEAT-003 says dynamic, code is dynamic, vision-aligned. **No bug at this category.**
- **Gemini/Imagen/PiAPI category:** `(A2, B2, C2)` — FEAT-003 keeps `config/costs.ts` static for these per spec, but the static list itself isn't kept current. ADR underspecified on staleness handling.
- **Test coverage category:** `(A3, B2, C2)` — no ADR governs "verify each model actually works" testing. Code doesn't do it.

### Themes (cross-cutting failure classes)

- [`jit-vs-precompute`](../_themes/jit-vs-precompute.md) — adds an instance. The Gemini/Imagen list is a precomputed snapshot of provider catalogues at code-write time.
- **Propose new theme:** `unverified-external-resource` — assumed-to-work external resources (API endpoints, model IDs, registry data) get into the codebase without any verification SLA. N=1 (this issue). Could expand if other resources exhibit similar lack of liveness checks.

## 5. Evidence and code paths

**Static registry:** `config/constants.ts:43-54`
```ts
export const AVAILABLE_IMAGE_MODELS = {
  Gemini: [
    { id: 'gemini-2.5-flash-image-preview', name: '...', description: '...' },
    { id: 'gemini-2.0-flash-preview-image-generation', ... },
    { id: 'imagen-3.0-generate-002', ... },
    { id: 'imagen-4.0-generate-preview-06-06', ... },      // date-stamped preview
    { id: 'imagen-4.0-ultra-generate-preview-06-06', ... }, // date-stamped preview
    { id: 'Qubico/flux1-schnell', ... },        // PiAPI under "Gemini" key
    { id: 'Qubico/flux1-dev', ... },
    { id: 'Qubico/flux1-dev-advanced', ... },
  ]
};
```

**Dynamic registry:** `services/openrouterImageModelAdapter.ts`
- `IMAGE_MODELS_URL = 'https://openrouter.ai/api/v1/models'` (line 56)
- Fetched + cached under `IMAGE_MODELS_KEY = 'openrouter-image-models-v2'` (line 54)
- Cache refresh logic at lines 200-240 (not exhaustively read this session)

**Merge + display:** `components/settings/ProvidersPanel.tsx:355-414`
- Reads `AVAILABLE_IMAGE_MODELS['Gemini']` for static models.
- Reads `dynamicImageModels` (state, populated by adapter) for OpenRouter models.
- Merges + sorts by provider then price.
- `getProvider(id)` infers provider category from ID prefix — `openrouter/google/`, `openrouter/black-forest-labs/`, `Qubico/`, etc.

**Tests:**
- `components/settings/ProvidersPanel.test.tsx:98` — mocks `AVAILABLE_IMAGE_MODELS` for unit tests.
- **No "does the model exist at the provider" test** exists. No "ping-with-dummy-prompt" gated test exists for either text or image models.

**Apiu metrics evidence (proxy for "does this model work"):** `services/apiMetricsService.ts:509-...` — `getImageModelsWithTokenData()` returns models with **historical** generation data. This is empirical evidence of which models the user has successfully used — but doesn't help with NEW models.

## 6. Test coverage gap & regression-test obligations

### What's missing

- No model-liveness test (gated, paid).
- No staleness alarm: if a static-list model returns 404 / "model deprecated" from the provider, the user gets the error silently mid-translation.
- No CI check that `imagen-4.0-*-preview-06-06`-style date-stamped IDs are auto-flagged for review by an N-month cadence.
- No test asserts PiAPI models are categorized as "PiAPI" provider, not "Gemini".

### Regression-test obligations

| Defect | Required regression test |
|---|---|
| Static-list drift | `tests/services/imageModelLiveness.gated.test.ts` — gated behind `RUN_PAID_LIVENESS_TESTS=1` env var. For each static model in `AVAILABLE_IMAGE_MODELS`, send a single 1-token-style dummy prompt + assert HTTP 200 (or recognized "model deprecated" response). Run weekly in CI, not per-PR. |
| Categorization bug | `tests/components/settings/ProvidersPanel.providers.test.tsx` — assert PiAPI Flux models are categorized as `PiAPI`, not `Gemini`. |
| OpenRouter dynamic fetch failure | `tests/services/openrouterImageModelAdapter.test.ts` — assert cache fallback when API returns 5xx or times out. |
| Cache staleness | `tests/services/openrouterImageModelAdapter.cacheTTL.test.ts` — assert cache invalidates after TTL (read the adapter source to determine current TTL — if none, that's a defect). |

### Text-provider equivalent

The user explicitly extended the claim to text providers ("same with other text providers"). The same liveness pattern applies:

| Defect | Required regression test |
|---|---|
| Text model liveness | `tests/services/textModelLiveness.gated.test.ts` — gated, paid, weekly cron. Dummy-prompt each model in `AVAILABLE_MODELS`. |

## 7. Archaeology

Two sites worth tracing at fix-time:

1. `config/constants.ts:43` — when was `AVAILABLE_IMAGE_MODELS` introduced, and was it ever migrated toward dynamic? FEAT-003 explicitly mentions OpenRouter — was the static side an oversight or intentional?
2. `services/openrouterImageModelAdapter.ts` — when did the dynamic OpenRouter fetch land? It's the model implementation that the static side should mirror.

## 8. Generator function

**Class:** "External-provider catalogue treated as static config, with no liveness probe and no scheduled re-verification."

Distinct from Phantom Consumer (which asks "does the code have a reader?") — this is the inverse: the code has a reader, but the **source** isn't verified to still produce the data the code expects.

**Other places this generator might surface:**
- Translation model availability (same shape).
- Embedding model availability (if used).
- Pricing data in `config/costs.ts` — likely drifts as providers update prices.
- Provider API endpoint URLs themselves (less common to drift, but possible).

## 9. Action — which kind of fix this is

**Compound:**
1. **`enforce_existing_ADR`** for OpenRouter (FEAT-003 already says dynamic; if any OpenRouter category is static, that's the bug).
2. **`fix_local`** for categorization (PiAPI under "Gemini" key — re-key the constant).
3. **`draft_new_ADR`** for the "unverified external resource" pattern: liveness-test SLA + cadence + gating.

### 9.1 enforce_existing_ADR — confirm no OpenRouter models in static list
Quick check: the static list has zero `openrouter/` prefixed IDs. ✅ FEAT-003 currently honored. No action needed if the check holds.

### 9.2 fix_local — re-key static models by actual provider
`AVAILABLE_IMAGE_MODELS = { Gemini: [...], PiAPI: [...] }` instead of all under "Gemini". <30 min change + test.

### 9.3 draft_new_ADR — "Liveness probes for external resources"
Sketch:
> **Proposed ADR-010 — Liveness probes for external resources.**
> 1. Every external-provider catalogue entry (text model, image model, pricing) has a corresponding liveness probe (1-token dummy prompt or model-list API).
> 2. Probes are gated behind `RUN_PAID_LIVENESS_TESTS=1` to avoid per-PR cost.
> 3. CI runs probes weekly via cron; failures open an auto-issue.
> 4. Static-list entries with date-stamped IDs (e.g., `*-preview-MM-DD`) are flagged for review at N+30 days from their date stamp.

| Direction | Impact | Effort | Risk | Reversibility | Confidence |
|---|---|---|---|---|---|
| Re-key PiAPI from "Gemini" to "PiAPI" | Categorization clarity | 30 min | Low | High | 0.95 |
| Draft ADR-010 + gated liveness tests | Catches drift before users do | 4-6 hr | Low | High | 0.85 |
| Add weekly cron for liveness probe | Continuous freshness | 1 hr (after ADR) | Low | High | 0.9 |
| Flag date-stamped IDs for review cadence | Reduces manual sweeps | 1 hr | None | High | 0.9 |

**Recommendation:** Re-key (9.2) is a freebie. Draft ADR-010 if user agrees the "unverified external resource" pattern is worth codifying. Liveness tests + cron land as one PR after ADR ratification.

## 9a. Closing gate

This issue closes as `fixed` when ALL:

- [ ] PiAPI re-keyed to its own provider category.
- [ ] ADR-010 (liveness probes for external resources) ratified.
- [ ] Gated paid liveness tests for image + text models committed.
- [ ] Weekly CI cron for liveness tests configured.
- [ ] Theme `unverified-external-resource` added under `_themes/`.

## 10. Status

`investigated` — compound action: 1× fix_local + 1× draft_new_ADR. Confirms split classification from index.

## 11. Open questions

- Is OpenRouter's `/api/v1/models` itself authoritative for image-model liveness, or do we need a per-model dummy prompt? (OpenRouter's index includes deprecated models — probe needed.)
- What's the right cadence for liveness probes — weekly or monthly? Cost vs freshness tradeoff.
- Should the static `imagen-*-preview-MM-DD` IDs be promoted to GA IDs as the previews stabilize, or removed entirely until they GA? (Open product question.)
