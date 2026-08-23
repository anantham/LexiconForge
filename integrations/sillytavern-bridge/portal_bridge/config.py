from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path


DEFAULT_ORIGINS = (
    "https://read.adityaarpitha.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)

DEFAULT_TRUSTED_PROXY_HOSTS = ("127.0.0.1", "::1")


@dataclass(frozen=True)
class Settings:
    vault_root: Path
    st_internal_url: str = "http://127.0.0.1:8000"
    st_public_url: str = "http://localhost:8000"
    allowed_origins: tuple[str, ...] = DEFAULT_ORIGINS
    request_timeout_seconds: float = 20.0
    owner_logins: tuple[str, ...] = ()
    trusted_proxy_hosts: tuple[str, ...] = DEFAULT_TRUSTED_PROXY_HOSTS
    max_request_bytes: int = 4 * 1024 * 1024
    idempotency_ttl_seconds: float = 600.0
    idempotency_max_entries: int = 128
    creation_cooldown_seconds: float = 2.0

    @property
    def character_cards_dir(self) -> Path:
        return self.vault_root / "Character Cards"

    @classmethod
    def from_environment(cls) -> "Settings":
        raw_origins = os.getenv("LF_PORTAL_ALLOWED_ORIGINS", "")
        origins = tuple(
            origin.strip().rstrip("/")
            for origin in raw_origins.split(",")
            if origin.strip()
        ) or DEFAULT_ORIGINS
        owner_logins = tuple(
            login.strip().casefold()
            for login in os.getenv("LF_PORTAL_OWNER_LOGINS", "").split(",")
            if login.strip()
        )
        return cls(
            vault_root=Path(os.getenv("LF_PORTAL_VAULT_ROOT", "vault/Forty Millenniums of Cultivation")),
            st_internal_url=os.getenv("LF_PORTAL_ST_INTERNAL_URL", "http://127.0.0.1:8000").rstrip("/"),
            st_public_url=os.getenv("LF_PORTAL_ST_PUBLIC_URL", "http://localhost:8000").rstrip("/"),
            allowed_origins=origins,
            request_timeout_seconds=float(os.getenv("LF_PORTAL_REQUEST_TIMEOUT_SECONDS", "20")),
            owner_logins=owner_logins,
            max_request_bytes=int(os.getenv("LF_PORTAL_MAX_REQUEST_BYTES", str(4 * 1024 * 1024))),
            idempotency_ttl_seconds=float(os.getenv("LF_PORTAL_IDEMPOTENCY_TTL_SECONDS", "600")),
            idempotency_max_entries=int(os.getenv("LF_PORTAL_IDEMPOTENCY_MAX_ENTRIES", "128")),
            creation_cooldown_seconds=float(os.getenv("LF_PORTAL_CREATION_COOLDOWN_SECONDS", "2")),
        )
