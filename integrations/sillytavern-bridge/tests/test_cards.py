from pathlib import Path

from portal_bridge.cards import parse_card, resolve_card


def write_card(cards_dir: Path, filename: str, name: str) -> Path:
    path = cards_dir / filename
    path.write_text(
        f"""# [[{name}]]

## Personality
patient investigator

## Appearance
battle-worn

## Background
bounded history

## Key Relationships
- ally

## Scenario
old generic scenario

## First Message
Hello from {name}.

## Example Dialogues
User: Ready?\n{name}: Ready.
""",
        encoding="utf-8",
    )
    return path


def test_resolves_only_the_version_covering_the_requested_chapter(tmp_path: Path) -> None:
    cards_dir = tmp_path / "Character Cards"
    cards_dir.mkdir()
    write_card(cards_dir, "Li Yao - v1 (Ch 1-100).md", "Li Yao")
    expected = write_card(cards_dir, "Li Yao - v4 (Ch 641-882).md", "Li Yao")

    reference = resolve_card(cards_dir, "  li   yao ", 750)

    assert reference is not None
    assert reference.path == expected
    assert reference.chapter_start == 641
    assert reference.chapter_end == 882


def test_returns_none_when_character_has_no_card_for_chapter(tmp_path: Path) -> None:
    cards_dir = tmp_path / "Character Cards"
    cards_dir.mkdir()
    write_card(cards_dir, "Li Yao - v1 (Ch 1-100).md", "Li Yao")

    assert resolve_card(cards_dir, "Li Yao", 750) is None


def test_parses_real_card_sections_into_sillytavern_fields(tmp_path: Path) -> None:
    cards_dir = tmp_path / "Character Cards"
    cards_dir.mkdir()
    path = write_card(cards_dir, "Li Yao - v4 (Ch 641-882).md", "Li Yao")
    reference = resolve_card(cards_dir, "Li Yao", 750)

    assert reference is not None
    card = parse_card(reference)
    fields = card.to_sillytavern_form(
        display_name="Li Yao · LF Ch750 · abc123",
        contextual_scenario="You arrive at the selected passage.",
        world_name="LF FMoC Ch750 abc123",
    )

    assert path.name in fields["creator_notes"]
    assert "bounded history" in fields["description"]
    assert fields["personality"] == "patient investigator"
    assert fields["scenario"] == "You arrive at the selected passage."
    assert fields["world"] == "LF FMoC Ch750 abc123"
