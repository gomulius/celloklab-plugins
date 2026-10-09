# Katalog RPL — ręczne operacje i granice integracji

## Zakres i warunki wdrożenia

RPL jest natywnym słownikiem produktów leczniczych dla ludzi, używanym do wyboru leków w wywiadzie trychologicznym. Nie jest katalogiem suplementów, mechanizmem ordynowania leku ani rozszerzeniem dokumentacji lekarskiej Case. Nie dodaje ogólnego endpointu ani capability wyszukiwania RPL dla pluginów.

Przed uruchomieniem katalogu administrator wdrożenia weryfikuje backup i stan schematu, przegląda oraz ręcznie stosuje **wyłącznie brakującą `migrations/086_rpl_catalog.sql`**. Migracja **084 jest potwierdzona jako wykonana — nie uruchamiać ponownie**. Nie ma automatycznego runnera migracji, importu przy starcie ani backfill leków pacjentów. Aktualizacja tej dokumentacji nie wykonuje migracji produkcyjnej.

Wymagany jest bezpieczny parser `defusedxml`; jego brak blokuje parsowanie, bez przejścia na niebezpieczny parser. Należy zapewnić miejsce na ograniczone pliki tymczasowe oraz czas obsługi jawnej operacji HTTP. RPL nie wymaga workera, crona, automatycznego odświeżania ani nowych sekretów/providerów AI.

## Panel administratora i jawny import

Otwórz istniejący panel **`/admin/clinical-dictionaries`**, część RPL, jako administrator platformy. Samo otwarcie strony tylko odczytuje stan; nie uruchamia importu. Dostęp administracyjny nie daje automatycznie dostępu klinicznego do wyszukiwarki.

1. Sprawdź dostępność, aktywny import i historię. Brak katalogu po migracji oznacza konieczność pierwszego jawnego importu, nie błąd migracji.
2. Wybierz świadomie pobranie oficjalnego katalogu albo upload oficjalnego XML **do 100 MiB włącznie**. Limit dotyczy rzeczywistych bajtów, nie tylko deklarowanego `Content-Length` lub rozszerzenia pliku.
3. Potwierdź pobranie i poczekaj na wynik. Nie zamykaj strony ani nie uruchamiaj równoległego ponowienia.
4. Po sukcesie sprawdź aktywny import, datę stanu katalogu, liczbę leków dla ludzi, datę importu i SHA-256. `catalog_date` pochodzi z `stanNaDzien` XML; `created_at` to data importu, a `activated_at` to aktywacja. Nie zastępuj tych wartości datą pobrania ani datą bieżącą.
5. Po timeout/utracie sieci/500 wynik może być niepewny: odczytaj status i historię przed następną świadomą próbą. Nie deklaruj sukcesu ani rollbacku na podstawie samego błędu połączenia.

Liczebność oraz data katalogu są danymi konkretnego importu, nie stałymi kontraktu. Liczba z testowego pełnego eksportu nie gwarantuje liczby w przyszłym katalogu.

## Natywne endpointy — nie API SDK

| Endpoint hosta | Dostęp i działanie |
|---|---|
| `GET /api/rpl/status` | Administrator platformy; dostępność, bieżący katalog, powód niedostępności i ostatnie importy (domyślnie 20). |
| `POST /api/rpl/refresh` | Administrator platformy; jawne pobranie ze stałego źródła, bez parametru URL. |
| `POST /api/rpl/import` | Administrator platformy; multipart z dokładnie jednym plikiem w polu `file`, bez pól tekstowych. |
| `GET /api/rpl/products?tenant_slug=…&q=…` | Uwierzytelniony klinicysta z aktualnym aktywnym dostępem klinicznym w aktywnej klinice; natywna wyszukiwarka, nie SDK. |

Operacje administracyjne wymagają aktualnej sesji administratora platformy (analyst/administrator kliniki nie wystarcza). POST wymaga poprawnego, związanego z sesją nagłówka **`X-CSRF-Token`**. Upload nie ma fallbacku do tokenu w formularzu; middleware weryfikuje nagłówek, a zależność administratora działa przed parsowaniem multipart. Body jest ograniczane przed parserem: 100 MiB pliku plus maksymalnie 1 MiB narzutu multipart; bufor pamięci przechodzi na plik tymczasowy. Nie omijaj kontroli autoryzacji/CSRF/rozmiaru. Odpowiedzi endpointów są `no-store`.

