# Typed trichology interview — browser and standalone SDK contract

## Scope and compatibility

This is the approved typed read/write extension of the existing clinic trichology record, not physician Case documentation. Routes remain `/api/plugins/{plugin_id}/patients/{patient_id}/trichology?tenant_slug=<host clinic slug>`. Use authenticated same-origin host session cookies, host-provided patient/clinic context and host CSRF for PATCH. No external API key, raw SQL or private host imports.

- GET requires existing `patient.read_trichology_record`; success is `{"plugin_id":"…","record":{…}}`.
- PATCH requires existing `patient.write_trichology_record`; success is `{"plugin_id":"…","result":{…}}`.
- **No new capability is introduced.** Existing effective read/write grants continue to cover their respective operations. A read-only plugin adding a write request needs reviewed source, an exact manifest-version approval and explicit write grant; do not force unrelated reapproval or new grants solely because the host adds typed fields.
- Missing/revoked capability is denied. A grant or visible hook is not clinical authority: current clinical role, active doctor profile, active clinic assignment and assigned patient in that clinic remain mandatory. Reception-only, finance and pure tenant/platform administrators do not gain clinical access.
- Existing record only; no creation, reassignment, ownership/security writes, AI recording, transcription, RPL or Case expansion.

## Read DTO: additive typed values

`record` retains `record_id`, `patient_id`, `tenant_id`, `revision`, all existing top-level legacy fields and the Polish display string/null values for the new interview fields. Existing `field_labels` remains a field-name → Polish-label map. **Do not round-trip those display captions through PATCH.**

The additive `record.interview_values` contains **all 41 keys below**, including unanswered fields. Single choices are exact stable coded strings/null; five multi-selects are JSON arrays of coded strings/null; `post_transplant` is JSON boolean/null (never a numeric SQL flag); text is string/null. SQL JSON TEXT columns are decoded to arrays, not exposed as storage strings. Empty selections can be `[]`; null also means no answer. Do not replace missing/invalid historical values with invented clinical answers.

`record.interview_options` maps choice field names to code → Polish caption maps. Render captions, submit codes, and retain the selected code independently of visible text. Use `field_labels` for labels. Free-text fields and the boolean have no invented coded choices; boolean UI should show „Tak”, „Nie”, „Brak odpowiedzi”.

## Flat PATCH, clear and validation semantics

Send a **nonempty flat JSON object**, e.g. `{"complaint_dynamics":"stable","affected_areas":["vertex"],"post_transplant":false}`. Do not send `interview_values`, `interview_options`, `field_labels`, IDs, revision or other read-only metadata in the body.

- Omitted fields remain unchanged. Submit only dirty fields, not all 41 defaults.
- For **new** fields, explicit `null` or `""` clears the answer. `[]` clears a multi-select; it is not a valid substitute for text, boolean or a single choice.
- `false` is a valid answer, not empty; do not use truthiness to decide whether to include it. `post_transplant` otherwise accepts only actual JSON booleans, not `0`/`1`, `"true"`, `"false"` or captions.
- Text: at most **20000 characters and 65535 UTF-8 bytes** per value; strings only. New fields do not inherit native legacy numeric-slider coercion.
- Single choice: an exact code from the catalog below, or a clear. Polish captions must not be substituted for codes (some clinical scale codes intentionally equal their captions).
- Multi-select: at most **200 submitted items**, all strings from that field's catalog. Backend normalization deduplicates choices while preserving first occurrence. Native persistence normalization accepts bounded JSON-list storage strings, but this plugin PATCH explicitly rejects encoded arrays: use actual JSON arrays, null or the empty-string clear. Unknown choices, nonstring items, nested structures and wrong types are rejected.
- Unknown fields, unsupported legacy fields and an empty PATCH are rejected. Validation remains server-side even when the standalone SDK validator succeeds.

The **unchanged, narrower legacy write allowlist** is `medication_list`, `supplements_list`, `allergies`, `allergies_details`, `diseases`, `chronic_diseases`, `surgeries`, `other_conditions`, `treatment_type`, `treatment_duration`, `treatment_details`, `trichology_treatments`, `notes`. These plugin legacy writes still require strings up to 20000 characters, with empty string clearing and null rejected. Do not infer native-form list/boolean acceptance for these legacy plugin fields. The 41 new fields are added alongside this allowlist; the broad legacy read list does not become writable. In particular, `additional_notes` stays read-only: **Dodatkowe informacje** is separate from `notes` (**Notatka trychologa**); never merge them.

PATCH `result` contains `record_id`, `patient_id`, `updated_fields`, `updated_values`, `revision`. `updated_values` contains **only submitted allowed fields**, with submitted new fields represented using typed readback (codes, arrays, boolean/null), not a full record or captions. This prevents a write-only grant from disclosing unsubmitted clinical fields. Clears may normalize to null or an empty array as appropriate; use confirmed server values, not inferred storage values.

