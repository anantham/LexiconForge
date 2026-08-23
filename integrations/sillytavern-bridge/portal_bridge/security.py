from __future__ import annotations

import re

from fastapi import Request

from .config import Settings
from .errors import BridgeError


IDEMPOTENCY_KEY_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{16,128}$")
TAILSCALE_LOGIN_HEADER = "Tailscale-User-Login"


def authorize_owner(request: Request, settings: Settings) -> str:
    client_host = request.client.host if request.client else ""
    if client_host not in settings.trusted_proxy_hosts:
        raise BridgeError(
            "untrusted_proxy",
            "Portal request did not arrive through the local Tailscale Serve proxy.",
            403,
        )

    if not settings.owner_logins:
        raise BridgeError(
            "identity_not_configured",
            "Portal owner identity is not configured; set LF_PORTAL_OWNER_LOGINS before enabling the bridge.",
            503,
        )

    login = request.headers.get(TAILSCALE_LOGIN_HEADER, "").strip().casefold()
    if not login:
        raise BridgeError(
            "identity_required",
            "Tailscale Serve did not provide an authenticated user identity.",
            401,
        )
    if login not in settings.owner_logins:
        raise BridgeError(
            "identity_forbidden",
            "The authenticated tailnet user is not allowed to use this portal.",
            403,
        )
    return login


def require_idempotency_key(request: Request) -> str:
    key = request.headers.get("Idempotency-Key", "").strip()
    if not IDEMPOTENCY_KEY_PATTERN.fullmatch(key):
        raise BridgeError(
            "invalid_idempotency_key",
            "Idempotency-Key must contain 16-128 ASCII letters, digits, dots, underscores, colons, or hyphens.",
            400,
        )
    return key
