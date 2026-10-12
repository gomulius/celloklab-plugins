# Plugin UI Hook Catalog

## Clinic module visibility and disclosure standard

Every mounted operational hook, widget, panel, modal/floating surface and registered page/navigation honors independent clinic module activation, including no-AI plugins. AI-requesting plugins additionally require independent clinic AI consent and existing policy/grant checks. The native **Wtyczki** management tab precedes **Ustawienia AI** and remains a catalog of all healthy globally enabled exact-approved modules even local OFF/AI-not-ready; it is not a new SDK hook. Missing row defaults module ON only in existing schema; schema/DB failure fails closed. Module OFF retains consent/guide progress and blocks subsequent runtime/replay/new queue/event work, without promising in-flight cancellation.

Use [PLUGIN_UI_STYLE_GUIDE.md](PLUGIN_UI_STYLE_GUIDE.md)'s accessible Vision-compatible details/summary card. The guide's **„Pierwsze kroki”** summary replaces its standalone panel launcher; incomplete eight-step reading opens by default, all eight acknowledgments close it. Original six step IDs and `clinic_admin:v1` remain, followed by `ai`/`plugins`, linking `settings#tab-ai`/`settings#tab-wtyczki`. The native summary is the only guide opener; there is no settings-header launch button. Disclosure preserves mounted state and never submits/generates/activates; private `/api/clinic-plugins` adds no partner hook, capability or SDK export.

## SDK 1.2.1, etap 2 — niezależny panel wywiadu

Bez nowego hooka: niezależna wtyczka **`vision.visit-assistant` 2.0.0** korzysta z `global.panel.right`, `placement=global_panel`, `page_ids=('documentation_form',)`, `tab_id='tab-wywiad'`, `requires_doctor=True` i jawnych ról klinicznych. Host filtruje stronę/rolę/profil i ukrywa istniejący fragment poza aktywną zakładką, zachowując jego DOM/listenery; widoczność nie jest grantem do pacjenta. Zwinięcie nie wyłącza mikrofonu, nie usuwa natywnego formularza ani innych modułów. Wtyczkę można niezależnie enable/disable przez istniejący lifecycle hosta; cofnięcie dostępu blokuje kolejne autoryzowane operacje, ale nie cofa już wysłanych danych.

Polski `.clk-plugin-ui` ma potomną `.clk-ui-card` i współdzielone klasy/tokeny. Vision dostarcza callbacki oraz panel start/wstrzymaj/wznów/zakończ i akceptuj/edytuj/odrzuć; core jest właścicielem transportu, autoryzacji, dostawców i rozliczenia, nie promptów chorobowych. Istniejące `AI`, `ai.live_interview`, `patient.read_trichology_record`, bieżące role kliniczne/profil/przypisanie oraz dostęp do przypisanego pacjenta są wymagane; zapis ma osobną bramkę `patient.write_trichology_record`. Zgoda operatora na nagranie nie zastępuje niezależnego opt-in administratora kliniki. Wyłącznie jawna akceptacja używa istniejącego PATCH z oryginalnym `If-Match`; dirty form/zmieniona baza/409 blokują zapis i zachowują szkic, bez automatycznego rebase ani zastąpienia native save.

Wspólny klient [live-audio.js](static/js/plugins/live-audio.js), [worklet PCM](static/js/plugins/live-pcm-worklet.js) i [most formularza](static/js/plugins/trichology-form-bridge.js) mają publiczne odpowiedniki `browser/live-audio.js`, `browser/live-pcm-worklet.js`, `browser/trichology-form-bridge.js`. Inkrementalne pakiety mikrofonu zwykle obejmują około 2 s; minimum regularnego pakietu to **0,5 s**, finalnego ogona **2 bajty**. Wynik blisko 2 s jest celem, nie zmierzoną latencją/SLA. REST STT i analiza rosnącego transkryptu nie są tokenowym streamingiem. Jedna stała opłata kredytowa obejmuje ograniczoną sesję, nie każdy pakiet. Host nie utrwala surowego audio w DB; utrwala zaszyfrowany stan kliniczny sesji, transkrypt, propozycje i wyniki chunków. Brak browser persistence i automatycznego ponawiania niepewnego dispatchu.

