# Organizacyjne rezerwacje wizyt — SDK 1.0

This guide describes implemented committed-host behavior. Host Python SDK is 1.1.0; the checked-in public SDK source/wheel remain the 1.0.0 snapshot without `bookings.py` or `examples/example_bookings/`. Use pinned public GitHub source and [PLUGIN_SDK_RELEASE.md](PLUGIN_SDK_RELEASE.md) to distinguish current contracts from available files. No ZIP generation is required.

## Granica i parytet z modułem natywnym

Rezerwacja kontaktowa jest wizytą, nie pacjentem, kontem ani dokumentacją. Kontakt `{name,surname,phone,email}` pozwala zarezerwować termin przed rejestracją. Po standardowej rejestracji recepcja przypisuje istniejącego pacjenta do **tej samej wizyty**, bez aktywacji konta. Przed przypisaniem nie ma dokumentacji pacjenta. SDK korzysta z tego samego hostowego `app.services.appointment_bookings` co operacje natywne: walidacja, rzeczywiste kolizje, czas, rewizje, idempotencja, audyt i transakcja należą do hosta.

Aktywna rola `reception_staff` w bieżącej klinice jest konieczna. Sama rola administratora lub klinicysty nie wystarcza. Aktor mieszany recepcja/klinicysta zachowuje ograniczenia własnego specjalisty i przypisanego pacjenta; wtyczka nie rozszerza uprawnień. Własna strona `ui.page` to prezentacja, nie grant danych. Wtyczka musi być obecnie włączona, zgodna wersją, z wymaganym grantem; host sprawdza te warunki w transakcji i przed zatwierdzeniem. Brak wspieranego przez core callbacku autoryzacyjnego oznacza błąd zamknięty, nie obejście.

Istniejące `visits.read_today`, `visits.read_full`, `visits.write` i ścieżki pacjenta pozostają. **Nie dołączają gości przez zmianę klinicznego JOIN**. Nowy odczyt organizacyjny nie zawiera diagnozy, notatek, zaleceń, mediów, kosztów ani dokumentacji. Case i mutacje personelu nie są rozszerzane. Brak raw SQL/API tabel, nowych ról, automatycznego tworzenia pacjentów lub maili.

## Najmniejsze oddzielne granty

| Capability | Operacja |
|---|---|
| `visits.read_bookings` | Lista/odczyt organizacyjnych rezerwacji |
| `visits.schedule_guest` | Utworzenie wizyty kontaktowej bez pacjenta |
| `visits.attach_patient` | Przypisanie już zarejestrowanego pacjenta |
| `visits.read_availability` | Specjaliści, minimalny katalog i anonimowe zajęte przedziały |
| `visits.reschedule_booking` | Zmiana wyłącznie daty tej samej wizyty |
| `visits.cancel_booking` | Anulowanie z zachowaniem historii |

Tworzenie wizyty z `patient_id` wymaga zachowanego `visits.schedule`, nie `visits.schedule_guest`. Demo prosi tylko o sześć grantów organizacyjnych i `ui.page`; nie prosi o AI ani kliniczny odczyt.

## Browser API

Bazowy adres: `/api/plugins/{plugin_id}/bookings?tenant_slug={dokładny_slug}`. Slug jest nieprzekształcanym kluczem hosta, nie UUID pacjenta. Uwierzytelniona sesja same-origin, standardowy hostowy CSRF (`X-CSRF-Token`) przy mutacji. Odpowiedzi: `{plugin_id,result}`.

| Metoda/ścieżka względna | Dane |
|---|---|
| `GET /providers` | bez danych pacjenta |
| `GET /catalog` | aktywne procedury bieżącej kliniki: `treatment_id`, `name`, `type`, `visit_type`, `duration_minutes`; bez pacjenta, cen i dokumentacji |
| `GET /availability` | `doctor_id`, `start`, `end` w query |
| `GET` (bez końcowego `/`) | opcjonalne `visit_id`, `unassigned_only=true` |
| `POST` (bez końcowego `/`) | payload tworzenia + `Idempotency-Key` UUID |
| `POST /{visit_id}/attach-patient` | `{patient_id}` + `If-Match` |
| `POST /{visit_id}/reschedule` | `{visit_date}` + `If-Match` |
| `POST /{visit_id}/cancel` | `{}` + `If-Match` |

Payload tworzenia: `patient_id` **albo** `contact`, `doctor_id` = kanoniczne `doctors.id`, `visit_date` lokalne ISO bez strefy, `visit_type` (`konsultacja`, `zabieg`, `inne`), opcjonalne `treatment_id`; `clinic_treatment_id` wyłącznie dla pacjenta i zabiegu. Nie przesyłaj czasu, końca, ceny, statusu ani pól dokumentacji. Przykład:

```json
{"contact":{"name":"Anna","surname":"Przykładowa","phone":"555000000","email":"anna@example.invalid"},"doctor_id":"12345678-1234-1234-1234-123456789002","visit_date":"2030-10-08T10:30","visit_type":"inne"}
```

Czas `duration_minutes` jest ustalany przez katalog administratora kliniki i zapisywany jako migawka wizyty. Natywny formularz wymaga katalogu dla konsultacji i zabiegów. API zachowuje historyczną konsultację bez katalogu z czasem 60 minut; zabieg z planu wymaga jednoznacznego aktywnego dopasowania katalogowego. Pozycje „Inne” mogą również korzystać z własnego czasu katalogowego. Wizyty „Inne” bez katalogu i historyczne brakujące migawki używają 60 minut. Zmiana katalogu nie zmienia wcześniejszych wizyt. `visit_end` wynika z migawki. Kolizje porównują rzeczywiste przedziały, również gdy ten sam człowiek ma kilka profili specjalisty. Dostępność obejmuje całą dobę: to nie grafik godzin pracy. Zajęte przedziały nigdy nie ujawniają pacjenta/kontaktu/ID wizyty.

