# Rozszerzony wywiad trychologiczny

This technical guide describes the committed host contract, not public artifact availability or production acceptance. Current host Python SDK is 1.1.0; the public `sdk/` source/wheel remain a 1.0.0 snapshot without the new typed module and interview example. Use pinned public GitHub source and [PLUGIN_SDK_RELEASE.md](PLUGIN_SDK_RELEASE.md); no ZIP generation or private installation workflow is required.

## Zakres

Formularz `templates/documentation_form.html` zachowuje istniejącą Dokumentację Trychologiczną. Dodatkowe sekcje renderuje wewnętrzny include `trichology_interview_extensions.html`. Definicje 41 nowych pól, polskie etykiety, kody wyborów oraz walidacja znajdują się w `app/models/trichology_interview.py`. Pełny publiczny kontrakt pól, typów, limitów i kodów opisuje **[PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md](PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md)**.

Źródłem porównania był wywiad Vision; jego repozytorium nie jest modyfikowane. Nagrywanie, transkrypcja, asystent i wyszukiwarka RPL nie należą do tego rozszerzenia. Nie rozszerza ono dokumentacji lekarskiej Case.

## Przechowywanie i wdrożenie

Migration 084 defines independent nullable `patient_clinic_records` columns without rewriting historical data or adding encryption. Migration 084 is user-confirmed applied for the referenced deployment and must not be rerun. Committed-source inspection does not independently verify that schema state. Only the host administrator reviews missing schema prerequisites; partners never apply SQL. Listy wyborów zapisuje się niezależnie jako JSON TEXT we właściwych kolumnach, nie jako jeden dokument ankiety. Bezpośrednie filtrowanie pojedynczych wyborów jest możliwe w SQL; listy wymagają operacji JSON, a wydajna wyszukiwarka osobnego projektu indeksów.

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

The host-independent 1.1.0 `celloklab_plugin_sdk/trichology.py` supplies constants/catalogs and partial-update validation. The implemented host reference is `example.trichology-interview` 1.0.0, without `AI`; its planned public `examples/example_trichology_interview/` location is absent from the current 1.0.0 snapshot. Do not substitute private imports for unpublished public helpers. Polish labels, `textContent`, explicit `type="button"`, no nested forms and unchanged native submit are required. The demo dynamically creates unnamed non-form controls, blocks PATCH while native fields are dirty and synchronizes only confirmed saved fields, preserving native edits made in flight. Denials clear displayed data and disable editing; only dirty drafts remain in transient memory, with authorized reread and explicit restoration confirmation. It uses inline Polish status/`aria-busy`, not the UI Kit loader/toast adapter. Raw validation `detail`/`input`/`ctx` must never be rendered, logged or persisted; malformed framework JSON errors are not covered by the domain's safe `invalid_update` envelope.

## Weryfikacja i ograniczenia

Existing extension suites include backend, UI and read-surface checks; their presence/historical results do not prove current bridge acceptance. This pass checks committed source/AST contract parity only, not SDK builds, ZIP inventory or test execution. Integration owners separately attach actual host/SDK tests, version-synchronized public source identity and runtime evidence. MariaDB concurrency/schema state, authenticated browser E2E and desktop/mobile geometry remain separate acceptance gates.
