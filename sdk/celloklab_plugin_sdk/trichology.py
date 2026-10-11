"""Host-independent contract for the 41 expanded trichology interview fields.

GET keeps its historical top-level display strings and adds ``interview_values``
(typed values), ``interview_options`` and ``field_labels``. PATCH submits actual
field codes in a flat partial object, with the current record revision in
If-Match. Its ``updated_values`` contains submitted fields only, never a full
record. This module validates JSON values, not SQL column representations.
"""
from __future__ import annotations

from collections.abc import Mapping
from typing import Literal, TypedDict

TRICHOLOGY_INTERVIEW_FIELDS = (
    'chief_complaint', 'complaint_duration', 'complaint_dynamics', 'complaint_onset',
    'shedding_amount', 'shedding_pattern', 'hair_loss_pattern', 'affected_areas',
    'previous_episodes', 'seasonality', 'scalp_symptoms', 'scalp_condition',
    'flaking_type', 'scalp_symptom_details', 'sebum_timing', 'shaft_condition',
    'washing_frequency', 'care_details', 'heat_styling', 'chemical_treatments',
    'traction_factors', 'medication_changes', 'current_medications',
    'hormonal_status', 'menstrual_cycle', 'menopause_status', 'pregnancy_postpartum',
    'contraception', 'androgen_symptoms', 'trt_status', 'weight_change',
    'post_transplant', 'transplant_details', 'previous_treatments', 'scale_norwood',
    'scale_ludwig', 'scale_salt', 'scale_pull_test', 'measurements',
    'family_history_details', 'visit_recommendations',
)
FIELD_LABELS = dict(zip(TRICHOLOGY_INTERVIEW_FIELDS, (
    'Powód wizyty (słowami pacjenta)', 'Od kiedy trwa problem', 'Dynamika',
    'Co poprzedzało początek', 'Nasilenie wypadania', 'Kiedy i gdzie widzi włosy',
    'Wzorzec wypadania', 'Obszary objęte procesem', 'Czy problem występował wcześniej',
    'Sezonowość i czynniki nasilające', 'Objawy podmiotowe', 'Stan skóry głowy',
    'Rodzaj łuski', 'Nasilenie, lokalizacja, pora dnia',
    'Po ilu dniach od mycia włosy się przetłuszczają', 'Stan łodygi', 'Częstość mycia',
    'Sposób pielęgnacji', 'Stylizacja termiczna', 'Zabiegi chemiczne',
    'Czynniki mechaniczne i trakcja', 'Leki odstawione lub zmienione w ostatnich 12 miesiącach',
    'Uwagi do farmakoterapii', 'Istotne zmiany hormonalne', 'Cykl miesiączkowy',
    'Status menopauzalny', 'Ciąże, porody, karmienie', 'Antykoncepcja',
    'Objawy androgenizacji', 'Testosteron / sterydy anaboliczne',
    'Zmiana masy ciała w ostatnim roku', 'Po przeszczepie włosów',
    'Szczegóły przeszczepu', 'Dotychczasowe leczenie włosów i jego efekt',
    'Hamilton-Norwood', 'Ludwig / Sinclair', 'SALT', 'Test pociągania (pull test)',
    'Pomiary', 'Wywiad rodzinny — szczegóły', 'Zalecenia z wizyty',
)))
OPTIONS = {
    'complaint_dynamics': dict(zip(('worsening', 'stable', 'improving', 'episodic'), ('Nasila się', 'Stabilny', 'Poprawa', 'Epizodycznie'))),
    'shedding_amount': dict(zip(('normal', 'moderate', 'heavy', 'extreme'), ('W normie', 'Umiarkowane', 'Nasilone', 'Bardzo nasilone'))),
    'hair_loss_pattern': dict(zip(('male_pattern', 'female_pattern', 'diffuse', 'patchy', 'frontal', 'traction', 'unclear'), ('Typ męski', 'Typ żeński', 'Rozlane', 'Ogniskowe', 'Linia czołowa / FFA', 'Trakcyjne', 'Niejednoznaczne'))),
    'affected_areas': dict(zip(('frontal', 'vertex', 'temples', 'occipital', 'diffuse', 'beard', 'eyebrows', 'body'), ('Czoło / zakola', 'Szczyt głowy', 'Skronie', 'Potylica', 'Cała głowa', 'Broda', 'Brwi / rzęsy', 'Owłosienie ciała'))),
    'scalp_symptoms': dict(zip(('itching', 'burning', 'pain', 'tightness', 'tenderness', 'odor', 'none'), ('Świąd', 'Pieczenie', 'Ból', 'Uczucie napięcia', 'Tkliwość przy dotyku', 'Zapach', 'Brak dolegliwości'))),
    'scalp_condition': dict(zip(('oily', 'dry', 'normal', 'sensitive', 'flaking', 'redness', 'pustules'), ('Przetłuszczająca się', 'Sucha', 'Normalna', 'Wrażliwa', 'Złuszczanie', 'Zaczerwienienie', 'Krostki / grudki'))),
    'sebum_timing': dict(zip(('same_day', '1_day', '2_3_days', '4_plus'), ('Tego samego dnia', 'Po 1 dniu', 'Po 2–3 dniach', 'Po 4 dniach i dłużej'))),
    'shaft_condition': dict(zip(('dry', 'brittle', 'oily_ends', 'split_ends', 'chemically_treated', 'curly', 'healthy'), ('Sucha', 'Łamliwa', 'Przetłuszczające się długości', 'Rozdwojone końce', 'Po zabiegach chemicznych', 'Kręcona', 'Bez zastrzeżeń'))),
    'washing_frequency': dict(zip(('daily', 'every_2_3_days', 'twice_week', 'weekly', 'rare'), ('Codziennie', 'Co 2–3 dni', '2× w tygodniu', 'Raz w tygodniu', 'Rzadziej'))),
    'menopause_status': dict(zip(('premenopausal', 'perimenopausal', 'postmenopausal', 'not_applicable'), ('Przed menopauzą', 'Okres okołomenopauzalny', 'Po menopauzie', 'Nie dotyczy'))),
    'androgen_symptoms': dict(zip(('acne', 'hirsutism', 'irregular_cycles', 'seborrhea', 'voice_change', 'none'), ('Trądzik', 'Hirsutyzm', 'Nieregularne cykle', 'Nasilony łojotok', 'Zmiana barwy głosu', 'Brak'))),
    'scale_norwood': {v: v for v in ('I', 'II', 'IIa', 'III', 'III vertex', 'IIIa', 'IV', 'IVa', 'V', 'Va', 'VI', 'VII')},
    'scale_ludwig': {v: v for v in ('Ludwig I', 'Ludwig II', 'Ludwig III', 'Sinclair 1', 'Sinclair 2', 'Sinclair 3', 'Sinclair 4', 'Sinclair 5')},
    'scale_salt': {v: v for v in ('S0', 'S1 (<25%)', 'S2 (25-49%)', 'S3 (50-74%)', 'S4 (75-99%)', 'S5 (100%)')},
    'scale_pull_test': {v: v for v in ('Ujemny (<10%)', 'Dodatni — czoło', 'Dodatni — szczyt', 'Dodatni — potylica', 'Dodatni — rozlany')},
}
MULTI_FIELDS = frozenset(('affected_areas', 'scalp_symptoms', 'scalp_condition', 'shaft_condition', 'androgen_symptoms'))


