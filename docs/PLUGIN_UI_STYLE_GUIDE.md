# Celloklab Plugin UI Kit v1

## Mandatory Polish language and AI visibility

**Every new or maintained platform module/plugin must use Polish for all user-facing UI**, including partner and administrative UI: page/navigation/surface titles, labels/buttons/help/placeholders/tooltips, accessibility names (`aria-label`, `title`), loading/status/errors/validation, confirmations/toasts/notifications and generated-output framing. English developer prose is allowed; internal IDs/API fields/capability names/stable codes stay unchanged. Map `pending`/`succeeded`/`failed` to „oczekujące”/„zakończone pomyślnie”/„nieudane”; display flags as „tak”/„nie”. Unknown states get a safe Polish fallback, never raw server text. Distinguish safe code `ai_policy_denied` (global activation plus local clinic-admin opt-in guidance), membership/capability denial and HTTP 402 (insufficient clinic AI credits), never raw exceptions. This mandate does not claim unrelated legacy UI was translated.

Every plugin requesting literal `AI` is hidden on all clinic-facing surfaces until platform-global activation plus explicit opt-in by that clinic's local administrator, including non-AI content. Authorized management consoles remain available. No-AI plugins keep existing role/page/plugin visibility in all eligible clinics without requiring AI settings/license/activation. Manual migration **080** adds default-off `tenant_plugin_ai_activations`; no automatic backfill, and existing `tenant_ai_feature_settings` is not approval. Clinic administrators must explicitly re-enable each AI-requesting plugin. Runtime/replay/CSRF/idempotency and generation licensing/settings/credit gates remain independent.

## Status and boundaries

Implemented: scoped component CSS and a JavaScript adapter to the host's existing Bootstrap toast engine. API version `1.0.0`. New demo `example.ui-kit` version `1.0.0`.

This release does NOT implement plugin pages, modals, floating panels, notification delivery or email. Existing Case/medical features remain unchanged. Future expansion of those delicate clinical domains is outside the agreed plan.

## Assets and ownership

Host `base.html` loads `/static/css/plugins/ui-v1.css` and `/static/js/plugins/ui-v1.js` before fragment scripts. Do not bundle another copy in a production plugin. Do not load another Bootstrap, font family, theme or toast system. These paths are public presentation assets, not data APIs.

Host sources: `static/css/core/variables.css`, `static/css/plugins/ui-v1.css`, `static/js/base-ui.js`, `static/js/plugins/ui-v1.js`.

Partner code uses the stable prefixed classes and token aliases below, NOT private host template selectors. Breaking contract changes require a new major version. A standalone downloadable partner package and offline host-independent preview are planned, not delivered here. The gallery currently runs inside the host and needs no patient-data grants.

## Mandatory wrapper

Component classes must be descendants of `.clk-plugin-ui`:

```html
<section class="clk-plugin-ui" aria-label="Moduł partnera">
  <div class="clk-ui-card clk-ui-stack">
    <h2 class="clk-ui-card-title">Tytuł modułu</h2>
    <p class="clk-ui-text-muted">Opis operacji.</p>
    <div class="clk-ui-row">
      <button type="button" class="clk-ui-button clk-ui-button--primary">Zapisz</button>
      <button type="button" class="clk-ui-button clk-ui-button--secondary">Anuluj</button>
    </div>
  </div>
</section>
```

Patient/visit section fragments must present plugin content as a semantic `.clk-plugin-ui` section with a child `.clk-ui-card`, not loose page text. Keep `patient.records.sections` read-only/non-form per the hook catalog. The `trichology.ai-summary` reference uses shared card-header/title/body/stack classes and safe plain-text output. The clinical reference is collapsed by default using native `<details>`/`<summary>` without `open`; it retains keyboard disclosure and does not submit the host form. Output is a separate labeled child card; existing `generated_at` provides Polish date/time, without guessed timezone or fallback current time. Missing/invalid dates are hidden. Polling never opens it, and toggling cannot generate. Show readable source freshness, not raw hashes; distinguish waiting queued work from uncertain AI dispatch requiring administrator review. Metadata uses compact UI Kit spacing (`clk-ui-gap-1`, compact cards), margin-free read-only blocks and a compact result heading; the short Polish “AI — wymaga” phrase stays together, while surrounding text wraps responsively. This does not change summary content, dates, polling or generation.

Do not put `.clk-ui-card` only on the wrapper itself; the descendant rules need a child. Use semantic DOM and text-safe rendering for untrusted values.

## Supported components

All names below include the `clk-ui-` prefix:

