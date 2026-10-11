# SDK 1.2 FOUNDATION — kontrakt wywiadu i zadań tekstowych

## Status i granica dostawy

To **początek zmian SDK, nie pełna dostawa wywiadu na żywo**. Źródło kontraktu stanowią `celloklab_plugin_sdk/clinical_tasks.py`, `live_interview.py`, publiczny registrar, rejestr hosta i most formularza `static/js/plugins/trichology-form-bridge.js`. Deklaracje oraz walidacja nie tworzą endpointów ani wykonania. Nie istnieje w tym kontrakcie uniwersalne `/run`, endpoint rozpoczęcia sesji, WebSocket ani API nagrywania. Nie przenoś wywiadu klinicznego do neutralnego completion API.

| Dostępne w fundamencie | Pozostaje do odrębnej implementacji i akceptacji |
| --- | --- |
| Publiczne DTO, czyste funkcje budowania promptu, rejestracja deklaracji zadań i sesji | Autoryzowany router wykonania zadań i sesji, cykl życia, anulowanie i odtwarzanie |
| Walidacja typów, limitów, pól wywiadu oraz referencji do finalnych segmentów | Mikrofon, zgoda na nagrywanie, transport audio, STT, streaming i porządkowanie rzeczywistych zdarzeń |
| Targetowanie panelu strony/zakładki i hostowy most istniejącego formularza | Adaptery dostawców, wybór modeli per tryb, limity, pomiar opóźnień |
| Referencja `example.live-interview`: syntetyczny podgląd bez zapisu | Rozliczanie nowego procesu live/STT, rezerwacje kredytów, idempotencja, audyt i uzgadnianie niepewnych kosztów |

Istniejący lifecycle pluginów, zgody kliniki na AI, aktualne API karty, natywne zapisy/formularze oraz dotychczasowe mechanizmy AI i finansowe pozostają obowiązujące. Fundament ich nie zastępuje ani nie dowodzi, że zostały zintegrowane z przyszłym live. Nie dodaje workerów, automatycznych migracji, magazynów partnera ani rozszerzeń Case/personelu. Ta dokumentacja nie potwierdza konfiguracji dostawcy, instalacji w produkcji ani zakończenia integracji badawczej.

„1.2 FOUNDATION” określa nowe kontrakty. W referencji `sdk_version` manifestu pozostaje `1.0` (zgodny major); `version` pluginu to `1.0.0`. Nie wyprowadzaj wersji dystrybucji Python, UI Kit ani gotowości archiwum z tego oznaczenia. Release owner weryfikuje je osobno.

## Deklaracje tekstowe E1

Publiczne importy pochodzą z `celloklab_plugin_sdk`, bez `app`, Request, SQL, sekretów lub klienta dostawcy.

- `TaskInputs`: `trichology_record`, `transcript`, `max_attachments`, `attachment_mode="text"`, `max_free_text`, `options`. Zdjęcia oraz `plugin_records`/`clinic_records` są odrzucane; tekst załącznika nie implementuje uploadu, ekstrakcji, OCR ani STT.
- `TaskAttachmentText(index, attachment_id, mime_type, text, extraction="pdf_text")`: już wyodrębniony tekst; `extraction` może też być `ocr`. Nie przekazuj bajtów mediów ani ścieżek jako obejścia kontraktu.
- `TranscriptSegment(start, end, speaker, text)`: czas w sekundach, zakres 0..86400, koniec nie wcześniejszy od początku. Etykieta rozmówcy nie uwierzytelnia osoby.
- `TaskContext(task_id, ...)`: minimalizowany przez hosta kontekst; `record_fields`, typowane `interview_values`, `attachments`, `transcript`, `free_text`, `options`, opcjonalny wiek/płeć. `context.validate(inputs)` sprawdza zakres deklaracji, nie uprawnienia ani zgodę.
- `TaskPrompt(system, user, response="json", temperature=None, max_output_tokens=None)`: tylko tekst/JSON, bez obrazów. System maks. 20000 znaków, user maks. 60000; limit odpowiedzi 1..32768 tokenów, temperatura 0..2.
- `TaskRegistration(task_id, title, model_class="text", output, inputs, prompt_builder, result_processor=None, persist_kind=None)` oraz `register_tasks(registrar, tasks)`/`registrar.register_clinical_task(...)`: deklaracja bez wykonania. `persist_kind` musi być `None`.

Zadania wymagają `AI` + `ai.clinical_tasks`; wejście karty dodaje `patient.read_trichology_record`, załączniki `patient.read_attachments`. Dostarczony tekst rozmowy nie przyznaje ani nie wymaga uprawnienia do przechwytywania audio. Nazwa katalogowa `ai.transcription` nie jest API transkrypcji. `validate_task_result` sprawdza skończony JSON i limit 256 KiB, nie kliniczną poprawność wyniku.

## Deklaracja sesji i zdarzenia do oceny

