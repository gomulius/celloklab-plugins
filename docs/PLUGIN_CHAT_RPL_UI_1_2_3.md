# SDK 1.2.3 — dodatek: czat, RPL i UI

Ten dodatek opisuje bieżące rozszerzenia, nie zastępuje istniejących kontraktów. Python SDK **1.2.3**, manifest SDK **1.0**, UI Kit **1.0.0** i Vision **2.0.0** to osobne wersje. Nie dodano capability, migracji ani workera; wcześniejsze wymagania hosta nadal obowiązują.

## Czat i callbacki

SDK eksportuje `LiveChatContext(task, message, history=(), segment_ids=())`. `LiveInterviewRegistration` dodaje opcjonalne `chat_prompt_builder(context) -> TaskPrompt` oraz `chat_result_processor(context, raw) -> Mapping`; procesor wymaga buildera, callbacki muszą być callable. Stare rejestracje pozostają poprawne. SDK sam nie wykonuje sieci, autoryzacji ani zapisu.

- Dostęp do karty odblokowuje czat bez mikrofonu i zgody na nagrywanie. Tekstowy start: `{profile_id:"interview",questions_only:true}`; jawne `/recording` z `{recording_consent:true}` dodaje audio do tej samej sesji, bez drugiej rezerwacji. Bez zgody callback otrzymuje pusty transkrypt i `segment_ids`.
- `POST /api/plugins/{plugin_id}/live-interviews/{session_id}/chat?tenant_slug=...` ma także wariant patient-scoped. Wymaga hostowej sesji, CSRF i UUID `Idempotency-Key`. Body dokładnie `{message,history}`: do 64 KiB, wiadomość do 4000 znaków; historia do 20 wpisów `{role:"user"|"assistant",content}` po 4000 znaków, łącznie do 20000 znaków. Pacjenta wiąże autoryzowana sesja, nie body.
- Odpowiedź bez envelope sesji: `{reply,suggestions,status,navigation?,error_code?,replayed?}`, `private, no-store`; status `completed`, `pending` lub `failed`, HTTP 202 dla pending. Nawigacja wyłącznie `trichology`, `photos`, `visits`, z hostowymi guardami.
- Jedna opłata według efektywnego kosztu funkcji AI za ograniczoną sesję. Czat i jawne pytania dzielą **20 wywołań**, odstęp **co najmniej 10 s**, limit **2048 output tokens** i timeout model-call **45 s**. To nie 20 kredytów, nie limit chunków STT ani obietnica czasu odpowiedzi. Wiele wywołań może powodować realne koszty dostawcy. Pending nie pozwala na automatyczny płatny retry, nowy klucz obejścia ani refund tylko na podstawie czasu.
- Historia, odpowiedzi i propozycje czatu pozostają w pamięci przeglądarki, bez localStorage/sessionStorage/IndexedDB. Host utrwala tylko beztreściowy marker, HMAC, klucz i czas; replay nie odzyskuje rozmowy (`chat_replay_unavailable`). To nie zmienia oddzielnej szyfrowanej persystencji nagranych segmentów i wyników audio; PCM nie jest utrwalany.
- Propozycja `{field,value,source,evidence,segment_ids}` ma natywny typ i pełny dowód: `source:"message"` cytuje całą bieżącą wiadomość, z `segment_ids:[]`; `source:"transcript"` cytuje całe rzeczywiste finalne segmenty objęte zgodą. Historia nie jest dowodem. Host wiąże pierwotne revision/baseline, waliduje źródła i odrzuca czyszczenie. AI nie zapisuje: tylko jawna akceptacja przez istniejący PATCH/If-Match, write grant i dirty-form guard. Konflikt zachowuje szkic bez cichego rebase.

## Oficjalne leki i formularz

