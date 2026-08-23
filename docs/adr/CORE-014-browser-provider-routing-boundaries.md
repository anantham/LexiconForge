# CORE-014: Browser Provider Routing Boundaries

**Status:** Implemented
**Date:** 2026-08-23
**Domain:** Provider routing and data handling

## Issue

LexiconForge already lets readers supply their own provider keys and choose text
and image models, but an OpenRouter model may be served by several independent
endpoints. The browser did not expose or preserve the endpoint choice. It also
needed a one-illustration override without making the user's reading session,
SillyTavern configuration, or IndrasNet broker responsible for coordinating all
cloud providers.

## Decision

1. LexiconForge owns two independent OpenRouter defaults: one for text requests
   and one for image requests. A text choice never changes image routing and an
   image choice never changes text routing.
2. Endpoint options are discovered from OpenRouter for the exact selected model.
   `Auto` omits an exact host pin; selecting a host sends `provider.only` and
   disables fallback so the request cannot silently execute elsewhere.
3. Every LexiconForge OpenRouter request sends `data_collection: "deny"` and
   `zdr: true`. Request-specific capabilities may add restrictions but may not
   weaken either data-handling requirement.
4. The selected-passage illustration action opens a responsive confirmation
   sheet. A reader may choose a model and endpoint for that one job. The store
   applies those values to an immutable settings snapshot and does not persist
   them as global defaults.
5. Endpoint discovery is advisory. A saved endpoint remains visible if discovery
   fails or the model catalogue changes; LexiconForge does not silently rewrite
   it to `Auto`.
6. Direct provider requests remain browser-to-provider. IndrasNet coordinates
   only its own ComfyUI work. Portal context transfer to SillyTavern carries
   story context, not LexiconForge provider settings.

## Positions considered

- **Global defaults only:** smallest change, but cannot choose a faster or more
  permissive route for one illustration without rewriting the reading defaults.
- **Independent defaults plus a one-job override (selected):** explicit,
  reversible, and keeps the existing client-only architecture.
- **Automatic local/cloud broker routing:** could hide outages, but centralizes
  unrelated credentials and provider policy in IndrasNet and risks unexpected
  cost or duplicate generation.

## Consequences

- Exact-host requests fail loudly when that model/host/privacy combination is
  unavailable. This is intentional; the user can choose `Auto` or another host.
- Provider catalogue availability is not a prerequisite for using a saved route.
- Browser-direct OpenRouter work survives chapter navigation through the image
  job system but not tab closure. No new server persistence is introduced.
- SillyTavern must expose its own text and image settings; this ADR prohibits
  importing LexiconForge provider choices through the portal bridge.

## Implementation notes

- `services/openrouterRouting.ts` owns endpoint discovery, caching, routing, and
  the deny/ZDR invariant.
- `components/settings/OpenRouterEndpointSelect.tsx` is shared by saved defaults
  and the one-job illustration sheet.
- `components/chapter/IllustrationRouteDialog.tsx` owns the responsive per-job
  affordance.
- `services/imageJobTypes.ts`, `store/slices/translationsSlice.ts`, and
  `store/slices/imageSlice.ts` thread optional overrides through a cloned
  settings snapshot.
- OpenRouter text adapters/planners and the OpenRouter image request path apply
  the routing helper at request construction time.

## Related decisions

- [SEC-001](./SEC-001-browser-provider-credential-boundary.md)
- [FEAT-003](./FEAT-003-image-service-architecture.md)
- [CORE-012](./CORE-012-background-work-survives-navigation.md)