```python
from celloklab_plugin_sdk import (
    LiveInterviewRegistration, TaskContext, TaskInputs, TaskPrompt,
)

inputs = TaskInputs(trichology_record=True, transcript=True)

def prompt_builder(context: TaskContext) -> TaskPrompt:
    context.validate(inputs)
    return TaskPrompt(
        system="Odpowiadaj po polsku. Proponuj wyłącznie udokumentowane pola do oceny lekarza.",
        user="\n".join(segment.text for segment in context.transcript) or "Brak rozmowy.",
        response="json",
    )

def register(registrar):
    registrar.register_live_interview(LiveInterviewRegistration(
        session_id="interview-review", title="Wywiad do oceny",
        inputs=inputs, prompt_builder=prompt_builder,
    ))
```

`LiveInterviewRegistration(session_id, title, prompt_builder, inputs=...)` domyślnie deklaruje kartę i transkrypt. Transkrypt jest obowiązkowy, załączniki niedozwolone. Wymaga `AI` + `ai.live_interview`, a przy karcie również `patient.read_trichology_record`. Alternatywnie `register_live_interviews(registrar, sessions)` deklaruje maks. 32 unikalne sesje. `session_id` rejestracji to lokalny identyfikator deklaracji, nie token uruchomionej wizyty; host dopiero musi powiązać konkretne zdarzenia z autoryzowanym kontekstem.

- `LiveSegmentEvent(session_id, segment_id, sequence, segment, final=True)` opisuje segment. `sequence` to liczba całkowita 0..1000000, nie grant, licznik trwałego transportu ani gwarancja deduplikacji.
- `TranscriptSourceReference(segment_id, start, end, quote)` zawiera dokładny cytat, nie URL. `validate_against(event, session_id)` wymaga tej samej sesji/segmentu, `final=True`, zakresu wewnątrz segmentu i cytatu obecnego w jego tekście.
- `LiveProposalEvent(session_id, proposal_id, sequence, updates, sources, confidence=None)` dopuszcza wyłącznie typowane pola rozszerzonego wywiadu z `trichology.py`. Niepuste `updates` wymagają dokładnie tego samego zbioru kluczy w `sources`; każde pole ma 1..8 referencji. `confidence` jest opcjonalną skończoną liczbą 0..1, nie pewnością medyczną ani zgodą na zapis.
- Konstrukcja/`validate()` sprawdzają strukturę. **Host musi dodatkowo wywołać `proposal.validate_sources(final_segments)`** na własnym zbiorze segmentów sesji. Sam poprawny DTO nie dowodzi istnienia rozmowy, prawdziwości cytatu lub klinicznej trafności.

Identyfikatory są krótkimi lokalnymi slugami, nie tożsamością pacjenta. Nie można utożsamiać propozycji z komendą zapisu. Czysty `prompt_builder` nie wybiera dostawcy, nie pobiera danych i nie rozlicza wykonania.

## Panel i referencja syntetyczna

`plugins/example_live_interview/` ma ID `example.live-interview`. Rejestruje realny publiczny `LiveInterviewRegistration` i statyczny `UIFragment`:

- hook `global.panel.right`, `placement="global_panel"`;
- `page_ids=("documentation_form",)`, `tab_id="tab-wywiad"`;
- `requires_doctor=True`, jawne role kliniczne, `fragment_id="live-interview-example"`;
- polski `.clk-plugin-ui` z potomną `.clk-ui-card`, współdzielone klasy/tokeny, bez własnych nadpisań motywu.

Host stosuje filtr strony/roli/profilu i utrzymuje panel tylko na właściwej zakładce. Zmiana zakładki i zwinięcie ukrywają istniejące poddrzewo DOM, nie klonują go ani nie kasują szkiców/listenerów. Obecność panelu nie autoryzuje dostępu do pacjenta. Panel i most nie zastępują natywnego formularza ani innych modułów.

Górny przycisk **„Rozpocznij wywiad z AI” jest stale disabled**, z wyjaśnieniem braku wykonania. **„Pokaż syntetyczną propozycję”** pokazuje zwalidowane lokalne przykładowe DTO: `chief_complaint="Przykładowy wywiad — dane syntetyczne"`, ze źródłem w syntetycznym segmencie. To nie transmisja zdarzeń live. Nie odczytuje pacjenta, nie używa mikrofonu, sieci, LLM, mostu zapisu, pamięci przeglądarki ani formularza. **Nie ma akceptacji/zapisu i nie żąda `patient.write_trichology_record`**, aby dane demonstracyjne nie trafiały do dokumentacji.

Mimo lokalnego podglądu manifest musi żądać `AI`, `ai.live_interview` i odczytu karty, ponieważ deklaruje sesję z takim wejściem. Nie jest to przykład no-AI. Obecna wspólna bramka AI dotyczy całego pluginu: potrzebne są zatwierdzony lifecycle/granty, aktywna globalna funkcja z aktywnym modelem/dostawcą i jawna aktywacja administratora kliniki. Bramka widoczności nie sprawdza salda; przyszłe płatne wykonanie ma niezależne warunki. Wykrycie źródeł nie aktywuje pluginu ani nie zapisuje konfiguracji dostawcy.

