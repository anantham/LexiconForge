# Integrity scan — 2026-07-26

Ran the `integrity-scan` skill (v1.0.1) across the production TS surface
(~100k lines: services/, components/, store/, hooks/, adapters/, utils/,
scripts/, config/, api/). Seven signatures: lying names, docstring↔code
divergence, comments citing neutralized mechanisms, synonym sprawl, forked
logic, band-aid layering, stale scaffolding. Five parallel auditors produced
candidates; every finding that led to a change was re-verified against the
code before fixing. Operator mandate: fix, no backward-compatibility
constraints.

## Fixed (this branch, one commit per theme)

### P0
- **Fan-translation search probe destroyed every off-allowlist candidate.**
  `probeCandidateUrl` routed candidates through our own allowlist-gated
  fetch-proxy and scored its 403 as "URL doesn't exist" — while the search
  prompt solicits novelupdates/wuxiaworld/webnovel by name, none allowlisted.
  Off-allowlist candidates are now kept unprobed; `fanCandidatesVerified` →
  `fanCandidatesProbed`; drifted private domain list re-derived from
  `SUPPORTED_WEBSITES` with suffix matching. *(fix(search), red-proofed)*

### P1
- **The glossary never reached OpenAI/OpenRouter/DeepSeek/Gemini models.**
  Both adapters carried a single-brace `replacePlaceholders` fork that cannot
  expand `{{glossary}}` — live translations shipped the literal placeholder.
  Claude was a third partial fork. All three now use the canonical helper
  (which gained the glossary `note` field). *(fix(prompts), red-proofed)*
- **The Playwright VPS scrape tier was dead ~4 months** (TCP timeout from two
  vantages), burning a 30s timeout per scrape that reached it while comments
  described a live 3-tier chain. Tier removed. *(fix in scraping sweep)*

### P2 (selection; full details in commit messages)
- db truth (fix(db)): dead pre-resolution above the repository's data-loss
  fallback (paid translation lost above the net built to save it); infra
  errors no longer read as "chapter untranslated" (which triggered PAID
  auto-retranslation); `ensureActiveTranslationByStableId` no longer
  fabricates `isActive: true` without persisting; keyspace-split backups no
  longer abort mid-restore (intra-batch slot tracker); disarmed feedback
  diagnostics re-armed.
- One illustration-marker grammar (fix(markers)): reader tokenizer, HTML
  repair, and EPUB now compose from `illustrationMarkers.ts`; a
  validation-passing `[ILLUSTRATION-2b]` used to render as literal text in
  the reader while the EPUB rendered it.
- Safety names (fix(retry/params/ratelimit)): `isNetworkError` no longer
  classifies user-Cancel as retryable (billed calls after Cancel);
  `isParameterError` no longer matches all of `invalid_request_error`
  (doubled API calls on every context-length/schema failure);
  `canMakeRequest` → `acquireRequestSlot` (consumed a slot as a side effect
  of asking; could never return false).
- Claims sweep (fix(claims) ×2): user-facing "static app with no backend"
  corrected; "Verify save worked" now verifies; stale pointer comments
  restated to where mechanisms actually live; grounding "verified URL" claim
  and fabricated `fetchedAt` honesty-fixed; leaderboard generator header now
  describes bestRunPerModel; `HtmlSanitizer` strips event handlers and
  javascript: URLs from all allowlisted tags; suspicious-short-translation
  tripwire no longer skips cheap models.
- Delegation onions (refactor(db)): `*Modern` wrapper layer inlined (vestige
  of the removed legacy backend); nav-history writes unified under
  `NavigationOps` (was 3 stacks × 6 shell sites for one key); store-then-
  patch double write and the redundant re-activation pass removed; ONE
  `ensureUrlMappings` (errors propagate; auto-repair catches locally);
  `SERVICE_NAMES` decoration deleted; `emergencyRollback` renamed
  `resetToModernBackend`.
