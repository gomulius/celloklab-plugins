# Celloklab partner plugin development

## Rezerwacje organizacyjne — rozszerzenie recepcji

Before implementing a calendar, read [PLUGIN_BOOKING_CONTRACT.md](PLUGIN_BOOKING_CONTRACT.md). The implemented host reference uses Polish UI Kit and standalone SDK with no clinical grants or AI; `examples/example_bookings/` is not yet in the public 1.0.0 snapshot. Wyślij kontakt albo pacjenta, nigdy oba; czas/koniec są migawką katalogu ustaloną przez hosta. Zachowuj body/klucz przy niepewnym utworzeniu i oryginalną rewizję przy przypisaniu/przełożeniu/anulowaniu. Nie dodawaj kont, dokumentacji przed przypisaniem, raw SQL, nowych ról, Case ani mutacji personelu. Widoczność strony nie oznacza autoryzacji.

## Mandatory Polish UI and explicit clinic AI approval

All new or maintained platform modules/plugins, including partner and administrator screens, must use **Polish for every user-facing string**: titles/navigation, labels/buttons/help/placeholders/tooltips, accessibility names (`aria-label`, `title`), loading/status/errors/validation, confirmations/toasts/notifications and output framing. English developer prose is allowed; internal IDs/API fields/capability names/stable codes remain unchanged. Map wire states to Polish labels and flags to „tak”/„nie”; never expose raw exceptions. Fixed AI instructions should request Polish output. This mandate does not claim unrelated legacy UI was translated.

Every manifest requesting literal `AI` makes the entire plugin hidden on all clinic-facing surfaces until platform-global activation plus explicit opt-in by that clinic's local administrator, including non-AI pages/fragments. Authorized management consoles remain available to administrators. Plugins without requested `AI` keep existing role/page/plugin rules in every eligible clinic and require no AI settings/license/activation. Runtime/replay checks remain independent.

Manual migration **080** adds default-off `tenant_plugin_ai_activations` alongside ledger migration 079. No automatic backfill: existing `tenant_ai_feature_settings` is not approval, and clinic administrators must explicitly re-enable each AI-requesting plugin. Ask the host administrator to apply only missing reviewed SQL; never guess columns or implement plugin SQL. Existing grants/licensing/settings/credits remain separate gates.

## Supported boundary

Develop against public `celloklab_plugin_sdk` source, not private host modules. The implemented host contract has Python SDK `1.1.0`, manifest compatibility `1.0` and UI Kit `1.0.0`. The checked-in public `sdk/` source and wheel remain a `1.0.0` snapshot; the new typed-interview and booking modules/examples are not yet published there. Start from a pinned public GitHub commit, inspect its actual inventory and never assume a documentation update upgrades its code. See [PLUGIN_API_REFERENCE.md](PLUGIN_API_REFERENCE.md) for browser behavior and [PLUGIN_SDK_RELEASE.md](PLUGIN_SDK_RELEASE.md) for the snapshot/publication boundary. No partner ZIP or private platform repository is required.

Plugins are administrator-reviewed, trusted, in-process Python plus server-rendered templates and same-origin JavaScript. This is **not a sandbox**. Capability grants do not authorize an actor or replace tenant/resource checks. There is no automatic installer, marketplace, dependency resolver, general event bus or arbitrary database API. Manifest event declarations alone do not provide event delivery; the one implemented narrow exception is reviewed `register_trichology_summary()` for `trichology.record.changed`.

The browser API uses the authenticated host session and host-resolved clinic context. It is not the separate external public API and provides no partner API-key authentication. Never import `app`, repositories, database connectors, native Request objects or secret configuration. Do not bypass the supported facade through native routes.

## Start without the host

From a reviewed, pinned checkout of the public GitHub repository, create a clean virtual environment, install the checked-in public SDK source and copy `starter/` as your plugin. The current checkout installs the `1.0.0` snapshot, not the host's newer `1.1.0` contract:

```sh
python -m venv .venv
.venv/bin/python -m pip install --no-index --no-deps --no-build-isolation ./sdk
.venv/bin/celloklab-plugin-validate starter
python -m http.server 8000 --bind 127.0.0.1 --directory preview
```

