# Wywiad na żywo — etap 2, SDK Python 1.2.1

## Polski wywiad i układ roboczy

- Sterowanie nagrywaniem, pauzą/wznowieniem i zakończeniem jest ikonowe z polskimi etykietami dostępności; nagrywanie czerwone, pauza ostrzegawcza. Sidebar pokazuje falę i pytania, nie karty propozycji.
- Propozycje są w wąskich paskach w `patient.records.sections`, na górze `tab-wywiad`, z polskimi nazwami pól/opcji. Ikony akceptuj/odrzuć zamykają pasek; akceptuj zapisuje przez publiczny bridge z oryginalnym If-Match/baseline. Konflikt lub niezapisana ręczna zmiana pozostawia pasek i komunikat.
- STT zawsze wysyła `language=pl`; tylko bezpośredni OpenAI ma dodatkowy polski prompt (OpenRouter nie deklaruje tego parametru). Fragmenty kończą się przy pauzie ≥400 ms po minimum 1,5 s lub po maksymalnie 5 s. Pomijana jest wyłącznie cisza cyfrowa ±8 PCM16, z krótkim pre-roll. To ogranicza cięcie słów, ale nie gwarantuje poprawności dostawcy ani reakcji w 2 s.
- Przycisk pytania wywołuje jawny `POST .../{session_id}/questions` z `{}` i UUID. Klient najpierw pauzuje i potwierdza audio; pytania korzystają z istniejącej stałej opłaty sesji. Limit 20 wywołań i odstęp 10 s, brak automatycznych płatnych ponowień; niepewny dispatch pozostaje pending. Wznowienie mikrofonu jest jawne.


Start z poprawnym JSON nie może maskować konfiguracji audio jako błędu payloadu. Preflight zwraca HTTP 424 z allowlistą `live_speech_model_required`, `live_speech_model_unavailable`, `live_duration_invalid`. UI pokazuje polski komunikat administracyjny; nie wyświetla dowolnego tekstu odpowiedzi. Brak konfiguracji nie uruchamia mikrofonu, dostawcy ani rezerwacji kredytów. Model transkrypcji ustawia się oddzielnie od modelu analizy w „Audio wywiadu na żywo”.

## Status: implementacja w źródłach, nie odbiór produkcyjny

Host ma implementację REST sesji, przechwytywania mikrofonu, inkrementalnej transkrypcji i analizy tekstowej, autoryzacji, idempotencji, rezerwacji jednej opłaty oraz panelu administratora audio. Niezależna wtyczka **`vision.visit-assistant`** dostarcza callbacki i polski panel propozycji. `plugins/example_live_interview/` pozostaje osobną **syntetyczną** referencją FOUNDATION: wyłączony start, bez mikrofonu, dostawcy i zapisu. Nie utożsamiaj jej z rzeczywistą wtyczką Vision.

Nie potwierdzono odbioru z rzeczywistym dostawcą, mikrofonem/przeglądarką HTTPS ani produkcyjną MariaDB. Fragment audio co około 2 sekundy **nie oznacza** wyniku w 2 sekundy ani SLA. Nie wykonano w tej aktualizacji dokumentacji SQL, konfiguracji, wdrożenia, budowy ZIP ani synchronizacji publicznego repozytorium.

Wersje są niezależne: docelowa dystrybucja Python **1.2.1** (wersjonowanie, wheel i jego izolowaną weryfikację finalizuje właściciel wydania), manifest `sdk_version="1.0"`, UI Kit `1.0.0`. Wersję Vision zatwierdzaj wyłącznie według finalnego `plugins/vision_visit_assistant/manifest.json`, nie numeru SDK. Istniejące domeny no-AI, natywne formularze/kolumny, frozen Case i read-only personel pozostają bez zmian.

## Własność i granice

