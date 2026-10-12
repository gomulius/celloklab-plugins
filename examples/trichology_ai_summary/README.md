# Niezależne podsumowanie trychologiczne AI

Wtyczka **`trichology.ai-summary`**, SDK `1.0`, wersja `1.0.0`, korzysta wyłącznie z publicznego `celloklab_plugin_sdk`. Nie importuje hosta, bazy danych ani klienta dostawcy AI. Jest zaufanym, recenzowanym kodem działającym w procesie hosta — nie piaskownicą.

## Kontrakt i źródło

Manifest żąda dokładnie `AI`, `patient.read_trichology_record`, `ai.trichology_summary` i deklaruje `trichology.record.changed`. `PluginRegistrar.register_trichology_summary(TrichologySummaryRegistration(prompt_builder=build_prompt))` rejestruje wyłącznie ten wąski przepływ. Nie udostępnia ogólnej magistrali zdarzeń, dowolnych zadań, odczytu tabel ani wykonania AI.

Host wywołuje builder z `TrichologySnapshot`: `{"fields": {"pole": "wartość lub null"}}`, bez identyfikatorów pacjenta, użytkownika i kliniki. Migawka obejmuje zatwierdzone pola wszystkich 12 natywnych sekcji wywiadu oraz `notes` i `additional_notes`, wyłącznie z zapisanych danych bazy — nie szkic przeglądarki, ostatnio zmienione pole, dawne wyniki AI ani pola przypisań/dostępu. Builder zwraca `TrichologySummaryPrompt(user_prompt=...)` (1–20000 znaków); nie ucina danych w ciszy. Host minimalizuje wartości skalarne i stosuje redakcję przed dostawcą. Brak osobnych identyfikatorów i redakcja **nie gwarantują anonimowości** tekstu swobodnego ani retencji po stronie dostawcy.

Rzeczywista zmiana źródła, również wyczyszczenie pola lub zaakceptowany PATCH Vision, aktualizuje rewizję i unieważnia poprzedni wynik w tej samej transakcji; sama zmiana **nie zleca generowania**. Potwierdzony natywny „Zapisz” zleca podsumowanie zapisanej dokumentacji także bez zmiany pól. Drugi jawny wyzwalacz to „Podsumuj teraz”. Wtyczka nie zastępuje natywnego formularza ani jego walidacji; nie zapisuje automatycznie szkicu.

### Dwa niezależne pola notatek

`patient_clinic_records.notes` to **Notatka trychologa** w zakładce trychologicznej; `additional_notes` to **Dodatkowe informacje**, osobne pole współdzielone z recepcją. Oba już należą do źródeł migawki i rewizji podsumowania, a builder umieszcza ich niepuste wartości w JSON instrukcji. Nie są zamiennikami: istniejące wpisy, również historyczne `notes`, pozostają bez kopiowania, scalania ani czyszczenia. Nie jest potrzebna nowa kolumna, migracja ani capability. Pluginowy zapis trychologii dopuszcza `notes`, ale nie `additional_notes`.

Zmiana lub wyczyszczenie samej Notatki trychologa tworzy nową wersję źródła i unieważnia poprzedni wynik, ale nie zleca zadania. Zadanie zleca natywny „Zapisz” (także bez zmian) albo „Podsumuj teraz”, przy zachowaniu dotychczasowej autoryzacji i zgody AI. Obie wartości przechodzą przez istniejącą redakcję hosta przed dostawcą, bez gwarancji anonimowości tekstu swobodnego. Wtyczka nie dodaje własnego formularza notatki ani nowych uprawnień.

## Interfejs i odczyt

Cały interfejs jest po polsku. Karta wyniku z przyciskiem `type="button"` „Podsumuj teraz” montuje się w `patient.records.sections`, na `documentation_form`, w `tab-wywiad`. Nie dodaje formularza, pól zapisu ani trwałego przechowywania medycznej treści w przeglądarce. Przed zleceniem używa hostowego `CelloklabPatientFormState.isReady()` / `isDirty()` i blokady zapisu bridge. Niezapisane zmiany, niegotowy stan lub trwający zapis blokują akcję: najpierw trzeba użyć natywnego „Zapisz”; nie ma autosave. Kontekst bierze z hosta, nie odgaduje identyfikatorów z adresu URL. Widoczność karty nie nadaje uprawnień klinicznych.

