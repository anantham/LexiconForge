from __future__ import annotations

import httpx

from .errors import SillyTavernError


class SillyTavernClient:
    def __init__(self, base_url: str, timeout_seconds: float = 20.0) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=timeout_seconds,
            follow_redirects=True,
        )
        self._csrf_token: str | None = None

    async def __aenter__(self) -> "SillyTavernClient":
        return self

    async def __aexit__(self, *_args: object) -> None:
        await self._client.aclose()

    async def _request(self, method: str, path: str, **kwargs: object) -> httpx.Response:
        try:
            response = await self._client.request(method, path, **kwargs)
            response.raise_for_status()
            return response
        except (httpx.HTTPError, ValueError) as error:
            raise SillyTavernError(
                f"SillyTavern {method} {path} failed: {type(error).__name__}: {error}"
            ) from error

    async def ensure_session(self) -> str:
        response = await self._request("GET", "/csrf-token")
        try:
            token = response.json()["token"]
        except (KeyError, TypeError, ValueError) as error:
            raise SillyTavernError("SillyTavern returned an invalid CSRF-token response") from error
        if not isinstance(token, str) or not token:
            raise SillyTavernError("SillyTavern returned an empty CSRF token")
        self._csrf_token = token
        return token

    async def health(self) -> bool:
        await self.ensure_session()
        return True

    def _headers(self) -> dict[str, str]:
        if not self._csrf_token:
            raise SillyTavernError("SillyTavern session was not initialized before a write")
        return {"x-csrf-token": self._csrf_token}

    async def create_world(self, name: str, chapter_title: str, content: str) -> None:
        payload = {
            "name": name,
            "data": {
                "entries": {
                    "0": {
                        "uid": 0,
                        "key": [],
                        "keysecondary": [],
                        "comment": f"LexiconForge context for {chapter_title}",
                        "content": content,
                        "constant": True,
                        "selective": False,
                        "order": 100,
                        "position": 0,
                        "disable": False,
                    }
                }
            },
        }
        await self._request("POST", "/api/worldinfo/edit", headers=self._headers(), json=payload)

    async def create_character(self, fields: dict[str, str]) -> str:
        response = await self._request(
            "POST",
            "/api/characters/create",
            headers=self._headers(),
            data=fields,
        )
        avatar = response.text.strip().strip('"')
        if not avatar.endswith(".png"):
            raise SillyTavernError(
                f"SillyTavern character creation returned an invalid avatar name: {avatar!r}"
            )
        return avatar

    async def create_group(
        self,
        *,
        name: str,
        member_avatars: list[str],
        chat_id: str,
    ) -> dict[str, object]:
        response = await self._request(
            "POST",
            "/api/groups/create",
            headers={**self._headers(), "content-type": "application/json"},
            json={
                "name": name,
                "members": member_avatars,
                "allow_self_responses": True,
                "activation_strategy": 0,
                "generation_mode": 1,
                "disabled_members": [],
                "chat_id": chat_id,
                "chats": [chat_id],
                "auto_mode_delay": 5,
            },
        )
        try:
            group = response.json()
        except ValueError as error:
            raise SillyTavernError("SillyTavern returned invalid JSON after group creation") from error
        if not isinstance(group, dict) or not isinstance(group.get("id"), str):
            raise SillyTavernError("SillyTavern group creation response did not contain an ID")
        return group
