from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re


CARD_FILENAME = re.compile(
    r"^(?P<name>.+?) - v(?P<version>\d+) \(Ch (?P<start>\d+)-(?P<end>\d+)\)\.md$",
    re.IGNORECASE,
)
SECTION_HEADING = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)


@dataclass(frozen=True)
class CardReference:
    character_name: str
    version: int
    chapter_start: int
    chapter_end: int
    path: Path

    def contains(self, chapter_number: int) -> bool:
        return self.chapter_start <= chapter_number <= self.chapter_end


@dataclass(frozen=True)
class CharacterCard:
    name: str
    description: str
    personality: str
    scenario: str
    first_message: str
    example_dialogues: str
    creator_notes: str

    def to_sillytavern_form(
        self,
        *,
        display_name: str,
        contextual_scenario: str,
        world_name: str,
    ) -> dict[str, str]:
        return {
            "ch_name": display_name,
            "description": self.description,
            "personality": self.personality,
            "scenario": contextual_scenario,
            "first_mes": self.first_message,
            "mes_example": self.example_dialogues,
            "creator_notes": self.creator_notes,
            "world": world_name,
            "tags": "LexiconForge,FMoC,self-insert",
            "character_version": "LexiconForge portal",
            "talkativeness": "0.5",
            "fav": "false",
        }


def list_card_references(cards_dir: Path) -> list[CardReference]:
    if not cards_dir.is_dir():
        return []
    references: list[CardReference] = []
    for path in cards_dir.iterdir():
        match = CARD_FILENAME.match(path.name)
        if not match:
            continue
        references.append(CardReference(
            character_name=match.group("name"),
            version=int(match.group("version")),
            chapter_start=int(match.group("start")),
            chapter_end=int(match.group("end")),
            path=path,
        ))
    return references


def resolve_card(cards_dir: Path, character_name: str, chapter_number: int) -> CardReference | None:
    wanted = " ".join(character_name.split()).casefold()
    matches = [
        reference
        for reference in list_card_references(cards_dir)
        if reference.character_name.casefold() == wanted and reference.contains(chapter_number)
    ]
    if not matches:
        return None
    return max(matches, key=lambda reference: (reference.version, reference.chapter_start))


def _sections(markdown: str) -> dict[str, str]:
    matches = list(SECTION_HEADING.finditer(markdown))
    sections: dict[str, str] = {}
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown)
        sections[match.group(1).strip().casefold()] = markdown[start:end].strip()
    return sections


def parse_card(reference: CardReference) -> CharacterCard:
    markdown = reference.path.read_text(encoding="utf-8-sig")
    sections = _sections(markdown)
    background = sections.get("background", "")
    appearance = sections.get("appearance", "")
    relationships = sections.get("key relationships", "")
    description_parts = [part for part in (background, appearance, relationships) if part]
    return CharacterCard(
        name=reference.character_name,
        description="\n\n".join(description_parts),
        personality=sections.get("personality", ""),
        scenario=sections.get("scenario", ""),
        first_message=sections.get("first message", ""),
        example_dialogues=sections.get("example dialogues", ""),
        creator_notes=(
            f"LexiconForge chapter-bounded source: {reference.path.name}. "
            f"Valid for chapters {reference.chapter_start}-{reference.chapter_end}."
        ),
    )
