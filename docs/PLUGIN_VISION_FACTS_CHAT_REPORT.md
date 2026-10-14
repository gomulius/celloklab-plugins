# Vision: diagnoza kompletności propozycji i odzyskiwanie czatu

## Podstawa diagnozy
Brak dostępu do logów produkcyjnego incydentu. Wnioski pochodzą ze źródeł i odtworzeń na danych syntetycznych, nie z treści pacjenta. Nie przypisujemy incydentowi finasterydu jednego kodu bez logu. STT, worklet, model i transport niezmienione w tej rundzie.

## 1. Propozycje
Przyczyna potwierdzona kodem: starsza ścieżka current_medications w UI rozpoznawała leki przez mały słownik; rozpoznanie jednego leku mogło pominąć niesłownikowy paracetamol. Zmieniono bounded generic lookup oraz structured medication_mentions, prompt obejmuje OTC/leki doraźne, równoczesne choroba+lek i konkretne odpowiedzi tak ze źródłem pytania i odpowiedzi. Polecenie specjalisty jest propozycją, a pytanie nie jest faktem. Liczniki model_updates→validated_proposals→unchanged_proposals→published_proposals są zwracane i logowane tylko jako liczby. Kody safety/speaker służą diagnostyce, nie dowodzą konkretnej przyczyny na dev. Zgodność RPL i oryginalne baseline/If-Match pozostają.

## 2. Objaśnienia
Przyczyna: mały słownik i ograniczone wyszukiwanie nie pokrywały wszystkich nazw. Rozszerzono bounded official prefix/fuzzy retrieval dla RPL; brak wymyślonych identyfikatorów. Prompt żąda edukacyjnych insights z maksymalnie czterema nowymi pojęciami i trichology_relevance wysokie/umiarkowane/niskie; enum jest walidowany, stary wynik bez pola pozostaje zgodny. Źródła exact oraz deduplikacja pozostają. Każde nowe dowolne pojęcie wymaga, aby model faktycznie je zwrócił — brak gwarancji pełności LLM. Metadane wzmianki nie dowodzą stosowania, katalog może nie mieć ATC. Brak istotnego wpływu ma być objaśniony, nie wymyślony jako działanie.

## 3. Kontekst i rozbieżności
Autorytatywna karta i demografia były już odświeżane atomowo przy claim; teraz dodatkowo wzbogacamy aktualny kontekst RPL pytań, analizy i czatu. Co wiem o pacjencie pokazuje 2–4 punkty z bieżącej karty. Dodano discrepancies: message/ask/evidence/field?, exact pełne cytaty i native-field validation; wyróżniona uwaga nad rozmową. Nie nadpisuje leków ani nie oznacza odstawienia bez wypowiedzi i akceptacji. Dane badań/trychoskopii poza istniejącym facade nadal nie są dodatkowo pobierane. Płeć/age mogą być nieznane; neutralne formy zamiast zgadywania.

## 4. Czat
Odtworzono sześć regresji syntetycznych. Callback PermissionError po definitywnej odpowiedzi dostawcy uciekał z walidacji i zostawiał dispatch pending. Naprawiono finalizację odrzucenia (chat_result_schema/allowlisted structured codes), zachowano ponowne sprawdzenie autoryzacji. Host obcinał żądane 4096 tokenów do2048; teraz dopuszcza limit4096 callbacka (default2048). Nie dowodzi to, że produkcyjny błąd był truncation. Kody nie są zastępowane samym generic phase. Failed replay/status tego samego UUID zwraca oryginalny code bez redispatchu. Prawdziwy timeout po dispatch i niepewny usage commit pozostają pending, z cause_code. Nie odzyskujemy nieutrwalanej odpowiedzi z serwera; nie powtarzamy płatnego wywołania. Stare osierocone pending wymagają dowodu rozliczenia, nie automatycznego retry.

## 5. Role
Dodano rozpoznawanie poleceń dodaj do karty z treści. Podział role z kontekstu pozostaje heurystyczny, nie akustyczny; nie zmieniono STT. UI etykiety znanych ról kolorystyczne, niepewne nie są sztucznie przypisane. Patient explicit self-report i krótka odpowiedź nie są odrzucane wyłącznie za unknown speaker; negacje, hipotetyczne pytania i rodzina nie stają się faktami.

## Testy i czasy
845 PASS, zero skipów, jedno ostrzeżenie deprecacyjne; rzeczywisty Chromium. /tmp/vision-facts-final.xml. Zestaw trwał70,65s, co NIE jest latencją modelu. Testy odtwarzają kontrakty, nie niezawodność rzeczywistego dostawcy. Telemetria po zmianach: claim/rpl_context/prompt/provider/validation/persistence/pending + elapsed_ms, outcome flags i A/B/C/D bez treści. Nie mamy pomiarów rzeczywistego mikrofonu ani etapów na dev: wymagany scenariusz użytkownika i mediany/p95 na identycznym nagraniu. Nie deklarujemy odpowiedzi w kilka sekund bez tego pomiaru. Rozszerzenie nie wymaga migracji ani zmiany wheel SDK. Historia czatu nadal tylko w pamięci, każda zmiana do akceptacji.