## All 41 fields and Polish labels

Every type below is nullable; the clear rules above apply.

| Field | Type | Polish label |
|---|---|---|
| `chief_complaint` | text | Powód wizyty (słowami pacjenta) |
| `complaint_duration` | text | Od kiedy trwa problem |
| `complaint_dynamics` | single code | Dynamika |
| `complaint_onset` | text | Co poprzedzało początek |
| `shedding_amount` | single code | Nasilenie wypadania |
| `shedding_pattern` | text | Kiedy i gdzie widzi włosy |
| `hair_loss_pattern` | single code | Wzorzec wypadania |
| `affected_areas` | array of codes | Obszary objęte procesem |
| `previous_episodes` | text | Czy problem występował wcześniej |
| `seasonality` | text | Sezonowość i czynniki nasilające |
| `scalp_symptoms` | array of codes | Objawy podmiotowe |
| `scalp_condition` | array of codes | Stan skóry głowy |
| `flaking_type` | text | Rodzaj łuski |
| `scalp_symptom_details` | text | Nasilenie, lokalizacja, pora dnia |
| `sebum_timing` | single code | Po ilu dniach od mycia włosy się przetłuszczają |
| `shaft_condition` | array of codes | Stan łodygi |
| `washing_frequency` | single code | Częstość mycia |
| `care_details` | text | Sposób pielęgnacji |
| `heat_styling` | text | Stylizacja termiczna |
| `chemical_treatments` | text | Zabiegi chemiczne |
| `traction_factors` | text | Czynniki mechaniczne i trakcja |
| `medication_changes` | text | Leki odstawione lub zmienione w ostatnich 12 miesiącach |
| `current_medications` | text | Uwagi do farmakoterapii |
| `hormonal_status` | text | Istotne zmiany hormonalne |
| `menstrual_cycle` | text | Cykl miesiączkowy |
| `menopause_status` | single code | Status menopauzalny |
| `pregnancy_postpartum` | text | Ciąże, porody, karmienie |
| `contraception` | text | Antykoncepcja |
| `androgen_symptoms` | array of codes | Objawy androgenizacji |
| `trt_status` | text | Testosteron / sterydy anaboliczne |
| `weight_change` | text | Zmiana masy ciała w ostatnim roku |
| `post_transplant` | boolean | Po przeszczepie włosów |
| `transplant_details` | text | Szczegóły przeszczepu |
| `previous_treatments` | text | Dotychczasowe leczenie włosów i jego efekt |
| `scale_norwood` | single code | Hamilton-Norwood |
| `scale_ludwig` | single code | Ludwig / Sinclair |
| `scale_salt` | single code | SALT |
| `scale_pull_test` | single code | Test pociągania (pull test) |
| `measurements` | text | Pomiary |
| `family_history_details` | text | Wywiad rodzinny — szczegóły |
| `visit_recommendations` | text | Zalecenia z wizyty |

## Exact choice codes → Polish captions

- `complaint_dynamics`: `worsening` → Nasila się; `stable` → Stabilny; `improving` → Poprawa; `episodic` → Epizodycznie.
- `shedding_amount`: `normal` → W normie; `moderate` → Umiarkowane; `heavy` → Nasilone; `extreme` → Bardzo nasilone.
- `hair_loss_pattern`: `male_pattern` → Typ męski; `female_pattern` → Typ żeński; `diffuse` → Rozlane; `patchy` → Ogniskowe; `frontal` → Linia czołowa / FFA; `traction` → Trakcyjne; `unclear` → Niejednoznaczne.
- `affected_areas`: `frontal` → Czoło / zakola; `vertex` → Szczyt głowy; `temples` → Skronie; `occipital` → Potylica; `diffuse` → Cała głowa; `beard` → Broda; `eyebrows` → Brwi / rzęsy; `body` → Owłosienie ciała.
- `scalp_symptoms`: `itching` → Świąd; `burning` → Pieczenie; `pain` → Ból; `tightness` → Uczucie napięcia; `tenderness` → Tkliwość przy dotyku; `odor` → Zapach; `none` → Brak dolegliwości.
- `scalp_condition`: `oily` → Przetłuszczająca się; `dry` → Sucha; `normal` → Normalna; `sensitive` → Wrażliwa; `flaking` → Złuszczanie; `redness` → Zaczerwienienie; `pustules` → Krostki / grudki.
- `sebum_timing`: `same_day` → Tego samego dnia; `1_day` → Po 1 dniu; `2_3_days` → Po 2–3 dniach; `4_plus` → Po 4 dniach i dłużej.
- `shaft_condition`: `dry` → Sucha; `brittle` → Łamliwa; `oily_ends` → Przetłuszczające się długości; `split_ends` → Rozdwojone końce; `chemically_treated` → Po zabiegach chemicznych; `curly` → Kręcona; `healthy` → Bez zastrzeżeń.
- `washing_frequency`: `daily` → Codziennie; `every_2_3_days` → Co 2–3 dni; `twice_week` → 2× w tygodniu; `weekly` → Raz w tygodniu; `rare` → Rzadziej.
- `menopause_status`: `premenopausal` → Przed menopauzą; `perimenopausal` → Okres okołomenopauzalny; `postmenopausal` → Po menopauzie; `not_applicable` → Nie dotyczy.
- `androgen_symptoms`: `acne` → Trądzik; `hirsutism` → Hirsutyzm; `irregular_cycles` → Nieregularne cykle; `seborrhea` → Nasilony łojotok; `voice_change` → Zmiana barwy głosu; `none` → Brak.