- Dead code (chore(dead-code), −855 lines): `novelCatalog.ts`,
  `aiService.ts` shim (+ its `__testUtils` bundle — importers now name
  canonical modules), `SchemaOps` (dormant second DB-open path),
  `validateSession`, deprecated `migrateImagesToCache` **and its test file
  that only exercised the dead fork**, `validateSample`, an
  always-null URL fallback + its false promise, `.ts.backup` debris. The
  rehydrator validators (tested-where-dead) were wired IN as diagnostics
  instead — dead weaver links shipped invisibly while they sat unreachable.
- Identity function (fix(identity)): scripts import
  `generateStableChapterId` instead of carrying copies guarded by a
  "matching the browser version" comment.
- Conventions written down: `docs/CONVENTIONS.md` §6a–6c (verb-prefix
  semantics, noun clusters, single-source grammars).

## Verified TRUE (coverage evidence — not findings)

The scan also confirmed load-bearing claims hold: the transaction kernel's
F1–F4 and completion contract; budget disjointness ("never double-counts");
both spend gates truly refuse; `spend-guard` fail-closed + key preflight +
rubric-version leaderboard filter + roster cross-check; `sanitizeResult`
chokepoint (the [0067] fix) still holds with no new forks;
`findByUrlInMemory` identity-first fix holds; benchmark board legend now
matches the scoring code; `autoTranslateMediator` suppression + its promised
test both exist; the 8 skipped tests are all honest env-gates, none a dead
guard.

## Deferred (filed, with reasons)

| Item | Why deferred |
|---|---|
| Memory-repo backend (`services/db/index.ts` ~490 lines): covers a minority of call sites, so IDB-unavailable environments get an inconsistent half-app | Architecture decision: route ALL consumers through the facade vs delete the memory backend and fail loudly at boot. Needs an operator call. |
| Ops-vs-facade consolidation (pick ONE service-facing API; fold no-op Ops classes into repository re-exports) | Mechanical but wide; delegation is now honest (no `*Modern` layer), so the remaining tax is one hop. |
| `scoring.ts` vs `quality-scorer.ts` dual scorers (`scorePhase`/`scoreAnatomist`/`scoreWeaver` defined in both; `run-scoring.ts` uses one, benchmark/publish the other) | Published-board integrity: consolidating mid-board risks silent rank drift. Do it with the next rubric bump; until then, do not edit one without the other. |
| Two `validatePacket`s with different semantics (report-only vs repairing; neither prod caller gates on `valid`) | Rename (`auditPacket` vs `repairPacket`) + decide whether the assembler should gate. Touches the benchmark lane. |
| Script-side cost math ×4 (`spend-guard`, `run-phase-experiment`, `generate-new-phases`, `benchmark.resolveCostUsd`) | Money-adjacent; consolidate into one `scripts/sutta-studio/lib/cost.ts` in a calm moment, with the provider-quirks catalog open. |
| `repairAnatomistSurfaces` positional-force risk (compensating drop+split slips the count check) | Docstring honesty shipped; the letter-overlap guard + `surface_repair_suspect` telemetry is real work on the compile lane. |
| `getChaptersForReactRendering`/`fetchChaptersForReactRendering` collapse; `normalizeImportUrl` → `rewriteGitHubSessionUrl` rename; `tokenizeEnglish` comment-coupled pair; small helper dedup (`generateId` ×3, `getTimestamp` ×3, `truncate` ×3, script-side `dpdLookup` ×5) | P3 coherence tax; listed so the next session doesn't re-discover them. |
| `migrateImagesToCacheFromDB` has no tests (its dead fork's test file was deleted with it) | Honest gap, better than false coverage; needs a fake-indexeddb harness. |

## Coverage boundaries (what the scan did NOT examine)

Auditors reported not-examined lists rather than silently truncating; the
main gaps: `services/db/operations/maintenance.ts` (2.7k lines, spot-checked
only), most `scripts/sutta-studio/*` bodies (~40 files; hot paths read),
`services/epubService/` beyond the chapter generator, `services/audio/`
bodies, `chrome_extension/`, `tools/`, `Features/`, `Marketing/`, deep
per-file reading of most `components/` (grep-swept + targeted reads). A
future pass should start at `maintenance.ts`.
