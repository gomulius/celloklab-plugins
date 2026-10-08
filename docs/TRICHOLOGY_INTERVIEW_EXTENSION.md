# Rozszerzony wywiad trychologiczny

## Zakres

Formularz `templates/documentation_form.html` zachowuje istniejącą Dokumentację Trychologiczną. Dodatkowe sekcje renderuje wewnętrzny include `trichology_interview_extensions.html`. Definicje 41 nowych pól, polskie etykiety, kody wyborów oraz walidacja znajdują się w `app/models/trichology_interview.py`. Pełny publiczny kontrakt pól, typów, limitów i kodów opisuje **[PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md](PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md)**.

Źródłem porównania był wywiad Vision; jego repozytorium nie jest modyfikowane. Nagrywanie, transkrypcja, asystent i wyszukiwarka RPL nie należą do tego rozszerzenia. Nie rozszerza ono dokumentacji lekarskiej Case.

## Przechowywanie i wdrożenie

Migracja `084_trichology_interview_fields.sql` jest **potwierdzona jako wykonana** na bazie tego wdrożenia. Nie uruchamiać jej ponownie. Dodała niezależne nullable kolumny w `patient_clinic_records`, bez zmiany historycznych danych i bez wprowadzania szyfrowania. Listy wyborów zapisuje się niezależnie jako JSON TEXT we właściwych kolumnach, nie jako jeden dokument ankiety. Bezpośrednie filtrowanie pojedynczych wyborów jest możliwe w SQL; listy wymagają operacji JSON, a wydajna wyszukiwarka osobnego projektu indeksów.

Rollback aplikacji pozostawia kolumny i zgromadzone odpowiedzi; nie usuwać danych klinicznych przez DROP COLUMN. Migracja nie jest wykonywana automatycznie. Typowany most pluginowy nie wymaga kolejnej migracji ani workera. Istniejące szyfrowanie snapshotów zadań AI i artefaktów jest odrębnym mechanizmem i **nie szyfruje natywnych kolumn wywiadu**.

## Kontrakt zapisu i dostęp

- Pole pominięte pozostaje bez zmian; wysyłać tylko zmienione odpowiedzi.
- Dla nowych pól jawne `null` lub pusty tekst czyści odpowiedź; pusta lista czyści zaznaczenia.
- `post_transplant` rozróżnia rzeczywiste JSON `true`, `false` i `null`. `false` jest prawidłową odpowiedzią, nie brakiem wartości; teksty lub liczby nie zastępują boolean.
- Pięć wielokrotnych wyborów: `affected_areas`, `scalp_symptoms`, `scalp_condition`, `shaft_condition`, `androgen_symptoms`. Odczyt i nowy zapis pluginowy używają tablic kodów, nie podpisów ani JSON-u w stringu. Backend normalizuje listy, usuwa duplikaty z zachowaniem kolejności i ogranicza je do 200 przekazanych elementów. Natywna kompatybilność JSON-list string jest ograniczona do 65535 bajtów UTF-8.
- Teksty nowych pól: maksymalnie 20000 znaków i 65535 bajtów UTF-8; pojedyncze wybory: dokładne kody z katalogu. Nieznane kody, złe typy i nieobsługiwane pola są odrzucane.
- Każde nowe pole, również wyczyszczenie, podlega klinicznej kontroli dostępu. Nowe odpowiedzi są usuwane z kontekstu HTML/JSON recepcji bez dostępu trychologicznego.
- Natywne leki i suplementy zachowują `name`, `dose`, `schedule`, opcjonalne `frequency` i `since`; usunięcie wierszy zapisuje pustą listę. Nie przenosi to natywnych typów do niezmienionego legacy plugin PATCH. Opis załącznika nie jest częścią zapisu pacjenta.
- `notes` (**Notatka trychologa**) i `additional_notes` (**Dodatkowe informacje**) pozostają niezależne; drugie pole nie staje się zapisywalne przez plugin.

