"""SDK 1.2 E1: pure text-task declarations, not an execution runtime.

The host alone authorizes/minimizes inputs, selects providers, manages consent,
credits, audit and retention. Registration grants neither data access nor writes.
Photo and record-store execution modes are deliberately not implemented here.
Attachment text/transcripts describe already extracted host inputs, not upload,
OCR or transcription services. No app imports, media bytes or provider clients.
"""
from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping, Optional, Tuple

from .trichology import validate_trichology_interview_updates

CLINICAL_TASKS_CAPABILITY = "ai.clinical_tasks"
TRANSCRIPTION_CAPABILITY = "ai.transcription"
CLINICAL_TASKS_CAPABILITIES = frozenset({"AI", CLINICAL_TASKS_CAPABILITY})
MODEL_CLASSES = frozenset({"text"})
OUTPUTS = frozenset({"json", "text"})
OPTION_TYPES = frozenset({"enum", "integer", "number", "string", "boolean"})
MAX_PROMPT_CHARS = 60_000
MAX_SYSTEM_CHARS = 20_000
MAX_RESULT_BYTES = 256 * 1024
_SLUG = re.compile(r"[a-z0-9]+(?:[_-][a-z0-9]+)*")


def _text(value: Any, maximum: int, *, nonempty: bool = False) -> None:
    if not isinstance(value, str) or len(value) > maximum or (nonempty and not value.strip()):
        raise ValueError("Nieprawidłowy lub zbyt długi tekst kontraktu.")
    try:
        value.encode("utf-8")
    except UnicodeError:
        raise ValueError("Tekst kontraktu ma nieprawidłowe kodowanie.") from None


def _slug(value: Any) -> None:
    if not isinstance(value, str) or len(value) > 100 or not _SLUG.fullmatch(value):
        raise ValueError("Identyfikator musi być krótkim kodem z małych liter, cyfr i separatorów.")


def _number(value: Any, low: float, high: float) -> bool:
    # Compare bounds before float conversion: oversized Python ints must fail
    # safely, not raise OverflowError inside math.isfinite.
    return type(value) in (int, float) and low <= value <= high and math.isfinite(value)


def validate_task_result(value: Any) -> None:
    """Size/JSON check only; clinical correctness and authorization are host duties."""
    try:
        data = json.dumps(value, ensure_ascii=False, allow_nan=False).encode("utf-8")
    except (ValueError, TypeError, UnicodeError, RecursionError):
        raise ValueError("Wynik musi być poprawną, skończoną wartością JSON.") from None
    if len(data) > MAX_RESULT_BYTES:
        raise ValueError("Wynik przekracza limit rozmiaru kontraktu.")


@dataclass(frozen=True)
class TaskInputs:
    trichology_record: bool = False
    max_photos: int = 0
    max_attachments: int = 0
    attachment_mode: str = "text"
    transcript: bool = False
    max_free_text: int = 0
    options: Mapping[str, Mapping[str, Any]] = field(default_factory=dict)
    plugin_records: Tuple[str, ...] = ()
    clinic_records: Tuple[str, ...] = ()

    def __post_init__(self) -> None:
        self.validate()

    def validate(self) -> None:
        if type(self.trichology_record) is not bool or type(self.transcript) is not bool:
            raise ValueError("Deklaracje wejść wymagają wartości logicznych.")
        for name, maximum in (("max_photos", 8), ("max_attachments", 8), ("max_free_text", 20_000)):
            if type(getattr(self, name)) is not int or not 0 <= getattr(self, name) <= maximum:
                raise ValueError("Deklaracja wejść przekracza limit kontraktu.")
        if self.attachment_mode != "text":
            raise ValueError("Kontrakt dopuszcza wyłącznie wyodrębniony tekst załączników.")
        if self.max_photos or self.plugin_records or self.clinic_records:
            raise ValueError("SDK 1.2 nie obsługuje zadań ze zdjęciami ani magazynów rekordów wtyczek.")
        if not isinstance(self.options, Mapping) or len(self.options) > 32:
            raise ValueError("Nieprawidłowa lub zbyt duża deklaracja opcji.")
        for name, spec in self.options.items():
            _slug(name)
            if not isinstance(spec, Mapping) or spec.get("type") not in OPTION_TYPES:
                raise ValueError("Nieprawidłowy typ opcji zadania.")
            kind = spec["type"]
            allowed = {"type"} | ({"values"} if kind == "enum" else {"min", "max"} if kind in {"integer", "number"} else {"max_length"} if kind == "string" else set())
            if set(spec) - allowed:
                raise ValueError("Nieznane właściwości deklaracji opcji.")
            if kind == "enum":
                values = spec.get("values")
                if not isinstance(values, (list, tuple)) or not 1 <= len(values) <= 100:
                    raise ValueError("Opcja wyboru wymaga ograniczonej listy wartości.")
                for value in values:
                    _text(value, 200, nonempty=True)
                if len(set(values)) != len(values):
                    raise ValueError("Wartości opcji wyboru nie mogą się powtarzać.")
            elif kind in {"integer", "number"}:
                lo, hi = spec.get("min"), spec.get("max")
                if not _number(lo, -1e12, 1e12) or not _number(hi, -1e12, 1e12) or lo > hi:
                    raise ValueError("Opcja liczbowa wymaga skończonego zakresu min..max.")
                if kind == "integer" and (type(lo) is not int or type(hi) is not int):
                    raise ValueError("Zakres opcji całkowitej wymaga liczb całkowitych.")
            elif kind == "string" and (type(spec.get("max_length")) is not int or not 1 <= spec["max_length"] <= 20_000):
                raise ValueError("Opcja tekstowa wymaga limitu długości 1..20000.")

    def validate_options(self, values: Mapping[str, Any]) -> None:
        self.validate()
        if not isinstance(values, Mapping) or set(values) - set(self.options):
            raise ValueError("Przekazano niezadeklarowane opcje zadania.")
        for name, value in values.items():
            spec = self.options[name]
            kind = spec["type"]
            if kind == "string":
                _text(value, spec["max_length"])
            elif kind == "boolean" and type(value) is not bool:
                raise ValueError("Opcja wymaga wartości logicznej.")
            elif kind == "enum" and (not isinstance(value, str) or value not in spec["values"]):
                raise ValueError("Nieprawidłowa wartość opcji wyboru.")
            elif kind in {"integer", "number"} and (not _number(value, spec["min"], spec["max"]) or (kind == "integer" and type(value) is not int)):
                raise ValueError("Wartość opcji jest poza zadeklarowanym zakresem.")


