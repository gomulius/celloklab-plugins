# Celloklab partner SDK 1.0.0

## Mandatory Polish UI and clinic AI approval

Partner authors must deliver **Polish for all new or maintained module/plugin user-facing UI**: titles/navigation, labels/buttons/help/placeholders/tooltips, accessibility names, loading/status/errors/validation, confirmations/toasts/notifications and output framing. Administrator screens follow the same rule. Developer prose may stay English; internal IDs/API fields/safe codes remain unchanged. Map wire statuses to Polish labels and flags to „tak”/„nie”; never expose raw exceptions. This mandate does not claim unrelated legacy platform UI was translated.

Every plugin requesting literal `AI` is hidden on all clinic-facing surfaces until platform-global activation plus explicit opt-in by that clinic's local administrator, including non-AI content. Authorized management consoles remain available for setup. No-AI plugins keep existing role/page/plugin rules in all eligible clinics without AI settings/license/activation dependencies. Manual migration **080** adds default-off `tenant_plugin_ai_activations` alongside ledger migration 079; no automatic backfill. Existing `tenant_ai_feature_settings` is not approval: local administrators must explicitly re-enable each AI-requesting plugin. Generation still enforces grants/licensing/settings/credits, and pending/replay/CSRF/idempotency safeguards remain independent.

The Python distribution contains **only** `celloklab_plugin_sdk` contracts, public JSON catalogs, and offline validation. It has no third-party runtime or build dependencies, database configuration, private Request object, or `app` imports. `SDK_VERSION` remains `1.0` (manifest major 1); distribution/UI-kit version is `1.0.0`. Host legacy imports are shims to the same classes.

## Build and install offline

From the repository root:

```sh
python -m pip wheel ./partner_sdk --no-deps --no-build-isolation --no-index -w /tmp/celloklab-wheels
python -m venv /tmp/celloklab-partner
/tmp/celloklab-partner/bin/python -m pip install --no-index --no-deps /tmp/celloklab-wheels/celloklab_plugin_sdk-1.0.0-py3-none-any.whl
/tmp/celloklab-partner/bin/celloklab-plugin-validate partner_sdk/starter
python -m unittest discover -s partner_sdk/tests -v
python partner_sdk/build_bundle.py --output /tmp/celloklab-partner.zip
```

The PEP 517 backend is stdlib-only and selects the public module, never the host. Its sdist embeds that module so it can be rebuilt without this checkout. Rebuild the ZIP **after** final public documentation changes; documentation is copied at build time, not vendored.

## Offline validator

`celloklab-plugin-validate PLUGIN_FOLDER` emits stable JSON `schema_version`, `ok`, `errors`, `warnings`; exit 0 means no reported errors, exit 1 means errors. It checks manifest shape, SDK major, entrypoint syntax/file existence, catalog names, path/symlink containment, CSS policy, and optional `ui-declarations.json`. It **never imports the entrypoint**. Static declarations do not capture arbitrary dynamic `register()` output, execute Jinja, or prove HTML/JS safety. Host review, approval, grants, tenant/actor authorization and email revision approval remain mandatory. This is not a sandbox or security guarantee. Catalogs are public snapshots of the current host, not promises that every declared hook is mounted.

CSS must be scoped to `.partner-*`, use the host UI-kit classes/tokens, and not replace host globals or tokens. The conservative stdlib linter reports literal colors, fonts and dimensions, fallback values, global selectors, URLs (including remote URLs), overrides and unsupported at-rules/escapes. It is a bounded-policy heuristic, not a full standards CSS parser. Prefer no custom CSS. Token fallbacks are deliberately rejected rather than permitting design drift.

## Starter

Copy `starter/` into a reviewed plugin folder. It imports only the public SDK and demonstrates an own page, modal, floating panel, safe `textContent`, local file selection, and a local XHTML email descriptor. Its JSON declarations are shared by the registration function and offline validator. No database, migration, native-case changes, staff mutations, upload requests or email sends run in the sample. Real attachment upload needs the requested `patient.upload_attachments` grant plus the host API's authorized patient scope and upload policy. The local email template is **not pre-approved**: an administrator must approve its exact version/revision/content before the approved host email API can send. Do not inject HTML into variables or use Jinja in local email files. No private API wrappers are exported by this package.

## Neutral AI reference and administrator handoff

The package includes `ai.py`: `AI_CAPABILITY="AI"`, `AIProtocol.generate(context, user_prompt, idempotency_key)`, `AIResult` and `plugin_ai_feature_id()`. These trusted in-process host contracts are not HTTP/provider clients, credentials, retries, a sandbox or an authorization/billing bypass. The ZIP separately includes explicit-allowlisted `examples/example_ai/` manifest, entrypoint, declarations, template, static JS and README. Validate that folder with the installed CLI; it supplies a neutral-text host page plus a global right-panel **Uruchom AI** button, not an offline preview/provider emulator. The panel submits a fixed gardening prompt immediately and shows plain-text output. Page and panel share execution state by plugin/tenant in the same document, retaining exact replay keys and preventing duplicate paid calls; mount does not execute AI.

Deliver pinned reviewed source/minimal exact `AI` request to the administrator. They deploy/approve/enable the version and grant, apply only missing manual migrations 079 and 080, configure the single derived `plugin_ai_<full SHA-256 hex digest of exact UTF-8 plugin ID>` feature, and check existing tenant licensing/active settings and credit balance. The initial console entry is virtual, unconfigured and disabled; selecting an active model/provider and saving materializes it, without discovery choosing defaults or modifying grants/licenses/balances. Administrator model/provider, cost and explicit activation are mandatory; the plugin system prompt is an optional administrator-owned supplement, with null/blank omitted. Native AI/multimodal prompts remain required. Never store provider secrets in plugin source/settings or rerun confirmed prior migrations.

