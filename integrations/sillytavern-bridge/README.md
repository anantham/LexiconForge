# LexiconForge SillyTavern Bridge

Standalone, FMoC-only bridge for the LexiconForge story portal. It resolves
chapter-bounded character-card files, creates a chapter lorebook and isolated
character copies in SillyTavern, creates a group, and returns a tailnet HTTPS
URL that opens that exact group through the bundled SillyTavern extension.

The bridge binds to localhost. Tailscale Serve is the network boundary; do not
bind either service directly to LAN or public interfaces. The bridge also
requires the Serve-injected `Tailscale-User-Login` to match
`LF_PORTAL_OWNER_LOGINS`. CORS is browser policy, not authorization.

## Local development

```bash
cp .env.example .env
uv run uvicorn portal_bridge.app:app --host 127.0.0.1 --port 5001 --no-proxy-headers
uv run pytest
```

Required environment variables are documented in `.env.example`. No provider
credential is needed: v1 uses the design's spoiler-safe template scenario
fallback and never logs passage or chapter text.

Every creation POST requires a 16-128 character `Idempotency-Key`. The bridge
binds that key to the raw request hash, joins exact in-flight retries, caches
the result for ten minutes, allows one creation at a time, and starts at most
one new creation every two seconds. Bodies are capped at 4 MiB while streaming,
before Pydantic parses the JSON.

## SillyTavern overlay

Copy `st-extension/` to
`SillyTavern/public/scripts/extensions/lexiconforge-portal/`. The extension
accepts only a 10-20 digit `lfGroup` query value, waits for `APP_READY`, opens
that exact group, persists it as active, and removes the query parameter.

## Asus runtime

Run `deploy/windows/bootstrap-bridge.ps1` first. It creates a standard Python
3.12.13 environment, exports the checked-in lock with hashes, synchronizes it,
and runs the bridge suite. The explicit base-Python path avoids uv's generated
Windows junction, which is rejected as an untrusted mount in an SSH session.

The checked-in launchers bind SillyTavern to `127.0.0.1:8000` and the bridge to
`127.0.0.1:5001`. `install-startup-tasks.ps1` registers two narrowly named,
current-user logon tasks disabled. Logs are append-only under
`deploy/windows/logs/`; request content and card bodies are intentionally not
logged.

Before cutover, run `apply-sillytavern-hardening.ps1 -AllowedDeviceIp <ip...>
-Apply`. It requires either the official upstream ancestry or exact reviewed
v1.18.0 manifest/lock blob hashes, applies the Multer 2.2.0 overlay, installs
the exact lock, verifies the installed version and integrity, and changes only
SillyTavern's whitelist block. The list
must contain loopback plus explicit owner-device Tailscale IPs; forwarded-IP
checking, CSRF protection, whitelist mode, and localhost binding must remain on.

Run `cutover-portal.ps1 -AllowedDeviceIp <ip...>` first as a no-write preflight.
Re-run with `-Apply` only after it passes. The cutover removes the exact stale
cleartext `:8000` route before starting SillyTavern, proves both localhost
services ready, then adds HTTPS `:8444` for SillyTavern and HTTPS `:5001` for
the bridge. It rejects Funnel and snapshots/comparisons every unrelated Serve
route. On failure it disables both tasks and removes only newly added routes;
it does not restore the cleartext route.

The dependency overlay intentionally does not manufacture a zero audit. The
2026-08-23 `npm audit --omit=dev` count moves from 44 to 43 findings by removing
the reachable Multer high-severity advisory. The remaining 27 moderate, 15
high, and one critical findings are either outside the portal execution path or
have no compatible published fix; `image-size` remains a reachable, no-fix risk
when SillyTavern parses trusted character-card images. Exposure therefore stays
owner-only and tailnet-only.
