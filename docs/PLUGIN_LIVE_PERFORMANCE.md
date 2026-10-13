# Wywiad na żywo: STT niezależne od analizy i bezpośrednie OpenAI

## Przywracanie
Użytkownik potwierdził utworzenie snapshotu Hetznera przed pracami. Bazowa rewizja aplikacji: `2d592227bd6f3c06977c8679d4825b9d1590e43b`. Snapshot był wykonany przez operatora, nie przez agenta. Nie deklarujemy zweryfikowanej kopii osobnego wolumenu/bazy. Powrót kodu wymaga wdrożenia tej rewizji przez Coolify; przywrócenie snapshotu może cofnąć dane i wymaga osobnej decyzji operatora. Brak nowej migracji.

## Zmiana przepływu
`/audio` kończy trwały zapis transkryptu i sekwencji bez czekania na analizę. Osobny POST `/api/plugins/{plugin_id}/patients/{patient_id}/live-interviews/{session_id}/analysis?tenant_slug=...` z `{}` i CSRF korzysta z logicznej idempotencji rewizji. Jest jedna aktywna analiza i najnowsza oczekująca rewizja. Stare wyniki nie zastępują nowych. Niepewnego płatnego dispatchu nie ponawiamy automatycznie. Końcowe rozliczenie czeka na analizę lub kontrolowane zakończenie grace; stała opłata sesji pozostaje.

Klient publikuje STT niezależnie, monitoruje analizę oraz zachowuje niewysłany backlog. Limit nagrywania jest oddzielony od maksymalnie 120 sekund przetwarzania końcówki. STOP nie oznacza automatycznie ukończonej analizy. Wybrane blokujące operacje DB wykonują się poza event loop.

## Audio
Okna energii 20 ms, adaptacja poziomu szumu i histereza poprawiają wykrywanie pauz. Zachowana cicha mowa, pre/post-roll, maksymalnie 5 sekund pakietu i dokładne próbki bez sztucznego paddingu. Rzeczywisty overlap audio jest WYŁĄCZONY: nie wdrożono powtórnego STT ogona ani rewizji już związanych dowodów. Metadane granic nie oznaczają powtórnego audio. Bezpośrednie OpenAI otrzymuje słownik i maksymalnie 600 znaków zredagowanej poprzedniej transkrypcji; redakcja poprzedza skracanie. OpenRouter i nierozpoznane endpointy nie dostają niezweryfikowanych parametrów prompt/context. Nie gwarantujemy anonimowości tekstu swobodnego.

## Konfiguracja bezpośredniego OpenAI
Lista STT pokazuje zarejestrowanych dostawców niezależnie od obecności modeli. Dostawca bez modelu STT pozostaje widoczny z instrukcją dodania modelu; zapis jest zablokowany. Jeśli OpenAI nie jest zarejestrowane, informacyjna opcja „OpenAI · nieskonfigurowany” nie jest prawdziwym dostawcą i nie może być zapisana. Nie tworzy klucza ani konfiguracji automatycznie.
1. Administrator: `/admin/ai-credits/providers` — zarejestrowany dostawca OpenAI z `https://api.openai.com/v1`, klucz przechowywany po stronie serwera.
2. Modele AI: dodaj `gpt-4o-mini-transcribe` pod tym dostawcą.
3. `/admin/plugins` → Vision → Audio wywiadu na żywo → wczytaj konfigurację → wybierz bezpośrednie OpenAI, model mowy i limit sesji → zapisz.
4. Funkcje AI → Konfiguruj dla Vision: wybierz model analizy przypisany do OpenAI. Może pozostać inny dostawca analizy; wybory mowy i analizy są niezależne.
Nie zmieniono produkcyjnych kluczy, modeli, aktywacji ani zgód klinik. OpenRouter pozostaje obsługiwany. API administratora zwraca wyłącznie dozwolone metadane, bez kluczy.

## Bezpieczeństwo i pomiary
Uprawniony przypisany specjalista, zgoda na nagrywanie, redakcja, szyfrowanie, dokładne cytaty, baseline/If-Match i jawna akceptacja pozostają. Brak autozapisu. Pomiary obejmują czas/liczby/stany, bez tekstu i PCM w logach. Głównie łaciński transkrypt z izolowanym obcym znakiem nie jest już odrzucany w całości; przewaga obcego alfabetu nadal jest odrzucana bez przepisywania.

## Weryfikacja
Końcowe testy live/Vision/admin: 683 PASS, jedno ostrzeżenie deprecacyjne. Testy syntetyczne, bez pomiaru dostawcy, prawdziwego mikrofonu ani MariaDB w produkcji. Opublikowanie kodu nie potwierdza jego wdrożenia na dev. Pozostały rzeczywisty test czasu STT/analizy i kontrolowana implementacja overlapu audio.