`GET /api/plugins/{plugin_id}/patients/{patient_id}/medication-candidates?tenant_slug=...&q=...` to read-only patient-scoped odczyt na istniejącym `patient.read_trichology_record`, z bieżącymi actor/tenant/patient/lifecycle/grant checks i `private, no-store`. Query do 100 znaków, prefix nazwy lub substancji od 2 znaków, do 20 produktów; odpowiedź `{candidates:[...]}`. Bridge udostępnia `searchMedications(pluginId,query)`, `getFieldMount(field)` i `navigateSection(section)`.

Kandydat niesie oficjalne `rpl_id`, `import_id`, `catalog_date`, `name`, `substance`, `strength`, `form` i pola schematu dawkowania. API katalogu może zwracać `import_id` jako liczbę; przy budowaniu `medication_list` należy normalizować metadane do stringów zgodnie z istniejącym kontraktem zapisu. Nie należy zgadywać identyfikatorów ani ufać metadanym klienta: host rozwiązuje nowe wybory względem aktualnego importu, a istniejące wybory zachowują zaufany snapshot historyczny.

Specjalista **wybiera oficjalny produkt**, następnie osobno przegląda i akceptuje pełną propozycję listy z istniejącymi pozycjami i pierwotnym baseline. `medication_list` nadal jest stringiem JSON. Moc produktu nie jest dawką pacjenta. Brak trafienia/niedostępny katalog: „nazwa do potwierdzenia” z pacjentem, nigdy zmyślony produkt/ID ani nowy zapis samej nazwy. Brak automatycznego mapowania historii, katalogu suplementów lub dostępu do prywatnego `/api/rpl/products`.

## Polski interfejs i STT

Vision ma **Konwersacja / Do akceptacji / Transkrypcja**, sticky composer z Pytania/Podsumowanie/Braki, trzy najnowsze pytania i wzmianki oraz starsze pod disclosure. Propozycje są w panelu i przy natywnych polach. Nagrywanie pokazuje czerwony wskaźnik, timer i STOP, bez widocznej fali. Bramki mikrofonu/zgody dotyczą nagrywania, nie czatu. Nawigacja nie omija ochrony niezapisanych zmian; native save i ręczne edycje pozostają chronione.

STT używa `language=pl`; słownik pisowni trafia wyłącznie do obsługiwanego bezpośredniego OpenAI `prompt`. OpenRouter nie otrzymuje nieobsługiwanego prompt/keyterms/provider options ani retry ze zmienionymi parametrami. Warianty fonetyczne wymagają potwierdzenia i zachowują pełny oryginalny raw evidence; wzmianka nie dowodzi diagnozy ani tożsamości leku.

## Handoff i granice dowodów

- Partner: [development](PLUGIN_DEVELOPMENT_SKILL.md), [API](PLUGIN_API_REFERENCE.md), [live contract](PLUGIN_LIVE_INTERVIEW_CONTRACT.md), [typed medication contract](PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md).
- Administrator: [installation](PLATFORM_ADMIN_PLUGIN_INSTALLATION_SKILL.md); osobno zatwierdza wersję/granty, model tekstowy i model mowy, istniejące bramki AI i clinic opt-in. Mikrofon wymaga HTTPS/uprawnień oraz jawnej zgody operatora; nie dodano automatycznej aktywacji ani SQL.
- Utrzymanie: [maintenance](PLUGIN_SYSTEM_MAINTENANCE.md), [release](PLUGIN_SDK_RELEASE.md). Zachowaj starsze wheels, w tym **1.2.2**; nie rozliczaj niepewnego dispatchu przez zgadywanie lub ponawianie.

Świeży wheel należy sprawdzić przez izolowaną instalację, import publicznych modułów/callbacków, metadane, RECORD i zgodność bajtów źródeł. Testy syntetyczne/statyczne nie są odbiorem rzeczywistego mikrofonu, autoryzowanej przeglądarki, dostawcy STT/LLM, produkcyjnej MariaDB ani jakości klinicznej. Nie deklarujemy live browser/mic acceptance, mierzonego SLA, deploymentu, commit/push lub ZIP.
