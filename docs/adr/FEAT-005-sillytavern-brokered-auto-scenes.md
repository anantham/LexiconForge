# FEAT-005 — SillyTavern Brokered Auto-Scene Illustrations

**Status:** Accepted
**Date:** 2026-08-23
**Group:** Integration / image generation

## Issue

LexiconForge portal chats should illustrate the scene after each conversational
turn. SillyTavern can call ComfyUI directly, but that would bypass IndrasNet's
GPU admission, service lifecycle, telemetry, and resumable HTTP job contract.
The Asus laptop and IndrasNet may be offline, and image generation must never
block or corrupt the text conversation.

## Assumptions and constraints

- A "turn" means one completed group response cycle, not one image per group
  member. Non-group chats use the completed assistant message.
- V1 uses a client-ready registered IndrasNet workflow by name; it never sends
  an arbitrary workflow graph.
- The browser tab need not survive closure. An in-flight job may finish in the
  broker, but the extension does not reconstruct it after the tab is closed.
- The extension stores no broker credential. Tailnet identity and IndrasNet's
  owner boundary remain authoritative.
- SillyTavern and the broker remain localhost services behind separate,
  tailnet-only HTTPS routes. Public/Funnel exposure is prohibited.
- The official SillyTavern dependency-audit gate recorded in FEAT-004 remains
  unresolved and is not waived by this decision.

## Positions considered

### A. SillyTavern calls ComfyUI directly

Lower initial effort, but it creates a second GPU queue and bypasses the broker
that coordinates LM Studio, ComfyUI, and other GPU consumers.

### B. SillyTavern extension calls the IndrasNet broker (selected)

Reuse the broker's resumable job API and registered workflows. The extension
composes a scene prompt through SillyTavern's current chat model, submits one
job, polls its operational state, and attaches the returned artifact to the
triggering message.

### C. LexiconForge coordinates every SillyTavern image

Centralizes UI state but wrongly makes the reader tab a coordinator for a chat
that runs in another application and duplicates the existing broker contract.

## Decision

1. The LexiconForge SillyTavern extension owns auto-scene behavior.
2. Group chats trigger only on `GROUP_WRAPPER_FINISHED`; non-group chats use
   `CHARACTER_MESSAGE_RENDERED`. A chat/message fingerprint suppresses duplicate
   event delivery and extension-generated messages are never recursive inputs.
3. The extension asks SillyTavern's configured chat model for a concise visual
   prompt. Prompt-composition failure is explicit and does not submit weak or
   empty work to the GPU queue.
4. The extension submits `workflow_name`, `prompt`, `negative_prompt`, and a
   bounded timeout to `POST /api/comfyui/jobs`, then polls the returned job ID.
5. Queued, running, completed, failed, offline, timeout, and broker-restart
   states are logged with the job ID and surfaced to the user. No passage or
   prompt text is logged.
6. On completion, the first returned image is attached to the assistant message
   using SillyTavern's `extra.media` schema. The attachment records workflow,
   broker job ID, prompt ID, and timing as provenance metadata.
7. Broker failure never edits or removes conversation text. A user can continue
   chatting while a job runs.
8. Defaults are enabled only for LexiconForge portal groups, use `gen_anime`,
   and remain configurable in SillyTavern's extension settings.

## Consequences

- IndrasNet remains the single GPU broker and its existing ComfyUI run ledger
  receives these generations without a new coordination service.
- One browser tab owns its own in-flight polling. Reload/tab closure recovery is
  intentionally out of scope.
- The eventual SillyTavern HTTPS origin must be added exactly through
  `INDRASNET_CORS_ORIGINS`; no wildcard is permitted.
- If IndrasNet is down, a clear notification replaces the image but the chat
  continues.
- This ADR remains `Accepted` until mocked integration tests and one safe live
  broker E2E pass, and FEAT-004's separate dependency/exposure gate is resolved.

## Related artifacts

- `docs/adr/FEAT-003-image-service-architecture.md`
- `docs/adr/FEAT-004-sillytavern-tailnet-portal.md`
- `integrations/sillytavern-bridge/st-extension/`