The package/build backend use the Python standard library and have no third-party runtime/build dependencies. The validator returns JSON (`schema_version`, `ok`, `errors`, `warnings`), exit 0 for no reported errors, 1 for errors. It checks declarations, known catalogs, entrypoint file/syntax, path/symlink containment and conservative CSS policy; it **does not import your entrypoint**, execute Jinja, validate arbitrary dynamic registration or certify security. Preview has no real API/authentication/upload/email; its visibly marked mock toast is not production toast parity. Fonts are not distributed; local fallback fonts may differ.

## Deliverable and registration

Use a unique module namespace, a stable plugin ID, relative template/static paths, explicit versions and minimal requested capabilities. Copy the starter's manifest shape:

```json
{
  "id": "partner.example",
  "version": "1.0.0",
  "sdk_version": "1.0",
  "publisher": "Example Partner",
  "entrypoint": {"module": "partner_example:register"},
  "capabilities": {"requested": ["patient.read_identity"]},
  "ui": {"hooks": ["ui.page", "ui.modal"]},
  "events": {"subscribe": []}
}
```

An entrypoint receives `PluginRegistrar`; use public `PluginPage` and `UIFragment`. `register_page`, `register_fragment`, and `register_ui` are the registration surface. Prefer static declarations in `ui-declarations.json` shared with registration (as in the starter) so offline checks see the same values. Dynamic registration still requires host review. A requested capability/hook must be declared; requests are not automatically granted. A plugin version change requires administrator approval before enablement.

## UI contracts

Use the shipped page catalog and `PLUGIN_UI_HOOK_CATALOG.md`, not URL guesses. A declared hook is not necessarily mounted. Current mounts include page before/after content, global right panel, doctor/reception dashboard widgets, patient header/profile/records/medical-documentation sections, visit header/form sections, own pages, modals and floating panels. Case hooks and `global.navigation.after` are declarations only. Own-page navigation is provided through `PluginPage.nav_label`, not that unmounted hook.

- `PluginPage`: `page_id`, `title`, `template`, optional `roles`, `requires_doctor`, `nav_label`, `css_assets`, `js_assets`, `enabled_hooks_setting`. IDs are local lowercase slugs; title maximum 160, navigation label maximum 80 characters.
- `UIFragment`: `template`, `hook`, `context`, assets, `placement`, `widget_id`, `default_col_span`, `page_ids`, `roles`, `requires_doctor`, `tab_id`, `surface_id`, `title`, `enabled_hooks_setting`, `priority`, `fragment_id`.
- Placements: `inline`, `dashboard_widget`, `global_panel`, `popup_modal`, `floating_panel`. Widgets require stable IDs and 1–3 columns and use the native dashboard grid/layout persistence; do not create a second grid.
- `priority` is an integer 0–1000 (default 100), ascending. Ties sort by plugin ID then stable identity (`fragment_id`, widget/surface ID or template). Declare unique local `fragment_id` values per hook and unique `surface_id` values across the plugin's surfaces.
- Target exact `page_ids` and optional `tab_id`; own-page targets use `plugin:<plugin_id>:<page_id>`. You cannot target another plugin's pages. Empty targeting is broad legacy behavior, not preferred partner practice.
- `roles` use current tenant roles. `requires_doctor` requires the local doctor role, an active doctor profile and active clinic assignment. Medical-documentation slots retain their stronger host guard even when the plugin omits it. UI visibility never authorizes runtime data access.
- Patient profile/records mounts are non-form visual slots inside native form contexts: static editable controls/forms are rejected before assets load. The reviewed typed interview reference creates unnamed independent controls dynamically, isolated from native serialization/dirty tracking; this trusted-code exception is not a sandbox or permission for arbitrary static editors. Visit form extensions are outside the native form and may use independent forms. Do not alter native submits, field names or core validation.

Use `.clk-plugin-ui`, native `clk-ui-*` components and shared design tokens documented in `PLUGIN_UI_STYLE_GUIDE.md`. Prefer no custom CSS. If needed, scope it to `.partner-*`; do not override host globals/tokens, hard-code colors/fonts/dimensions, supply literal design-token fallbacks or fetch remote assets. The offline linter is conservative, not a full CSS parser.

## Surfaces, toast and loading

