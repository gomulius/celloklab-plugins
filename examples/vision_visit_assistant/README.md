# Vision — Asystent wywiadu, etap 2

## Stabilne pytania i niezależne propozycje

Nowe pytania dopisują się na dole bez zastępowania istniejących pills; tekst identyczny nie jest duplikowany. Tylko operator usuwa pytanie ikoną X w aktywnej sesji. Wyjątki ochronne: cofnięcie dostępu usuwa dane, nowa sesja rozpoczyna nową listę.

Processor Vision uwzględnia sąsiednie segmenty jednej niedokończonej wypowiedzi tylko przy zgodnym mówcy, ciągłości czasu i źródłach cytujących każdy pełny segment. Nie skleja cytatów evidence ani nie wymyśla IDs. Błędna propozycja jednego pola nie usuwa poprawnej propozycji innego pola; odrzucenie jest jawne. Globalny nieprawidłowy schemat nadal odmawia. Pytania, hipotezy, negacje i historia rodzinna nie stają się faktami pacjenta.


## Przechwytywanie niezależne od przetwarzania

Mikrofon i fala działają niezależnie od przejściowych błędów pollingu/POST, 409, opóźnień dostawcy i pending. Bufor PCM jest tylko w RAM i ograniczony autoryzowanym czasem × 48000 bajtów; nie jest trwałym archiwum audio. `onTransport` pokazuje odrębny stan i zaległość. Niepewny POST nie jest ponawiany w ciemno; świeży GET tej samej sesji musi potwierdzić dokładny ACK. Po odzyskaniu ACK wysyłanie kontynuuje się. Terminalna awaria przetwarzania zatrzymuje wysyłanie, ale nie mikrofon; nie tworzy automatycznie nowej płatnej sesji. Przy nieodwracalnym pending/failed buffered audio pozostaje nieprzetworzone, nie należy ogłaszać pełnego dostarczenia. Manual pause/stop i deadline zwalniają fizyczne ścieżki niezależnie od żądań; revocation czyści PCM.

Polski STT nadal używa `language=pl`. Wynik zawierający litery spoza alfabetów łacińskich jest odrzucany z `stt_language_rejected`, ACK fragmentu bez ponownego dispatchu i bez propozycji. To filtr alfabetu, nie pełny detektor języka ani korektor treści klinicznej; błędna polska transkrypcja pozostaje do poprawy dostawcy.


## Diagnostyka wyników i odporność sesji

Sesja zwraca opcjonalny `error_code` z zamkniętej allowlisty (bez wyjątków, treści dostawcy lub danych pacjenta): analiza JSON/callback/dowody, STT, niepewny dispatch/księgowanie i limit kontekstu. Definitywnie zwrócony nieprawidłowy wynik analizy nie kończy nagrywania: zachowuje transkrypcję i poprzednie propozycje/pytania, potwierdza fragment raz i pokazuje ostrzeżenie. Nie wykonuje ponownie tego samego dispatchu. Niepewna odpowiedź lub COMMIT pozostaje `pending`, bez zwrotu i płatnego retry. Terminalne `failed` po odebranym fragmencie jest wynikiem serwera, nie brakiem odbioru audio; klient nie flushuje dodatkowego PCM ani nie zastępuje go stanem transportowej niepewności.


## Sekwencyjna akceptacja i pytania pills

Pytania są większymi pills z ikoną X „Usuń zadane pytanie”. Usunięcie jest lokalne dla sesji, nie zapisuje karty i nie wraca przy kolejnych odczytach tej samej odpowiedzi. Nowa sesja czyści listę usuniętych pytań.

Bridge zapisuje ograniczony do 1000 krawędzi łańcuch rewizji z własnych potwierdzonych PATCH, w pamięci i w zakresie plugin/pacjent/klinika. Propozycja z pierwotną rewizją może przejść wyłącznie przez ciąg własnych zapisów niezmieniających jej pola. Świeży GET sprawdza aktualną rewizję i bazową wartość pola; PATCH używa tego If-Match. Zewnętrzna luka, zmiana tego samego pola, ręczne niezapisane edycje i niepewne potwierdzenie nadal odmawiają. Nie należy podmieniać rewizji propozycji w UI na podstawie dowolnego GET.


## Pytania bez mikrofonu i czysty formularz