@dataclass(frozen=True)
class TaskAttachmentText:
    """Future host input: extracted/redacted text only, never a filename or bytes."""
    index: int
    attachment_id: str
    mime_type: str
    text: str
    extraction: str = "pdf_text"

    def __post_init__(self) -> None:
        if type(self.index) is not int or not 0 <= self.index < 8:
            raise ValueError("Nieprawidłowy indeks tekstu załącznika.")
        _text(self.attachment_id, 100, nonempty=True)
        _text(self.mime_type, 100, nonempty=True)
        _text(self.text, 20_000)
        if self.extraction not in {"pdf_text", "ocr"}:
            raise ValueError("Nieznana metoda wyodrębnienia tekstu.")


@dataclass(frozen=True)
class TranscriptSegment:
    start: float
    end: float
    speaker: str
    text: str

    def __post_init__(self) -> None:
        self.validate()

    def validate(self) -> None:
        if not _number(self.start, 0, 86400) or not _number(self.end, 0, 86400) or self.end < self.start:
            raise ValueError("Nieprawidłowy zakres czasu segmentu rozmowy.")
        _text(self.speaker, 80, nonempty=True)
        _text(self.text, 20_000, nonempty=True)


@dataclass(frozen=True)
class TaskContext:
    """Host-minimized context; validation is not consent or resource authorization."""
    task_id: str
    record_fields: Mapping[str, Optional[str]] = field(default_factory=dict)
    interview_values: Mapping[str, Any] = field(default_factory=dict)
    photos: Tuple[Any, ...] = ()
    attachments: Tuple[TaskAttachmentText, ...] = ()
    transcript: Tuple[TranscriptSegment, ...] = ()
    free_text: str = ""
    options: Mapping[str, Any] = field(default_factory=dict)
    records: Mapping[str, Any] = field(default_factory=dict)
    clinic_records: Mapping[str, Any] = field(default_factory=dict)
    patient_age_years: Optional[int] = None
    patient_sex: Optional[str] = None

    def __post_init__(self) -> None:
        self.validate()

    def validate(self, inputs: Optional[TaskInputs] = None) -> None:
        _slug(self.task_id)
        if self.photos or self.records or self.clinic_records:
            raise ValueError("Kontekst tekstowy nie może zawierać zdjęć ani magazynów rekordów.")
        if not isinstance(self.record_fields, Mapping) or len(self.record_fields) > 100:
            raise ValueError("Nieprawidłowe pola karty.")
        for key, value in self.record_fields.items():
            _slug(key)
            if value is not None:
                _text(value, 20_000)
        try:
            validate_trichology_interview_updates(self.interview_values)
        except (ValueError, TypeError):
            raise ValueError("Kontekst zawiera nieprawidłowe pola lub wartości wywiadu trychologicznego.") from None
        if not isinstance(self.transcript, (tuple, list)) or len(self.transcript) > 1000:
            raise ValueError("Zbyt wiele segmentów rozmowy.")
        for segment in self.transcript:
            if not isinstance(segment, TranscriptSegment):
                raise TypeError("Wymagany jest TranscriptSegment.")
            segment.validate()
        if not isinstance(self.attachments, (tuple, list)) or len(self.attachments) > 8 or any(not isinstance(a, TaskAttachmentText) for a in self.attachments):
            raise ValueError("Nieprawidłowy zbiór tekstów załączników.")
        if len({a.index for a in self.attachments}) != len(self.attachments):
            raise ValueError("Indeksy tekstów załączników nie mogą się powtarzać.")
        _text(self.free_text, 20_000)
        if not isinstance(self.options, Mapping) or len(self.options) > 32:
            raise ValueError("Nieprawidłowe opcje kontekstu.")
        if self.patient_age_years is not None and (type(self.patient_age_years) is not int or not 0 <= self.patient_age_years <= 130):
            raise ValueError("Nieprawidłowy wiek w kontekście.")
        if self.patient_sex not in {None, "F", "M"}:
            raise ValueError("Nieprawidłowa wartość płci w kontekście.")
        validate_task_result({"fields": self.record_fields, "interview": self.interview_values, "transcript": [vars(s) for s in self.transcript], "attachments": [vars(a) for a in self.attachments], "text": self.free_text, "options": self.options})
        if inputs is not None:
            inputs.validate_options(self.options)
            if (not inputs.trichology_record and (self.record_fields or self.interview_values)) or (not inputs.transcript and self.transcript) or len(self.attachments) > inputs.max_attachments or len(self.free_text) > inputs.max_free_text:
                raise ValueError("Kontekst przekracza zadeklarowany zakres wejść zadania.")