**Osobna referencja FOUNDATION `example.live-interview` pozostaje syntetyczna** (`fragment_id='live-interview-example'`): „Rozpocznij wywiad z AI” jest wyłączony, „Pokaż syntetyczną propozycję” pokazuje tylko dane syntetyczne; bez mikrofonu, dostawcy i zapisu. Nie utożsamiaj jej z Vision publikowanym jako `examples/vision_visit_assistant/`.

Autorytatywne granice etapu 2: **[PLUGIN_LIVE_INTERVIEW_CONTRACT.md](PLUGIN_LIVE_INTERVIEW_CONTRACT.md)**. Nowy warunek runtime to wyłącznie brakująca, ręcznie przejrzana migracja **088**, po backupie i zgodzie operatora; istniejące prerekwizyty potwierdź bez rerunów wcześniejszych SQL, zwłaszcza 084. Ta publikacja nie wykonuje SQL, konfiguracji dostawcy ani wdrożenia; nie buduje ZIP. Źródła runtime nie są dowodem odbioru produkcyjnego mikrofonu HTTPS, dostawcy czy MariaDB. SDK Python **1.2.1**, manifest SDK **1.0**, UI Kit **1.0.0** i wersja Vision **2.0.0** są niezależne; historyczny wheel 1.2.0 FOUNDATION nie instaluje bieżącego SDK.

## Optional clinic guide at the existing right-panel mount

`clinic.guided-setup` **1.0.0** registers `global.panel.right` with `placement=global_panel`, `fragment_id=clinic-guided-setup`, roles `tenant_admin`; no new hook, requested capability or AI. Enabled/exact-version-approved lifecycle and current host-verified local roles apply before rendering; no `/admin` mount or automatic enable. Old clinics retain the „Pierwsze kroki” disclosure without rollout welcome; invitations use an immutable host cohort and user+clinic+`clinic_admin:v1` state, not a per-browser first visit.

`host_page_id` selects employees/settings/documentation_form/schedule_appointment context; `celloklab:tab-change` with `page_id=settings` and actual `tab_id` handles same-page settings tabs. Neither authorizes access nor acknowledges reading. The guide is a Polish optional reading panel, not a wizard; legal is „W przygotowaniu” without a navigation target. Pure clinic administrators receive no patient/appointment links; the host requires active reception for those guide links.

The guide remains in the host's responsive right-panel layout; its separate welcome dialog is not a mobile reading drawer. Keep accessible live errors and „Wczytaj aktualny postęp” explicit GET in the card. Preserve sibling modules, native unsaved-form guards and summary/header-launch focus; collapse must not destroy controls or collapse another module. No automatic PATCH retries or browser storage of progress. Persistence is private host infrastructure, not a new SDK contract. Guide/UI/browser fixtures are synthetic; current-card live geometry/accessibility acceptance remains separate.

Current mounts. Existing Case/medical functionality retained; further Case/external expansion is out of scope. Declaration alone does not install a slot.