Pytania są dostępne od razu bez zgody na nagrywanie. Klient tworzy tekstową sesję z `{profile_id:"interview",questions_only:true}` i generuje pytania z karty; ta sesja korzysta z jednej stałej opłaty AI. `POST .../{session_id}/recording` z `{recording_consent:true}` aktywuje mikrofon w tej samej sesji bez drugiej rezerwacji. Audio bez zgody jest odrzucane. Puste `tips` po prawidłowej odpowiedzi AI mają pluginowy zestaw ogólnych polskich pytań; awaria dostawcy pozostaje błędem, nie pozornym sukcesem.

Nagrywanie jest nieaktywne do checkboxa; po zaznaczeniu blok zgody znika, nowa sesja wymaga nowej zgody. Pomoc, opłaty, transkrypcja i diagnostyka są tylko pod „i” przy tytule. W głównym panelu pozostają kontrolki, sygnał, krótki stan i pytania.

Hostowe `CelloklabPatientFormState` współdzieli semantyczny baseline z bridge i beforeunload. Baseline powstaje po natywnej hydratacji; asynchroniczna hydratacja specjalisty nie oznacza edycji. Pluginowe/transient kontrolki nie zmieniają stanu karty. Powrót do pierwotnej wartości czyści stan; faktyczne ręczne zmiany i konflikty nadal blokują nadpisanie. Potwierdzony zapis aktualizuje baseline, nie samo kliknięcie.


## Polski wywiad i układ roboczy

- Sterowanie nagrywaniem, pauzą/wznowieniem i zakończeniem jest ikonowe z polskimi etykietami dostępności; nagrywanie czerwone, pauza ostrzegawcza. Sidebar pokazuje falę i pytania, nie karty propozycji.
- Propozycje są w wąskich paskach w `patient.records.sections`, na górze `tab-wywiad`, z polskimi nazwami pól/opcji. Ikony akceptuj/odrzuć zamykają pasek; akceptuj zapisuje przez publiczny bridge z oryginalnym If-Match/baseline. Konflikt lub niezapisana ręczna zmiana pozostawia pasek i komunikat.
- STT zawsze wysyła `language=pl`; tylko bezpośredni OpenAI ma dodatkowy polski prompt (OpenRouter nie deklaruje tego parametru). Fragmenty kończą się przy pauzie ≥400 ms po minimum 1,5 s lub po maksymalnie 5 s. Pomijana jest wyłącznie cisza cyfrowa ±8 PCM16, z krótkim pre-roll. To ogranicza cięcie słów, ale nie gwarantuje poprawności dostawcy ani reakcji w 2 s.
- Przycisk pytania wywołuje jawny `POST .../{session_id}/questions` z `{}` i UUID. Klient najpierw pauzuje i potwierdza audio; pytania korzystają z istniejącej stałej opłaty sesji. Limit 20 wywołań i odstęp 10 s, brak automatycznych płatnych ponowień; niepewny dispatch pozostaje pending. Wznowienie mikrofonu jest jawne.


Vision pracuje z natywnymi polami sekcji wywiadu przez `CelloklabTrichologyFormBridge`. Nie wymaga `example.trichology-interview`; demonstracyjny edytor partnera nie jest elementem instalacji Vision.

Niezależna rzeczywista wtyczka **`vision.visit-assistant`**, profil **`interview`**, włączana/wyłączana standardowym lifecycle hosta. Wersję do zatwierdzenia odczytaj z **finalnego `manifest.json`**; nie utożsamiaj jej z docelowym Python SDK **1.2.1**, manifest SDK `1.0` ani UI Kit `1.0.0`. Czyste callbacki importują wyłącznie publiczny SDK, nie backend, SQL, klienta dostawcy ani sekrety. Wtyczka posiada domenowe instrukcje i polski panel; core wyłącznie generyczny transport, wejście, autoryzację, provider/redakcję/credits.

Dokładne requested/granted capabilities: **`AI`, `ai.live_interview`, `patient.read_trichology_record`, `patient.write_trichology_record`**. Tylko jawne **„Akceptuj”** lub **„Zapisz zatwierdzoną zmianę”** zapisuje pojedyncze pole przez istniejący bridge. Odrzucenie jest lokalne, AI nie zapisuje automatycznie. Legacy ask/insights nie są rejestrowane ani pokazywane jako martwe kontrolki. Osobny `example.live-interview` pozostaje syntetycznym FOUNDATION demo bez wykonania/zapisu.