Dostęp do produktów jest związany z kliniką i aktywnym użytkownikiem/przypisaniem; flaga super-admin lub globalna rola nie zastępuje klinicznego scope. **Pluginy nie mogą używać `/api/rpl/products` jako obejścia fasady.** Nie istnieje ogólny pluginowy endpoint/capability RPL; metadane wyboru w istniejącym kontrakcie leków są walidowane przez hosta. Nowa wyszukiwarka partnerska wymaga osobnego zatwierdzenia kontraktu, nie zgadywania ścieżki core.

## Oficjalny XML, pobieranie i ograniczenia parsera

Stałe źródło bieżącej implementacji:

`https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/public-pl-report/6.0.0/overall.xml`

Parser przyjmuje ściśle format **6.0.0**: namespace `http://rejestry.ezdrowie.gov.pl/rpl/eksport-danych-v6.0.0`, korzeń `produktyLecznicze`, bezpośrednie elementy `produktLeczniczy`, poprawna data `stanNaDzien`. To nie jest importer dowolnego XML/CSV ani automatyczne wykrywanie przyszłych schematów. Zmiana formatu źródła wymaga przeglądu implementacji i testów.

Pobieranie korzysta z HTTPS ze sprawdzaniem TLS, odrzuca przekierowania, nie przyjmuje URL użytkownika i nie korzysta z proxy środowiska. Żąda nieskompresowanej odpowiedzi i odrzuca inne kodowanie treści. Limit 100 MiB jest liczony strumieniowo także przy braku `Content-Length`. Timeout połączenia wynosi 10 s, odczytu 30 s. Budżet pobierania wynosi 180 s i jest sprawdzany pomiędzy odczytami: **nie jest twardym terminem wall-clock** — blokujący odczyt może spowodować przekroczenie do jego timeoutu. Budżet nie jest gwarancją łącznego czasu parsowania i transakcji SQL.

Parser strumieniowy odrzuca DTD, encje i zewnętrzne odwołania; nie wczytuje całego dokumentu jako drzewa. Ma ograniczenia głębokości, liczby węzłów, tekstu/atrybutów i niedokończonych tokenów. Po produkcie zwalnia poddrzewo. Do katalogu trafiają wyłącznie produkty z `rodzajPreparatu="ludzki"`; weterynaryjne nie są wynikami, ale nadal podlegają limitom bezpieczeństwa parsera. Niepoprawny dokument lub brak produktów dla ludzi odrzuca cały import. Dane pochodzą z oficjalnych atrybutów nazwy, mocy i postaci; substancje są łączone bez duplikatów, z fallbackiem do nazwy powszechnie stosowanej. Nie dopisuje się wymyślonych produktów, suplementów ani wartości klinicznych.

## Publikacja atomowa i historia

Migracja 086 tworzy:

- `rpl_catalog_imports`: identyfikator importu, unikalny SHA-256 XML, data stanu katalogu, liczba produktów, operator, źródło (`official`/`upload`) i data importu.
- `rpl_catalog_products`: niezmienne produkty danego importu, klucz `(import_id, rpl_id)`, dane nazwy/substancji/mocy/postaci/podmiotu odpowiedzialnego; indeksy `(import_id, name(191))` i `(import_id, substance(191))` dla wyszukiwania prefiksowego.
- `rpl_catalog_current`: pojedynczy wskaźnik aktywnego importu oraz data aktywacji.

Import blokuje wskaźnik, parsuje i zapisuje partiami w jednej transakcji, następnie atomowo przełącza aktywny katalog. Błąd parsowania/zapisu wycofuje całość i **zachowuje poprzedni działający katalog**. Nie usuwa ani nie przepisuje wcześniejszych produktów i migawek leków pacjentów. Pierwszy nieudany import pozostawia katalog niedostępny.