| Host/core | Niezależna wtyczka |
| --- | --- |
| Transport PCM/REST, mikrofon i kolejka, ograniczenia wejścia, aktualna autoryzacja aktora/kliniki/pacjenta, modele/sekrety dostawcy, redakcja, rezerwacja i rozliczenie | `LiveInterviewRegistration`, czysty `prompt_builder(context)` i opcjonalny `result_processor(context, raw)`, instrukcje domenowe, wskazówki, polski UI i jawna ocena propozycji |
| Walidacja typowanych pól, powiązanie dowodu z własnym transkryptem i oryginalną rewizją; istniejący most zapisu | Przyciski start/wstrzymaj/wznów/zakończ, akceptuj/edytuj/odrzuć; brak automatycznego zapisu |

Core nie przechowuje promptów chorobowych Vision i nie rozpoznaje chorób dla wtyczki. Callbacki nie otrzymują Request, SQL, klienta dostawcy ani sekretów. Wtyczki są zaufanym Pythonem w procesie hosta, **nie sandboxem**. Nazwa capability ani widoczny panel nie nadają uprawnień.

## Publiczne deklaracje SDK

Importuj z `celloklab_plugin_sdk`, nigdy z `app`.

- `TaskInputs`: `trichology_record`, `transcript`, `max_attachments`, `attachment_mode="text"`, `max_free_text`, `options`. Ogólne zadania tekstowe nie implementują uploadu, OCR ani STT. `TaskRegistration`/`register_clinical_task` pozostają deklaracjami: nie ma uniwersalnego `/run` ani obejścia live przez neutralne completion.
- `TaskContext`: minimalizowane `record_fields`, typowane `interview_values`, transkrypt `TranscriptSegment(start,end,speaker,text)` i deklarowane wejścia. `validate(inputs)` waliduje strukturę, nie zgodę ani tożsamość rozmówcy.
- `TaskPrompt(system,user,response="json",temperature=None,max_output_tokens=None)`: system do 20000 znaków, user do 60000; tekst/JSON bez obrazów. Host live wymaga JSON; nie obiecuj zastosowania wszystkich parametrów DTO przez adapter — bieżące wykonanie używa konfiguracji funkcji AI hosta.
- `LiveInterviewRegistration(session_id,title,prompt_builder,inputs=...,result_processor=None)`: `session_id` to lokalny profil, **nie UUID uruchomionej sesji**. Transkrypt jest obowiązkowy, załączniki niedozwolone. `result_processor` jest opcjonalną czystą funkcją `context, raw → Mapping`, walidowaną jako callable. Registrar rejestruje deklarację, nie uruchamia mikrofonu ani sieci. `register_live_interviews` dopuszcza do 32 unikalnych profili.
- `LiveSegmentEvent`, `TranscriptSourceReference` i `LiveProposalEvent` pozostają publicznymi DTO oceny. `validate_sources(final_segments)` musi sprawdzić faktyczne źródła sesji; sama konstrukcja DTO nie dowodzi rozmowy ani klinicznej poprawności. Ich format **nie jest** formatem REST sesji poniżej.

Vision rejestruje profil **`interview`**, odczyt karty i transkrypt oraz oba callbacki. Dokładne requested/granted capabilities jego manifestu: **`AI`, `ai.live_interview`, `patient.read_trichology_record`, `patient.write_trichology_record`**. Live runtime potrzebuje pierwszych trzech; zapis ma osobną bramkę istniejącego PATCH. Nie dodawaj `ai.transcription`, `ai.clinical_tasks`, nowych grantów ani event busa do tego flow.

## Autoryzacja i zgoda

Każda operacja wymaga bieżącej hostowej sesji, `tenant_slug`, zatwierdzonego/enabled pluginu i aktualnych grantów, aktywnej lokalnej roli klinicznej, aktywnego profilu lekarza i przypisania do kliniki oraz uprawnienia do przypisanego pacjenta. Czysty administrator/recepcja/finanse nie uzyskuje danych klinicznych. Sesja jest związana z pluginem, kliniką, aktorem i pacjentem. Host sprawdza politykę przed odczytem/dekrypcją, przed wysłaniem do dostawcy i przed publikacją.

