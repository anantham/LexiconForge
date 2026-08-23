from pathlib import Path


BRIDGE_ROOT = Path(__file__).parents[1]


def read(relative_path: str) -> str:
    return (BRIDGE_ROOT / relative_path).read_text(encoding="utf-8")


def test_bridge_launcher_binds_loopback_and_disables_proxy_header_trust() -> None:
    launcher = read("deploy/windows/start-bridge.cmd")

    assert "--host 127.0.0.1 --port 5001 --no-proxy-headers" in launcher
    assert "LF_PORTAL_OWNER_LOGINS=" in launcher
    assert "LF_PORTAL_MAX_REQUEST_BYTES=4194304" in launcher


def test_task_installer_registers_disabled_until_cutover() -> None:
    installer = read("deploy/windows/install-startup-tasks.ps1")

    assert "Disable-ScheduledTask" in installer
    assert "Start-ScheduledTask" not in installer


def test_cutover_is_exact_and_never_resets_unrelated_serve_routes() -> None:
    cutover = read("deploy/windows/cutover-portal.ps1")

    assert "--http=8000" in cutover
    assert "--https=8444" in cutover
    assert "--https=5001" in cutover
    assert "Assert-MapsEqual" in cutover
    assert "funnel" in cutover.casefold()
    assert "serve', 'reset" not in cutover


def test_multer_overlay_is_version_and_integrity_pinned() -> None:
    overlay = read("security/sillytavern-1.18.0-multer-2.2.0.patch")
    hardening = read("deploy/windows/apply-sillytavern-hardening.ps1")

    assert '"multer": "^2.2.0"' in overlay
    assert '"version": "2.2.0"' in overlay
    assert "51ad27fb86d39a3daca3adaa970375c9670c12df" in hardening
    assert "rev-parse --verify --quiet" in hardening
    assert "12c30fc061e38c0a35becca70fab9c6fb991a7f0" in hardening
    assert "95b4dbc33c62829e2aff383f286889ebdcc15ffd" in hardening
    assert "sha512-6rdyFg2kLrMh9Jee7/" in hardening


def test_sillytavern_configurator_preserves_forwarded_ip_and_csrf_controls() -> None:
    configurator = read("deploy/windows/configure-sillytavern-security.mjs")

    for required_setting in (
        "listen",
        "whitelistMode",
        "enableForwardedWhitelist",
        "basicAuthMode",
        "enableUserAccounts",
        "disableCsrfProtection",
        "securityOverride",
        "xForwardedFor",
    ):
        assert required_setting in configurator
    assert "parseDocument" in configurator
    assert "whitelistNode.range" in configurator
    assert "originalText.slice(0, rangeStart)" in configurator
