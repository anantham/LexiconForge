# LexiconForge security repair receipt — 2026-10-02

Scanned/deployed source: `9e79b036400d6c009edd5c4881f4e223be3e74ae`.
The private scan report was read without alteration and its local identity and
byte verification remain in task-local evidence. This receipt records validated
source findings and synthetic evidence without novel prose or credentials.

The user authorized implementation, tests, task branches, worktrees and local
commits. Publication, merge, deployment, runtime settings, credential rotation,
repository visibility and destructive history cleanup are excluded. No production
change is represented by a local fix. Existing main/other worktrees were preserved.

## Finding validation and disposition

| Report | Source conclusion | Implemented boundary / acceptance evidence |
| --- | --- | --- |
| L01 proxy work | Supported: body collection unbounded and timeout renewed per redirect | Shared server handler: HTTPS/default ports, no credentials, 4MiB actual response bytes, 20s entire operation, four redirects, bounded caller/process admission. Synthetic streams prove overflow/deadline/hop rejection and ordinary decoding. |
| L02 active same-origin source | Supported: upstream source returned as navigable HTML | Plain-text attachment, nosniff, sandbox CSP, no-store; source bytes remain available to scraping. Actual API and Vite middleware tests assert representation. |
| L03 local provenance | Supported: Windows manifest-only fallback does not authenticate source tree | Exact reviewed commit and complete tracked/index/worktree byte checks, unreviewed executable additions rejected before provisioning; dependencies and approved mutable runtime data are excluded. Synthetic trees prove altered source/flags/history cannot pass. |
| L04 target YAML dependency | Supported: verifier loads target's untrusted parser | Fixed tool-owned parser import and pinned dedicated tooling lock; target module resolution/install is never used for verification. Synthetic target malicious parser is never executed. |
| L05 auxiliary recipient | Supported: selected provider can silently become OpenRouter | Comparison/explanation/diff use selected Settings provider and key; missing key, disabled feature, unknown provider, response/request failures and malformed diff fail closed. Recipient matrix mocks all five providers. |
| L06 public CORS disclosure | Supported: automatic unrelated proxy list receives full URL | Automatic fallback list disabled, including prior Worker tier; first-party failure contacts only requested site directly, or returns failure. Scraping and dictionary tests assert complete recipient lists. |
| L07 legacy inspector sink | Unsafe innerHTML supported; current import-to-sink exploit inapplicable at this source | Current imports use `lexicon-forge` schema16; obsolete inspector opens `LexiconForgeDB` v9. Literal DOM rendering is defense in depth for legacy data. No current-path XSS claim. |
| L08 liturgy code identifier | Supported: imported exportName enters executable binding syntax | Binding identifier and reserved-name validation before generation/output; code-bearing names reject, ordinary names emit valid TypeScript. |
| L09 grounding paths | Supported: imported stableId becomes read/write filename | Strict IDs, whole-session ID preflight, canonical containment and descriptor-relative no-follow regular-file reads/writes. Synthetic traversal/symlink/pipe/full-flow checks. |
| L10 remote imports | Supported: header-only timer/Content-Length fail to bound body and early persistence | Bounded staged download and incremental strict JSON/shape preflight precede any remote-import persistence; actual bytes/end-to-end time/shape limits and rejection-state tests. |
| L11 dev report paths | Supported under Windows/dev reachability prerequisites | Safe report basenames, realpath containment, loopback default. Synthetic grammar/symlink/middleware tests; native Windows execution remains unverified. |
| L12 telemetry work/logs | Supported: arbitrary string enums and unrestricted logging | Fixed enums, existing16KiB body cap, caller/process budgets, tuple dedupe, 1-in10 sampling, bounded dedupe table and allowlisted logged fields. Production edge throttling still needed for invocation control. |
| L13 bridge log growth | Supported under reachable local/tailnet bridge prerequisites | Bounded rejection aggregation and rotated/retained logs via controlled launcher; synthetic caps/rotation tests. No public reachability or Windows runtime claim. |
| L14 extension markup/sender | Supported markup/UI injection; arbitrary extension script execution not established | textContent logs, bounded log length, active allowed top-frame sender/URL validation. Synthetic sender and literal DOM tests; installed-browser extension verification remains open. |
| L15 EPUB statistics | Supported inherited-property pollution; code execution not established | Null-prototype provider/model dictionaries, strict imported object-key preflight; hostile label regression proves unchanged prototypes and normal aggregation/export. |

