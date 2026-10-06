"""Narrow clinical automation declarations; all authority and jobs belong to host.

No event bus, clinical reader, provider, credentials or execution API is exposed.
The host supplies only approved source fields, after checking actor/tenant scope,
current persisted grants and plugin version. Registration is not authorization.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Mapping, TypedDict

TRICHOLOGY_CHANGED = "trichology.record.changed"
TRICHOLOGY_SUMMARY_CAPABILITY = "ai.trichology_summary"
TRICHOLOGY_SUMMARY_CAPABILITIES = frozenset({
    "AI", "patient.read_trichology_record", TRICHOLOGY_SUMMARY_CAPABILITY,
})
MAX_TRICHOLOGY_PROMPT_LENGTH = 20_000


class TrichologySnapshot(TypedDict):
    """Minimal source-only snapshot: no patient, actor or tenant identifiers."""
    fields: Mapping[str, str | None]


@dataclass(frozen=True)
class TrichologySummaryPrompt:
    """Bounded user prompt; system prompt/model/cost remain host-owned."""
    user_prompt: str

    def __post_init__(self) -> None:
        self.validate()

    def validate(self) -> None:
        if (not isinstance(self.user_prompt, str) or not self.user_prompt.strip()
                or len(self.user_prompt) > MAX_TRICHOLOGY_PROMPT_LENGTH):
            raise ValueError("clinical user prompt must contain 1..20000 characters")


@dataclass(frozen=True)
class TrichologySummaryRegistration:
    """One source-only builder for the exact host trichology-change event."""
    prompt_builder: Callable[[TrichologySnapshot], TrichologySummaryPrompt]
    event: str = TRICHOLOGY_CHANGED

    def __post_init__(self) -> None:
        self.validate()

    def validate(self) -> None:
        if self.event != TRICHOLOGY_CHANGED:
            raise ValueError("only trichology.record.changed is supported")
        if not callable(self.prompt_builder):
            raise TypeError("prompt_builder must be callable")


__all__ = ["TRICHOLOGY_CHANGED", "TRICHOLOGY_SUMMARY_CAPABILITY",
           "TRICHOLOGY_SUMMARY_CAPABILITIES", "MAX_TRICHOLOGY_PROMPT_LENGTH",
           "TrichologySnapshot", "TrichologySummaryPrompt", "TrichologySummaryRegistration"]