Kontrakt: [PLUGIN_LIVE_INTERVIEW_CONTRACT.md](../../PLUGIN_LIVE_INTERVIEW_CONTRACT.md), ścieżki: [PLUGIN_API_REFERENCE.md](../../PLUGIN_API_REFERENCE.md).

## Panel i bezpieczna ocena

Vision nie korzysta z `example.live-interview`: to osobne syntetyczne demo SDK. Ruchomy wskaźnik pokazuje rzeczywisty sygnał RMS/szczyt z AudioWorklet, nie atrapę nagrywania. Licznik potwierdzonych fragmentów oznacza odbiór przez hosta, nie dowód poprawnej transkrypcji. Panel pokazuje osobno ostatnie cztery segmenty transkrypcji i brak propozycji. Wskaźnik resetuje się po wyłączeniu mikrofonu; tekst usuwa się przy cofnięciu dostępu.

Osobna rozwijana karta „Asystent wywiadu z AI”, domyślnie zwinięta, używa wrappera `.clk-plugin-ui` i deklarowanego `assistant.css`. Tło, obramowanie, cień i padding odpowiadają przewodnikowi kliniki. Rozwijanie i zwijanie nie uruchamiają mikrofonu, nie zatrzymują sesji i nie usuwają propozycji.

Panel `global.panel.right` / `global_panel`, `documentation_form`, `tab-wywiad`, role kliniczne i `requires_doctor=False` (wywiad trychologiczny nie wymaga roli lekarza). Przed startem UI odczytuje kartę przez publiczny bridge. Widoczność nie daje dostępu: host ponownie sprawdza aktywny profil i clinic assignment, assigned patient, plugin/version/grants, feature/model/provider, dostępność/licencję i clinic opt-in. No-AI, pozostałe moduły, native fields/save i frozen Case/staff nie zmieniają się.

Checkbox **„Mam zgodę pacjenta na nagrywanie”** zapisuje oświadczenie operatora, że uzyskał pozwolenie na opisane nagranie/przekazanie audio do AI. Nie jest samodzielną decyzją pacjenta i nie zastępuje jawnego opt-in administratora kliniki, informacji dla pacjenta, podstawy prawnej lub polityki retencji/dostawcy. Mikrofon dopiero po checkboxie i potwierdzonym starcie serwera.

Propozycja pokazuje poprzednią wartość, nową wartość i **oryginalny pełny cytat** rozmowy. Edytor zachowuje typy/kody 41 pól SDK oraz ograniczone istniejące tekstowe legacy: `other_conditions`, `allergies_details`, `supplements_list`, `surgeries`, `trichology_treatments`, `notes`. Instrukcje/processor Vision zachowują zasady: karta/transkrypt są danymi, lek ≠ choroba, pytanie/negacja/hipoteza/rodzina ≠ rozpoznanie pacjenta. Heurystyka `source_role` bierze pod uwagę treść i speaker, nie przypisuje wszystkim „patient”; krótką dopuszczoną wzmiankę może pokazać tylko jako cytat **do potwierdzenia** z pytaniem. Nie jest to diarization/identity proof ani gwarancja jakości klinicznej.

Akceptacja wywołuje `savePatch(pluginId,{field:value},{revision:originalRevision,expected_values:{field:baseline}})`. Bridge sprawdza oryginalne If-Match i baseline, grant zapisu i CSRF; kontrolny GET nie rebase'uje starej propozycji. Dirty native form/409/blokada zachowują szkic, bez automatycznego overwrite. Potwierdzony własny PATCH stosuje wartości do formularza, zachowując nowsze ręczne/niepowiązane edycje. Udany zapis nie aktualizuje rewizji pozostałych starych propozycji dla obejścia konfliktu.

## SDK callback i hostowe źródła

`LiveInterviewRegistration(session_id="interview", inputs=TaskInputs(trichology_record=True,transcript=True), prompt_builder=build_interview_prompt, result_processor=process_interview_result)` jest rzeczywistą deklaracją. `result_processor(context, raw)` już istnieje w źródłach SDK i waliduje się jako opcjonalny callable; rejestracja nie uruchamia sieci.