| Mounted hook | Templates | Helper | Guard |
|---|---|---|---|
| `page.before_content` | plugin_before_content.html | `plugin_fragments` | Explicit ordinary page mount after complete heading; outer page authorization remains authoritative |
| `page.after_content` | base.html | `plugin_fragments` | Non-/admin request; outer page authorization remains authoritative |
| `global.panel.right` | base.html | `plugin_fragments` | Non-/admin request with current user |
| `dashboard.doctor.after` | dashboard_doctor.html | `dashboard_plugin_widgets` | Authorized doctor dashboard; dashboard_widget placement only |
| `dashboard.reception.after` | dashboard_reception.html | `dashboard_plugin_widgets` | Authorized reception dashboard; dashboard_widget placement only |
| `patient.header.actions` | documentation_form.html | `plugin_fragments` | Authorized patient-card roles in current clinic; after complete header, outside patientForm |
| `patient.profile.sections` | documentation_form.html | `plugin_fragments` | Authorized patient-card roles; tab-dane-osobowe; non-form visual fragments only, no native-save controls |
| `patient.records.sections` | documentation_form.html | `plugin_fragments` | Authorized patient-card roles; tab-wywiad inside existing has_trichology_access guard; non-form visual fragments only; no doctor-profile requirement |
| `visit.header.actions` | visit_detail.html, visits/visit_form.html | `plugin_fragments` | Current authenticated clinic staff; authorized visit pages; after complete header, outside native forms |
| `visit.form.sections` | visits/visit_form.html | `plugin_fragments` | Current authenticated clinic staff; authorized create/edit page; after native visitForm, independent forms permitted; not schedule_appointment |
| `patient.medical_documentation.sections` | documentation_form.html | `plugin_fragments` | documentation_form / tab-dokumentacja-medyczna; active clinic doctor required by host |
| `ui.modal` | plugin_surfaces.html | `plugin_fragments` | Current clinic staff, non-/admin request; explicit open only |
| `ui.floating` | plugin_surfaces.html | `plugin_fragments` | Current clinic staff, non-/admin request; explicit open only |
| `ui.page` | plugin_page.html, base.html | `registered_pages / plugin_page_navigation` | Authorized clinic staff PluginPage route; navigation uses nav_label |

## Not mounted

- global.navigation.after (registered-page navigation exists separately via ui.page)
- case.header.actions
- case.tabs
- case.sidebar

Case slots above remain declared only, outside further expansion. None were removed.

## Probe1.1.0 acceptance

Approve deployed example.ui-hook-probe1.1.0 and enable without data grants. Existing UIgallery1.2/clinicaldemo1.36 unchanged. Report route /app/<slug>/plugins/example.ui-hook-probe/report and UI Hook Probe menu. settings {"enabled_hooks":"all"}; optional comma-separated hook list, keep ui.page for report. Role/page/tab gates always apply.

Visit authorized patient card: patient.header.actions below complete header; patient.profile.sections in tab-dane-osobowe; patient.records.sections in tab-wywiad only with existing trichology access; medical slot unchanged. Open actual visit_detail and visits.visit_form: header markers below heading, formsection AFTER nativeform. schedule_appointment has generic page hooks, not these localvisit slots. Markers show declared role targets and serverderived page/tab IDs, no patient payloads.

Patient profile/record fragments are inside native patient form: read-only content and explicit type=button actions only. Host rejects forms/editable controls/submit/form association before asset loading. Use authorized separate plugin page/modal for independent forms. Visitform slot is outside form and permits independent form. These are supported host guards, not an isolation boundary against reviewed trusted code dynamically modifying DOM.

Patient/visit section content must be rendered as a semantic `.clk-plugin-ui` wrapper with a descendant `.clk-ui-card` using the shared UI Kit classes (`PLUGIN_UI_STYLE_GUIDE.md`), not loose text. `trichology.ai-summary` follows this contract in the existing records slot, without adding editable/submit controls or changing the native form. Its full section is initially collapsed via native details/summary, with a separate result card and generation date inside; no toggle invokes generation or alters native fields. UI grouping grants no clinical authority. Metadata uses compact UI Kit spacing (`clk-ui-gap-1`, compact cards), margin-free read-only blocks and a compact result heading; the short Polish “AI — wymaga” phrase stays together, while surrounding text wraps responsively. This does not change summary content, dates, polling or generation.

All fragments use lowerpriorityfirst, then pluginID/stablefragmentID; dashboard savedlayout overrides initialorder. No data permission derived from UI. Test native save still works, reception cannot see trichology slot, eligible clinician can, businessadmin alone no patientlocal slots, disabledprobe missingmarkers. Desktop/mobile visual acceptance required; local tests use actual Jinja and QuickJS fixtures.
