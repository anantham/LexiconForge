# FEAT-004 — SillyTavern Tailnet Portal

**Status:** Accepted
**Date:** 2026-08-23
**Group:** Integration / interactive reading

## Issue

The approved April self-insert design implemented the LexiconForge button but
assumed complete localhost `novel-analyzer` and SillyTavern installations. On
2026-08-23, read-only Asus inspection found that both directories were partial,
unversioned snapshots; port 5001 was closed; and the existing Tailscale port
8000 mapping targeted an unoccupied localhost listener. A production HTTPS page
cannot safely call a raw tailnet HTTP URL, asynchronous preparation can lose
the browser popup gesture, and SillyTavern 1.18.0 has no exact-group deep link.

## Assumptions and constraints

- V1 remains FMoC-only.
- FMoC character-card filenames declare explicit chapter ranges and are the
  spoiler boundary; current/future card content must not leak into chapters
  outside that range.
- SillyTavern and the bridge bind only to localhost. Tailscale Serve provides
  tailnet identity and TLS; Funnel/public exposure is prohibited.
- Existing Asus source snapshots and unrelated Serve routes remain untouched.
- The public LexiconForge repository may contain bridge code, tests, and a
  small SillyTavern overlay, but never the private vault or credentials.

## Positions considered

### A. Clean isolated runtime plus versioned bridge (selected)

Pin an official SillyTavern release in a new Asus runtime directory. Keep the
standalone bridge and exact-group extension versioned under
`integrations/sillytavern-bridge/`, deploy that source to Asus, and expose both
services through additive tailnet-only HTTPS listeners.

### B. Repair the partial snapshots in place

Rejected: the directories have no Git provenance, runtime manifests, or
complete dependency graph. Repair would blur source, generated state, and
private vault ownership and would have a poor rollback boundary.

### C. Retain localhost-only behavior

Rejected: it cannot satisfy the selected production-browser-to-Asus use case.

## Decision

1. The bridge resolves a character only from a card filename matching both its
   normalized name and the requested chapter range. Missing cards are reported;
   if none match, the request fails before any SillyTavern write.
2. Each successful request creates uniquely named character copies and a
   chapter lorebook. The full translated chapter is attached as constant world
   context; the selected passage becomes the immediate second-person scenario.
3. The bridge creates a fresh group/chat identity and returns an HTTPS
   `chatUrl` containing only a numeric `lfGroup` identifier.
4. A minimal SillyTavern extension validates `lfGroup`, waits for app readiness,
   opens the exact group, persists it as active, and removes the query value.
5. LexiconForge reserves a blank tab synchronously during the portal click. It
   navigates that tab only after a validated success and closes it on failure.
6. `GET /health` reports bridge, vault, and SillyTavern readiness. The portal is
   hidden unless the complete dependency chain is ready.
7. CORS is allowlisted to the production reader and explicit localhost origins.
   The bridge logs operation/chapter/count metadata and errors, never passage,
   full chapter, credentials, or card contents.

## Consequences

- This is a real companion service, not a Vercel function. Availability still
  depends on Asus being awake, Tailscale connected, and both local services
  running.
- V1 uses the approved template scenario fallback and needs no LLM credential.
- One request creates new SillyTavern artifacts; automatic garbage collection
  and chat continuity remain future decisions.
- Multi-novel support requires a separate registry/contract decision rather
  than more FMoC path conditionals.
- The ADR remains `Accepted` until the source PR is merged and the real
  LexiconForge → bridge → SillyTavern → exact-group path passes device E2E.

## Related artifacts

- `docs/superpowers/specs/2026-04-05-sillytavern-self-insert-design.md`
- `docs/superpowers/plans/2026-04-05-sillytavern-self-insert.md`
- `integrations/sillytavern-bridge/`
- `services/selfInsertService.ts`
- `services/selfInsertPortal.ts`
- `services/sillyTavernBridge.ts`