JSON modelu: `{updates:{field:value},sources:{field:[{start,end,speaker,quote,source_role}]},tips:[text]}`. Każdy quote to pełna wypowiedź verbatim ze zgodnymi czasami i speaker. Processor zwraca `{suggestions:[{field,value,evidence:[full_quote],segment_ids:[]}],tips:[text]}`. `TaskContext` nie udostępnia hostowych segment IDs; nie wymyślaj ich z sequence lub pozycji.

Host redaguje tekstowe liście karty/transkryptu przed callbackiem i text provider, wiąże pełne redacted quotes/time/speaker ze swoimi finalnymi segmentami, przywraca **tylko własny oryginalny dowód** do UI i waliduje ponownie. Nie odwraca placeholderów w model value ani nie używa urwanego cytatu. Publiczna propozycja REST: `{proposal_id,field,value,evidence,segment_ids,revision,context:{revision,baseline}}`; segment: `{segment_id,sequence,start,end,speaker,text}`. Redakcja nie jest anonimowością: STT musi otrzymać audio zawierające rozmowę.

## Host runtime i konfiguracja administratora

Host ładuje `trichology-form-bridge.js`, następnie `live-audio.js`, potem skrypt wtyczki; serwuje same-origin `live-pcm-worklet.js`. Wymagane HTTPS/AudioWorklet i scoped Permissions-Policy mikrofonu wyłącznie na rzeczywistym `/app/{clinic}/patients/{patient_uuid}`, nie globalne otwarcie mikrofonu.

REST baza `/api/plugins/{plugin_id}/patients/{patient_id}/live-interviews?tenant_slug=...`:

- POST start: dokładnie `{"profile_id":"interview","recording_consent":true}`, host cookies/CSRF i kanoniczny UUID `Idempotency-Key`.
- GET `/{session_id}`: host session/CSRF, bieżący stan, bez provider dispatch.
- POST `/{session_id}/audio`: surowe `audio/pcm` s16le mono24 kHz, `X-Audio-Sequence`, `X-Audio-Final:true|false`. Regularne fragmenty minimum0,5 s/max5 s; worklet zwykle emituje około2 s. Finalny ogon z `true` od jednej próbki/2 bajtów; nie ucina się końcówki.
- POST `/{session_id}/stop`: dokładnie `{}`, JSON/CSRF. Pending uncertainty nie jest automatycznie kończone/refundowane.

CSRF/origin poprzedza body; middleware nie pre-parsuje PCM jako formularza. To pipeline REST chunk STT+text i aktualizacje JSON, **nie bidirectional provider WebSocket** ani obietnica wyniku w2 s. Użytkownikowi pokazuj polskie stany i czynności, nie techniczny spór o transport.

Administrator po enabled/exact approval konfiguruje **osobny model mowy i typed max duration** w panelu wtyczki (`GET/PUT /api/admin/plugins/{plugin_id}/live-audio-settings`). PUT z CSRF ma dokładnie `{speech_model_id,max_duration_seconds}`. Lista z istniejącego model/provider admin catalog oznacza `speech_input_supported` i blokuje niewspierane modele; runtime sprawdza aktywny dostawcę/endpoint ponownie. Zalecany STT: **`openai/gpt-4o-mini-transcribe`**. Jeśli zwykły import OpenRouter go pomija, administrator jawnie dodaje/importuje go do katalogu po sprawdzeniu `https://openrouter.ai/api/v1/models?output_modalities=transcription` i `https://openrouter.ai/api/v1/models/openai/gpt-4o-mini-transcribe/endpoints`. Model tekstowy **`openai/gpt-4.1-mini`**, koszt i globalną aktywację ustawia **osobno w konsoli funkcji AI**. Żadnych poświadczeń w plugin settings.

## Stała opłata i ograniczenia

Jedna opłata według **istniejącego efektywnego kosztu funkcji AI pluginu** jest rezerwowana przy starcie, bez per-fragment debit/nowej opłaty mowy. Administrator nadal może ponosić koszt wielu STT+text calls dostawcy.

Limit `max_duration_seconds`: default1800, integer60–7200, czas od startu (pause nie resetuje). Jednocześnie min(1000,max_duration_seconds) fragmentów, 40000 znaków transkryptu i limity kontekstu/state mogą zakończyć pracę wcześniej. Ustawienie7200 nie gwarantuje dwugodzinnej rozmowy.

