# Niezależne podsumowanie trychologiczne AI

Wtyczka **`trichology.ai-summary`**, SDK `1.0`, wersja `1.0.0`, korzysta wyłącznie z publicznego `celloklab_plugin_sdk`. Nie importuje hosta, bazy danych ani klienta dostawcy AI. Jest zaufanym, recenzowanym kodem działającym w procesie hosta — nie piaskownicą.

## Kontrakt i źródło

Manifest żąda dokładnie `AI`, `patient.read_trichology_record`, `ai.trichology_summary` i deklaruje `trichology.record.changed`. `PluginRegistrar.register_trichology_summary(TrichologySummaryRegistration(prompt_builder=build_prompt))` rejestruje wyłącznie ten wąski przepływ. Nie udostępnia ogólnej magistrali zdarzeń, dowolnych zadań, odczytu tabel ani wykonania AI.

Host wywołuje builder z `TrichologySnapshot`: `{"fields": {"pole": "wartość lub null"}}`, bez identyfikatorów pacjenta, użytkownika i kliniki. Dostarcza tylko zatwierdzoną listę pól źródłowych wywiadu trychologicznego, nie dawne wyniki AI ani pola przypisań/dostępu. Builder zwraca `TrichologySummaryPrompt(user_prompt=...)` (1–20000 znaków); nie ucina danych w ciszy. Host minimalizuje wartości skalarne i stosuje redakcję przed dostawcą. Brak osobnych identyfikatorów i redakcja **nie gwarantują anonimowości** tekstu swobodnego ani retencji po stronie dostawcy.

Zdarzenie jest zapisywane w tej samej transakcji co rzeczywista zmiana źródła, również wyczyszczenie pola. Zapis bez zmian nie tworzy kolejnej generacji; jedna zmiana źródła oznacza jedną wersję. Wtyczka nie zastępuje natywnego formularza ani jego walidacji. Natywne AI i pozostałe integracje pozostają niezależne.

## Interfejs i odczyt

Cały interfejs jest po polsku. Własna karta tylko do odczytu montuje się w `patient.records.sections`, na `documentation_form`, w `tab-wywiad`. Nie dodaje formularza, pól zapisu, przycisku generowania ani przechowywania medycznej treści w przeglądarce. Kontekst bierze z hosta, nie odgaduje identyfikatorów z adresu URL. Widoczność karty nie nadaje uprawnień klinicznych.

`GET /api/plugins/trichology.ai-summary/patients/{patient_id}/trichology-summary?tenant_slug=<slug hosta>` wymaga sesji hosta i `X-CSRF-Token`. Odpowiedź to `{"plugin_id":"trichology.ai-summary","summary":{...}}`; pola `summary`: `status`, `source_revision`, `current_revision`, `is_current`, `text`, `generated_at`, `job_id`. Statusy: `queued`, `processing`, `pending`, `failed`, `stale`, `succeeded`, `cancelled`, `absent`. Karta odczytuje ograniczoną liczbę razy (maksymalnie 30 żądań, odstęp 2 sekundy), zatrzymuje się przy opuszczeniu strony i pokazuje tekst przez `textContent`. Odczyt nie wywołuje modelu. Nie istnieje POST z dowolną instrukcją kliniczną.

Wymagane są aktualne uprawnienia kliniczne, aktywny profil lekarza i przypisanie do kliniki oraz przypisany pacjent. Recepcja, administrator czy finanse nie uzyskują dostępu przez widoczność UI. Host sprawdza aktora, przypisanie, wersję wtyczki, granty i politykę ponownie przed odszyfrowaniem, przed dostawcą i przed publikacją.

## Wynik i bezpieczeństwo rozliczeń

To **artefakt kliniczny**, nie neutralne `/ai/completion`: host trwale zapisuje zaszyfrowaną migawkę zadania i aktualny zaszyfrowany wynik z rewizją źródła. Neutralne AI nadal nie zapisuje treści wyniku; jego replay zwraca wyłącznie metadane. Rejestry wykonania/finansów, audyt i logi nie zawierają instrukcji ani wygenerowanej treści.