## Resource and behavior contracts

Proxy limits are constants in the shared handler. Admission is per process, with a
fixed registry cap and expiry; distributed serverless throttling must be deployed
at the edge after approval. Platform body parsing occurs before telemetry code;
application rejection cannot prevent all anonymous function invocations.

Remote session imports preserve the existing 500MiB cap for large supported
libraries, with actual streaming byte accounting, a 120s full-download/preflight
deadline, maximum 10,000 chapters, 16,777,216 UTF-16 code units per serialized chapter, 8,388,608 per string, depth64,
2 million values, 100,000 array items, 4,096 object keys, 1,000 translations/chapter
and at most131,072 received chunks. Keys are capped at1,024 code units and captured envelope objects at33,554,432 code units. Network-time reading starts after validated staging;
local chapter-by-chapter persistence remains. This bounds allocations but may
still require substantial browser memory at the maximum size. Storage failures
retain established import semantics; no new claim of transactional restoration
for concurrent canonical writes is made. Network/schema rejection occurs before
any persistence.

Provider changes retain browser-local Settings credentials. Diff now uses the
selected model and its cost, with no hidden `gpt-4o-mini` fallback. Existing
comparison/explanation metrics use the translation category. Live native-model
quality is unverified. Pre-existing prompt/response diagnostic logging in diff and
comparison is outside the enumerated server telemetry/bridge log findings and
remains a separate privacy debt item.

Grounding IDs containing separators, colons or other unsupported characters now
reject visibly; existing slug/unit IDs remain supported. Descriptor-relative
no-follow I/O fails closed on platforms lacking those APIs. Windows provenance
requires byte-preserving checkout; previously tolerated history imports or
arbitrary descendants now reject and require a reviewed provenance update.

## Integrated validation and independent review

Runtime: Node24.19.0 and Vitest4.0.16. Installed top-level package versions
match the lockfile; this comparison originally missed absent React type packages.
The exact locked React/React-DOM types and csstype were subsequently restored in
task-owned storage with SHA-512 verification and no package scripts. Existing
dependency bytes were reused without mutating the original checkout; Vite caches
were isolated. The missing axe Playwright helper affects the unperformed browser
audit, not these local unit/build/type gates.

- Full suite plus coverage: **331 files, 9,828 passed, 347 skipped**. Untouched
  scan baseline: 324 files, 9,610 passed, 347 skipped.
- Coverage policy passes: lines62.04%, statements60.44%, functions59.99%,
  branches48.80%; all per-file floors pass.
- Bridge aggregate: **69 passed**. Grounding synthetic workflow: **8 passed**.
- Production build, client-artifact secret scan, extension packaging, repository
  integrity and whitespace gates pass.
- Whole-repository lint: **0 errors, 1,853 warnings**; warnings were not suppressed.
- Full TypeScript checking passes on both the final source and untouched scan
  source after restoring the exact locked React type declarations. The earlier
  two TS2578 diagnostics were the QA guard detecting an incomplete local runtime,
  not baseline source defects. No type fixture or application code was suppressed.

Independent source review covered all groups and final integration, including
per-provider recipient tests, staged-import validation, provenance checks,
path/sender guards and resource quotas. It found an ignored-file packaging defect
and the agent explicitly staged the new import modules/tests before commit. No
unresolved actionable source findings remain after review; confidence0.90 for
reviewed local/mocked behavior, without production-runtime assurance.

Integrated build verification caught a CommonJS-to-ESM Vite config loader
regression. A trusted fixed-path `createRequire` keeps the server policy outside
the config bundle; a new regression uses Vite's actual bundled loader. Production
build and independent loader/middleware regression now pass. Restart the dev
server after shared policy changes.

