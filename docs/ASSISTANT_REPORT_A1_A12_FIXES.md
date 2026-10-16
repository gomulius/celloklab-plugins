# Poprawki raportu Asystent AI — A1–A12

## Potwierdzone i poprawione
- A1/A3: host dublował komunikat zgody w statusie i notice, a etykieta nie reagowała na udzieloną zgodę. Teraz jeden komunikat i etykieta zależna od potwierdzonego backendu; personel nie udziela zgody za pacjenta.
- A2: istniejąca sesja tekstowa ma SQL recording/public paused i może blokować nowy klucz409. Rozróżniono live_session_exists, dodano scope-safe GET active oraz jawne resume-text. Wznowienie nie tworzy nowej opłaty, nie uruchamia mikrofonu i odrzuca pending/nieznaną zgodę/nagrywanie.
- A6: aktualny kod ma synchroniczny guard wysyłania, lokalne odmowy dispatched=false oraz sprawdzanie statusu z oryginalnym UUID. Test rzeczywistej klasy Vision i obu adapterów potwierdza ochronę szybkiego drugiego send. Dodano oznaczenie niewysłanej wiadomości; nie dodano automatycznej kolejki ani nowej płatnej sesji omijającej nierozstrzygnięte wykonanie. Zdarzenie produkcyjne nie zostało odtworzone z logów.
- A8: scalp_history już było w snapshotcie. Brak dowodu pominięcia po stronie hosta; prompt teraz jawnie wymaga uwzględnienia niepustego pola i zachowania sprzeczności chief_complaint/shedding_amount/shedding_pattern. Test sprawdza persisted snapshot→rzeczywisty prompt, nie gwarancję modelu.
- A9: textContent wyświetlał Markdown dosłownie. Ograniczony renderer tworzy bezpieczne węzły tekstowe/strong/listy/akapity/nagłówki, bez raw HTML, aktywnych linków/obrazów. Testy XSS i Chromium.
- A10: istniejące terminalne zadanie dla tej samej rewizji celowo jest deduplikowane. POST dodaje created/reused pod blokadą; pojedynczy komunikat jawnie mówi, że nie uruchomiono nowej generacji i nie zmienia daty wyniku. Jedna generacja/ledger.
- A12: panel po main był static na mobile, a silniejszy selektor desktopowy nadal rezerwował260–320px. Hostowy drawer i launcher zachowują ten sam DOM, drafty, klienta i listener’y; brak marginesu przy390/768/1024/1199, desktop320px przy1200/1440. Zamykanie panelu nie zatrzymuje nagrywania ani nie omija guardów zakładki.

## Zachowane i granice
A4/A5/A11 bez celowej zmiany zachowania; A7 wymaga ponownego testu na dev. Żadne chronione pliki Vision ani przesłane adaptery nie zostały zmienione. Nie dodano nowej migracji ani wersji wheel. Brak produkcyjnych logów/kosztów i płatnych wywołań. Nie dajemy nowej sesji omijającej niepewne rozliczenie; świadome potwierdzenie kosztu nie zastępuje wyjaśnienia fence’a.

## Testy
213 PASS, bez skipów; 103 ostrzeżenia deprecacyjne. Zestaw obejmuje host chat/zgody/panel i summary request/runtime/JS oraz Chromium. Raport /tmp/assistant-report-final.xml. Nie jest to pełna regresja projektu ani odbiór dev/MariaDB/prawdziwego mikrofonu. Istniejące stare testy Vision z uproszczonym DOM mają osobne niepowodzenia odtworzone także bez rozszerzeń hosta; nie deklarujemy całej regresji zielonej.
