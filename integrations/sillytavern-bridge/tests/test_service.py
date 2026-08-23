from pathlib import Path

import pytest

from portal_bridge.config import Settings
from portal_bridge.errors import BridgeError
from portal_bridge.models import SelfInsertRequest
from portal_bridge.service import PortalService

from test_cards import write_card


class FakeSillyTavernClient:
    def __init__(self) -> None:
        self.worlds: list[str] = []
        self.characters: list[dict[str, str]] = []
        self.groups: list[dict[str, object]] = []

    async def __aenter__(self) -> "FakeSillyTavernClient":
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None

    async def ensure_session(self) -> str:
        return "csrf"

    async def health(self) -> bool:
        return True

    async def create_world(self, name: str, _title: str, _content: str) -> None:
        self.worlds.append(name)

    async def create_character(self, fields: dict[str, str]) -> str:
        self.characters.append(fields)
        return f"{fields['ch_name']}.png"

    async def create_group(self, **payload: object) -> dict[str, object]:
        self.groups.append(payload)
        return {"id": "1712345678901", **payload}


class TestPortalService(PortalService):
    __test__ = False

    def __init__(self, settings: Settings, client: FakeSillyTavernClient) -> None:
        super().__init__(settings)
        self.client = client

    def _client(self) -> FakeSillyTavernClient:
        return self.client


def request() -> SelfInsertRequest:
    return SelfInsertRequest(
        chapterNumber=750,
        characterNames=["Li Yao", "Missing Person"],
        selectedPassage="The formation shattered.",
        chapterTranslation="Full translated chapter.",
        chapterTitle="Chapter 750: The Broken Formation",
    )


@pytest.mark.asyncio
async def test_creates_bounded_cards_world_group_and_exact_chat_url(tmp_path: Path) -> None:
    vault = tmp_path / "Forty Millenniums of Cultivation"
    cards_dir = vault / "Character Cards"
    cards_dir.mkdir(parents=True)
    write_card(cards_dir, "Li Yao - v4 (Ch 641-882).md", "Li Yao")
    client = FakeSillyTavernClient()
    service = TestPortalService(Settings(
        vault_root=vault,
        st_public_url="https://asus.example.test:8000",
    ), client)

    result = await service.self_insert(request())

    assert result.charactersLoaded == ["Li Yao"]
    assert result.charactersSkipped == ["Missing Person"]
    assert result.chatUrl == "https://asus.example.test:8000/?lfGroup=1712345678901"
    assert len(client.worlds) == 1
    assert len(client.characters) == 1
    assert "The formation shattered." in client.characters[0]["scenario"]
    assert client.characters[0]["world"] == client.worlds[0]
    assert client.groups[0]["member_avatars"] == [f"{client.characters[0]['ch_name']}.png"]
    assert client.groups[0]["chat_id"] == result.chatId


@pytest.mark.asyncio
async def test_fails_before_writing_when_no_card_matches_chapter(tmp_path: Path) -> None:
    vault = tmp_path / "Forty Millenniums of Cultivation"
    cards_dir = vault / "Character Cards"
    cards_dir.mkdir(parents=True)
    write_card(cards_dir, "Li Yao - v1 (Ch 1-100).md", "Li Yao")
    client = FakeSillyTavernClient()
    service = TestPortalService(Settings(vault_root=vault), client)

    with pytest.raises(BridgeError) as caught:
        await service.self_insert(request())

    assert caught.value.code == "no_characters_found"
    assert client.worlds == []
    assert client.characters == []
    assert client.groups == []