## Most formularza i oryginalna rewizja

Hostowy `window.CelloklabTrichologyFormBridge` udostępnia kontekst, schemat pól, migawkę, blokadę zapisu, `readRecord`, `savePatch`, zastosowanie potwierdzonego PATCH oraz guard przed zmianą zakładki. To istniejąca karta, nie nowy endpoint live.

Przyszły edytor musi odczytać kartę przez `readRecord(pluginId)`, zachować `record.revision` z **tego odczytu, na którym oparto ocenianą propozycję**, pokazać pola/źródła lekarzowi i dopiero po jego jawnej akceptacji wywołać `savePatch(pluginId, acceptedUpdates, {revision: originalRevision})`. Potrzebny jest osobny grant `patient.write_trichology_record`, bieżący lifecycle, zakres pacjenta/kliniki oraz CSRF. Referencja syntetyczna nie wykonuje tych kroków.

Nie pobieraj nowszej rewizji tylko po to, aby wysłać stary wynik. Most wykonuje kontrolny GET przed PATCH, ale porównuje go z przekazaną oryginalną rewizją i nigdy nie podmienia `If-Match` ani nie robi rebase. Brak rewizji blokuje zapis; zmiana rewizji, konflikt 409, brudny natywny formularz lub niezgodna baza pól zachowują szkic i blokują zapis. Opcjonalne `expected_values` pozwala przekazać oryginalne wartości ocenianych pól; most sprawdza także aktualną migawkę DOM względem karty. Ponowny odczyt i ocena to jawny nowy cykl, nie ponowienie zaakceptowanej starej propozycji z nowym `If-Match`. `captureSnapshot()` jest migawką DOM, nie rewizją serwera. Tylko potwierdzenie otrzymane przez most z udanego same-origin PATCH może zmienić formularz; własny obiekt pluginu lub propozycja nie są potwierdzeniem. Zmiany użytkownika wykonane w trakcie zapisu pozostają w formularzu; most rozdziela pola zastosowane i zachowane oraz nie czyści obcych zmian dokumentacji. Zobacz także [PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md](PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md).

## Modele — rekomendacja, nie konfiguracja

Zweryfikowane publiczne API OpenRouter: **`openai/gpt-4.1-mini`** do szybkiej ekstrakcji pól i pytań; alternatywa **`google/gemini-2.5-flash-lite`**. Model mowy **`openai/gpt-4o-mini-transcribe`** jest dostępny w [osobnym katalogu transkrypcji](https://openrouter.ai/api/v1/models?output_modalities=transcription) oraz ma [aktywny endpoint](https://openrouter.ai/api/v1/models/openai/gpt-4o-mini-transcribe/endpoints). Zwykły katalog modeli tekstowych nie jest pełnym katalogiem STT. Docelowo oba modele można skonfigurować po stronie hosta z tym samym dostawcą OpenRouter; fundament nie dodaje jeszcze adaptera audio ani wyboru osobnego modelu mowy do panelu. Dostępny model tekstowy nie obsługuje przez to nagrywania.

To kandydaci do późniejszych testów jakości języka polskiego, prywatności, kosztu i opóźnień; nie skonfigurowano modeli, kluczy ani funkcji w tej pracy. Nie ma gwarancji odpowiedzi w 2 sekundy ani SLA. Live/STT wymaga nadal polityki zgody/retencji, minimalizacji danych, autoryzacji przed każdym etapem oraz odrębnego przeglądu finansowego.

## Weryfikacja i granica dowodów

Uruchom z katalogu repozytorium:

```sh
python -m celloklab_plugin_sdk.validation plugins/example_live_interview
python -m pytest tests/test_plugin_clinical_task_contracts.py tests/test_plugin_live_interview_contracts.py tests/test_plugin_tab_scoped_panel.py tests/test_plugin_trichology_form_bridge.py -q
```

Dowody lokalnego sprawdzenia: walidator referencji oraz testy DTO, rzeczywistego registrara, renderowania Jinja i zachowania JS w QuickJS. Wyniki końcowego przebiegu należy dołączyć do informacji o wydaniu; zmiana kodu po przebiegu wymaga ponowienia testów. Nie wykonano testu mikrofonu, wywołania dostawcy ani wdrożenia.

Walidator jest doradczy: nie uruchamia entrypointu, Jinja, funkcji ani autoryzacji hosta. `ui-declarations.json` i `live-interviews.json` są statycznymi kopiami deklaracji do przeglądu, nie konfiguracją wykonania. Testy lokalne nie potwierdzają instalacji, produkcyjnej MariaDB, dostawcy, rozliczeń live ani mikrofonu. Właściciel integracji dołącza rzeczywiste wyniki i sprawdza artefakty po ostatecznych zmianach; ten zakres nie buduje ZIP ani nie wykonuje wdrożenia.