Pewnie zamknięta sesja bez dispatchu/cyfrowa cisza zwraca rezerwację. Confirmed provider usage zużywa stałą opłatę również bez akceptacji pól. `charged=false` przy aktywnej/pending nie oznacza refundu/spendable balance. Timeout/crash/niepewne dispatch lub COMMIT zachowuje pending/reserve do manual reconciliation: **bez fresh-key bypass, automatycznego retry dostawcy, fence reset lub refundu według czasu**. Identyczny completed chunk replay tylko odczytuje zaszyfrowany wynik; unresolved fence może odmówić409 i nie dispatchuje.

## Mikrofon, retry i retencja

`CelloklabLiveAudio.create({pluginId,profileId,onUpdate,onSession,onError})` oferuje `start({recordingConsent:true})`, `pause()`, `resume()`, `stop()`, `retryPending()` i session/state/active. Jedna instancja posiada jedną sesję; nowy deliberate start dopiero po pewnym zakończeniu, nigdy w celu obejścia pending. Worklet miksuje do mono/resampluje faktyczny AudioContext do24 kHz bez MediaRecorder. Kolejka max3 pakiety; backpressure jawnie wyłącza tracki i zgłasza nieprzesłane audio, nie nadpisuje kolejki.

Pause zatrzymuje fizyczne tracki; resume wymaga jawnej akcji. Stop wyłącza tracki, wysyła finalny ogon i czeka na ACK przed REST stop. Jawny retry zachowuje identyczny start key/bytes/sequence/final, nie otwiera automatycznie mikrofonu i odzyskuje również niepewny stop. GET jest planowany co5 s; czas odpowiedzi może wydłużyć wykrycie revocation. Denial wyłącza tracki i czyści clinical UI. Zwinięcie panelu tylko ukrywa DOM, nie wyłącza mikrofonu; podczas przechwytywania/startu guard zakładki blokuje zmianę i prosi o zakończenie. Pagehide natychmiast zamyka mikrofon i próbuje keepalive stop best-effort, bez gwarancji rozliczenia.

Disable blokuje nowe żądania/publikację. Prywatny admin-hook zamyka i rozlicza pewne stany tylko na financial metadata, bez decrypt PHI; uncertain/pending pozostawia z rezerwacją. Nie może cofnąć wysłanego audio.

Browser clinical state jest tylko w pamięci, bez local/session storage/IndexedDB. Host nie utrwala PCM, ale **trwale przechowuje zaszyfrowane** source/transcript/proposals/chunk results. Ledger/audit/logs tylko metadata. Uzgodniona retention/holds i provider policy są wymagane; **nie dodano TTL/workera retencji**. Core GDPR hard-delete usuwa sesje/chunki przed kartą, financial ledger pozostaje. Czas sesji nie jest terminem usunięcia danych.

Nowy schema prerequisite: ręcznie tylko brakująca **`088_plugin_live_interviews.sql`**, po administrator review/backup. Potwierdź istniejące prerekwizyty bez rerun wcześniejszych potwierdzonych SQL, szczególnie084; brak autoSQL/workera live.

## Weryfikacja i granica dowodów

Przykładowe kontrole do rzeczywistego wykonania przez integration owner:

```sh
python -m celloklab_plugin_sdk.validation plugins/vision_visit_assistant
python -m pytest -q tests/test_plugin_live_audio_client.py tests/test_vision_visit_assistant.py tests/test_plugin_live_interview_runtime.py tests/test_plugin_live_interview_http.py tests/test_plugin_live_audio_provider.py
```

Raportuj actual executed results bez historycznych counts. Static validation nie wykonuje entrypointu/autoryzacji; fake/QuickJS/SQLite nie zastępują realnego mikrofonu HTTPS/browser, provider STT+text, klinicznej jakości, kosztów, MariaDB transaction/deletion/concurrency ani wyniku w2 s. **Te odbiory pozostają niepotwierdzone.** Source implementation nie jest deployed configuration. Właściciel wydania finalizuje Python SDK1.2.1 sources/wheel; ta dokumentacja nie buduje ZIP, nie wykonuje public sync, commit/push, SQL lub płatnego smoke testu.
