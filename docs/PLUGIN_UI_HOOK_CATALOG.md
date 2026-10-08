# Plugin UI Hook Catalog

Current mounts. Existing Case/medical functionality retained; further Case/external expansion is out of scope. Declaration alone does not install a slot.

Committed inventory: **14 mounted hooks and four declared-only hooks**, matching the host's `SUPPORTED_UI_HOOKS` and mount catalog. Page inventory and stale public SDK JSON differences are documented in [PLUGIN_PAGE_CATALOG.md](PLUGIN_PAGE_CATALOG.md). This is a GitHub source contract, not a ZIP/install/release claim.

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

The implemented `example.trichology-interview` reference is such a reviewed dynamic non-form editor: its initial template passes the static non-form guard; JavaScript then creates unnamed controls with `data-plugin-nonform`, stops its input/change events reaching native dirty tracking, and performs a separate authorized PATCH. It never injects named native fields or intercepts native submit. That behavior is not permission for arbitrary editable static fragments and is not sandbox enforcement. The sample blocks PATCH while native edits are dirty, synchronizes only confirmed saved fields and preserves native edits made in flight. It is absent from the current public SDK snapshot; see [PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md](PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md).

Patient/visit section content must be rendered as a semantic `.clk-plugin-ui` wrapper with a descendant `.clk-ui-card` using the shared UI Kit classes (`PLUGIN_UI_STYLE_GUIDE.md`), not loose text. `trichology.ai-summary` follows this contract in the existing records slot, without adding editable/submit controls or changing the native form. Its full section is initially collapsed via native details/summary, with a separate result card and generation date inside; no toggle invokes generation or alters native fields. UI grouping grants no clinical authority. Metadata uses compact UI Kit spacing (`clk-ui-gap-1`, compact cards), margin-free read-only blocks and a compact result heading; the short Polish “AI — wymaga” phrase stays together, while surrounding text wraps responsively. This does not change summary content, dates, polling or generation.

All fragments use lowerpriorityfirst, then pluginID/stablefragmentID; dashboard savedlayout overrides initialorder. No data permission derived from UI. Test native save still works, reception cannot see trichology slot, eligible clinician can, businessadmin alone no patientlocal slots, disabledprobe missingmarkers. Desktop/mobile visual acceptance required; local tests use actual Jinja and QuickJS fixtures.
