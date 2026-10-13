# Vision: kontekst pacjenta, polskie źródła, objaśnienia i czat

## Zrealizowane
- Poziomy rząd zakładek ze specyficznością wobec stylów hosta; kompaktowy wiersz zgody/mikrofonu, stały composer. Testy rzeczywistego Chromium obejmują 360/260/220 px.
- Live pytania, analiza i czat otrzymują wiek i płeć z autoryzowanego PatientService oraz pełny dostępny natywny rekord (12 sekcji, RPL, alergie, leczenie). Dane demograficzne nie zawierają nazwy/PESEL w promptach. Formy Pan/Pani i neutralne przy braku danych; wykluczenie pytań niedotyczących płci.
- Insights AI, maksymalnie 4 na wynik, wymagają rzeczywistych źródeł w transkrypcji; nowe objaśnienia nad pytaniami, deduplikacja. Lokalna baza nadal natychmiastowa, dodano migrenę/Nimesil/nimesulid/warianty dutasterydu. Hostowe RPL przekazuje oficjalnych kandydatów, bez deklarowania przyjmowania na podstawie wzmianki; ATC null jeśli katalog go nie zawiera.
- Słownik i język polski dla gpt-live-transcribe; kontekst poprzedniej wypowiedzi redagowany przed skracaniem. Dosłowny raw_text pozostaje dowodem; display_text i korekty są osobne i oznaczone do potwierdzenia.
- Role rozpoznawane z treści: Pacjent/Specjalista, albo nieznany. To NIE akustyczna diaryzacja. Nie wymuszamy naprzemiennych ról jak w heurystyce prototypu. Krótkie odpowiedzi i nowe słowa nie są blokowane za brak w słowniku.
- Obcy/niewiarygodny tekst jest prezentowany po polsku jako niepewny; analiza może zwrócić oznaczone tłumaczenie do potwierdzenia. Nie tłumaczymy bełkotu w wymyślony fakt, nie zamieniamy tłumaczenia w cytat ani bezpośredni zapis.
- Czat: definitywny błąd przed dispatch nie blokuje dalszego pisania. Odczyt statusu niepewnej wiadomości jest autoryzowany i nie ponawia płatnego POST. Zakończonego tekstu nie można odzyskać z serwera, bo historia/odpowiedzi są tylko w pamięci; status mówi o tym wprost.

## Granice
Nie rozszerzono scope na prywatne tabele badań/trychoskopii: do promptów wchodzą tylko dane obecnego zatwierdzonego facade. Pełne nowe integracje badań wymagają osobnego kontraktu. Nie zmieniono wymaganej zgody, roli przypisanego specjalisty, If-Match/baseline ani jawnej akceptacji; brak autozapisu. Nie zmieniono samodzielnego pluginu podsumowania przy tej rundzie: podsumowanie w czacie dostaje bieżący kontekst.

## Weryfikacja i pomiary
824 testy live/Vision/speech PASS, bez skipów, jedno ostrzeżenie deprecacyjne; obejmują Chromium i rzeczywiste SQL przez adapter SQLite. Raport /tmp/vision-round-final.xml. Brak dostępu do tej samej rzeczywistej sesji/nagrania oraz telemetrii produkcyjnej sprzed zmian: nie ma rzetelnego porównania czasu przed/po. Czas zestawu testów (60,24 s) NIE jest latencją STT ani benchmarkiem dostawcy. Do odbioru potrzebne pomiary capture→STT final, STT→local insight, STT→AI insight, czas chat reply na identycznym nagraniu/modelu, z liczbą prób i medianą/p95. Obecne StageTimer rejestruje beztreściowe czasy etapów; nie zapisuje tekstu ani PCM w logach.

## Kontrakt
Session rozszerzona o insights i medications oraz segment raw/display/role/confirmation. Publiczny TaskContext nie zmienił API. Brak migracji i nowej wersji wheel SDK. Nowy chroniony odczyt statusu czatu /chat-status wiąże UUID request z sesją; nie zwraca historii lub odpowiedzi.