A modal uses `hook="ui.modal"`, `placement="popup_modal"`; a floating panel uses `ui.floating` / `floating_panel`. Both require a local surface ID and title. Browser IDs are namespaced as `<plugin_id>:<surface_id>`.

```js
const ui = window.CelloklabPluginUI;
const id = 'partner.example:editor';
ui.registerCloseGuard(id, async () => window.confirm('Odrzucić niezapisane zmiany?'));
await ui.openModal(id);
ui.setLoading(id, true, 'Ładowanie…');
try {
  // Perform an authorized host request; render text with textContent.
} finally {
  ui.setLoading(id, false);
}
// Only after a confirmed successful save:
ui.markClean(id);
ui.notify({type: 'success', message: 'Zapisano zmiany.', duration: 5000});
```

Public adapter methods: `openModal`, `closeModal`, `openFloating`, `minimizeFloating`, `closeFloating`, `registerCloseGuard` (returns unregister function), `markClean`, `setLoading`, `notify`. Dirty input/change makes close fail closed without a guard returning literal `true`; Escape/close and surface replacement respect the guard. Minimize preserves the floating panel's dirty state. Modal focus is trapped/restored; dirty surfaces also trigger unload protection. Guard patient switches, reloads and internal navigation in your own editor too. Opening static content does not automatically set loading; clear loading in `finally`.

Toast types are `success`, `info`, `warning`, `error`; message 1–2000 Unicode code points; optional duration 1000–30000 ms. It delegates to the captured native host toast renderer; there is no production fallback renderer. Loading label is nonempty, maximum 200 Unicode code points. Use plain text, safe DOM APIs, delegated/idempotent event handlers and buttons with explicit type. Never put clinical data in console logs, URLs, local/session storage or public static assets.

## Typed trichology editor

Read **[PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md](PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md)** before implementing an editor. GET retains display/legacy values and labels, adding all 41 typed `record.interview_values` and Polish `record.interview_options`. Edit codes/arrays/boolean-null/text-null, never captions. PATCH is a nonempty flat dirty-field object: the narrower legacy string-only write allowlist stays unchanged, with all 41 new fields added. New null/empty clears; `[]` clears multi-selects; `false` is valid; omit unchanged fields. `result.updated_values` exposes only submitted values, typed for new fields.

The implemented 1.1.0 SDK supplies host-independent `celloklab_plugin_sdk/trichology.py` constants/validation, not private models or database imports. The host reference is `example.trichology-interview`; neither that module nor `examples/example_trichology_interview/` is present in the checked-in public 1.0.0 snapshot. Do not import absent helpers or substitute private host source; await reviewed source synchronization. It requires existing `patient.read_trichology_record` and `patient.write_trichology_record`, not `AI` or a new capability. A read-only plugin adding write must obtain explicit write grant and exact manifest-version approval; unchanged effective grants need no blanket reset. Current clinical role, active doctor profile/clinic assignment and assigned patient are required even when the UI is visible.

Use Polish labels/errors and native UI Kit, no nested forms or native-save interception. Keep draft and original trichology revision in memory; strongly recommend `If-Match` (legacy optional). A 409 must preserve changes and offer explicit reload/compare, never automatically refresh the revision and overwrite. Denial clears displayed read data and disables editing; preserve only dirty input in transient memory, with authorized reread and explicit confirmation before restoration. Block plugin saving while native edits are dirty; synchronize only confirmed saved fields and preserve native edits made during the request. Native columns remain unencrypted; only separate existing AI job snapshots/artifacts are encrypted. The bridge needs no additional migration, capability, worker or recording/RPL/Case expansion; migration 084 is user-confirmed applied for the referenced deployment and must not be rerun; source inspection does not independently verify that schema state. Local validator success is not runtime authorization or production acceptance. Do not display/log raw framework validation errors or rejected request input; use safe Polish status/code messages.

## Data and email scope

For trichology, `patient_clinic_records.notes` means **Notatka trychologa** (clinical note), while `additional_notes` means **Dodatkowe informacje** (separate shared reception information). Preserve existing/historical values in both; never merge or repurpose them. Both are already summary source/revision fields and use the existing pre-provider redaction path, which does not guarantee anonymity. Only `notes` is in the plugin trichology write allowlist. Notes-only edits/clears enqueue eligible summary work and invalidate old output; no-op saves do not. No new schema or capability is needed.