Osobno obowiązują globalna aktywacja funkcji AI/modelu/dostawcy, dostępność/licencja kliniki, jawny opt-in lokalnego administratora kliniki oraz kredyty przy starcie. Wszystkie powierzchnie pluginu żądającego `AI` pozostają ukryte bez tych bramek widoczności; saldo jest odrębnym warunkiem wykonania. No-AI nie zyskuje zależności od AI.

Checkbox **„Mam zgodę pacjenta na nagrywanie”** jest oświadczeniem operatora, że uzyskał pozwolenie pacjenta na opisane nagranie/przekazanie audio. Nie jest bezpośrednią decyzją pacjenta w portalu, nie zastępuje opt-in administratora kliniki, podstawy prawnej, informacji dla pacjenta ani polityki retencji/przetwarzania dostawcy. Mikrofon jest włączany dopiero po checkboxie i potwierdzonym starcie hosta. HTTPS/AudioWorklet i same-origin microphone są wymagane; Permissions-Policy dopuszcza mikrofon tylko na faktycznej hostowej stronie `/app/{clinic}/patients/{patient_uuid}`, nie globalnie na stronach pluginów/admina.

## Rzeczywisty transport REST

Baza: `/api/plugins/{plugin_id}/patients/{patient_id}/live-interviews?tenant_slug=...`. Pacjent i identyfikator uruchomionej sesji muszą być kanonicznymi UUID. Wszystkie poniższe żądania, **także GET**, używają same-origin cookies i `X-CSRF-Token`; kontrola CSRF/origin następuje przed odczytem body. Audio nie może być wstępnie parsowane jako formularz przez middleware.

| Metoda i ścieżka względem bazy | Body / nagłówki |
| --- | --- |
| POST baza | Dokładnie `{"profile_id":"interview","recording_consent":true}`, JSON do 1024 bajtów; `Idempotency-Key`: kanoniczny UUID |
| GET `/{session_id}` | Bez body; odczyt bieżącego stanu, kontrola dostępu/czasu i odzyskanie potwierdzonego rozliczenia; bez dispatchu dostawcy |
| POST `/{session_id}/audio` | Surowe PCM; dokładnie `Content-Type: audio/pcm`, `X-Audio-Sequence`, opcjonalny `X-Audio-Final: true|false` (domyślnie false) |
| POST `/{session_id}/stop` | Dokładnie `{}`, JSON; zamknięcie stanu pewnego, bez refundowania/ponawiania niepewnego dispatchu |

PCM: signed 16-bit little-endian, mono, 24000 Hz; regularny fragment **0,5–5 s** (24000–240000 bajtów, parzysta długość). Wspólny AudioWorklet emituje zwykle około **2 s**. Finalny ogon z `X-Audio-Final: true` może mieć od **jednej próbki / 2 bajtów**; nie wysyłaj pustego fragmentu ani nie ucinaj końcówki. HTTP ogranicza audio do 240 KiB, a walidacja PCM do 240000 bajtów. Sequence od 0, dokładna kolejność; rzeczywisty limit runtime jest niższy niż syntaktyczny limit nagłówka routera.

Potwierdzony identyczny fragment tej samej sesji/sequence/final zwraca przechowany zaszyfrowany wynik bez kolejnego dispatchu. Inne bajty/znacznik pod tą sekwencją lub niezamknięty fence dają konflikt; nie oznacza on pozwolenia na redispatch. Nie ma bidirectional provider WebSocket ani tokenowego streamingu: każdy fragment → REST STT (WAV z PCM po stronie hosta) → analiza rosnącego transkryptu przez model tekstowy → aktualizacja JSON panelu. Nie przedstawiaj argumentu technicznego typu „WebSocket kontra REST” jako instrukcji dla pacjenta/operatora.