`GET /api/plugins/trichology.ai-summary/patients/{patient_id}/trichology-summary?tenant_slug=<slug hosta>` wymaga sesji hosta i `X-CSRF-Token`. Odpowiedź to `{"plugin_id":"trichology.ai-summary","summary":{...}}`; pola `summary`: `status`, `source_revision`, `current_revision`, `is_current`, `text`, `generated_at`, `job_id`. Statusy: `queued`, `processing`, `pending`, `failed`, `stale`, `succeeded`, `cancelled`, `absent`. Karta odczytuje ograniczoną liczbę razy (maksymalnie 30 żądań, odstęp 2 sekundy), zatrzymuje się przy opuszczeniu strony i pokazuje tekst przez `textContent`. Odczyt nie wywołuje modelu. Nie istnieje POST z dowolną instrukcją kliniczną.

Wymagane są aktualne uprawnienia kliniczne i przypisany pacjent. Dla capability `patient.read_trichology_record` aktywny lokalny `specialist`, przypisany do tego pacjenta przez `patient_clinic_records.assigned_specialist_id = users.id` (UUID użytkownika), nie potrzebuje profilu `doctors` ani `doctor_clinic_assignments` (DCA). Pozostali aktorzy kliniczni zachowują wymóg profilu lekarza/przypisania do kliniki. Wyjątek obejmuje tylko odczyt/zapis trychologii konkretnego pacjenta; polityki dokumentacji medycznej, wizyt i Case pozostają bez zmian. Recepcja, administrator czy finanse nie uzyskują dostępu przez widoczność UI. Host sprawdza aktora, przypisanie, wersję wtyczki, granty i politykę ponownie przed odszyfrowaniem, przed dostawcą i przed publikacją.

„Podsumuj teraz” wysyła `POST` **bez treści** pod ten sam URL co GET, z sesją hosta i `X-CSRF-Token`. Nie wysyła nawet `{}` ani pól, instrukcji czy rewizji; host odrzuca treść i ładuje pełną zapisaną migawkę z bazy. Odpowiedź `{"plugin_id":"trichology.ai-summary","request":{...}}` opisuje zadanie; wykonuje je istniejący worker, nie przeglądarka. Montaż karty, rozwinięcie, polling i akceptacja propozycji Vision nie zlecają generowania. Po utracie odpowiedzi, błędzie serwera lub nieprawidłowym potwierdzeniu UI wykonuje tylko ograniczone GET, nie ponawia automatycznie płatnego POST.

## Wynik i bezpieczeństwo rozliczeń

To **artefakt kliniczny**, nie neutralne `/ai/completion`: host trwale zapisuje zaszyfrowaną migawkę zadania i aktualny zaszyfrowany wynik z rewizją źródła. Neutralne AI nadal nie zapisuje treści wyniku; jego replay zwraca wyłącznie metadane. Rejestry wykonania/finansów, audyt i logi nie zawierają instrukcji ani wygenerowanej treści.

Host deduplikuje zlecenia tej samej rewizji źródła, także po zakończeniu zadania (`succeeded`, `failed`, `cancelled`, `stale`). Kolejny „Zapisz” lub „Podsumuj teraz” zwraca istniejące zadanie, bez nowego wywołania dostawcy i naliczenia. **Nie można ponownie płatnie wygenerować tej samej migawki**, również po błędzie lub zmianie konfiguracji; do nowego zlecenia potrzebna jest nowa rewizja zapisanych źródeł. Nie resetować terminalnych zadań ani nie omijać deduplikacji.

Zmiana źródła blokuje publikację starego wyniku; wcześniej zapisany wynik może być oznaczony jako nieaktualny. Prawidłowa opłacona odpowiedź nie jest zwracana finansowo tylko dlatego, że źródło zmieniło się w trakcie. Wyłączenie wtyczki lub cofnięcie uprawnień blokuje pracę/publikację; nie rozstrzyga niepewnego wysłania. Zadanie po niepewnym wysłaniu pozostaje `pending` do ręcznego uzgodnienia, bez automatycznego ponowienia. Host używa dzierżawy 300 sekund i maksymalnie 6 prób odzyskania przed wysłaniem.

Podsumowanie nie stanowi diagnozy ani zalecenia leczenia. Zachowuje braki i niepewności źródeł; wymaga weryfikacji uprawnionego specjalisty.