Follow the exact route/field/revision tables in `PLUGIN_API_REFERENCE.md`. Read before editing, retain separate revisions per resource/domain and reload on conflicts rather than overwriting. A 500/network failure may have an uncertain outcome: read back before retrying. Uploads are not idempotent. Keep unsaved input until the outcome is confirmed.

Staff directory reads remain supported; **employee mutations are permanently excluded**. Existing Case reads remain supported but frozen: no Case expansion, mutations, native Case changes or physician-document creation. Trichology clinic records and physician Case medical documentation are distinct contracts.

Local email files are part of the reviewed plugin source. Declare alias, subject, `localfile`, variables and revision in the manifest; follow `PLUGIN_EMAIL_CONTRACT.md`. Use restricted XHTML/plain placeholder substitution, not Jinja or HTML-valued variables. Administrator approval binds the exact plugin version, descriptor/revision and source content; changed content needs reapproval. There are no per-plugin environment template maps or partner-supplied Resend template IDs. Native Resend email flows remain unchanged. Self and staff send paths have different payloads; staff sending requires an active local tenant administrator. Queued/provider-accepted does not prove delivery.

## Neutral AI partner flow

For 503 retain the original request/key and show a neutral Polish failure message, not an inferred provider/configuration cause. The administrator uses safe phase/errno logs; never display server exception text or create a new paid execution as a diagnostic retry.

1. Copy the public repository's `examples/example_ai/` for a neutral-text own-page and global right-panel reference, or request exact uppercase `AI` and minimum UI declarations. Validate with `celloklab-plugin-validate examples/example_ai`. Public `AIProtocol`/`AIResult` are host adapter contracts, not HTTP/provider clients or a sandbox.
2. Deliver pinned reviewed source and synthetic tests to the administrator for deployment, exact-version approval, enablement and explicit `AI` grant. Active local staff may generate neutral text; page visibility grants nothing. No patient fetch or clinical/doctor-assignment authority is inferred. Existing patient/Case policies remain independent.
3. Ask the administrator to apply only missing manual migrations **079** (plugin AI execution ledger) and **080** (default-off explicit clinic approval), never repeat confirmed prior migrations, and configure the single host feature: `plugin_ai_` plus the full SHA-256 hex digest of the exact UTF-8 plugin ID, returned by `plugin_ai_feature_id()`. The AI console first shows a virtual disabled/unconfigured entry; an active model/provider must be selected and saved before persistence. Administrator model/provider, nonnegative integer cost and explicit activation are required. The plugin supplies its task in `user_prompt`; the administrator's system prompt is an optional supplement, not a required task definition. Null/blank supplements are omitted, not replaced with invented instructions. Native AI/multimodal system prompts remain required; hash-shaped feature IDs alone are not an exemption. Provider secrets never belong in plugin settings/source. Discovery/feature saves do not grant access, license/activate tenant AI or allocate credits; those existing gates and balances remain independently enforced.
   Parameter overrides/defaults are administrator-owned: missing/null values inherit provider-specific feature → generic feature → model → call fallback; zero is explicit. Provider reasoning support and rejection rules are specified in `PLUGIN_API_REFERENCE.md`. The providers page exposes Polish instructions through clickable **i** help; plugins do not duplicate those controls.
4. From the authenticated host page POST `/api/plugins/{plugin_id}/ai/completion?tenant_slug=...`, session cookies + host CSRF + UUID `Idempotency-Key`, with **only** `{"user_prompt":"Napisz po polsku krótkie, przyjazne powitanie na warsztaty ogrodnicze."}`. Host maximum is 20000 characters and 64 KiB body; demo maximum is 1000. No feature/model/prompt/cost overrides. Follow `PLUGIN_API_REFERENCE.md` for the exact response.
5. Result metadata is `execution_id`, `status` (`pending`/`succeeded`/`failed`), `credit_cost`, `charged`, `replayed`, plus optional first-success `text`. Render text with `textContent`; never log/persist prompt/output or infer clinical authority. All replays are metadata only because raw prompt/generated text are not stored in execution/idempotency/audit records. Existing prompt redaction is reused, **not an anonymity/security guarantee** or provider-retention assurance.
6. Preserve the exact request/key in transient memory after uncertainty. Allow explicit same-payload replay only, not blind retries, polling or fresh-key bypass; changed payload with the same key is 409. Credits are atomically reserved/debited before dispatch; success consumes the reserve, definite provider failure refunds, uncertain/crashed in-progress execution retains it pending manual reconciliation without automatic provider replay. Revoked replay authorization does not settle earlier uncertainty. Reloading loses transient request state: ask the administrator to reconcile retained execution/key metadata rather than guessing a new paid request. Start a separate execution only after terminal confirmation.