class TrichologyInterviewUpdates(TypedDict, total=False):
    """Partial new-only PATCH dictionary; omission preserves the saved field."""
    chief_complaint: str | None
    complaint_duration: str | None
    complaint_dynamics: str | None
    complaint_onset: str | None
    shedding_amount: str | None
    shedding_pattern: str | None
    hair_loss_pattern: str | None
    affected_areas: list[str] | Literal[''] | None
    previous_episodes: str | None
    seasonality: str | None
    scalp_symptoms: list[str] | Literal[''] | None
    scalp_condition: list[str] | Literal[''] | None
    flaking_type: str | None
    scalp_symptom_details: str | None
    sebum_timing: str | None
    shaft_condition: list[str] | Literal[''] | None
    washing_frequency: str | None
    care_details: str | None
    heat_styling: str | None
    chemical_treatments: str | None
    traction_factors: str | None
    medication_changes: str | None
    current_medications: str | None
    hormonal_status: str | None
    menstrual_cycle: str | None
    menopause_status: str | None
    pregnancy_postpartum: str | None
    contraception: str | None
    androgen_symptoms: list[str] | Literal[''] | None
    trt_status: str | None
    weight_change: str | None
    post_transplant: bool | Literal[''] | None
    transplant_details: str | None
    previous_treatments: str | None
    scale_norwood: str | None
    scale_ludwig: str | None
    scale_salt: str | None
    scale_pull_test: str | None
    measurements: str | None
    family_history_details: str | None
    visit_recommendations: str | None


def validate_trichology_interview_updates(
    updates: TrichologyInterviewUpdates | Mapping[str, object],
) -> TrichologyInterviewUpdates:
    """Validate typed partial input; normalize empty strings and deduplicate arrays.

    Only the expanded fields are accepted (not legacy notes or identifiers).
    Empty strings clear to null; empty arrays stay arrays; False stays False.
    Encoded JSON arrays, numeric booleans and display labels are not wire values.
    Text is bounded to 20000 characters / 65535 UTF-8 bytes; arrays to 200
    items. Errors never include submitted clinical values. Host authorization,
    resource existence, body limits and optimistic concurrency remain required.
    An empty object is a valid partial dictionary, not a useful PATCH request.
    """
    if not isinstance(updates, Mapping) or set(updates) - set(TRICHOLOGY_INTERVIEW_FIELDS):
        raise ValueError('Unsupported trichology interview fields')
    result = {}
    for field, value in updates.items():
        if value is None or value == '':
            result[field] = None
        elif field == 'post_transplant':
            if type(value) is not bool:
                raise ValueError(f'{field}: expected boolean or null')
            result[field] = value
        elif field in MULTI_FIELDS:
            if not isinstance(value, list) or len(value) > 200:
                raise ValueError(f'{field}: expected a bounded array or null')
            if any(not isinstance(item, str) or item not in OPTIONS[field] for item in value):
                raise ValueError(f'{field}: unknown choice')
            result[field] = list(dict.fromkeys(value))
        elif field in OPTIONS:
            if not isinstance(value, str) or value not in OPTIONS[field]:
                raise ValueError(f'{field}: unknown choice')
            result[field] = value
        else:
            if not isinstance(value, str) or len(value) > 20000:
                raise ValueError(f'{field}: expected text up to 20000 characters')
            try:
                bounded = len(value.encode('utf-8')) <= 65535
            except UnicodeError:
                bounded = False
            if not bounded:
                raise ValueError(f'{field}: invalid or oversized UTF-8 text')
            result[field] = value
    return result


__all__ = ['TRICHOLOGY_INTERVIEW_FIELDS', 'FIELD_LABELS', 'OPTIONS', 'MULTI_FIELDS',
           'TrichologyInterviewUpdates', 'validate_trichology_interview_updates']
