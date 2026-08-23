from pydantic import BaseModel, ConfigDict, Field, field_validator


class SelfInsertRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    chapterNumber: int = Field(ge=1, le=100_000)
    characterNames: list[str] = Field(min_length=1, max_length=50)
    selectedPassage: str = Field(min_length=1, max_length=20_000)
    chapterTranslation: str = Field(min_length=1, max_length=500_000)
    chapterTitle: str = Field(min_length=1, max_length=500)

    @field_validator("selectedPassage", "chapterTranslation", "chapterTitle")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must contain non-whitespace text")
        return value

    @field_validator("characterNames")
    @classmethod
    def normalize_character_names(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            name = " ".join(value.split())
            if not name or len(name) > 200:
                raise ValueError("character names must contain 1-200 visible characters")
            key = name.casefold()
            if key not in seen:
                normalized.append(name)
                seen.add(key)
        if not normalized:
            raise ValueError("at least one distinct character name is required")
        return normalized


class HealthResponse(BaseModel):
    ready: bool
    bridgeVersion: str
    vaultReady: bool
    sillyTavernReady: bool
    message: str


class SelfInsertSuccess(BaseModel):
    success: bool = True
    stUrl: str
    chatUrl: str
    groupId: str
    chatId: str
    charactersLoaded: list[str]
    charactersSkipped: list[str]
    scenarioMode: str = "template"


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    message: str
