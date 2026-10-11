# Przykład SDK — bez nagrywania i zapisu

Referencja `example.live-interview` 1.0.0 demonstruje wyłącznie **SDK 1.2 FOUNDATION**: publiczną deklarację `LiveInterviewRegistration`, czysty `prompt_builder` i lokalny podgląd zwalidowanych syntetycznych zdarzeń. Pełny kontrakt: [PLUGIN_LIVE_INTERVIEW_CONTRACT.md](../../PLUGIN_LIVE_INTERVIEW_CONTRACT.md).

## Co zobaczysz

Panel hosta na `documentation_form` → `tab-wywiad`, hook `global.panel.right`, placement `global_panel`, `requires_doctor=True` oraz role kliniczne. Górny przycisk **„Rozpocznij wywiad z AI”** jest wyłączony i jawnie informuje o niewdrożonym wykonaniu. Drugi przycisk **„Pokaż syntetyczną propozycję”** wyświetla tylko `chief_complaint` o wartości **„Przykładowy wywiad — dane syntetyczne”**, ze źródłem w syntetycznym segmencie.

Nie ma mikrofonu, nagrywania, połączeń sieciowych, wywołania LLM, odczytu karty, zapisu, akceptacji, zmiany formularza, automatycznych ponowień ani pamięci przeglądarki. To nie działająca sesja live ani deklaracja zainstalowanej integracji badawczej. Zwinięcie/zmiana zakładki są zarządzane przez hosta; panel nie przejmuje natywnego formularza.

## Uprawnienia i instalacja

Manifest żąda **`AI`, `ai.live_interview`, `patient.read_trichology_record`**, ponieważ rejestracja deklaruje wejście karty i transkryptu. Nie żąda zapisu, `ai.clinical_tasks` ani `ai.transcription`. Jest to plugin AI w rozumieniu lifecycle, choć samo demo nie wykonuje AI. Nie usuwaj `AI` z manifestu, aby ominąć bramkę widoczności. `sdk_version` pozostaje zgodnym major `1.0`; nie jest numerem dystrybucji Python.

Administrator musi standardowo przejrzeć i zatwierdzić dokładną wersję, jawnie włączyć plugin z tymi grantami oraz zapewnić aktywną globalną funkcję/model/dostawcę i jawną zgodę administratora kliniki. Wykrycie źródeł nie oznacza instalacji/aktywacji. Nic w tym przykładzie nie zapisuje konfiguracji AI i nie uruchamia płatnego procesu; bramka UI nie sprawdza salda. Uprawnienia do pacjenta pozostają odrębne od widoczności panelu.

## Pliki i weryfikacja

- `example_live_interview.py`: deklaracja sesji, czysty prompt, syntetyczne DTO z `validate_sources` i statyczny fragment.
- `manifest.json`, `ui-declarations.json`, `live-interviews.json`: deklaracje do przeglądu i doradczej walidacji offline.
- `templates/panel.html`: polski `.clk-plugin-ui` z potomną kartą UI Kit.
- `static/interview.js`: bezpieczne wyświetlenie przez `textContent`, bez API i efektów klinicznych.

```sh
python -m celloklab_plugin_sdk.validation plugins/example_live_interview
```

Walidator nie wykonuje rejestracji ani nie certyfikuje bezpieczeństwa/autoryzacji. Testy hosta i produkcyjne sprawdzenie przeglądarki/kliniki są niezależne. Przyszły zapis rzeczywistej propozycji wymaga jawnej oceny lekarza, osobnego grantu zapisu i oryginalnej rewizji odczytu — **nie dodawaj zapisu danych syntetycznych do tego demo**. Routing live/STT, adaptery dostawców i rozliczenia pozostają przyszłą integracją hosta.