Odpowiedź: `{"plugin_id":"...","session":{...}}`, 202 dla `pending`, 200 dla pozostałych stanów; private/no-store. `session` zawiera `session_id`, `status`, `next_sequence`, `revision` (licznik sesji, **nie If-Match karty**), `credit_cost`, `max_duration_seconds`, `charged`, `segments`, `suggestions`, `tips`. Bieżące stany hosta: `recording`, `stopped`, `pending`, `failed` (schema dopuszcza też `cancelled`); nie obiecuj nieimplementowanych stanów/endpointów.

Typowe statusy błędów: 403 brak aktualnego dostępu/CSRF, 402 brak kredytów, 404 profil/sesja niedostępne, 409 konflikt, 413 rozmiar, 415 typ treści, 422 dane/PCM, 428 brak klucza startu, 429 limit sesji, 503 wynik/integracja niepotwierdzone. Obsługuj bezpieczny kod i polski komunikat; nie pokazuj wyjątków ani payloadów dostawcy.

## Ograniczona sesja i jedna opłata

`max_duration_seconds` jest typowanym ustawieniem audio administratora: domyślnie **1800**, zakres **60–7200**. Jest to limit czasu od startu, nie obietnica ciągłej dwugodzinnej rozmowy. Obowiązują jednocześnie limit nagranego PCM, najwyżej **`min(1000,max_duration_seconds)` fragmentów** i **40000 znaków transkryptu**; limity kontekstu SDK/promptu/zaszyfrowanego stanu mogą zakończyć analizę wcześniej. Wstrzymanie nie resetuje czasu. Limit sekwencji obejmuje też ciszę. Koniec następuje przy pierwszym osiągniętym ograniczeniu; nie obiecuj, że ustawienie 7200 daje 7200 sekund transkrypcji.

Start atomowo rezerwuje jedną opłatę według **istniejącego efektywnego kosztu funkcji AI tego pluginu** (`plugin_ai_feature_id(plugin_id)`) i ledgeru 079. Nie ma debetu za klatkę/fragment, drugiej opłaty za STT ani osobnej licencji mowy. Dostawca może jednak naliczać administratorowi realne koszty **wielu wywołań STT i modelu tekstowego**; stałe kredyty użytkownika nie ograniczają rachunku dostawcy.

Przy potwierdzonym użyciu dostawcy sesja zużywa opłatę również wtedy, gdy wynik jest nieprzydatny lub nie zapisano żadnego pola. Sesja bez dispatchu (w tym lokalna cyfrowa cisza) przy pewnym zamknięciu zwraca rezerwację. `charged=false` podczas aktywnej/pending sesji nie oznacza dostępnego salda ani refundu. Timeout, crash, niepewny COMMIT/dispatch zachowuje **pending i rezerwację** do ręcznego uzgodnienia na podstawie dowodów. Nie resetuj fence, nie wysyłaj do dostawcy ponownie i nie używaj świeżego płatnego klucza jako obejścia. GET/stop nie rozstrzygają niepewności automatycznie.

## Panel administratora: osobny model mowy

Po standardowym zatwierdzeniu i enable pluginu panel zarządzania wtyczkami oferuje **konfigurację audio**. Hostowe `GET/PUT /api/admin/plugins/{plugin_id}/live-audio-settings` wymagają aktualnego super-admina oraz enabled pluginu z grantami `AI` + `ai.live_interview`. PUT wymaga CSRF przed body, JSON do 2048 bajtów i dokładnie `speech_model_id` oraz całkowitego `max_duration_seconds`. Zapis łączy te dwa niesekretne ustawienia z bieżącą konfiguracją pod blokadą; nie aktywuje pluginu, funkcji ani kliniki.

