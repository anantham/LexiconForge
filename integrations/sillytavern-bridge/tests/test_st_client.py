import json
from urllib.parse import parse_qs

import httpx
import pytest

from portal_bridge.st_client import SillyTavernClient


@pytest.mark.asyncio
async def test_uses_one_csrf_cookie_session_and_official_118_endpoints() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path == "/csrf-token":
            return httpx.Response(
                200,
                json={"token": "csrf-test"},
                headers={"set-cookie": "session=test; Path=/"},
            )
        assert request.headers["x-csrf-token"] == "csrf-test"
        assert request.headers["cookie"] == "session=test"
        if request.url.path == "/api/worldinfo/edit":
            body = json.loads(request.content)
            assert body["data"]["entries"]["0"]["constant"] is True
            return httpx.Response(200, json={"ok": True})
        if request.url.path == "/api/characters/create":
            body = parse_qs(request.content.decode())
            assert body["ch_name"] == ["Li Yao · LF Ch750"]
            assert body["world"] == ["LF FMoC Ch750"]
            return httpx.Response(200, text="Li Yao LF Ch750.png")
        if request.url.path == "/api/groups/create":
            body = json.loads(request.content)
            assert body["members"] == ["Li Yao LF Ch750.png"]
            assert body["chat_id"] == "LF-FMoC-Ch750-test"
            return httpx.Response(200, json={"id": "1712345678901", **body})
        raise AssertionError(f"Unexpected request: {request.method} {request.url}")

    client = SillyTavernClient("http://sillytavern.test")
    await client._client.aclose()
    client._client = httpx.AsyncClient(
        base_url="http://sillytavern.test",
        transport=httpx.MockTransport(handler),
    )

    async with client:
        await client.ensure_session()
        await client.create_world("LF FMoC Ch750", "Chapter 750", "Full chapter")
        avatar = await client.create_character({
            "ch_name": "Li Yao · LF Ch750",
            "world": "LF FMoC Ch750",
        })
        group = await client.create_group(
            name="FMoC Ch750",
            member_avatars=[avatar],
            chat_id="LF-FMoC-Ch750-test",
        )

    assert group["id"] == "1712345678901"
    assert [request.url.path for request in requests] == [
        "/csrf-token",
        "/api/worldinfo/edit",
        "/api/characters/create",
        "/api/groups/create",
    ]