The reference includes manifest, entrypoint, declarations, template, local JS and README. It has no patient API calls/provider credentials/browser persistence, uses native loader/toast and explicit uncertainty/replay controls. Offline checks do not establish authenticated browser/MariaDB/live-provider acceptance. Deliver administrator test cases for role/grant/version denial, missing AI configuration/license/credits, payload/header bounds, conflict/replay, reserve/refund and pending reconciliation. Employee mutations stay excluded and Case reads frozen.

## Independent clinical trichology automation

Use the public repository's `examples/trichology_ai_summary/`, plugin ID `trichology.ai-summary`. Its five executable/declaration/template/JS files plus README import only the public SDK. Request `AI`, `patient.read_trichology_record`, `ai.trichology_summary`, declare exact `trichology.record.changed`, and register `TrichologySummaryRegistration(prompt_builder=...)` through `PluginRegistrar.register_trichology_summary()`. The builder receives `TrichologySnapshot` containing only approved `fields` (strings/null, no identities), and returns `TrichologySummaryPrompt` (1–20000 characters). It does not receive clinical reader, credentials, provider execution, database or generic jobs. Follow the API reference for the source field allowlist. Host scalar minimization/redaction are not anonymity guarantees; do not silently truncate or infer missing clinical facts.

The host enqueues actual source changes, including clears, transactionally with the source write; no-op writes, AI output, assignments and access changes do not generate another version. Host controls clinical authorization, encrypted snapshots/artifacts, dispatch, billing, audit and retention. Current assigned-patient clinical scope, active doctor profile and clinic assignment are required before decryption, before provider and before publication, independently of UI visibility; nonclinical GET is denied. Disable/revocation cancels undispatched work and blocks publication; dispatch uncertainty stays pending. Source changes suppress obsolete publication, not refund a valid paid response. Lease is 300 seconds with at most 6 bounded pre-dispatch attempts; dispatch-fenced crashes never auto-retry.

Use a semantic `.clk-plugin-ui` section with a descendant `clk-ui-card` and the shared card header/title/body classes; never apply the card only to the wrapper or insert loose text. Follow `PLUGIN_UI_STYLE_GUIDE.md` and `PLUGIN_UI_HOOK_CATALOG.md`. The reference is initially collapsed using native details/summary, with a distinct child result card and date/time from `generated_at`. Preserve host wall-clock time and any supplied timezone; never guess timezone/current time for missing data. Invalid/missing dates stay hidden; polling cannot expand the section and toggling cannot generate. Distinguish queued work from uncertain `pending` requiring administrator reconciliation, even after polling stops; show readable current/stale information instead of revision hashes. Docker/Passenger automatically supervise the host worker; direct uvicorn requires separate supervision and neither deployment should add a duplicate loop. Metadata uses compact UI Kit spacing (`clk-ui-gap-1`, compact cards), margin-free read-only blocks and a compact result heading; the short Polish “AI — wymaga” phrase stays together, while surrounding text wraps responsively. This does not change summary content, dates, polling or generation.

Keep the entire Polish read-only card in `patient.records.sections`, `documentation_form`, `tab-wywiad`: no nested form, native-save changes or arbitrary clinical-prompt POST. Use host context, session cookies, `X-CSRF-Token` and `tenant_slug` on GET `/patients/{patient_id}/trichology-summary`. The `summary` fields are `status`, `source_revision`, `current_revision`, `is_current`, `text`, `generated_at`, `job_id`; statuses are `queued`, `processing`, `pending`, `failed`, `stale`, `succeeded`, `cancelled`, `absent`. Polling must be bounded (sample: 30 requests, 2-second intervals) and stopped on unload; render plain text and stale labels safely. This GET polling is not a paid AI replay.

