# Przykład: edytor wywiadu trychologicznego

Moduł `example.trichology-interview` nie używa AI. Publiczny SDK 1.1.0
(`sdk_version: 1.0`) dostarcza niezależny od hosta schemat wszystkich 41 nowych
pól. Moduł generuje edytory tekstu, pojedynczego i wielokrotnego wyboru oraz
trójstanowego pola logicznego. Etykiety są po polsku, wartości opcji pozostają
kodami. Nie importuje hosta, SQL ani klienta zewnętrznego API.

## Uruchomienie

Administrator instaluje zrecenzowane źródła i publiczny SDK, zatwierdza dokładną
wersję oraz nadaje `patient.read_trichology_record` i
`patient.write_trichology_record`. Walidacja offline:

```sh
celloklab-plugin-validate examples/example_trichology_interview
```

Host montuje fragment w `patient.records.sections`, na `documentation_form`,
`tab-wywiad`. Lista ról nie zastępuje silniejszej kontroli klinicznej hosta:
aktywny specjalista i jego przypisany pacjent w bieżącej klinice. Wymuszenie
`requires_doctor` wykluczyłoby uprawnionych specjalistów niebędących lekarzami,
dlatego pozostaje `false`. Widoczność fragmentu nie nadaje uprawnień API.

## Typowany kontrakt

GET `/api/plugins/{plugin_id}/patients/{patient_id}/trichology?tenant_slug=...`
zwraca kopertę `record`. Czytaj `record.interview_values` (wszystkie 41 pól:
string/null, array/null, boolean/null), `interview_options`, `field_labels`
i `revision`. Historyczne pola najwyższego poziomu pozostają wartościami do
wyświetlania — nie używaj ich do edycji. SDK udostępnia
`TRICHOLOGY_INTERVIEW_FIELDS`, `FIELD_LABELS`, `OPTIONS`, `MULTI_FIELDS`,
`TrichologyInterviewUpdates`, `validate_trichology_interview_updates`.
Walidator przyjmuje częściowy słownik nowych pól i zwraca JSON-friendly dane;
nie serializuje tablic do SQL/JSON TEXT. Pusty tekst oznacza null, tablica []
pozostaje [], false pozostaje false. Ominięte pola pozostają bez zmian.

PATCH tej samej trasy wysyła **płaskie** body tylko zmienionych pól, np.
`{"chief_complaint":"Dane syntetyczne","affected_areas":["vertex"],"post_transplant":false}`.
Bieżąca `revision` trafia do `If-Match`. Koperta `result` zawiera nową `revision`
i `updated_values` tylko przesłanych pól. Sesja hosta, CSRF i kontekst kliniki
pochodzą z hostowego DOM; nie ma kluczy partnera ani własnego globalnego klienta.

## Zapis niezależny od formularza pacjenta

Brak zagnieżdżonego formularza, nazw pól i natywnego submit. Elementy są oznaczone
`data-plugin-nonform`. Przycisk „Zapisz wywiad partnera” ma `type="button"`.
Zmiany modułu **nie są zapisywane** przyciskiem natywnego formularza.
Moduł nie przejmuje jego submit ani nie czyści jego dirty state. Własny status
i ochrona przed opuszczeniem strony dotyczą tylko niezapisanych zmian modułu.
Nie zapisuje danych w local/session storage ani logach.

Moduł blokuje zapis, gdy formularz pacjenta ma niezapisane zmiany. Najpierw
zapisz formularz pacjenta i odczytaj aktualną wersję modułu. Po potwierdzonym
PATCH moduł uaktualnia tylko odpowiadające zapisanym polom natywne kontrolki
i migawkę inicjalizacji, bez generowania zdarzeń dirty. Zmiany natywne wykonane
w czasie żądania pozostają nietknięte. Nie zapisuj dwóch edytorów równolegle.

Konflikt lub błąd zachowuje wszystkie wpisane wartości i blokuje kolejny PATCH
do jawnego ponownego odczytu. Odczyt odświeża rewizję, lecz zachowuje lokalne
zmienione pola. Po takim odczycie użytkownik sprawdza zmiany i potwierdza ich
zapis na nowej wersji. Brak automatycznych prób, ponowień ani ślepego nadpisania.
Niepewny wynik sieciowy wymaga odczytu przed kolejną operacją. Odmowa dostępu
pokazuje bezpieczny polski komunikat, nigdy tekst wyjątku serwera.

Testy kontraktu i wykonania JS używają danych syntetycznych. Nie zastępują
akceptacji w przeglądarce z prawdziwą sesją, kliniką, CSRF i MariaDB.
