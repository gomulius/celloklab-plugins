# Rezerwacje — demo recepcji

Referencja `example.bookings` 1.0.0 dla `PLUGIN_BOOKING_CONTRACT.md`. Strona `calendar` wymaga aktywnej roli recepcji i sześciu niezależnych grantów organizacyjnych. Brak AI, kont pacjentów, dokumentacji, maili i dodatkowych uprawnień. Aktorzy mieszani zachowują ograniczenia kliniczne hosta.

Wybierz specjalistę i dzień, odczytaj kalendarz/dostępność, zarezerwuj kontakt. Po zwykłej rejestracji pacjenta przypisz jego UUID do tej samej wizyty. Przy przełożeniu/anulowaniu używana jest oryginalna rewizja. Niepewne tworzenie sprawdź tylko tym samym zamrożonym żądaniem; mutacji nie ponawiaj bez jawnego odczytu. Zajęte przedziały są anonimowe, dostępność obejmuje całą dobę, nie godziny pracy. Demo wybiera nazwę i rzeczywisty czas procedury z minimalnego katalogu kliniki; konsultacja i zabieg wysyłają treatment_id oraz właściwy visit_type. Podgląd nie zawiera PII; dodatkowa opcja „Inne” ma 60 minut. Host zapisuje migawkę czasu, partner nie ustala duration_minutes.

UI jest polski, używa hostowego UI Kit, bez własnych fontów/Bootstrap i bez danych w localStorage. Host sesyjny/CSRF jest konieczny; offline validator nie wysyła żądań. Aktywacja produkcyjna wymaga zintegrowanego core z transactional authorization_guard, migracji zatwierdzonych ręcznie przez administratora oraz MariaDB/browser acceptance.