@dataclass(frozen=True)
class TaskPrompt:
    system: str
    user: str
    image_indexes: Tuple[int, ...] = ()
    response: str = "json"
    temperature: Optional[float] = None
    max_output_tokens: Optional[int] = None

    def __post_init__(self) -> None:
        self.validate()

    def validate(self) -> None:
        _text(self.system, MAX_SYSTEM_CHARS)
        _text(self.user, MAX_PROMPT_CHARS, nonempty=True)
        if self.image_indexes or self.response not in OUTPUTS:
            raise ValueError("SDK 1.2 dopuszcza wyłącznie odpowiedzi tekstowe lub JSON bez obrazów.")
        if self.temperature is not None and not _number(self.temperature, 0, 2):
            raise ValueError("Temperatura musi być skończoną liczbą z zakresu 0..2.")
        if self.max_output_tokens is not None and (type(self.max_output_tokens) is not int or not 1 <= self.max_output_tokens <= 32768):
            raise ValueError("Limit odpowiedzi musi wynosić 1..32768 tokenów.")


@dataclass(frozen=True)
class TaskRegistration:
    task_id: str
    title: str
    model_class: str
    output: str
    inputs: TaskInputs
    prompt_builder: Callable[[TaskContext], TaskPrompt]
    result_processor: Optional[Callable[[TaskContext, Any], Mapping[str, Any]]] = None
    persist_kind: Optional[str] = None

    def __post_init__(self) -> None:
        self.validate()

    @property
    def required_capabilities(self) -> frozenset[str]:
        caps = set(CLINICAL_TASKS_CAPABILITIES)
        if self.inputs.trichology_record:
            caps.add("patient.read_trichology_record")
        if self.inputs.max_attachments:
            caps.add("patient.read_attachments")
        # A supplied text transcript does not authorize or require audio capture.
        return frozenset(caps)

    def validate(self) -> None:
        _slug(self.task_id)
        _text(self.title, 160, nonempty=True)
        if self.model_class not in MODEL_CLASSES or self.output not in OUTPUTS or self.persist_kind is not None:
            raise ValueError("SDK 1.2 obsługuje tylko deklaracje zadań tekstowych bez automatycznego zapisu.")
        if not isinstance(self.inputs, TaskInputs):
            raise TypeError("Wymagany jest TaskInputs.")
        self.inputs.validate()
        if not callable(self.prompt_builder) or (self.result_processor is not None and not callable(self.result_processor)):
            raise TypeError("Budowanie promptu i przetwarzanie wyniku wymagają funkcji.")


def register_tasks(registrar: Any, tasks: Tuple[TaskRegistration, ...] | list) -> None:
    """Register declarations only; does not mean the host can execute E1."""
    register = getattr(registrar, "register_clinical_task", None)
    if not callable(register):
        raise RuntimeError("Host nie obsługuje rejestracji ai.clinical_tasks (SDK 1.2, E1).")
    tasks = tuple(tasks)
    if len(tasks) > 100 or any(not isinstance(task, TaskRegistration) for task in tasks):
        raise ValueError("Nieprawidłowy lub zbyt duży zbiór deklaracji zadań.")
    for task in tasks:
        task.validate()
    if len({task.task_id for task in tasks}) != len(tasks):
        raise ValueError("Identyfikatory zadań nie mogą się powtarzać.")
    for task in tasks:
        register(task)


__all__ = ["CLINICAL_TASKS_CAPABILITY", "CLINICAL_TASKS_CAPABILITIES", "TRANSCRIPTION_CAPABILITY", "MODEL_CLASSES", "OUTPUTS", "TaskInputs", "TaskAttachmentText", "TranscriptSegment", "TaskContext", "TaskPrompt", "TaskRegistration", "register_tasks", "validate_task_result"]
