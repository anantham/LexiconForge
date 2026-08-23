# LexiconForge SillyTavern Bridge

Standalone, FMoC-only bridge for the LexiconForge story portal. It resolves
chapter-bounded character-card files, creates a chapter lorebook and isolated
character copies in SillyTavern, creates a group, and returns a tailnet HTTPS
URL that opens that exact group through the bundled SillyTavern extension.

The bridge binds to localhost. Tailscale Serve is the network boundary; do not
bind either service directly to LAN or public interfaces.

## Local development

```bash
cp .env.example .env
uv run uvicorn portal_bridge.app:app --host 127.0.0.1 --port 5001
uv run pytest
```

Required environment variables are documented in `.env.example`. No provider
credential is needed: v1 uses the design's spoiler-safe template scenario
fallback and never logs passage or chapter text.

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
current-user logon tasks and starts them. Logs are append-only under
`deploy/windows/logs/`; request content and card bodies are intentionally not
logged.

The intended tailnet-only routes are additive HTTPS listeners: port `8444`
proxies to SillyTavern and port `5001` proxies to the bridge. Do not enable
Tailscale Funnel or replace unrelated Serve routes.
