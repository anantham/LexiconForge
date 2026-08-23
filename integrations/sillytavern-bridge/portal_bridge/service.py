from __future__ import annotations

import logging
from urllib.parse import urlencode
from uuid import uuid4

from .cards import parse_card, resolve_card
from .config import Settings
from .errors import BridgeError, SillyTavernError
from .models import HealthResponse, SelfInsertRequest, SelfInsertSuccess
from .st_client import SillyTavernClient
from . import __version__


LOGGER = logging.getLogger("lexiconforge.portal")


def build_scenario(request: SelfInsertRequest) -> str:
    return (
        f"You find yourself in the middle of {request.chapterTitle}.\n\n"
        f"{request.selectedPassage}\n\n"
        "The scene and every character are bounded to what is known at this point in the chapter. "
        "You are present as a new observer or participant."
    )


class PortalService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _client(self) -> SillyTavernClient:
        return SillyTavernClient(
            self.settings.st_internal_url,
            self.settings.request_timeout_seconds,
        )

    async def health(self) -> HealthResponse:
        vault_ready = self.settings.character_cards_dir.is_dir()
        st_ready = False
        st_message = "SillyTavern unavailable"
        try:
            async with self._client() as client:
                st_ready = await client.health()
                st_message = "SillyTavern ready"
        except SillyTavernError as error:
            st_message = error.message
        ready = vault_ready and st_ready
        if not vault_ready:
            message = f"Character-card directory not found: {self.settings.character_cards_dir}"
        else:
            message = st_message
        return HealthResponse(
            ready=ready,
            bridgeVersion=__version__,
            vaultReady=vault_ready,
            sillyTavernReady=st_ready,
            message=message,
        )

    async def self_insert(self, request: SelfInsertRequest) -> SelfInsertSuccess:
        operation_id = uuid4().hex[:12]
        cards = []
        skipped: list[str] = []
        for character_name in request.characterNames:
            reference = resolve_card(
                self.settings.character_cards_dir,
                character_name,
                request.chapterNumber,
            )
            if reference is None:
                LOGGER.warning(
                    "portal_card_skipped operation=%s chapter=%d character=%r reason=no_range_match",
                    operation_id,
                    request.chapterNumber,
                    character_name,
                )
                skipped.append(character_name)
                continue
            cards.append(parse_card(reference))

        if not cards:
            raise BridgeError(
                "no_characters_found",
                f"No chapter-bounded character cards matched chapter {request.chapterNumber}",
                422,
            )

        world_name = f"LF FMoC Ch{request.chapterNumber} {operation_id}"
        chat_id = f"LF-FMoC-Ch{request.chapterNumber}-{operation_id}"
        scenario = build_scenario(request)
        loaded: list[str] = []
        member_avatars: list[str] = []

        LOGGER.info(
            "portal_start operation=%s chapter=%d requested=%d matched=%d",
            operation_id,
            request.chapterNumber,
            len(request.characterNames),
            len(cards),
        )
        async with self._client() as client:
            await client.ensure_session()
            await client.create_world(world_name, request.chapterTitle, request.chapterTranslation)
            for card in cards:
                display_name = f"{card.name} · LF Ch{request.chapterNumber} · {operation_id[-6:]}"
                try:
                    avatar = await client.create_character(card.to_sillytavern_form(
                        display_name=display_name,
                        contextual_scenario=scenario,
                        world_name=world_name,
                    ))
                except SillyTavernError as error:
                    LOGGER.error(
                        "portal_character_failed operation=%s character=%r error=%s",
                        operation_id,
                        card.name,
                        error.message,
                    )
                    skipped.append(card.name)
                    continue
                member_avatars.append(avatar)
                loaded.append(card.name)

            if not member_avatars:
                raise BridgeError(
                    "no_characters_found",
                    "SillyTavern rejected every matching character card; inspect bridge logs",
                    502,
                )

            group = await client.create_group(
                name=f"FMoC Ch{request.chapterNumber} — {request.chapterTitle[:120]}",
                member_avatars=member_avatars,
                chat_id=chat_id,
            )

        group_id = str(group["id"])
        chat_url = f"{self.settings.st_public_url}/?{urlencode({'lfGroup': group_id})}"
        LOGGER.info(
            "portal_complete operation=%s chapter=%d group=%s loaded=%d skipped=%d",
            operation_id,
            request.chapterNumber,
            group_id,
            len(loaded),
            len(skipped),
        )
        return SelfInsertSuccess(
            stUrl=self.settings.st_public_url,
            chatUrl=chat_url,
            groupId=group_id,
            chatId=chat_id,
            charactersLoaded=loaded,
            charactersSkipped=skipped,
        )