| Category | Classes |
|---|---|
| Card | card, card--compact, card-header, card-title, card-body, card-footer |
| Button | button, button--primary, button--secondary, button--danger, button--small |
| Form | form, field, label, input, select, textarea, help, feedback, check, checkbox |
| Alert | alert, alert--success, alert--info, alert--warning, alert--error |
| Table | table-wrap, table |
| Layout | stack, row, grid, grid--2, grid--3 |
| Gaps | gap-1, gap-2, gap-3, gap-4, gap-6 |
| Padding | p-0, p-2, p-4, p-6 |
| Top margin | mt-0, mt-2, mt-4, mt-6 |
| Text | text-muted |

Combine a modifier with its base class, e.g. `clk-ui-button clk-ui-button--danger`. Rows wrap; grids are one column under 768px, with two/three columns above that width.

```html
<div class="clk-ui-field">
  <label class="clk-ui-label" for="partner-title">Nazwa</label>
  <input class="clk-ui-input" id="partner-title" aria-describedby="partner-help">
  <p class="clk-ui-help" id="partner-help">Wyjaśnienie pola.</p>
</div>
```

Use associated labels, `aria-describedby` for help and `aria-invalid` for failed validation. Use real disabled controls; `aria-disabled` is only visual unless plugin code blocks action. For table scrolling use `tabindex="0"`, `role="region"` and an accessible label on `clk-ui-table-wrap`. Avoid nested forms, global CSS and inline layout overrides.

## Tokens

Aliases exist inside `.clk-plugin-ui`; names have `--clk-ui-` prefix:

| Alias | Host token |
|---|---|
| font-body / font-heading | --font-body / --font-heading |
| surface / surface-card / surface-muted | --color-panel-bg / --color-card-bg / --color-border-subtle |
| text / text-secondary / text-muted | --color-text-primary / --color-text-secondary / --color-text-muted |
| border | --color-border-default |
| primary-bg / accent / focus | --color-navy-signature / --color-mint-accent / --color-brand-teal-light |
| success / success-bg | --success-color / --success-bg |
| info / info-bg | --info-color / --info-bg |
| warning / warning-bg | --warning-color / --warning-bg |
| error / error-bg | --error-color / --error-bg |
| radius-card / radius-button / radius-input | --radius-card / --radius-btn / --radius-input |
| transition | --transition-fast |
| space-1 through space-9 | --s-1 through --s-9 |

Fonts, spacing, colors and theme follow host tokens. Do not override `:root`, redefine host tokens, import fonts or hardcode independent colors. Use approved component classes first; scoped custom geometry may use aliases only. Mandatory partner CSS lint/package enforcement remains a planned follow-up; CSS alone is not a sandbox. Do not claim every arbitrary custom stylesheet is mechanically constrained.

## Native toast API

```javascript
CelloklabPluginUI.notify({
  type: 'success',
  message: 'Zapisano zmiany.',
  duration: 4000
});
```

- API version: `CelloklabPluginUI.version === '1.0.0'`.
- Types: success, info, warning, error.
- Nonblank message, max 2000 Unicode code points; literal text, never raw HTML.
- Optional integer duration 1000–30000ms; defaults success/info4000, warning/error6000.
- Only type/message/duration accepted.
- Returns the connected native toast element. Invalid options, missing host renderer/container or failed rendering throw.
- Uses the existing `base-ui.js` Bootstrap renderer, preserving appearance, icons, close button, autohide and native cleanup.
- Adapter captures native renderer before page-specific overrides. Reinitialization preserves API identity.

Toast is NOT bell notification, email, audit or proof of persistence. Show success only after confirmed backend success; conflicts must preserve edited fields and use an appropriate warning/error. Do not put medical data, patient identity, tokens or raw exception messages in toast content. Avoid repeated messages on background polling.

## Demo and verification

Platform superadmin enables `example.ui-kit` in existing plugin management, with no data capabilities. Tenant admin opens **Pulpit Kliniki** for the gallery. Gallery tests cards, forms, tables, alerts, responsive layout and four native toast variants without saving clinical data or sending notifications/emails. Disable this diagnostic gallery after acceptance if not wanted on the dashboard.

Check desktop/mobile and both themes, keyboard focus, disabled buttons, wrapped action groups, long literal messages and native close/autohide. QuickJS tests verify API/safe DOM behavior; they do not certify browser rendering, animation timing, screen-reader use or contrast. Automated browser verification is still pending.

## Next stages

Separate plugin pages inheriting base.html, controlled modals/floating panels, complete hook catalog/probe plugin, bell notification and Resend delivery adapters. None of those are implied by this first UI Kit release.


## Declarative plugin pages, modals and floating panels — UI gallery1.1.0

