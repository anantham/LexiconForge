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

Create an ignored `.env` from `.env.example` and replace the placeholders first.
For a POSIX shell:

```bash
set -a
. ./.env
set +a
uv run uvicorn portal_bridge.app:app --host 127.0.0.1 --port 5001 --no-proxy-headers
uv run pytest
```

Required environment variables are documented in `.env.example`. Export your actual
values into the process environment; the bridge does not automatically load `.env`. No provider
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

The same overlay can generate one scene illustration after each completed chat
turn. Group chats trigger after the whole group response cycle, not after each
character. The extension uses SillyTavern's configured chat model to compose a
visual prompt, then sends the image to one independently selected route:

- **IndrasNet** uses the resumable ComfyUI job API and a registered workflow.
- **SillyTavern Image Generation** uses the source, model, and server-held
  credential already selected in SillyTavern's own Image Generation panel.

The second route invokes SillyTavern's registered `imagine` callback directly;
generated prompt text is never parsed as STscript. The returned image is
attached to the triggering message with backend/provider/model provenance.
Provider failure never blocks or edits the text conversation. Jobs are
intentionally tab-scoped; reload/tab-closure recovery is out of scope.

Controls live under SillyTavern's Extensions panel. Auto-scene is enabled by
default only for bridge-created LexiconForge portal groups. The image route,
broker URL/workflow, negative prompt, and scope are configurable. SillyTavern's
API Connections panel remains authoritative for the text model; its Image
Generation panel remains authoritative for native image source/model selection.
These settings are deliberately separate from LexiconForge reader settings.
The UI reports elapsed time rather than inventing a percentage or ETA; neither
route currently supplies one to this extension.

Stock SillyTavern 1.18.0 does not add OpenRouter `provider.data_collection` or
`provider.zdr` fields to its native image request. Select a provider/account
policy that meets the desired retention boundary; this overlay does not claim
to strengthen that upstream request. Exact per-request OpenRouter privacy
routing would require a separately reviewed SillyTavern server change.

## macOS preparation and foreground launch

Use Node 24.19 and the explicit approved `LF_ST_ROOT`; keep the runtime outside
this repository. For a new installation, clone the official source once into an
absent destination and select the reviewed release:

```bash
: "${LF_ST_ROOT:?Set the approved installation directory}"
git clone https://github.com/SillyTavern/SillyTavern.git "$LF_ST_ROOT"
git -C "$LF_ST_ROOT" checkout --detach 51ad27fb86d39a3daca3adaa970375c9670c12df
bash deploy/macos/prepare-sillytavern.sh --apply
bash deploy/macos/prepare-sillytavern.sh
```

Run these commands from this integration directory. For an existing checkout,
skip cloning and start with the last command. Preparation requires the exact
upstream commit and either the exact base or reviewed hardened manifest pair.
`--apply` applies the overlay, runs `npm ci --ignore-scripts`, sets the whitelist
to loopback only and installs the byte-verified extension. Without `--apply`, it
checks the complete prepared state without installation or configuration writes.
Unrelated changes, a changed extension, staged files and mixed manifests fail.
A failed apply leaves its explicit checkout available for inspection and retry;
it does not claim atomic installation or activate a service.

The existing configurator's `--local-only` mode cannot be combined with device
IPs. Other forwarded-IP, CSRF and security settings must already be safe. Its
Windows path remains stable for existing callers; no wrapper is needed.

Prepare the bridge with `uv sync --frozen --python 3.12`, export the explicit
values described in Local development, and use its existing foreground uvicorn
command. In a separate terminal, start SillyTavern:

```bash
: "${LF_ST_ROOT:?Set the approved installation directory}"
cd "$LF_ST_ROOT"
NODE_ENV=production node server.js --port 8000 --no-listen --no-browserLaunchEnabled
```

These commands do not create startup tasks, expose routes, copy a private vault,
or bypass owner admission. A locally supplied identity header is only a test
fixture and cannot prove Tailscale/device authorization. Use the existing owner
path for actual portal acceptance; read-only local `/csrf-token` health alone is
also insufficient.

Run `python3 tests/macos/test_preparation.py --seed <reviewed-checkout>` for the
executable disposable-clone probe. The seed must have the exact upstream commit
and installed lock-pinned `yaml` 2.8.3. The probe uses real Git, overlay and
configuration operations, but simulates npm; it never modifies the seed or starts
services. The seed is an explicit fixture input, not a machine-specific default.

## Windows runtime