Unlike neutral AI's ephemeral text/metadata-only replay, **clinical artifacts persist encrypted**; do not copy them into browser storage, financial records or logs. Deliver synthetic tests and a retention/patient-deletion plan to the host administrator. They apply only missing reviewed manual migration 081 (never rerun confirmed 079/080), grant the exact version/capabilities, explicitly activate an active model/provider and independent plugin feature, confirm clinic license/credits and local tenant-admin consent, and operate the dedicated host worker. Dedicated native AI is removed, not pilot-disabled. Host administrators review/apply only missing manual `migrations/083_remove_legacy_native_ai_configuration.sql` after removal of native callers; no per-clinic native-disable step remains. It removes exact legacy assignments/settings and dispatch configuration, retaining inert history-referenced feature rows and all clinical tables/columns/results, financial history and plugin reserves. Partners must not apply private SQL or assume historical results are automatically converted into plugin artifacts. No Case/physician-document expansion or generic event/job platform is part of this flow.

## When the SDK is insufficient

Do not export arbitrary tables or add a database connector to a plugin. A new table needs administrator-reviewed manual MariaDB SQL and a reviewed host persistence adapter with explicit ownership, authorization, audit, revisions, retention and failure semantics. There is no generic clinic-job API or capability-development kit: review the impact on core and SDK contracts before adding a job or capability. Do not infer functions from capability names or broad roadmap claims.

Deliver a pinned GitHub source revision with source/dependency inventory, requested capabilities/hooks, validator output, synthetic tests and an administrator test plan. Private operational installation/maintenance instructions are not partner prerequisites; ask the administrator to perform deployment and migrations. Do not generate a partner ZIP for this workflow. Never include secrets, database dumps, logs, patient data, environment files or private host source.

## Patient write example

`patient.write_identity` and `patient.write_contact` are independent capabilities. Use scoped PATCH identity/contact routes in PLUGIN_API_REFERENCE.md; the host encrypts allowed fields and records PATIENT_UPDATED audit. A capability never bypasses current actor/patient authorization. Read and retain each domain revision, send only changed fields, and preserve edits on error.

## Complete partner email HTML example

The starter contains this reviewed layout. Declare title/message variables in its manifest and obtain administrator source approval before sending; this example grants no access and sends nothing by itself.

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" dir="ltr" lang="pl">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no" />
<title>{{title}}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Segoe UI,Arial,sans-serif;color:#333;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#fff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,.05);overflow:hidden;">
<tr><td align="center" style="padding:32px 24px;background:#667eea;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;">
<a href="https://celloklab-technology.com"><img src="https://celloklab-technology.com/pl/static/img/Logo-full-white.webp" width="180" alt="Celloklab Technology" style="max-width:180px;height:auto;border:0;" /></a>
<h1 style="font-size:24px;margin:16px 0 8px;color:#fff;">{{title}}</h1>
<p style="margin:0;color:#fff;">Powiadomienie modułu platformy</p>
</td></tr>
<tr><td class="content" style="padding:32px;line-height:1.6;">
<div class="content-html"><p>{{message}}</p></div>
{{#action_url}}
<p><a href="{{action_url}}" style="display:inline-block;padding:14px 24px;background:#667eea;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;text-decoration:none;border-radius:8px;">{{action_label}}</a></p>
<p style="font-size:12px;color:#4a5568;">Jeśli przycisk nie działa, użyj adresu:</p>
<div style="word-break:break-all;background:#f7fafc;padding:12px;font-size:12px;">{{action_url}}</div>
{{/action_url}}
<div style="margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;">Wiadomość wygenerowana automatycznie przez Celloklab.<br /><strong>Zespół Celloklab</strong></div>
</td></tr></table>
<p style="text-align:center;font-size:12px;color:#6b7280;">© 2026 Celloklab. Wszystkie prawa zastrzeżone.<br />Wiadomość automatyczna — nie odpowiadaj na ten email.</p>
</td></tr></table>
</body></html>
<!-- Variables: title, message, action_url, action_label. Plain-text variables are HTML-escaped by host. No clinical data, arbitrary URLs, or raw HTML. -->

```