Existing clinicaldemo1.36 unchanged. New PluginPage exported through celloklab_plugin_sdk; registrar.register_page requires manifest ui.page hook. Page fields page_id,title,template,roles,requires_doctor,nav_label,css_assets,js_assets. Local page_id lowercase slug; navlabel max80,title160. Host route /app/<tenant_slug>/plugins/<plugin_id>/<page_id> inherits base.html, verifies active staff tenantmembership and declaredroles/doctor plus currentplugin state evendirectURL. Unauthorized/inactive/unknown404, anonymous401. Plugin body receives only tenant_slug/plugin_id/localpage_id/title. Includes/extends loader rejects traversal/symlinkescape. Navigation link labelsescaped, URLs hostcontrolled; no arbitraryroutes or data grants.

Canonical dynamic page identity plugin:<plugin_id>:<page_id>, helper plugin_page_id. Fragments may target own dynamicpages or corecatalog; cannot target anotherplugin identity. New UIFragment popup_modal/ui.modal and floating_panel/ui.floating require surface_id localunique slug and title. Host templates render authorized surfaces only, adminexcluded, existingmedicalhook retained. Surface IDs for JS '<plugin_id>:<surface_id>'. Not data APIs and no AI/page scraping.

CelloklabPluginUI additions openModal/closeModal/openFloating/minimizeFloating/closeFloating return Promise<boolean>; registerCloseGuard(id,callback) gets{id,action,element}, stricttrue required dirtyclose; markClean(id) after confirmed save/reset. Independent native dialogs leave core appModal intact; focusrestoration/tabtrap/Escape; oneexpandedfloating; minimization preservesforms. Input/change marks surface dirty; withoutguard dirtyclose refused; beforeunload warning. Guards must implement save/discard/cancel explicitly—surface API doesn't prove server save or automatically share domains. Alreadyrendered UI isn't remotelyremoved on revoke; future requests revalidate server.

example.ui-kit1.1.0 declares page gallery/nav 'Plugin UI — galeria', demo-modal and demo-floating limited to dashboard_clinic and ownpage, tenant_admin. Gallery has explicit openbuttons and fakefieldreset; closeguard confirmsdiscard, no clinicalwrites. Floating minimized launcher reopens retainedtext, expandbutton resizes. Approve1.1.0 then enable no datagrants, open Clinicdashboard/gallerymenu and test directURL /app/<slug>/plugins/example.ui-kit/gallery. No migration or clinicaldemo reapproval. UI Kitv1 toastcontract unchanged. Native dialog visibility/mobile/focus realbrowser acceptance outstanding; QuickJS and HTTP/Jinja tests isolated. Full UIHookProbe catalog and notifications are later slices.


## Modal centering/backdrop and truthful loader — UI gallery1.2.0

Global host reset removes native dialog auto margins. Modal now explicitly fixed/inset0/margin auto, viewport-bounded and native showModal backdrop darkened. Floating right-bottom position preserved, subtle host-token shadow with scoped fallback. No display rule exposes closed dialogs. Existing dirtyclose guard/focus behavior preserved.

CelloklabPluginUI.setLoading(surfaceId, boolean, label?) toggles dedicated status/spinner and aria-busy. Default off, label plain text max200Unicodecodepoints. Never replaces input/content, alters dirty baseline or focus; reduced-motion styling. Plugin must set true before actual async work and false in finally; static ready content must not fake progress. Gallery button explicitly simulates one-second no-network loading for acceptance. Example: setLoading(id,true,'Ładowanie…'); try { await task(); } finally {setLoading(id,false);}. Loader is presentation, not authorization or proof of save.

Approve example.ui-kit1.2.0 then enable no datagrants; clinicaldemo1.36 unchanged. Verify modal centered and dimmed backdrop desktop/mobile, floating shadow light/dark, loader test, close/cancel and dirtyfield preserved. No migration/newcapabilities. QuickJS/style tests passed, actual browser visual acceptance pending.


## UI Hook Probe — diagnostic1.0

New example.ui-hook-probe, no data grants; existing UIgallery1.2 and clinicaldemo1.36 unchanged. PLUGIN_UI_HOOK_CATALOG.md distinguishes nine actual mounts from declared-only hooks. Probe renders labelled placeholders for mounted before/after content, right panel, doctor/reception widgets, existing medical tab, page/modal/floating. Existing medical/Case functions unchanged. No patient API requests.

UIFragment/PluginPage optional enabled_hooks_setting references flat comma-separated setting (absent/all enables, empty hides). Existing actor/page/tab gates still apply. Host supplies diagnostic host_page_id/host_tab_id only, no Request/clinicalpayload/actorroles. Probe report sidebar or /app/<slug>/plugins/example.ui-hook-probe/report; modal/floating explicit clicks. Keep ui.page when selecting report surfaces. Disable probe after visual review. No migration. Actual Jinja/QuickJS tests local; browser visual role matrix pending.


## Heading-relative top slot, deterministic ordering and adjustable right panel