Lista pochodzi z **istniejącego admin-katalogu modeli/dostawców**, nie z automatycznego pobrania STT. Endpoint zwraca `models` z `speech_input_supported`; UI blokuje wybór nieobsługiwanych modeli, zapis i runtime ponownie walidują model, aktywnego dostawcę i obsługiwany endpoint. Zalecany wybór: OpenRouter **`openai/gpt-4o-mini-transcribe`**. Jeśli zwykły import katalogu pomija STT, administrator jawnie dodaje/importuje model w istniejącej konsoli AI, korzystając z katalogu `https://openrouter.ai/api/v1/models?output_modalities=transcription` i metadanych `https://openrouter.ai/api/v1/models/openai/gpt-4o-mini-transcribe/endpoints`; samo istnienie wpisu nie dowodzi działającego routingu. Adapter obsługuje ograniczoną listę STT OpenRouter oraz skonfigurowanego OpenAI, nie dowolnego dostawcę audio i nie fallback do modelu tekstowego.

Model tekstowy (np. **`openai/gpt-4.1-mini`**) wybiera się **osobno w istniejącej konsoli funkcji AI** tego pluginu razem z kosztem i globalną aktywacją. Sekrety pozostają w hostowej konsoli dostawcy i dedykowanej domenie szyfrowania poświadczeń, nigdy w plugin settings, promptach ani manifestach. Wybór modeli jest rekomendacją konfiguracji, nie potwierdzeniem dostępności/ceny/latencji u rzeczywistego dostawcy.

## Źródła propozycji i bezpieczny zapis

Host redaguje tekstowe liście karty/transkryptu **przed callbackiem i dostawcą tekstowym**. Dostawca STT musi otrzymać audio, które może zawierać dane osobowe; redakcja późniejszego tekstu nie anonimizuje nagrania. Minimization/redakcja nie gwarantują anonimowości ani retencji dostawcy.

Vision żąda `{updates,sources,tips}` z pełnymi cytatami i zgodnymi `start,end,speaker`; jego processor zwraca `{suggestions:[{field,value,evidence,segment_ids}],tips}` bez wymyślania hostowych ID. Host wiąże **pełny** zredagowany cytat i czas/mówcę z własnym finalnym segmentem, przywraca tylko własny oryginalny dowód do UI i waliduje ponownie. Nie odwraca placeholderów w wartościach modelu ani nie wycina negacji. REST propozycja zawiera `proposal_id`, `field`, `value`, `evidence`, `segment_ids`, `revision` oryginalnej karty i `context:{revision,baseline}`. Dopuszczone są 41 typowanych pól i ograniczone istniejące tekstowe legacy: `other_conditions`, `allergies_details`, `supplements_list`, `surgeries`, `trichology_treatments`, `notes`. Heurystyki wtyczki i dokładny cytat nie są diagnozą ani potwierdzeniem tożsamości rozmówcy.

Panel pokazuje poprzednią/proponowaną wartość, źródło i wskazówki po polsku. **Tylko jawne „Akceptuj” lub „Zapisz zatwierdzoną zmianę”** wywołuje `CelloklabTrichologyFormBridge.savePatch(pluginId,{field:value},{revision:originalRevision,expected_values:{field:baseline}})`. Odrzucenie jest lokalne; live runtime nie zapisuje karty.

Bridge wymaga osobnego grantu zapisu, aktualnej klinicznej autoryzacji, CSRF i oryginalnej rewizji w `If-Match`; kontrolny GET tylko porównuje rewizję, nie zastępuje jej/rebase'uje propozycji. Brak rewizji, dirty native form lub zmiana baseline/409 blokują zapis i zachowują szkic. Tylko własny potwierdzony PATCH stosuje wartości do DOM; nowsze ręczne edycje i niepowiązane pola zostają zachowane. Po udanym zapisie stara propozycja nie dostaje automatycznie nowej rewizji. Natywne pola, sekcje i native save nie są zastępowane; szczegóły: [PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md](PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md).

## Klient, cofnięcie dostępu i retencja

