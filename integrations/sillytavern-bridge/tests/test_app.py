import json
from pathlib import Path

from fastapi import Request
from fastapi.testclient import TestClient
import pytest

from portal_bridge.app import _read_bounded_json, create_app
from portal_bridge.config import Settings
from portal_bridge.errors import BridgeError
from portal_bridge.models import HealthResponse, SelfInsertRequest, SelfInsertSuccess


class FakeService:
    calls = 0

    async def health(self) -> HealthResponse:
        return HealthResponse(
            ready=True,
            bridgeVersion="test",
            vaultReady=True,
            sillyTavernReady=True,
            message="ready",
        )

    async def self_insert(self, request: SelfInsertRequest) -> SelfInsertSuccess:
        type(self).calls += 1
        return SelfInsertSuccess(
            stUrl="https://asus.example.test:8000",
            chatUrl="https://asus.example.test:8000/?lfGroup=1712345678901",
            groupId="1712345678901",
            chatId=f"LF-FMoC-Ch{request.chapterNumber}-test",
            charactersLoaded=request.characterNames,
            charactersSkipped=[],
        )


def make_client(tmp_path: Path) -> TestClient:
    FakeService.calls = 0
    settings = Settings(
        vault_root=tmp_path,
        allowed_origins=("https://read.adityaarpitha.com",),
        owner_logins=("owner@example.test",),
        trusted_proxy_hosts=("testclient",),
    )
    return TestClient(create_app(settings, service_factory=FakeService))


OWNER_HEADERS = {"Tailscale-User-Login": "owner@example.test"}
CREATE_HEADERS = {
    **OWNER_HEADERS,
    "Origin": "https://read.adityaarpitha.com",
    "Idempotency-Key": "portal-request-0001",
}


def self_insert_payload(chapter_number: int = 750) -> dict[str, object]:
    return {
        "chapterNumber": chapter_number,
        "characterNames": ["Li Yao"],
        "selectedPassage": "The formation shattered.",
        "chapterTranslation": "Full chapter.",
        "chapterTitle": f"Chapter {chapter_number}",
    }