Ten sam SHA-256 jest no-op (`unchanged=true`), także przy ponownym przesłaniu starego, już znanego XML: **nie reaktywuje starego importu**. Nie ma przycisku arbitralnego rollbacku katalogu; nie improwizuj SQL zmieniającego wskaźnik ani kasującego historyczne importy. Rollback aplikacji zachowuje katalog i kliniczne migawki.

## Wyszukiwanie i wybór w wywiadzie

Wyszukiwanie działa lokalnie w aktywnym imporcie, bez pobierania oficjalnego XML podczas wpisywania. Wymaga co najmniej **2 znaków**, przyjmuje do 100 znaków i zwraca maksymalnie **20 wyników**, uporządkowanych po nazwie/ID. Dopasowuje **prefiks** nazwy handlowej albo zapisanego tekstu substancji; nie dowolny fragment i nie każdą substancję wewnątrz złożonej wartości. Znaki `%` i `_` są escapowane, a nie używane jako wildcard użytkownika. Krótsze zapytanie daje pustą listę przy dostępnym katalogu; brak katalogu zwraca niedostępność, nie fałszywe „brak leków”.

Natywny combobox wyświetla nazwę, substancję, moc i postać, obsługuje strzałki/Enter/Escape oraz komunikaty statusu. Moc produktu (`strength`) nie jest dawką przyjmowaną (`dose`). Nowy lek lub zmieniona nazwa wymaga rzeczywistego wyboru z wyników; same wpisane litery nie są wyborem. Stare name-only wiersze można zachować i edytować schemat przyjmowania bez zmiany nazwy, bez automatycznego przypisania RPL. Suplementy pozostają oddzielną listą bez tego katalogu. Niepewność/błąd wyszukiwania nie usuwa szkicu.

Plugin `medication_list` pozostaje legacy zakodowanym JSON-em w stringu. Oprócz `name`, `dose`, `schedule`, opcjonalnego `frequency` i `since`, dopuszcza `rpl_id`, `import_id`, `catalog_date`, `strength`, `form`, `substance` jako kanoniczne stringi. Host po autoryzacji i blokadzie klinicznego rekordu rozwiązuje nowy ID w bieżącym imporcie; klient nie ustala historycznego importu ani oficjalnych metadanych. Istniejący wybrany ID zachowuje zaufaną historyczną migawkę. Szczegóły limitów i reguł zachowania legacy: [kontrakt wywiadu](PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md#medication-snapshots-legacy-wire-host-validated-rpl-selection).

## Błędy, prywatność i odbiór

- `413`: przekroczony limit bajtów pliku/body.
- `422`: nieobsługiwany/niebezpieczny XML, niepoprawne dane lub wybór produktu.
- `502`/`504`: błąd oficjalnego pobrania/budżetu czasu; przy niepewnym wyniku klienta najpierw sprawdzić stan.
- `503` z `rpl_catalog_unavailable`: np. brak importu, migracji, bazy albo bezpiecznego parsera. Sprawdzić `reason` i rzeczywisty schemat, nie powtarzać potwierdzonych migracji.
- `401`/`403`: sesja/uprawnienia/CSRF; nie osłabiać tych kontroli, aby import przeszedł.

Nie loguj zapytań wyszukiwania, list leków pacjentów, tokenów, cookies ani surowych wyjątków. Historia importów zawiera dane operacyjne katalogu, nie odpowiedzi pacjenta. Import nie wysyła danych klinicznych do źródła RPL.

Testy źródłowe: `tests/test_rpl_catalog.py`, `tests/test_rpl_admin_integration.py`, `tests/test_rpl_medication_persistence.py`, `tests/test_trichology_interview_layout.py` oraz istniejące testy wywiadu/UI. Weryfikować błędy i rollback, ten sam hash, zachowanie historii, fałszywe metadane, nowy wybór/legacy, granice uprawnień i CSRF przed multipart, limity strumieni/XML, prefiks/2 znaki/20 wyników oraz dostępność klawiatury. Lokalna kontrola dokumentacji ani jednostkowy parser nie są dowodem wykonania migracji produkcyjnej, poprawności blokad MariaDB lub autoryzowanego browser E2E. Dokumentować rzeczywiście wykonane kontrole i pozostałe bramki wdrożenia.