Organizacyjny DTO ma bezpieczne pola: `id`/`visit_id`, `patient_id` lub `contact` z czterema polami, opcjonalne nazwy wyświetlania, `doctor_id`, `visit_date`, `visit_end`, `duration_minutes`, `status`, `visit_type`, `revision`, opcjonalne powiązania zabiegu i `replayed`. Wersję przekazuj dokładnie z odczytu do `If-Match`; nie pobieraj automatycznie nowszej, aby zastąpić konflikt.

428 = brak klucza/rewizji; 409 = konflikt klucza, rewizji lub terminu; 403 = brak uprawnienia; 422 = nieobsługiwane pola/wartości; 500 = niepotwierdzony wynik runtime. Interfejs pokazuje własne polskie komunikaty, nigdy surowe wyjątki.

## Powtórzenia, przypisanie i bezpieczeństwo formularza

`BookingsProtocol.catalog(context)` odpowiada `GET /catalog` i wymaga istniejącego `visits.read_availability` oraz aktywnej roli recepcji. Zwraca `{treatments:[{treatment_id,name,type,visit_type,duration_minutes}],other:{visit_type:"inne",duration_minutes:60}}`. Czas katalogowy jest dokładną liczbą całkowitą 1–1440 minut; brak lub błędna wartość blokuje odczyt. Host używa stałego, filtrowanego zapytania w transakcji core, ponawia kontrolę grantu przed commit i wymaga audytu; SDK nie udostępnia SQL. Stare `/providers` pozostaje bez zmian. Ścieżka planu pacjenta wymaga dokładnie jednego aktywnego dopasowania katalogowego; zero dopasowań nie tworzy wizyty z domyślnym czasem.

Zamroź body i UUID przed pierwszym utworzeniem. Niepewna odpowiedź zachowuje body/klucz i pozwala tylko jawnie sprawdzić tym samym żądaniem. Hostowy ledger nie zależy od późniejszego patient_id: ten sam klucz po przypisaniu zwraca tę samą wizytę, nie nową. Inne body z tym samym kluczem = konflikt. Rewizje zmieniają się po przypisaniu/przełożeniu/anulowaniu. Mutacji z `If-Match` nie ponawiaj automatycznie; jawny odczyt i świadoma decyzja użytkownika są konieczne. Nigdy nie zapisuj danych kontaktowych/kluczy w localStorage ani logach.

## Reference demo

`plugins/example_bookings`, ID `example.bookings`, wersja 1.0.0. Strona `/app/{slug}/plugins/example.bookings/calendar`: polski UI Kit, sekcja `.clk-plugin-ui` z potomnym `.clk-ui-card`, wybór specjalisty/dnia, anonimowe zajęte przedziały, kontakt, odczyt kalendarza, przypisanie przez UUID już zarejestrowanego pacjenta, przełożenie i anulowanie. Brak zewnętrznych fontów/kalendarza/wywołań AI. Demo wybiera rzeczywistą procedurę i jej czas z `GET /catalog`, wysyła `treatment_id` oraz zgodny `visit_type`; dodatkowa opcja „Inne” pozostaje 60-minutowa. Podgląd pokazuje wyłącznie nazwę procedury i czas, bez danych kontaktowych. Wartości danych renderowane są jako tekst, przyciski blokują operacje w toku, niepewne tworzenie zachowuje oryginalne żądanie, niepewna mutacja wymaga ponownego odczytu.

The committed host's standalone SDK exports `BookingsProtocol` and `BOOKING_CAPABILITIES`; it supplies no HTTP transport, SQL connection or private host API. Manifest compatibility remains 1.0; current host distribution is 1.1.0. The public 1.0.0 snapshot has not been synchronized and cannot supply these imports/examples yet.

## Weryfikacja i ograniczenia

Kontakt rezerwacji i zamrożona odpowiedź idempotencji są szyfrowane w tabelach hosta. Przypisanie pacjenta zachowuje oryginalny kontakt; anulowanie nie jest usunięciem. Istniejąca operacja trwałego usunięcia pacjenta (RODO) usuwa kontakty i zaszyfrowane odpowiedzi przypisanych wizyt przed usunięciem tych wizyt, bez usuwania audytu i logów email. Ten zakres nie wdraża TTL, automatycznego purge ani workera retencji tych tabel i nie gwarantuje usuwania po określonym czasie. Operator musi zatwierdzić odrębną politykę retencji/usuwania; samo szyfrowanie nie zastępuje tej polityki.

Testy lokalne fake-core/SQLite sprawdzają mapowanie, minimalne DTO, role/granty w transakcji, rewizje, payload i HTTP. Nie potwierdzają MariaDB blokad/deadlocków ani wizualnej geometrii przeglądarki. Zintegrowane testy SDK → prawdziwy serwis core z adapterem SQLite obejmują replay po attach, czasy katalogowe, prawdziwe przedziały, role mieszane i HTTP. Przed aktywacją produkcyjną pozostają migracja 082, weryfikacja współbieżności MariaDB i sesyjny browser E2E. Partner nigdy nie wykonuje migracji ani SQL. Publikacja odbywa się z przypiętego źródła GitHub; synchronizacja brakujących modułów/przykładów jest osobnym zadaniem. Ten audyt nie odtwarza pakietu ani ZIP; granice weryfikacji opisuje [PLUGIN_SDK_RELEASE.md](PLUGIN_SDK_RELEASE.md).
