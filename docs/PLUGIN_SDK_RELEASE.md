# Standalone SDK release — Python 1.2.1 / etap 2 live

## Polish UI and independent clinic approval

All new or maintained plugin UI must be Polish for all user-facing labels, errors, accessibility and output framing. Existing migration **080** supplies default-off `tenant_plugin_ai_activations`; `tenant_ai_feature_settings` is not clinic approval. Clinic administrators must explicitly re-enable each AI plugin; authorized management consoles remain available. Apply only missing prerequisites, never rerun confirmed SQL. No-AI plugins retain their existing independent rules.

## Wersje i granica wydania

Docelowa dystrybucja Python: **`celloklab-plugin-sdk` 1.2.1**. Manifesty nadal używają **`sdk_version="1.0"`**, UI Kit **1.0.0**; wersja pluginu to odrębny manifest, nie wersja SDK. Właściciel integracji finalizuje zgodność `__version__`, `partner_sdk/pyproject.toml`, build backendu i metadanych wheel oraz dołącza tożsamość/wyniki izolowanej instalacji. Dokumentacja nie potwierdza artefaktu na podstawie samej planowanej wersji.

Ten etap aktualizuje lokalne autorytatywne dokumenty i opisuje implementację w źródłach hosta. **Nie tworzy ani nie obiecuje nowego ZIP**, nie synchronizuje publicznego repozytorium SDK, nie wykonuje commit/push, SQL, konfiguracji ani wdrożenia. Publiczne zatwierdzone sources/docs mogą zostać zsynchronizowane osobno przez release owner. Partner nie potrzebuje prywatnego host source ani sekretów; sam wheel nie dostarcza hostowego runtime/mikrofonu/dostawcy.

## Wywiad na żywo: z FOUNDATION do etapu 2

Pełny kontrakt: **[PLUGIN_LIVE_INTERVIEW_CONTRACT.md](PLUGIN_LIVE_INTERVIEW_CONTRACT.md)**; faktyczne ścieżki/headers/envelope: **[PLUGIN_API_REFERENCE.md](PLUGIN_API_REFERENCE.md)**.

| Dostarczona implementacja źródłowa | Nadal niepotwierdzony odbiór |
| --- | --- |
| Publiczne `TaskInputs`, `TaskContext`, `TaskPrompt`, `LiveInterviewRegistration` z opcjonalnym `result_processor(context, raw)`, registrar oraz DTO źródeł/propozycji | Finalna zgodność wersji/identity wheel 1.2.1 i niezależna instalacja po końcowych zmianach — raport release owner |
| Host REST start/GET/PCM/stop, autoryzacja przed body/decrypt/provider/publication, STT adapter i analiza tekstowa, szyfrowany stan i trwały chunk fence | Reprezentatywna MariaDB schema/migracja/transakcje/concurrency/deletion |
| Wspólny AudioWorklet/client, polski panel niezależnej `vision.visit-assistant`, typed audio settings w panelu administratora | Rzeczywisty mikrofon/uprawnienia/HTTPS/browser UX i rzeczywisty STT+text provider |
| Jedna rezerwacja istniejącego kosztu funkcji na ograniczoną sesję; pewne consumption/refund i pending bez redispatch | Realne koszty dostawcy, jakość polskiej rozmowy, legal/retention acceptance i wynik w 2 s — bez SLA |

`plugins/example_live_interview/` pozostaje **syntetycznym** FOUNDATION demo: start disabled, lokalna propozycja, bez mikrofonu/dostawcy/zapisu i bez write grant. Rzeczywisty partnerski przykład jest odrębny: **`plugins/vision_visit_assistant/`**, ID **`vision.visit-assistant`**, profil **`interview`**, dokładne capabilities **`AI`, `ai.live_interview`, `patient.read_trichology_record`, `patient.write_trichology_record`**. Zatwierdzaj jego finalną wersję z manifestu. Plugin posiada prompt/result processor i polski UI; core jest generycznym transportem/wejściem/autoryzacją/provider/credits, bez disease prompts. Nie ma nowych Case/staff uprawnień, generic event busa ani uniwersalnego clinical `/run`.

