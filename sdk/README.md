# Celloklab partner SDK 1.2.0 FOUNDATION

## Version and publication boundary

The [repository documentation](../README.md) and `sdk/` source, metadata, catalogs and build backend now publish **Python distribution 1.2.0 FOUNDATION**. Building this source yields 1.2.0. Manifest SDK stays `1.0`, browser UI Kit stays `1.0.0`; demo versions are separate. The release owner builds/verifies the current wheel separately; any retained 1.0.0 wheel is historical, not a FOUNDATION installation.

The public package includes host-independent `trichology.py` catalogs/typed-update validation, `bookings.py` contracts, and new `clinical_tasks.py` / `live_interview.py` declarations and DTO validation. Interview, booking and live-reference demos are synchronized in `examples/`. FOUNDATION includes host registration/registry integration, tab-targeted panels and the existing-form browser bridge; it **does not implement a live audio runtime**. Source publication does not prove host deployment or a GitHub release. Confirm installed-host compatibility with the administrator; private host modules are not part of this public package.

GitHub branch/commit source and documentation are the delivery surface. **No ZIP is required or generated for this update.** See the [documentation index](../README.md#complete-documentation-index), [live contract](../docs/PLUGIN_LIVE_INTERVIEW_CONTRACT.md), [browser bridge](../browser/trichology-form-bridge.js), [release notes](../docs/PLUGIN_SDK_RELEASE.md), [administrator installation guide](../docs/PLATFORM_ADMIN_PLUGIN_INSTALLATION_SKILL.md) and [maintenance guide](../docs/PLUGIN_SYSTEM_MAINTENANCE.md). Published administrative prose does not distribute private host implementation or grant runtime authority. This README edit does not build/replace wheel artifacts.

## Mandatory Polish UI and AI consent

All new or maintained module/plugin user-facing UI, including administrator screens, must be **Polish**: titles/navigation, labels/buttons/help/placeholders/tooltips, accessibility names, loading/status/errors/validation, confirmations/toasts/notifications and output framing. Developer prose may be English; IDs/API fields/safe codes remain unchanged. Translate wire states and show boolean flags as „tak”/„nie”; never expose raw exceptions. This is not a claim that unrelated legacy UI is translated.

Every plugin requesting literal `AI` is hidden on clinic-facing surfaces until platform-global availability and explicit local clinic-admin opt-in. Current version/grants, model/provider readiness, licensing and credits are independent gates; authorized setup consoles remain available. No-AI plugins retain normal role/page rules without AI dependencies. Existing settings are not clinic consent. Administrators apply only missing reviewed prerequisites; migration 080 supplies default-off consent beside ledger 079, never automatic backfill or a rerun of confirmed SQL.

## Build and install public SDK 1.2.0

Python 3.10+ is required. The standalone package has no third-party runtime/build dependencies, database configuration, private Request export or `app` imports. From the **public repository root**, not a private host tree:

```sh
python -m venv /tmp/celloklab-partner
python -m pip wheel ./sdk --no-deps --no-build-isolation --no-index -w /tmp/celloklab-wheels
/tmp/celloklab-partner/bin/python -m pip install --no-index --no-deps /tmp/celloklab-wheels/celloklab_plugin_sdk-1.2.0-py3-none-any.whl
/tmp/celloklab-partner/bin/celloklab-plugin-validate starter
/tmp/celloklab-partner/bin/celloklab-plugin-validate examples/example_ai
/tmp/celloklab-partner/bin/celloklab-plugin-validate examples/trichology_ai_summary
/tmp/celloklab-partner/bin/celloklab-plugin-validate examples/example_trichology_interview
/tmp/celloklab-partner/bin/celloklab-plugin-validate examples/example_bookings
/tmp/celloklab-partner/bin/celloklab-plugin-validate examples/example_live_interview
```

Alternatively install a release-owner-verified 1.2.0 wheel from `wheels/` when available. Installing the older `celloklab_plugin_sdk-1.0.0-py3-none-any.whl` remains possible for historical compatibility, but does not supply the new modules or FOUNDATION contracts.

The stdlib PEP 517 backend selects only the bundled public module. Do not use host-only `partner_sdk/` paths or host test commands in this checkout; those paths/tests are not provided here. No archive build is needed to read or publish Markdown.

## Offline validator and starter

`celloklab-plugin-validate PLUGIN_FOLDER` emits JSON `schema_version`, `ok`, `errors`, `warnings`; exit 0 means no reported errors, exit 1 means errors. The validator checks manifest shape/SDK major, entrypoint syntax/existence, catalog names, containment, bounded CSS policy, optional `ui-declarations.json` and FOUNDATION declarations. It **never imports the entrypoint**, executes Jinja or proves dynamic registration/browser safety or live mounting. Review and host approval/authorization remain mandatory; this is not a sandbox/security guarantee.

CSS must stay scoped to `.partner-*` and use host UI Kit tokens/classes without overriding globals/tokens. Prefer no custom CSS. The bounded stdlib linter is a policy heuristic, not a complete CSS parser. See [UI Style Guide](../docs/PLUGIN_UI_STYLE_GUIDE.md).

The existing [starter](../starter/) demonstrates a page, modal, floating panel, safe `textContent`, local file selection and local email descriptor. It does not send email, upload files or mutate clinical/staff/Case data. Real upload needs `patient.upload_attachments`, authorized scope and host upload policy. Local email source needs exact version/revision/content approval; no HTML variables or Jinja in email files. No private API wrappers are exported.

## Bundled typed interview read/write contract

See [Typed Trichology Interview Contract](../docs/PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md) for all 41 fields, Polish labels, codes and bounds, and [Extended Interview](../docs/TRICHOLOGY_INTERVIEW_EXTENSION.md) for native storage context.

- Existing `patient.read_trichology_record` / `patient.write_trichology_record` grants cover authenticated GET/PATCH on `/api/plugins/{plugin_id}/patients/{patient_id}/trichology?tenant_slug=...`. Current clinical role, active doctor profile/clinic assignment and assigned patient remain mandatory. No new grant or AI prerequisite.
- GET retains top-level legacy/Polish display fields and `field_labels`, adding all 41 typed `interview_values` and Polish `interview_options`. Display captions are not PATCH values.
- PATCH is a nonempty flat dirty-field object. New values are text/null, single codes/null, five coded arrays/null or actual `post_transplant` boolean/null. Omission preserves; null/empty string clears; `[]` clears multi-selects; `false` is valid. Text is bounded to 20000 characters/65535 UTF-8 bytes and arrays to 200 submitted coded strings. Reject encoded arrays, numeric booleans and unknown codes.
- The legacy narrower string-only write allowlist remains unchanged. `notes` and read-only `additional_notes` are separate. `updated_values` exposes submitted fields only, with typed new-field readback.
- The bundled `validate_trichology_interview_updates()` helper validates **new-only** partial updates, normalizes clears/deduplicates arrays, and is not an HTTP client or authorization bypass. Its valid empty dictionary must not be sent as an empty PATCH.
- Send the original revision in `If-Match` (technically optional, strongly recommended). Preserve dirty drafts on 409; explicit compare/merge, no automatic overwrite. Audit, revision and eligible source-change capture remain transactional.

Native interview answers use separate **unencrypted** nullable columns/JSON TEXT lists; encrypted AI jobs/artifacts are separate. Migration 084 is confirmed applied in the inspected deployment and must not be rerun there. The typed bridge needs no new migration, worker, capability, recording/RPL or Case expansion. A read-only plugin adding writing needs reviewed exact manifest-version approval and explicit existing write grant, not blanket reapproval of unchanged valid grants.

## Live interview FOUNDATION — not live execution

See the [live contract](../docs/PLUGIN_LIVE_INTERVIEW_CONTRACT.md) and [browser bridge source](../browser/trichology-form-bridge.js). Public task/session DTOs, pure prompt builders, declaration registration and validation are implemented, alongside host registry/panel/bridge support. There is no live execution/session router, microphone capture, recording consent flow, audio transport, STT, streaming, provider adapter or live billing lifecycle.

`examples/example_live_interview/` registers a real declaration and a panel on `documentation_form` → `tab-wywiad`. Its **„Rozpocznij wywiad z AI” CTA is disabled**. The other button displays only a validated synthetic proposal: no actual provider calls, network, patient reads, clinical writes, acceptance, microphone or browser persistence. It requests `AI`, `ai.live_interview` and card-read authority because of the declaration; it is not a no-AI example and requests no write grant. Normal administrator lifecycle/grant approval, global model/provider availability and independent clinic-admin AI consent still apply.

The bridge uses existing authorized card GET/PATCH, not a new live endpoint. A future editor needs explicit clinician acceptance, separate write authority and the original read revision; conflicts/dirty native forms preserve the draft and block writes rather than rebasing automatically. The synthetic demo never invokes this write path or changes the native form.

## Existing neutral AI reference

The bundled `ai.py` exports `AI_CAPABILITY="AI"`, `AIProtocol.generate(context, user_prompt, idempotency_key)`, `AIResult` and `plugin_ai_feature_id()`. These are trusted in-process contracts, not provider/HTTP clients, credentials, retries or billing bypasses.

The existing [neutral AI demo](../examples/example_ai/README.md) registers an editable page and global right-panel **Uruchom AI** button sending a fixed Polish gardening prompt. Both share transient per-plugin/tenant execution state and paid-call lock in one document; mount never executes AI. It has no clinical access. POST `/api/plugins/{plugin_id}/ai/completion?tenant_slug=...` uses host session, CSRF, UUID `Idempotency-Key` and exactly `{"user_prompt":"..."}` (host max 20000 characters/64 KiB; demo max 1000).

The host owns feature/model/provider/cost and optional system-prompt supplement. Null/blank supplements are omitted. Administrators review pinned source/version and exact `AI` grant, configure the single derived feature, licensing/credits/platform availability and independent clinic consent. Never store provider secrets in plugin source/settings.

Results contain `execution_id`, `status`, `credit_cost`, `charged`, `replayed`, optional first-success `text`. Prompt/output are not stored in execution/idempotency/audit records; replay is metadata-only. Reservation/debit precedes dispatch; definite failure refunds, uncertainty remains pending for manual reconciliation, never automatic redispatch. Preserve exact key/payload; changed payload is 409. See [API Reference](../docs/PLUGIN_API_REFERENCE.md) for authoritative current policy.

## Existing clinical summary reference — distinct from typed editing

Bundled `clinical_ai.py` and [trichology summary demo](../examples/trichology_ai_summary/README.md) expose one builder for exact `trichology.record.changed`, not an event bus/job/clinical-reader/provider API. **`TrichologySnapshot.fields` remains strings/null**, including Polish scalar presentation of approved source fields. This is intentionally separate from the typed editable DTO; do not pass arrays/booleans into the old builder.

The demo requests exactly `AI`, `patient.read_trichology_record`, `ai.trichology_summary`; it shows a Polish, initially collapsed, non-form read-only card at `patient.records.sections`. It never PATCHes the interview or posts arbitrary clinical prompts. The existing JS safely renders text/dates and uses bounded session/CSRF GET polling (30 reads, 2-second intervals) without auto-expansion/generation.

Actual source changes, including clears, enqueue host-owned work transactionally; no-op/AI-output/access changes do not. Current clinical authority is checked before decryption/provider/publication. Host **persists encrypted clinical snapshots/artifacts**, unlike ephemeral neutral output; financial/audit/log records contain no clinical content. Redaction is not anonymity. Stale valid paid results are not refunded merely because source changed; uncertain dispatch remains pending without automatic provider replay.

Administrators approve exact source/version/three grants, confirm only missing reviewed 079/080/081 prerequisites, configure model/provider/feature, licensing/credits and independent clinic consent, and verify the dedicated supervised worker. Docker/Passenger supervision and standalone uvicorn differ; never start a duplicate loop/cron. Dedicated legacy native AI is **removed in the current host**, not pilot-disabled; no obsolete native-disable step remains. Native forms/historical results stay intact. See the administrator/maintenance guides for operational review, not private-host installation commands.

## Preview and verification limits

From the public repository root:

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory preview
```

Open `http://127.0.0.1:8000/`. The preview uses bundled public UI assets and mock feedback: **no real authentication, authorization, API, clinical data, email, upload or provider**. It is not proof of current host styling/catalog parity; fonts use local fallbacks. Browser visual review remains separate.

The public source publication does not claim a rebuilt wheel, host deployment or new host test results from this README edit. Static checks do not establish MariaDB concurrency/schema execution, authenticated browser acceptance, live audio/provider completion or security certification. Existing Case reads remain frozen; employee mutations are permanently excluded and the staff directory stays read-only.

## Licensing

Markdown documentation is [CC BY 4.0](../LICENSES/CC-BY-4.0.txt); code, templates, catalogs and documentation code snippets are [Apache 2.0](../LICENSES/Apache-2.0.txt). See [LICENSE](../LICENSE) and [NOTICE](../NOTICE). These licenses do not publish or license private host modules, trademarks or service access; historical wheels retain their own notices.