page.before_content keeps its ID for compatibility but now renders AFTER the complete native page heading, before body sections. Shared plugin_before_content.html mounts on33 ordinary base templates, adminpages excluded, partnerpage afterhosttitle. Heading-free iframe mounts at contentstart; standalone/external/patientportal layouts unchanged. No JS relocation. Newtemplates must explicitly include sharedslot once afterheading or implement page_header/page_plugin_before_content blocks; base no longer silently mounts aboveheading.

UIFragment priority strictinteger0–1000/default100, lower first; tie ordered plugin_id then explicitfragment_id or legacywidget/surface/templateidentity. Optional fragment_id lowercase slug, duplicateexplicit IDs within sameplugin/hook rejected. Multipleplugins render all eligiblefragments; no winner-takes-all. Default order doesn't override persisted dashboardwidget layout. Exactlegacyduplicate identities aren't meaningfully distinct; partners should assign explicit stablefragment_id. No administrator dragordering added for inline slots.

global.panel.right now collapse/reopen plus leftseparator pointerdrag and keyboard ArrowLeft/Right,+/-,Home/End (Shift largersteps). Default320px, range260–560 constrainedto keep480maincontent; collapsed48rail. Under1200 or insufficientspace inlinefullwidth with resizeoff. Stores only width/collapsed localStorage scopedbyhostuser/tenant, no patientdata; unavailablestorage tolerated. Collapse hides existingform subtree withoutdestroyinginputs. Pointercancel/blur/viewportchange rollsback unfinisheddrag. Preferences restoreonDOMinit brief initialflash possible. No migration/grant/pluginversion change, existing diagnosticprobe1.0 retained. Tests executedrender placement and QuickJS layoutbehavior; productionmobilevisual acceptance pending.


## Local patient/visit mounts and Probe1.1.0

Five former declared-only hooks now mounted: patient.header.actions afterfull patientheading outsidepatientForm; patient.profile.sections tab-dane-osobowe; patient.records.sections tab-wywiad under unchanged has_trichology_access; visit.header.actions actualvisitdetail/createedit pages; visit.form.sections after nativevisitForm (independent forms okay). No localvisit slot on schedule_appointment, only generic pagehooks. No newCase/medical/external scope. Existing hostpane/route access remains authoritative; localcurrenttenantstaff enforced evenuntargetedfragments. Patientlocal excludes businessadmin/finance-only; trichology no newdoctorprofile requirement.

Patient section fragments insidecoreform may only show visualreadonlycontent/typebutton actions. Host rejects forms/input/select/textarea/object/submit controls/explicit form association before fragmentassets loaded. Use modal/separatepage for input; no nestedforms or native-save-field injection. Trustedinprocess code isn't sandboxed, runtimeDOM safety still integrationreview responsibility. Slot placement doesn't authorize dataAPI. Exact guards/pages available PLUGIN_UI_HOOK_CATALOG.md.

Probe updated1.1.0 exactpage/tab/role targets, stablefragmentIDs priority100; no data grants. Approveversion then enable; existinggal/UI and clinicaldemo unchanged. Settings enabled_hooks options include newslots and all. Tests actualnativepageJinja guardmatrix, no nestedforms, nativeform preserved and existingmedicalblock unchanged. No migration. Live visual and role acceptance pending.


### Patient footer hook spacing

On documentation_form only, a populated page.after_content uses the native section spacing token --spacing-md. Redundant120px patientForm bottompadding before the hook is removed; main-content bottomclearance for fixedsavecontrols remains. Emptyfooter and otherpages unchanged. Visual-only adjustment, no grants/versions/migrations. Real Jinja/CSS regressions pass; browsermeasured geometry not verified locally.


## Adaptive patient tabs: active tab plus Więcej

Patient card tabs stay on one row without horizontal scrolling. Actual nav width ResizeObserver, fontloading and windowresize determine compactspacing then overflow original authorizedbuttons into Więcej disclosure. Active tab always staysvisible; verynarrow label ellipsis/title ratherthan secondrow. Widening restores originalbuttonorder/instances/listeners. Existingdelegated tab switch, URLhash, panes/roleconditions and localSDKhookidentities unchanged; menu doesn'tgrantnewaccess or make clinicalrequests. No inputs/statepersisted. Escape/outsideclick close; focusrestored, menu viewportbounds verticalscrollonly. Existing formguard decision staysauthoritative when switching. New patient-tab-overflow.js, scoped documentation_form.css; no backend/capability/migration/pluginversion change. Tests actualrole-renderedJinja plus QuickJSwidth/font/mutation/cancellation; browser desktop/mobile rendering requires liveacceptance.


### Patient tab overflow discoverability

Więcej is a bordered secondary button with a decorative downward chevron on the right. Native token colors, hover/expanded state and focus remain; width calculation includes the full control, no role/SDK/hook changes. No migration/version/grant change.