### Warunki i ograniczenia live

- Start: dokładnie `profile_id` i `recording_consent:true`, kanoniczne UUID pacjenta/Idempotency-Key, host session/tenant/CSRF. Wszystkie operacje, także GET, ponownie sprawdzają bieżący kliniczny assigned-patient scope, profil/clinic assignment, lifecycle/granty i AI policy.
- Regularne PCM s16le mono 24 kHz: zwykle około 2 s, minimum 0,5 s/max5 s. Finalny ogon od jednej próbki/2 bajtów z `X-Audio-Final:true`; nie ucina się końcówki. REST chunk → STT → analiza → JSON aktualizacja, **nie bidirectional provider WS** ani dwusekundowa gwarancja wyniku. UI nie powinien spierać się o transport, tylko jasno opisywać nagranie, stan i akcje.
- Typowany limit czasu domyślnie 1800 s, integer60–7200. Jednocześnie `min(1000,max_duration_seconds)` fragmentów, 40000 znaków transkryptu i bounds SDK/prompt/state mogą zakończyć sesję wcześniej; wstrzymanie nie resetuje czasu. Max7200 nie obiecuje dwugodzinnego transkryptu.
- Jedna rezerwacja według efektywnego kosztu istniejącej funkcji pluginu, bez per-frame credit/debit i osobnej opłaty STT. Administrator nadal może ponosić **realny koszt wielu STT+text calls**. Pewnie zamknięta sesja bez dispatchu/cyfrowa cisza refunduje; confirmed usage zużywa opłatę także bez zaakceptowania propozycji. `charged=false` nie dowodzi refundu aktywnej/pending sesji.
- Identyczny potwierdzony chunk replay korzysta z zaszyfrowanego wyniku bez dispatchu. Niepewny fence/provider/COMMIT pozostaje pending z rezerwacją do manual reconciliation, **bez fresh-key bypass, provider retry i refundu na podstawie czasu**.
- Callback/text provider otrzymuje zredagowany/minimalizowany kontekst; host wiąże pełny cytat/czas/mówcę z finalnym segmentem, a UI pokazuje oryginalny dowód. STT otrzymuje audio; redakcja późniejszego tekstu nie gwarantuje anonimowości.
- Tylko explicit bridge accept/edit-save zapisuje pojedyncze pole przez istniejący PATCH z original If-Match/baseline, osobnym write grantem i CSRF. Dirty form/409 zachowuje szkic, bez rebase. Native fields/save i nowsze ręczne edycje pozostają niezmienione.
- Klient planuje GET co5 s, denial/pause/stop zatrzymuje rzeczywiste tracki; opóźnienie odpowiedzi może wydłużyć wykrycie revocation. Retry zachowuje identyczny key/bytes/sequence, nigdy automatycznie nie otwiera mikrofonu, również po niepewnym stop. Disable blokuje nowe żądania/publikację; prywatny admin-hook zamyka i rozlicza tylko pewne stany na metadata bez PHI, uncertain/pending pozostawia.

### Konfiguracja hosta, prywatność i SQL

Model mowy jest osobny od text feature. Panel administracji pluginu używa `GET/PUT /api/admin/plugins/{plugin_id}/live-audio-settings` z `speech_model_id` i typowanym `max_duration_seconds`; tylko enabled plugin z `AI`+`ai.live_interview`, super-admin i CSRF PUT. Istniejący admin model catalog zwraca `speech_input_supported`; UI oraz runtime sprawdzają wspierany STT endpoint. Jeśli standardowy OpenRouter import pomija STT, administrator jawnie dodaje/importuje **`openai/gpt-4o-mini-transcribe`** po sprawdzeniu katalogu `https://openrouter.ai/api/v1/models?output_modalities=transcription` i endpointu modelu. Tekst **`openai/gpt-4.1-mini`**, koszt i globalną aktywację wybiera osobno w konsoli funkcji AI. Sekrety tylko w host provider credential domain, nigdy w plugin settings/source/wheel.

