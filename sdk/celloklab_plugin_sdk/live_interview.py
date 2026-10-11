"""SDK 1.2 host-independent live interview declarations and review-only events.

No session endpoints, audio capture, STT, streaming, scheduling or clinical writes
are provided. These DTOs are not consent, identity, authorization or evidence of
execution. A future host must bind opaque IDs to an authorized visit, check source
references, revision/concurrency and require clinician review before existing PATCH.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Mapping, Tuple

from .clinical_tasks import (TaskContext, TaskInputs, TaskPrompt, TranscriptSegment,
                             _number, _slug, _text, validate_task_result)
from .trichology import TrichologyInterviewUpdates, validate_trichology_interview_updates

LIVE_INTERVIEW_CAPABILITY = "ai.live_interview"
LIVE_INTERVIEW_CAPABILITIES = frozenset({"AI", LIVE_INTERVIEW_CAPABILITY})


@dataclass(frozen=True)
class LiveInterviewRegistration:
    """Pure proposal prompt builder; one declaration does not start a session."""
    session_id: str
    title: str
    prompt_builder: Callable[[TaskContext], TaskPrompt]
    inputs: TaskInputs = field(default_factory=lambda: TaskInputs(trichology_record=True, transcript=True))

    def __post_init__(self) -> None:
        self.validate()

    @property
    def required_capabilities(self) -> frozenset[str]:
        caps = set(LIVE_INTERVIEW_CAPABILITIES)
        if self.inputs.trichology_record:
            caps.add("patient.read_trichology_record")
        return frozenset(caps)

    def validate(self) -> None:
        _slug(self.session_id)
        _text(self.title, 160, nonempty=True)
        if not isinstance(self.inputs, TaskInputs):
            raise TypeError("Wymagany jest TaskInputs.")
        self.inputs.validate()
        if not self.inputs.transcript or self.inputs.max_attachments:
            raise ValueError("Sesja wywiadu wymaga tekstu rozmowy i nie dopuszcza załączników.")
        if not callable(self.prompt_builder):
            raise TypeError("Budowanie promptu sesji wymaga funkcji.")


@dataclass(frozen=True)
class LiveSegmentEvent:
    """A transcript segment event; sequence is ordering, not an identity grant."""
    session_id: str
    segment_id: str
    sequence: int
    segment: TranscriptSegment
    final: bool = True

    def __post_init__(self) -> None:
        self.validate()

    def validate(self) -> None:
        _slug(self.session_id)
        _slug(self.segment_id)
        if type(self.sequence) is not int or not 0 <= self.sequence <= 1_000_000:
            raise ValueError("Nieprawidłowy numer segmentu rozmowy.")
        if not isinstance(self.segment, TranscriptSegment) or type(self.final) is not bool:
            raise ValueError("Nieprawidłowy segment rozmowy.")
        self.segment.validate()


@dataclass(frozen=True)
class TranscriptSourceReference:
    """Reference to a finalized segment span and exact quote (not a URL/path)."""
    segment_id: str
    start: float
    end: float
    quote: str

    def __post_init__(self) -> None:
        self.validate()

    def validate(self) -> None:
        _slug(self.segment_id)
        if not _number(self.start, 0, 86400) or not _number(self.end, 0, 86400) or self.end < self.start:
            raise ValueError("Nieprawidłowy zakres czasu źródła propozycji.")
        _text(self.quote, 2000, nonempty=True)

    def validate_against(self, event: LiveSegmentEvent, session_id: str) -> None:
        self.validate()
        event.validate()
        if (event.session_id != session_id or event.segment_id != self.segment_id or not event.final
                or self.start < event.segment.start or self.end > event.segment.end
                or self.quote not in event.segment.text):
            raise ValueError("Źródło propozycji nie odpowiada zatwierdzonemu segmentowi tej sesji.")


@dataclass(frozen=True)
class LiveProposalEvent:
    """Typed expanded trichology fields only. Never a command to save the record.

    Each proposed field needs at least one transcript source. ``validate_sources``
    must additionally be called with the host's session-local finalized segments;
    structural validation alone cannot prove that a source exists or is clinical
    evidence. AI confidence is descriptive, never permission or medical certainty.
    """
    session_id: str
    proposal_id: str
    sequence: int
    updates: TrichologyInterviewUpdates
    sources: Mapping[str, Tuple[TranscriptSourceReference, ...]]
    confidence: float | None = None

    def __post_init__(self) -> None:
        self.validate()

    def validate(self) -> None:
        _slug(self.session_id)
        _slug(self.proposal_id)
        if type(self.sequence) is not int or not 0 <= self.sequence <= 1_000_000:
            raise ValueError("Nieprawidłowy numer propozycji.")
        try:
            normalized = validate_trichology_interview_updates(self.updates)
        except (ValueError, TypeError):
            raise ValueError("Propozycja zawiera nieprawidłowe pola lub wartości wywiadu trychologicznego.") from None
        if not normalized or not isinstance(self.sources, Mapping) or set(self.sources) != set(normalized):
            raise ValueError("Każde proponowane pole wymaga źródła w rozmowie.")
        refs = []
        for sources in self.sources.values():
            if not isinstance(sources, (list, tuple)) or not 1 <= len(sources) <= 8:
                raise ValueError("Pole propozycji wymaga od 1 do 8 źródeł.")
            for source in sources:
                if not isinstance(source, TranscriptSourceReference):
                    raise TypeError("Wymagany jest TranscriptSourceReference.")
                source.validate()
                refs.append(vars(source))
        if self.confidence is not None and not _number(self.confidence, 0, 1):
            raise ValueError("Pewność propozycji musi być skończoną liczbą z zakresu 0..1.")
        validate_task_result({"updates": normalized, "sources": refs})

    def validate_sources(self, segments: Mapping[str, LiveSegmentEvent]) -> None:
        self.validate()
        if not isinstance(segments, Mapping):
            raise ValueError("Wymagany jest zbiór segmentów źródłowych sesji.")
        for sources in self.sources.values():
            for source in sources:
                event = segments.get(source.segment_id)
                if not isinstance(event, LiveSegmentEvent):
                    raise ValueError("Brak segmentu źródłowego propozycji.")
                source.validate_against(event, self.session_id)


def register_live_interviews(registrar: Any, sessions: Tuple[LiveInterviewRegistration, ...] | list) -> None:
    """Declare review-only sessions; host execution support is a separate concern."""
    register = getattr(registrar, "register_live_interview", None)
    if not callable(register):
        raise RuntimeError("Host nie obsługuje rejestracji ai.live_interview (SDK 1.2).")
    sessions = tuple(sessions)
    if len(sessions) > 32 or any(not isinstance(item, LiveInterviewRegistration) for item in sessions):
        raise ValueError("Nieprawidłowy lub zbyt duży zbiór deklaracji sesji.")
    for item in sessions:
        item.validate()
    if len({item.session_id for item in sessions}) != len(sessions):
        raise ValueError("Identyfikatory deklaracji sesji nie mogą się powtarzać.")
    for item in sessions:
        register(item)


__all__ = ["LIVE_INTERVIEW_CAPABILITY", "LIVE_INTERVIEW_CAPABILITIES", "LiveInterviewRegistration", "LiveSegmentEvent", "TranscriptSourceReference", "LiveProposalEvent", "register_live_interviews"]