## Pluginy i istniejące źródło AI

GET `/api/plugins/{plugin_id}/patients/{patient_id}/trichology?tenant_slug=…` zachowuje główne legacy/polskie pola prezentacyjne i `field_labels`. Dodaje `record.interview_values` z **wszystkimi 41 typowanymi kluczami** (kody, tablice, boolean/null, tekst/null) i `record.interview_options` z mapami kod → polski podpis. Nie zapisywać podpisów jako kodów. Dotychczasowy skalarny snapshot źródłowy AI pozostaje osobny od edytowalnego DTO.

PATCH tej samej ścieżki przyjmuje niepusty **płaski** obiekt pól. Węższa lista legacy `WRITE_FIELDS` i jej wymaganie stringów do 20000 znaków/pustego tekstu do czyszczenia/null odrzuconego pozostają niezmienione; obok niej dopuszcza się wszystkie 41 nowych pól z powyższą semantyką. `result.updated_values` obejmuje wyłącznie przesłane pola, z typowanym odczytem nowych wartości, nie cały rekord. Szczegóły listy legacy i katalogów są w publicznym kontrakcie.

Wystarczają istniejące `patient.read_trichology_record` oraz `patient.write_trichology_record`; nie ma nowego grantu. Brak/cofnięcie capability odmawia dostępu. Wtyczka dotąd tylko czytająca, która dodaje zapis, wymaga zatwierdzenia dokładnej wersji manifestu i jawnego istniejącego grantu zapisu; nie wymuszać ponownej akceptacji niezmienionych ważnych grantów. Aktualna rola kliniczna, aktywny profil lekarza, przypisanie do kliniki i przypisany pacjent pozostają obowiązkowe; widoczność UI/rola administratora nie zastępuje tych warunków.

Zapis, obowiązkowy audyt kliniczny, rewizja i kwalifikowane zdarzenie `trichology.record.changed` pozostają transakcyjne. Rzeczywista zmiana, także wyczyszczenie, zmienia świeżość źródła; no-op nie uruchamia nowego zadania. `If-Match` z rewizją odczytu jest technicznie opcjonalny, ale **zdecydowanie zalecany**. Przy 409 zachować szkic użytkownika i pierwotną rewizję; porównanie aktualnych danych musi być jawne, bez automatycznego nadpisania. Zachowane mechanizmy redakcji i polityki AI nie gwarantują anonimowości. Zapis wywiadu nie jest nową ścieżką generowania AI ani automatycznym eksportem na forum.

Publiczne, niezależne od hosta `celloklab_plugin_sdk/trichology.py` dostarcza stałe/katalogi i walidację częściowej aktualizacji. Referencja `plugins/example_trichology_interview` jest przeznaczona do `examples/example_trichology_interview/` w dystrybucji; nie wymaga `AI`. Finalne eksporty, wersje i allowlisty należy uzgodnić z rzeczywistymi artefaktami SDK/demo. Polski UI Kit, `textContent`, przyciski `type="button"`, brak zagnieżdżonych formularzy i zachowanie natywnego zapisu są obowiązkowe; odpowiedzi i szkice nie trafiają do logów ani pamięci przeglądarki trwałej.

## Weryfikacja i ograniczenia

Istniejące pliki testów rozszerzenia: `tests/test_trichology_interview_backend.py`, `tests/test_trichology_interview_ui.py`, `tests/test_trichology_interview_read_surfaces.py`. Ich historyczny zakres nie jest dowodem weryfikacji nowego typowanego mostu. Właściciel integracji dołącza rzeczywiste wyniki nowych testów host/SDK, walidacji przykładów, izolowanej instalacji oraz inventory/identyfikację archiwum po końcowej dokumentacji. Ten przewodnik opisuje kontrakt, nie deklaruje niewykonanych testów. MariaDB, autoryzowany browser E2E i wygląd desktop/mobile pozostają odrębnymi etapami odbioru.