Istniejące clinic opt-in/license/availability/credits są oddzielnymi bramkami. Checkbox operatora **„Mam zgodę pacjenta na nagrywanie”** zapisuje jego oświadczenie, nie zastępuje clinic opt-in, patient information/legal basis ani retention policy. Nowym SQL etapu jest **wyłącznie brakująca ręczna `088_plugin_live_interviews.sql`** po backup/review; potwierdź istniejące prerequisites bez rerun wcześniej potwierdzonych migracji, w tym084. Brak autoSQL i nowego workera live.

Host nie utrwala PCM, ale **persistuje zaszyfrowane** source/transcript/proposals/chunk results. Browser trzyma kliniczny stan tylko w pamięci; ledger/audit/logs metadata-only. Uzgodnij retencję/holds i dostawcę — **nie dodano TTL/workera retencji**; czas sesji nie jest okresem przechowywania. Core hard-delete usuwa sessions/chunks przed kartą, ledger finansowy zostaje. MariaDB purge/races pozostają do odbioru.

## Zachowane istniejące domeny

- Publiczny SDK jest host-independent i standard-library-only: context/registrar/UI/page/fragment, protocols/catalogs, email descriptor i offline validation. Nie eksportuje Request, DB connectors, HTTP/provider wrappers, generic jobs ani sandboxa.
- Istniejące browser API pacjentów, wizyt/recepcji, dokumentacji trychologicznej, media/care plans, clinic profile/services/read-only staff, bell/email zachowują swoje granty i actor/resource rules. **No-AI nie ma nowych zależności od AI/zgód/licencji**.
- Typed trichology: 41 typed fields/interview options, istniejące read/write grants, narrower legacy write allowlist i submitted-only readback; native columns remain unencrypted. 084 jest potwierdzona, bez rerun. RPL selection/booking/treatment consent mają odrębne kontrakty, nie generic SDK RPL search ani zmiany Case.
- Organizational bookings zachowuje sześć least-privilege grants i same-transaction `authorization_guard`; contacts nie tworzą kont/dokumentacji. Staff mutations są **permanently excluded**. Existing Case reads są **frozen**, bez expansion/mutations/native physician document writes.
- Neutral `/ai/completion` zachowuje ephemeral text i metadata-only replay. Clinical summary automation `trichology.record.changed` ma odrębne encrypted snapshots/artifacts i istniejącego host workera; nie jest generic event bus. Jej dotychczasowe źródła/worker supervision nie są zastępowane przez live.
- Każdy literal `AI` plugin jest ukryty na klinicznych powierzchniach bez global activation i explicit local clinic-admin opt-in; no-AI zachowuje zwykłe lifecycle/page/role rules. Management consoles są osobne. Pending reservations/history pozostają przy disable/rollback.
- Cały nowy/utrzymywany user-facing UI (w tym partner/admin, accessibility, validation/status/toast/output framing) jest **po polsku**. Internal identifiers/codes są bez zmian, wyjątków nie pokazuje się użytkownikowi. Nie twierdzimy, że przetłumaczono niezwiązany legacy UI.

## Weryfikacja źródeł/wheel przez release owner

Przykładowe polecenia do rzeczywistego wykonania po finalnych zmianach (nie deklaracja ich uruchomienia przez tę aktualizację):

```sh
python -m pip wheel ./partner_sdk --no-deps --no-build-isolation --no-index -w /tmp/celloklab-wheels
python -m venv /tmp/celloklab-partner
/tmp/celloklab-partner/bin/python -m pip install --no-index --no-deps /tmp/celloklab-wheels/celloklab_plugin_sdk-1.2.1-py3-none-any.whl
python -m unittest discover -s partner_sdk/tests -v
python -m celloklab_plugin_sdk.validation plugins/vision_visit_assistant
python -m celloklab_plugin_sdk.validation plugins/example_live_interview
git diff --check
```

Wheel/sdist muszą zawierać aktualny `live_interview.py` z result_processor oraz jego publiczne exports/registrar, bez private host imports. Izoluj instalację od host checkout/PYTHONPATH; sprawdź source version, wheel metadata i zarejestrowany rzeczywisty partner example. Walidator nie wykonuje entrypointu/Jinja ani autoryzacji; statyczne `live-interviews.json` i `ui-declarations.json` nie są runtime config. Preview nie ma rzeczywistego API/auth/upload/email/mic i nie jest production UI parity; fonts pozostają osobną granicą licencyjną.