def test_health_contract_and_allowed_cors_origin(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.get(
        "/health",
        headers={**OWNER_HEADERS, "Origin": "https://read.adityaarpitha.com"},
    )

    assert response.status_code == 200
    assert response.json()["ready"] is True
    assert response.headers["access-control-allow-origin"] == "https://read.adityaarpitha.com"


def test_unlisted_origin_receives_no_cors_grant(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.get(
        "/health",
        headers={**OWNER_HEADERS, "Origin": "https://attacker.example"},
    )

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_creation_preflight_allows_idempotency_header(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.options(
        "/api/self-insert",
        headers={
            "Origin": "https://read.adityaarpitha.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,idempotency-key",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://read.adityaarpitha.com"
    assert "Idempotency-Key" in response.headers["access-control-allow-headers"]


def test_self_insert_contract_returns_exact_chat_url(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    response = client.post(
        "/api/self-insert",
        headers=CREATE_HEADERS,
        json=self_insert_payload(),
    )

    assert response.status_code == 200
    assert response.json()["chatUrl"].endswith("?lfGroup=1712345678901")


def test_invalid_request_fails_loudly_with_stable_error_shape(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.post(
        "/api/self-insert",
        headers={**OWNER_HEADERS, "Idempotency-Key": "portal-request-0002"},
        json={"chapterNumber": 0},
    )

    assert response.status_code == 422
    assert response.json()["success"] is False
    assert response.json()["error"] == "invalid_request"
    assert "chapterNumber" in response.json()["message"]


def test_missing_identity_fails_before_service_construction(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.post(
        "/api/self-insert",
        headers={"Idempotency-Key": "portal-request-0003"},
        json=self_insert_payload(),
    )

    assert response.status_code == 401
    assert response.json()["error"] == "identity_required"
    assert FakeService.calls == 0


def test_wrong_identity_fails_closed(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.get(
        "/health",
        headers={"Tailscale-User-Login": "other@example.test"},
    )

    assert response.status_code == 403
    assert response.json()["error"] == "identity_forbidden"


def test_untrusted_direct_client_cannot_spoof_identity(tmp_path: Path) -> None:
    settings = Settings(
        vault_root=tmp_path,
        owner_logins=("owner@example.test",),
    )
    client = TestClient(
        create_app(settings, service_factory=FakeService),
        client=("203.0.113.10", 50000),
    )

    response = client.get("/health", headers=OWNER_HEADERS)

    assert response.status_code == 403
    assert response.json()["error"] == "untrusted_proxy"


def test_owner_configuration_is_fail_closed(tmp_path: Path) -> None:
    settings = Settings(vault_root=tmp_path, trusted_proxy_hosts=("testclient",))
    client = TestClient(create_app(settings, service_factory=FakeService))

    response = client.get("/health", headers=OWNER_HEADERS)

    assert response.status_code == 503
    assert response.json()["error"] == "identity_not_configured"


def test_missing_idempotency_key_fails_before_body_parsing(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.post(
        "/api/self-insert",
        headers={**OWNER_HEADERS, "Content-Type": "text/plain"},
        content=b"not-json",
    )

    assert response.status_code == 400
    assert response.json()["error"] == "invalid_idempotency_key"
    assert FakeService.calls == 0


def test_unsupported_media_type_fails_descriptively(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.post(
        "/api/self-insert",
        headers={
            **OWNER_HEADERS,
            "Idempotency-Key": "portal-request-0004",
            "Content-Type": "text/plain",
        },
        content=b"not-json",
    )

    assert response.status_code == 415
    assert response.json()["error"] == "unsupported_media_type"
    assert FakeService.calls == 0


def test_declared_oversize_body_is_rejected_before_parsing(tmp_path: Path) -> None:
    settings = Settings(
        vault_root=tmp_path,
        owner_logins=("owner@example.test",),
        trusted_proxy_hosts=("testclient",),
        max_request_bytes=64,
    )
    client = TestClient(create_app(settings, service_factory=FakeService))

    response = client.post(
        "/api/self-insert",
        headers={**OWNER_HEADERS, "Idempotency-Key": "portal-request-0005"},
        json=self_insert_payload(),
    )

    assert response.status_code == 413
    assert response.json()["error"] == "request_too_large"
    assert FakeService.calls == 0


def test_exact_retry_returns_cached_result_without_duplicate_creation(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    body = json.dumps(self_insert_payload(), separators=(",", ":"))
    headers = {**CREATE_HEADERS, "Content-Type": "application/json"}

    first = client.post("/api/self-insert", headers=headers, content=body)
    second = client.post("/api/self-insert", headers=headers, content=body)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["groupId"] == first.json()["groupId"]
    assert FakeService.calls == 1


def test_reused_key_with_different_body_is_rejected(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    first = client.post("/api/self-insert", headers=CREATE_HEADERS, json=self_insert_payload())
    second = client.post(
        "/api/self-insert",
        headers=CREATE_HEADERS,
        json=self_insert_payload(chapter_number=751),
    )

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["error"] == "idempotency_conflict"
    assert FakeService.calls == 1


async def test_streamed_oversize_body_is_rejected_without_content_length() -> None:
    messages = [
        {"type": "http.request", "body": b"1234", "more_body": True},
        {"type": "http.request", "body": b"56789", "more_body": False},
    ]

    async def receive() -> dict[str, object]:
        return messages.pop(0)

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/self-insert",
            "headers": [(b"content-type", b"application/json")],
        },
        receive=receive,
    )

    with pytest.raises(BridgeError) as raised:
        await _read_bounded_json(request, max_request_bytes=8)

    assert raised.value.status_code == 413
    assert raised.value.code == "request_too_large"