For the following scales **each exact code is also its Polish display caption**; spacing, punctuation and case matter:

- `scale_norwood`: `I`, `II`, `IIa`, `III`, `III vertex`, `IIIa`, `IV`, `IVa`, `V`, `Va`, `VI`, `VII`.
- `scale_ludwig`: `Ludwig I`, `Ludwig II`, `Ludwig III`, `Sinclair 1`, `Sinclair 2`, `Sinclair 3`, `Sinclair 4`, `Sinclair 5`.
- `scale_salt`: `S0`, `S1 (<25%)`, `S2 (25-49%)`, `S3 (50-74%)`, `S4 (75-99%)`, `S5 (100%)`.
- `scale_pull_test`: `Ujemny (<10%)`, `Dodatni — czoło`, `Dodatni — szczyt`, `Dodatni — potylica`, `Dodatni — rozlany`.

## Revision, transaction and safe UX

GET returns the trichology-domain revision including the new source fields. Send that exact revision in `If-Match` on PATCH. The legacy header remains **technically optional, strongly recommended**; missing it does not provide concurrency protection. A stale revision yields **409**. Retain the user's dirty draft and its original revision; offer an explicit read/compare/merge decision. Never silently fetch a new revision and overwrite someone else's work. Polish conflict copy: „Dane zostały zmienione. Twoje niezapisane zmiany zachowano. Wczytaj aktualne dane i porównaj odpowiedzi przed zapisem.”

Scoped persistence, current clinical authorization, required semantic audit, source revision and eligible `trichology.record.changed` capture remain transaction-bound. Actual changes, including clears, affect source freshness; a no-op does not enqueue new generation. Audit/event metadata must not contain clinical values. PATCH is not a new AI-generation endpoint and never grants AI consent. Existing scalar Polish AI source snapshots remain distinct from this editable typed DTO.

On denial clear displayed clinical read data without logging it. On 409, validation error or uncertain network/500 outcome retain dirty input; read back explicitly before retrying and never claim success until confirmed. Use safe Polish errors, `textContent`, native UI Kit loader/toast, independent buttons with `type="button"`, and no nested forms inside native patient record mounts. Keep drafts only in transient memory, not console, URLs, browser storage or public assets.

## Standalone SDK and reference example

Public `celloklab_plugin_sdk/trichology.py` exports `TRICHOLOGY_INTERVIEW_FIELDS`, `FIELD_LABELS`, `OPTIONS`, `MULTI_FIELDS`, `TrichologyInterviewUpdates` and `validate_trichology_interview_updates`. The validator accepts **new-only** partial typed values, normalizes empty text to null and deduplicates arrays; it rejects encoded JSON-array strings and legacy fields. An empty dictionary is valid to the helper but must not be sent as an empty PATCH. Errors identify fields/types, not submitted medical values; translate safe validation messages into Polish for UI. These are host-independent contracts, not an HTTP client, persistence adapter or authorization bypass.

The inspected Python distribution is **1.1.0**, manifest SDK **1.0**, UI Kit **1.0.0**. The reviewed host reference lives at `plugins/example_trichology_interview`; its public distribution location is `examples/example_trichology_interview/`, manifest ID `example.trichology-interview`, version **1.0.0**. It uses existing grants, typed GET/PATCH and Polish UI, without AI requirements or native-submit interception. It blocks plugin PATCH while native edits are dirty and, after confirmed success, synchronizes only saved fields into matching native interview controls and initialization snapshots; native edits made during the request are preserved. Denials clear displayed clinical values and disable editors; user drafts remain only in transient memory and require an authorized reread and explicit confirmation before restoration. Archive membership and actual release evidence must still be verified after the final build; see `PLUGIN_SDK_RELEASE.md`.

Native answers are stored in **separate unencrypted nullable columns**, with multi-selects serialized independently as JSON TEXT. Existing AI job snapshots/artifacts are encrypted separately; that does not encrypt native interview columns or guarantee anonymity. Migration 084 is confirmed applied for this deployment; do not rerun it. No new migration, capability or worker is required for the typed plugin bridge. Local documentation checks are not MariaDB, authenticated browser or provider acceptance.