Wspólny `CelloklabLiveAudio.create({pluginId,profileId,onUpdate,onSession,onError})` oferuje `start({recordingConsent:true})`, `pause`, `resume`, `stop`, `retryPending`; nie jest klientem dostawcy. Kolejka jest ograniczona do trzech pakietów. Backpressure/błąd wyłącza fizyczne tracki, nie gubi pakietów w ciszy. Wstrzymanie zatrzymuje tracki; wznowienie wymaga jawnego działania. Stop wysyła finalny ogon, czeka na ACK i kończy sesję. Jawne odzyskanie używa tych samych bajtów/sekwencji/klucza; nie otwiera automatycznie mikrofonu, także po niepewnym stop. Polling GET jest planowany co 5 s (czas odpowiedzi może wydłużyć wykrycie cofnięcia), bez dispatchu. Denial wyłącza rzeczywiste tracki i usuwa kliniczne treści UI. Pagehide natychmiast wyłącza mikrofon; keepalive stop jest best-effort, nie gwarancją zamknięcia/rozliczenia.

Disable/revocation blokuje nowe autoryzowane żądania i publikację; nie może cofnąć już wysłanych danych. Prywatny admin-hook zamyka pewne stany i odzyskuje rozliczenie na **metadanych finansowych**, bez odszyfrowywania PHI. Niepewne/pending pozostają z rezerwacją. Zwinięcie panelu tylko ukrywa DOM; nie wyłącza mikrofonu. Guard zakładki podczas przechwytywania nie zastępuje serwerowej autoryzacji.

Host nie utrwala surowego PCM. **Utrwala zaszyfrowane** migawki karty, transkrypt, propozycje i wyniki chunków w tabelach 088; stan w przeglądarce jest tylko w pamięci, bez localStorage/sessionStorage/IndexedDB. Ledger/audyt/logi przechowują wyłącznie bezpieczne metadane, nie tekst kliniczny ani audio. Administrator musi uzgodnić retencję/holds i odpowiedzialność dostawcy; **nie dodano TTL ani workera retencji**. Limit sesji nie jest okresem retencji. Core GDPR hard-delete usuwa sesje przed kartą, a chunki kaskadowo, zachowując ledger/rezerwacje finansowe; rzeczywistą transakcję/usuwanie/races należy odebrać na MariaDB.

## Migracja i weryfikacja

Nowy warunek tego etapu: wyłącznie brakująca, ręcznie przejrzana **`migrations/088_plugin_live_interviews.sql`**, po backupie i zgodzie operatora. Istniejące prerekwizyty lifecycle/079/080 należy potwierdzić, **nie uruchamiać ponownie potwierdzonych wcześniejszych SQL** (w szczególności 084). Nie ma automatycznego startup/plugin SQL ani nowego workera live.

Do lokalnego sprawdzenia źródeł (wyniki raportuje wykonujący, bez historycznych liczników):

```sh
python -m celloklab_plugin_sdk.validation plugins/vision_visit_assistant
python -m celloklab_plugin_sdk.validation plugins/example_live_interview
python -m pytest -q tests/test_plugin_live_interview_contracts.py tests/test_plugin_live_interview_runtime.py tests/test_plugin_live_interview_http.py tests/test_plugin_live_audio_provider.py tests/test_plugin_live_audio_client.py tests/test_vision_visit_assistant.py tests/test_plugin_trichology_form_bridge.py
```

Walidator jest doradczy i nie wykonuje entrypointu, Jinja ani autoryzacji; statyczne `live-interviews.json`/`ui-declarations.json` nie są konfiguracją wykonania. Fakes/QuickJS/SQLite nie zastępują odbioru mikrofonu HTTPS, aktualnych uprawnień i CSRF w przeglądarce, rzeczywistego STT+analizy, kosztu, jakości polskiej rozmowy, dwusekundowej latencji ani MariaDB schema/locking/deletion. Finalne wyniki i tożsamość wheel 1.2.1 dołącza właściciel integracji; nie deklaruj nieuruchomionych testów ani ZIP.
