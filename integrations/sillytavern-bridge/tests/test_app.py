from pathlib import Path

from fastapi.testclient import TestClient

from portal_bridge.app import create_app
from portal_bridge.config import Settings
from portal_bridge.models import HealthResponse, SelfInsertRequest, SelfInsertSuccess


class FakeService:
    async def health(self) -> HealthResponse:
        return HealthResponse(
            ready=True,
            bridgeVersion="test",
            vaultReady=True,
            sillyTavernReady=True,
            message="ready",
        )

    async def self_insert(self, request: SelfInsertRequest) -> SelfInsertSuccess:
        return SelfInsertSuccess(
            stUrl="https://asus.example.test:8000",
            chatUrl="https://asus.example.test:8000/?lfGroup=1712345678901",
            groupId="1712345678901",
            chatId=f"LF-FMoC-Ch{request.chapterNumber}-test",
            charactersLoaded=request.characterNames,
            charactersSkipped=[],
        )


def make_client(tmp_path: Path) -> TestClient:
    settings = Settings(
        vault_root=tmp_path,
        allowed_origins=("https://read.adityaarpitha.com",),
    )
    return TestClient(create_app(settings, service_factory=FakeService))


def test_health_contract_and_allowed_cors_origin(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.get(
        "/health",
        headers={"Origin": "https://read.adityaarpitha.com"},
    )

    assert response.status_code == 200
    assert response.json()["ready"] is True
    assert response.headers["access-control-allow-origin"] == "https://read.adityaarpitha.com"


def test_unlisted_origin_receives_no_cors_grant(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.get("/health", headers={"Origin": "https://attacker.example"})

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_self_insert_contract_returns_exact_chat_url(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    response = client.post(
        "/api/self-insert",
        headers={"Origin": "https://read.adityaarpitha.com"},
        json={
            "chapterNumber": 750,
            "characterNames": ["Li Yao"],
            "selectedPassage": "The formation shattered.",
            "chapterTranslation": "Full chapter.",
            "chapterTitle": "Chapter 750",
        },
    )

    assert response.status_code == 200
    assert response.json()["chatUrl"].endswith("?lfGroup=1712345678901")


def test_invalid_request_fails_loudly_with_stable_error_shape(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.post("/api/self-insert", json={"chapterNumber": 0})

    assert response.status_code == 422
    assert response.json()["success"] is False
    assert response.json()["error"] == "invalid_request"
    assert "chapterNumber" in response.json()["message"]