## Przekazanie administratorowi i pilotaż

1. Zatwierdzić źródło i dokładną wersję; włączyć wtyczkę z trzema jawnymi grantami.
2. Potwierdzić istniejące migracje 079/080; zastosować ręcznie **wyłącznie brakującą**, recenzowaną migrację **081**. Nie uruchamiać ponownie SQL wcześniej potwierdzonego i nie instalować automatycznego migratora.
3. Skonfigurować i jawnie aktywować własną funkcję `plugin_ai_feature_id("trichology.ai-summary")`, aktywny model/dostawcę, koszt, licencję i kredyty; uzyskać niezależną zgodę lokalnego administratora kliniki. Natywna funkcja AI nie jest zgodą na tę wtyczkę.
4. Natywne moduły AI zostały usunięte — **nie ma kroku wyłączania ich w klinice pilotażowej**. Administrator hosta przegląda i ręcznie stosuje wyłącznie brakującą migrację `migrations/083_remove_legacy_native_ai_configuration.sql`, po wdrożeniu usunięcia natywnych wywołań. Migracja usuwa stare przypisania/ustawienia i konfigurację generowania; rekordy funkcji wymagane przez historię FK pozostają nieaktywne. Zachowuje wszystkie kliniczne tabele, kolumny i wyniki, salda, transakcje oraz rezerwy/kolejki wtyczek. Nie konwertuje historycznych wyników do artefaktów wtyczki; taka konwersja wymaga osobno zatwierdzonej migracji. Natywne formularze kliniczne pozostają dostępne.
5. Docker/Passenger uruchamia dedykowany worker hosta automatycznie przez istniejący supervisor, obok poczty i mediów. Nie dodawać drugiego workera ani cron. Samo uruchomienie uvicorn nie uruchamia workera: w takim wdrożeniu administrator zapewnia osobny nadzorowany proces. Zasady retencji/usuwania pacjenta i uzgadniania `pending` są utrzymywane przez hosta.

## Prezentacja sekcji i stany

Karta jest dzieckiem sekcji `.clk-plugin-ui`, zgodnie z `PLUGIN_UI_STYLE_GUIDE.md` i `PLUGIN_UI_HOOK_CATALOG.md`, w istniejącym slocie `patient.records.sections`. Używa współdzielonych klas karty/nagłówka/treści; nie wprowadza formularza ani pól natywnego zapisu. Cała sekcja jest domyślnie zwinięta, z natywnym `details`/`summary` obsługującym klawiaturę. Odczyt nie rozwija jej automatycznie, a rozwijanie nie generuje ani nie wysyła dodatkowych żądań. Sam wynik jest w osobnej ramce „Wygenerowane podsumowanie”, oddzielonej od opisu/statusu. Data i godzina pochodzą z `generated_at`; nie zgadujemy strefy czasowej ani nie podstawiamy obecnego czasu. Brak lub nieprawidłowa data pozostaje ukryta. Pokazuje czytelne informacje o aktualności zamiast technicznych skrótów wersji. `queued` to oczekiwanie w kolejce; `pending` to niepotwierdzony wynik wywołania wymagający sprawdzenia przez administratora, bez automatycznego ponawiania. Ten komunikat pozostaje także po wyczerpaniu limitu odczytów. Metadane używają kompaktowych odstępów UI Kit i bloków bez marginesów akapitów. Krótka fraza „AI — wymaga” pozostaje w jednej linii; pozostały tekst może zawijać się responsywnie. Treść wyniku, daty i generowanie nie zmieniają się.

## Zawartość publicznego przykładu

ZIP obejmuje tylko pięć plików wykonawczych: `manifest.json`, `trichology_ai_summary.py`, `ui-declarations.json`, `templates/summary.html`, `static/staticsummary.js`, oraz ten README. Nie obejmuje hosta, migracji, poradników administracyjnych, sekretów ani danych pacjentów.

```sh
celloklab-plugin-validate examples/trichology_ai_summary
```

Walidacja i izolowane testy SDK nie potwierdzają działania produkcyjnej MariaDB, uwierzytelnionej przeglądarki ani dostawcy AI. Odbiór pilotażu wymaga oddzielnych testów syntetycznych autoryzacji, zmian źródła, retencji, awarii i rozliczeń.