Run `deploy/windows/bootstrap-bridge.ps1 -BasePython <python.exe>` first. It creates a standard Python
3.12.13 environment, exports the checked-in lock with hashes, synchronizes it,
and runs the bridge suite. The explicit base-Python path avoids uv's generated
Windows junction, which is rejected as an untrusted mount in an SSH session.

Set `LF_ST_ROOT`, `LF_PORTAL_VAULT_ROOT`, `LF_PORTAL_ST_PUBLIC_URL` and
`LF_PORTAL_OWNER_LOGINS` in the runtime user's private environment before launching
or registering tasks. The launchers reject missing configuration and retain the
error in their log even when started by a headless scheduled task. The bridge root
is resolved relative to its launcher. Existing deployed launchers are not modified
by a source checkout; review configuration migration before deployment.

The checked-in launchers bind SillyTavern to `127.0.0.1:8000` and the bridge to
`127.0.0.1:5001`. `install-startup-tasks.ps1` registers two narrowly named,
current-user logon tasks disabled. Logs are append-only under
`deploy/windows/logs/`; request content and card bodies are intentionally not
logged.

Before cutover, run `apply-sillytavern-hardening.ps1 -SillyTavernRoot <directory>
-AllowedDeviceIp <ip...> -Apply`. It requires either the official upstream ancestry or exact reviewed
committed v1.18.0 manifest/lock blob hashes, applies the Multer 2.2.0 overlay, installs
the exact lock, verifies the installed version and integrity, and changes only
SillyTavern's whitelist block. The list
must contain loopback plus explicit owner-device Tailscale IPs; forwarded-IP
checking, CSRF protection, whitelist mode, and localhost binding must remain on.
The working manifests must be either the exact reviewed base pair or the exact
reviewed overlay pair. Re-run without `-Apply` to verify without installation or
configuration writes. The configurator's timestamped backups are preserved and
accepted; unrelated uncommitted files remain a failure.

Run `cutover-portal.ps1 -SillyTavernRoot <directory>
-OwnerLogin <owner-login> -AllowedDeviceIp <ip...>` first as a no-write preflight.
The resolved directory must match `LF_ST_ROOT` in that runtime user's environment;
missing or mismatched launcher configuration fails before hardening or task/route work.
Re-run with `-Apply` only after it passes. The cutover removes the exact stale
cleartext `:8000` route before starting SillyTavern, proves both localhost
services ready, then adds HTTPS `:8444` for SillyTavern and HTTPS `:5001` for
the bridge. It rejects Funnel and snapshots/comparisons every unrelated Serve
route. On failure it disables both tasks and removes only newly added routes;
it does not restore the cleartext route.

Run `tests/windows/test-runtime-configuration.ps1` in a separate PowerShell process
to check root matching and missing-variable logs using disposable launcher copies.
The probe stops at a hardening sentinel; it does not start services or alter routes.

Run `tests/windows/test-hardening-repeat.ps1 -SeedDirectory <fixture>` in a
separate PowerShell process for the real overlay/configurator round trip. The
fixture contains `package.json` and `package-lock.json` from upstream commit
`51ad27fb86d39a3daca3adaa970375c9670c12df`, plus the extracted `yaml/` package
from that lock (2.8.3, verified against its recorded integrity). This test creates
and removes its own temporary checkout, simulates npm's installed manifest, and
checks repeat verification and rejection paths. It neither installs dependencies
nor changes the live runtime, services or routes.

The dependency overlay intentionally does not manufacture a zero audit. The
2026-08-23 `npm audit --omit=dev` count moves from 44 to 43 findings by removing
the reachable Multer high-severity advisory. The remaining 27 moderate, 15
high, and one critical findings are either outside the portal execution path or
have no compatible published fix; `image-size` remains a reachable, no-fix risk
when SillyTavern parses trusted character-card images. Exposure therefore stays
owner-only and tailnet-only.

The intended tailnet-only routes are additive HTTPS listeners: port `8444`
proxies to SillyTavern and port `5001` proxies to the bridge. Do not enable
Tailscale Funnel or replace unrelated Serve routes.

When the SillyTavern HTTPS route is eventually enabled, add its exact origin to
the IndrasNet process environment, for example:

```text
INDRASNET_CORS_ORIGINS=https://sillytavern.example.com
```

Do not use a wildcard. This CORS entry is not authentication; IndrasNet's owner
and tailnet boundary still applies. The hardening and cutover preflight above
must pass before enabling the SillyTavern listener.