Zmiana źródła blokuje publikację starego wyniku; wcześniej zapisany wynik może być oznaczony jako nieaktualny. Prawidłowa opłacona odpowiedź nie jest zwracana finansowo tylko dlatego, że źródło zmieniło się w trakcie. Wyłączenie wtyczki lub cofnięcie uprawnień blokuje pracę/publikację; nie rozstrzyga niepewnego wysłania. Zadanie po niepewnym wysłaniu pozostaje `pending` do ręcznego uzgodnienia, bez automatycznego ponowienia. Host używa dzierżawy 300 sekund i maksymalnie 6 prób odzyskania przed wysłaniem.

Podsumowanie nie stanowi diagnozy ani zalecenia leczenia. Zachowuje braki i niepewności źródeł; wymaga weryfikacji uprawnionego specjalisty.

## Przekazanie administratorowi i pilotaż

1. Zatwierdzić źródło i dokładną wersję; włączyć wtyczkę z trzema jawnymi grantami.
2. Potwierdzić istniejące migracje 079/080; zastosować ręcznie **wyłącznie brakującą**, recenzowaną migrację **081**. Nie uruchamiać ponownie SQL wcześniej potwierdzonego i nie instalować automatycznego migratora.
3. Skonfigurować i jawnie aktywować własną funkcję `plugin_ai_feature_id("trichology.ai-summary")`, aktywny model/dostawcę, koszt, licencję i kredyty; uzyskać niezależną zgodę lokalnego administratora kliniki. Natywna funkcja AI nie jest zgodą na tę wtyczkę.
4. W klinice pilotażowej **ręcznie wyłączyć** starą natywną `patient_summary_generation`, aby uniknąć podwójnego generowania. Kod wtyczki jej nie wyłącza i nie zmienia natywnego przepływu.
5. Docker/Passenger uruchamia dedykowany worker hosta automatycznie przez istniejący supervisor, obok poczty i mediów. Nie dodawać drugiego workera ani cron. Samo uruchomienie uvicorn nie uruchamia workera: w takim wdrożeniu administrator zapewnia osobny nadzorowany proces. Zasady retencji/usuwania pacjenta i uzgadniania `pending` są utrzymywane przez hosta.

## Prezentacja sekcji i stany

Karta jest dzieckiem sekcji `.clk-plugin-ui`, zgodnie z `PLUGIN_UI_STYLE_GUIDE.md` i `PLUGIN_UI_HOOK_CATALOG.md`, w istniejącym slocie `patient.records.sections`. Używa współdzielonych klas karty/nagłówka/treści; nie wprowadza formularza ani pól natywnego zapisu. Cała sekcja jest domyślnie zwinięta, z natywnym `details`/`summary` obsługującym klawiaturę. Odczyt nie rozwija jej automatycznie, a rozwijanie nie generuje ani nie wysyła dodatkowych żądań. Sam wynik jest w osobnej ramce „Wygenerowane podsumowanie”, oddzielonej od opisu/statusu. Data i godzina pochodzą z `generated_at`; nie zgadujemy strefy czasowej ani nie podstawiamy obecnego czasu. Brak lub nieprawidłowa data pozostaje ukryta. Pokazuje czytelne informacje o aktualności zamiast technicznych skrótów wersji. `queued` to oczekiwanie w kolejce; `pending` to niepotwierdzony wynik wywołania wymagający sprawdzenia przez administratora, bez automatycznego ponawiania. Ten komunikat pozostaje także po wyczerpaniu limitu odczytów. Metadane używają kompaktowych odstępów UI Kit i bloków bez marginesów akapitów. Krótka fraza „AI — wymaga” pozostaje w jednej linii; pozostały tekst może zawijać się responsywnie. Treść wyniku, daty i generowanie nie zmieniają się.

## Zawartość publicznego przykładu

ZIP obejmuje tylko pięć plików wykonawczych: `manifest.json`, `trichology_ai_summary.py`, `ui-declarations.json`, `templates/summary.html`, `static/staticsummary.js`, oraz ten README. Nie obejmuje hosta, migracji, poradników administracyjnych, sekretów ani danych pacjentów.

```sh
celloklab-plugin-validate examples/trichology_ai_summary
```

Walidacja i izolowane testy SDK nie potwierdzają działania produkcyjnej MariaDB, uwierzytelnionej przeglądarki ani dostawcy AI. Odbiór pilotażu wymaga oddzielnych testów syntetycznych autoryzacji, zmian źródła, retencji, awarii i rozliczeń.