Nowy ZIP nie jest deliverable tego etapu. Jeżeli przyszłe public sources/example/docs są zatwierdzane, użyj jawnej allowlisty; private host/admin/maintenance guides, AGENTS, migrations, secrets/env/logs/audit/patient data nie należą do partner release. **`PLATFORM_ADMIN_PLUGIN_INSTALLATION_SKILL.md` i `PLUGIN_SYSTEM_MAINTENANCE.md` pozostają prywatne.** Publiczny sync wymaga odrębnej zgody, nie wykonuj go z tego dokumentu.

Dołącz wyłącznie aktualne executed commands/results/blockers, source/wheel identity i ewentualne failures. Usunięto historyczne liczniki testów/plików: nie są dowodem bieżącego etapu. Fake/SQLite/QuickJS/unit/static checks nie potwierdzają produkcyjnej MariaDB, live provider, mikrofonu, klinicznej jakości, legal acceptance, native-form integrity w autoryzowanej przeglądarce ani wyniku w2 s. Te bramki muszą być jawnie raportowane przed wdrożeniem.


## Natywne uzupełnianie 12 sekcji wywiadu — SDK 1.2.2

Vision otrzymuje schemat rzeczywistych pól 12 sekcji: tekst, wybory, grupy checkboxów, booleany i suplementy. Potwierdzona choroba trafia do `chronic_diseases` z kodem opcji (np. `["diabetes"]`), nie tylko do opisu. To katalog pól i kodów, nie lista wymaganych zwrotów rozmowy. AI interpretuje treść semantycznie; cytat nie dowodzi poprawności interpretacji.

Propozycje z tymi samymi źródłami i pierwotną rewizją są pokazywane razem. Specjalista widzi wszystkie zmieniane pola i zatwierdza je jednym kliknięciem; host wykonuje jeden atomowy PATCH. Nie uruchamia się niewidocznego drugiego AI ani dodatkowych zapisów po zatwierdzeniu. Istniejące wybory checkboxów są zachowane w widocznej propozycji. Rewizje, źródła, uprawnienia i ochrona ręcznych edycji nadal obowiązują.

Addytywne `NATIVE_TRICHOLOGY_FIELDS`, `NATIVE_OPTIONS`, `NATIVE_MULTI_FIELDS`, `NATIVE_BOOLEAN_FIELDS`, `NATIVE_FIELD_LABELS` i `validate_native_trichology_updates` obejmują 76 pól. Historyczny kontrakt 41 pól pozostaje. GET dodaje `native_values`, `native_options`, `native_field_labels`; `interview_values` w GET zachowuje wcześniejszy zakres. `TaskContext.interview_values` może zawierać pełny natywny kontrakt. Legacy arrays koduje jako JSON-string dopiero host przed persystencją w istniejących kolumnach.

`supplements_list` ma string JSON z listą obiektów `name`, `dose`, `frequency`, `since`, `schedule` (stringi). Nieznane szczegóły to pusty string. Vision wymaga wszystkich kluczy, niepustej nazwy i nie proponuje czyszczenia. Propozycja obejmuje całą listę, zachowując istniejące pozycje. Host synchronizuje rzeczywiste wiersze oraz zapisany baseline; zmiany podczas PATCH pozostają widoczne. Historycznych list readonly nie zastępuje ukrytymi kontrolkami.

**Granica farmakoterapii:** rozmowa uzupełnia `current_medications` i `medication_changes`; automatyczny wybór katalogowego produktu RPL nie jest zaimplementowany. Nie wolno fabrykować identyfikatorów leków. To ograniczenie, nie deklaracja pełnego automatycznego wypełnienia listy RPL.

Bez nowej migracji i bez automatycznego włączania pluginu. Wydanie wymaga zgodnego hosta, SDK 1.2.2 oraz aktualnego przykładu Vision. Testy syntetyczne potwierdzają kontrakt, zapis i UI; nie stanowią odbioru rzeczywistego STT/LLM ani produkcyjnej bazy.