During early provider test development, the SDK's externalized Node transport
bypassed an initial mock and attempted synthetic DNS requests. They failed with
ENOTFOUND; no provider HTTP response, paid request or private-content disclosure
occurred. That harness was stopped and corrected to inject mocked SDK transports.
Subsequent recipient tests use synthetic content and mocked transport. A public
disposable upstream source clone for genuine-seed testing failed with a connection
reset, so genuine-seed acceptance is explicitly unverified.

## Schedule calibration

| Milestone | Original plan (UTC) | Observed (UTC) |
| --- | --- | --- |
| Actual start | 11:23 | 11:23 |
| First parent assessment | Within ten minutes; combined plan due11:34 | Sent11:27 |
| Validate finding/file map | By11:45 | All groups traced by11:40 |
| First proxy/privacy fixes and tests | 12:20–12:40 | Root/provider local commits by11:43 |
| All fix groups | 12:50–13:20 | All groups locally committed by11:50; integrated by11:52 |
| Final review and aggregate checks | 13:50–14:50 | Code review and final aggregate/loader checks complete by11:58 |

Original estimate was150–210 minutes, confidence0.70. At11:41 it was revised to
90–140 minutes, confidence0.78, because reusable adapters and a prepared trusted
runtime removed expected setup work. The final loader correction added several
minutes, without slipping the original or revised milestone windows. Individual
implementation estimates versus actuals: provider45–60 vs18 minutes;
inputs65–85 vs22; imports75–110 vs24; provenance/logs60–90 vs25;
independent review30–45 vs14, plus about2 for loader follow-up. These activities
ran concurrently; summing their times is not elapsed duration. Estimates were
substantially conservative for local deterministic verification. They excluded
unperformed native/deployed acceptance and a fresh scan; those remain open.

## Remaining acceptance and approved-deployment sequence

1. Parent reviews this grouped commit series and exact changed-file manifest.
   Follow-on publication was requested after owner approval was recorded, but
   automatic approval review rejected both attempts because it requires direct
   user authorization in the child task. No push/PR, merge, deployment or runtime
   activation was performed; the rejection was not bypassed.
2. Run exact-head CI and the repository's external PR-review gate after
   authorized publication. The supposed baseline TypeScript fixture failure is
   withdrawn: final and baseline type checks pass with complete React types. Fresh security scanning requires its own applicable
   cost/authorization envelope and was not run by this task.
3. After merge/deployment approval, deploy the frontend and the serverless API
   together, verify safe proxy headers/limits in the deployed environment with
   controlled synthetic fixtures, and configure approved fleet-wide edge limits
   for proxy and telemetry invocation admission. No production settings have
   been changed or assumed to exist.
4. Distribute the updated extension and grounding scripts including `safe_paths.py`;
   exercise the installed extension and representative large imports on target
   devices without private content export or unapproved paid calls.
5. For local SillyTavern activation, use the exact reviewed upstream checkout
   with `core.autocrlf=false`, install only the trusted deployment-tool lock with
   lifecycle scripts disabled, then run native platform preparation/tests before
   any task/route activation. Dependency integrity and mutable runtime data are
   outside the complete tracked-source byte check. Windows execution and genuine
   seed round trip remain prerequisites, not completed milestones.

Keep all task worktrees/commits and evidence available for parent review. Existing
production remains at its previous source/runtime state. Local regression success
is not a claim of deployed protection, compromise absence or all-project coverage.


## Follow-on publication and validation correction

The public repository identity, owner push/admin permission and remote base were
verified. Outgoing additions exclude the private report, Library identifiers,
local user paths and credential patterns. Two publication attempts were rejected
before execution; no alternate route was used. Automatic review has therefore not
been observed for this branch, and no manual review comment was sent. Draft-to-ready
transition remains a separate parent decision. Existing GitHub workflow state was
read without enabling or changing Actions; the scan-base Test run passed all five
jobs. This is baseline CI evidence, not CI for the unpublished security head.

The original local TypeScript classification was incorrect. QA-01 detected absent
React type declarations in the reused dependency installation. Restoring the exact
locked types makes both baseline and final type checking pass without source edits.
The historical test logs are retained with corrected-runtime logs and an explicit
correction; they must not be described as baseline source defects.