POST `/api/plugins/{plugin_id}/ai/completion?tenant_slug=...` uses host session, CSRF and UUID `Idempotency-Key`, exactly `{"user_prompt":"Napisz po polsku krótkie, przyjazne powitanie na warsztaty ogrodnicze."}` (maximum 20000 characters, 64 KiB body; demo maximum 1000). Active local staff and current exact `AI` grant are required; no patient fetch or clinical authority is inferred. `result` contains `execution_id`, `status` (`pending`/`succeeded`/`failed`), `credit_cost`, `charged`, `replayed`, optional first-success `text`. Raw prompt/generated text are not stored in execution/idempotency/audit records; all replays are metadata only. Render plain text safely, retain only transient request state, and do not treat existing prompt redaction as an anonymity/security guarantee.

Reservation/debit is atomic before dispatch: success consumes it, definite provider failure refunds, uncertain/crashed in-progress execution retains it pending manual reconciliation, never automatic provider replay. Changed payload with the same key is 409. After uncertainty allow only explicit exact-key/payload replay, not blind retries/new paid keys. See public API/development guides for handoff and proof-test limits. Case reads stay frozen; employee mutations remain permanently excluded.

## Clinical trichology reference

Public `clinical_ai.py` is included in wheel/sdist and source allowlists. `TrichologySnapshot` supplies only approved source `fields` (strings/null, no identities); `TrichologySummaryPrompt` is bounded to 1–20000 characters; `TrichologySummaryRegistration` declares one builder for exact `trichology.record.changed`, through `PluginRegistrar.register_trichology_summary()`. It exposes no general event bus, arbitrary jobs, clinical reader/provider execution or database API.

The ZIP's `examples/trichology_ai_summary/` contains exactly five files plus README: `manifest.json`, `trichology_ai_summary.py`, `ui-declarations.json`, `templates/summary.html`, `static/staticsummary.js`, `README.md`. Plugin `trichology.ai-summary` requests exact `AI`, `patient.read_trichology_record`, `ai.trichology_summary`. Validate it using the isolated installed CLI. It renders an entirely Polish non-form read-only card inside a semantic `.clk-plugin-ui` section with a descendant `clk-ui-card` per the style guide/hook catalog, not an offline provider emulator. The full section is initially collapsed using native details/summary, with a separate result card and Polish date/time from `generated_at`; preserve host wall-clock/explicit timezone without guessing or fabricating missing dates. Polling never expands it and toggling never generates. It displays readable freshness rather than revision hashes and distinguishes waiting `queued` from uncertain `pending` requiring administrator reconciliation, preserving the latter after polling stops. GET `/api/plugins/{plugin_id}/patients/{patient_id}/trichology-summary?tenant_slug=...` requires host session and `X-CSRF-Token`; polling is bounded to 30 reads at 2-second intervals and stops on unload. `summary` fields: `status`, `source_revision`, `current_revision`, `is_current`, `text`, `generated_at`, `job_id`; statuses: `queued`, `processing`, `pending`, `failed`, `stale`, `succeeded`, `cancelled`, `absent`. No arbitrary clinical-prompt POST exists. Metadata uses compact UI Kit spacing (`clk-ui-gap-1`, compact cards), margin-free read-only blocks and a compact result heading; the short Polish “AI — wymaga” phrase stays together, while surrounding text wraps responsively. This does not change summary content, dates, polling or generation.

Only actual source changes (including clears, not AI output/assignment/access changes) enqueue transactionally and advance a source version. Active clinical profile/clinic assignment and assigned-patient scope remain required regardless of UI visibility; host checks fresh authority before decrypt/provider/publication. Scalar minimization/redaction are not anonymity guarantees. Host owns encrypted clinical snapshot/artifact persistence — **unlike neutral completion's ephemeral output** — and retention/patient deletion; logs/financial/audit records contain no prompt/output. Stale valid paid responses are not refunded merely because source changed. Disabled/revoked work is cancelled before dispatch; uncertain dispatch stays pending without automatic retry (lease 300 seconds, at most 6 pre-dispatch attempts).

Administrator handoff: approve exact version and three grants, confirm existing 079/080 and apply only missing reviewed manual 081, explicitly activate this plugin's model/provider/feature, verify license/credits and independent clinic-admin consent, and verify dedicated host worker operation. Docker/Passenger supervise it automatically; direct uvicorn needs a separately supervised loop. Do not add a duplicate worker/cron. Pilot administrators manually disable native `patient_summary_generation`; plugin code never changes it. Native forms/AI and frozen Case scope remain unchanged. Private migration/host/admin/maintenance files are excluded from the ZIP. See public API/development guides and the sample README for synthetic test requirements; isolation does not prove production MariaDB/browser/provider acceptance.

## UI-kit preview

Unzip the bundle and run:

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory preview
```

Open `http://127.0.0.1:8000/`. The build copies the current public UI-kit CSS/JS and host design tokens, never private base.js. The separate mock toast is visibly marked **preview-only**; it is not production styling parity, an API server, authentication, authorization, email sending or upload emulation. Modal/floating behavior uses the public UI JS. Fonts are not redistributed because font licensing is not established here; the token file's existing font URLs can be configured to an authorized host/local installation, otherwise browsers use local fallback fonts. No CDN or credentials are needed. A visual browser check is still recommended before partner delivery.

The ZIP uses an explicit documentation/source/asset allowlist and scans for common credential markers. It excludes AGENTS, app/config, host source, logs, audit/patient data, environment files, migrations and third-party fonts. This scan supplements—not replaces—a manual release review.
