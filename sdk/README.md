# Celloklab partner SDK — current contracts and bundled snapshot

## Version and publication boundary

The [repository documentation](../README.md) describes inspected current **Python distribution 1.1.0** contracts. The `sdk/` source, metadata, catalogs, build backend and `wheels/` artifact in this docs-only branch remain an **older 1.0.0 snapshot**. **Installing or rebuilding this public checkout does not provide 1.1.0.** Manifest SDK stays `1.0`, browser UI Kit stays `1.0.0`; demo versions are separate.

Current 1.1.0 adds host-independent `trichology.py` catalogs/typed-update validation and `bookings.py` contracts. Neither module nor the associated interview/booking demos is bundled here. Technical documentation of these additions is not evidence of a public wheel/release or an instruction to access private host sources. Obtain implementation compatibility confirmation through the platform administrator and use a separately reviewed public artifact when one is actually published. No public 1.1.0 download is claimed here.

GitHub branch/commit documentation is the delivery surface. **No ZIP is required or generated for this update.** See the [13-guide index](../README.md#complete-documentation-index-13-guides), [release notes](../docs/PLUGIN_SDK_RELEASE.md), [administrator installation guide](../docs/PLATFORM_ADMIN_PLUGIN_INSTALLATION_SKILL.md) and [maintenance guide](../docs/PLUGIN_SYSTEM_MAINTENANCE.md). Published administrative prose does not distribute private host implementation or grant runtime authority.

## Mandatory Polish UI and AI consent

All new or maintained module/plugin user-facing UI, including administrator screens, must be **Polish**: titles/navigation, labels/buttons/help/placeholders/tooltips, accessibility names, loading/status/errors/validation, confirmations/toasts/notifications and output framing. Developer prose may be English; IDs/API fields/safe codes remain unchanged. Translate wire states and show boolean flags as „tak”/„nie”; never expose raw exceptions. This is not a claim that unrelated legacy UI is translated.

Every plugin requesting literal `AI` is hidden on clinic-facing surfaces until platform-global availability and explicit local clinic-admin opt-in. Current version/grants, model/provider readiness, licensing and credits are independent gates; authorized setup consoles remain available. No-AI plugins retain normal role/page rules without AI dependencies. Existing settings are not clinic consent. Administrators apply only missing reviewed prerequisites; migration 080 supplies default-off consent beside ledger 079, never automatic backfill or a rerun of confirmed SQL.

## Install or rebuild the older public 1.0.0 snapshot

Python 3.10+ is required. The standalone package has no third-party runtime/build dependencies, database configuration, private Request export or `app` imports. From the **public repository root**, not a private host tree:

```sh
python -m venv /tmp/celloklab-partner
/tmp/celloklab-partner/bin/python -m pip install --no-index --no-deps wheels/celloklab_plugin_sdk-1.0.0-py3-none-any.whl
/tmp/celloklab-partner/bin/celloklab-plugin-validate starter
/tmp/celloklab-partner/bin/celloklab-plugin-validate examples/example_ai
/tmp/celloklab-partner/bin/celloklab-plugin-validate examples/trichology_ai_summary
```

Optional wheel rebuild, still **1.0.0**:

```sh
python -m pip wheel ./sdk --no-deps --no-build-isolation --no-index -w /tmp/celloklab-wheels
```

The stdlib PEP 517 backend selects only the bundled public module. Do not use host-only `partner_sdk/` paths or host test commands in this checkout; those paths/tests are not provided here. No archive build is needed to read or publish Markdown.

## Offline validator and starter

`celloklab-plugin-validate PLUGIN_FOLDER` emits JSON `schema_version`, `ok`, `errors`, `warnings`; exit 0 means no reported errors, exit 1 means errors. The bundled older validator checks manifest shape/SDK major, entrypoint syntax/existence, catalog names, containment, bounded CSS policy and optional `ui-declarations.json`. It **never imports the entrypoint**, executes Jinja or proves dynamic registration/browser safety. Its old catalogs do not establish full 1.1.0 validation or live mounting. Review and host approval/authorization remain mandatory; this is not a sandbox/security guarantee.

CSS must stay scoped to `.partner-*` and use host UI Kit tokens/classes without overriding globals/tokens. Prefer no custom CSS. The bounded stdlib linter is a policy heuristic, not a complete CSS parser. See [UI Style Guide](../docs/PLUGIN_UI_STYLE_GUIDE.md).

The existing [starter](../starter/) demonstrates a page, modal, floating panel, safe `textContent`, local file selection and local email descriptor. It does not send email, upload files or mutate clinical/staff/Case data. Real upload needs `patient.upload_attachments`, authorized scope and host upload policy. Local email source needs exact version/revision/content approval; no HTML variables or Jinja in email files. No private API wrappers are exported.

## Current typed interview read/write contract (1.1.0; module not bundled)

See [Typed Trichology Interview Contract](../docs/PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md) for all 41 fields, Polish labels, codes and bounds, and [Extended Interview](../docs/TRICHOLOGY_INTERVIEW_EXTENSION.md) for native storage context.

- Existing `patient.read_trichology_record` / `patient.write_trichology_record` grants cover authenticated GET/PATCH on `/api/plugins/{plugin_id}/patients/{patient_id}/trichology?tenant_slug=...`. Current clinical role, active doctor profile/clinic assignment and assigned patient remain mandatory. No new grant or AI prerequisite.
- GET retains top-level legacy/Polish display fields and `field_labels`, adding all 41 typed `interview_values` and Polish `interview_options`. Display captions are not PATCH values.
- PATCH is a nonempty flat dirty-field object. New values are text/null, single codes/null, five coded arrays/null or actual `post_transplant` boolean/null. Omission preserves; null/empty string clears; `[]` clears multi-selects; `false` is valid. Text is bounded to 20000 characters/65535 UTF-8 bytes and arrays to 200 submitted coded strings. Reject encoded arrays, numeric booleans and unknown codes.
- The legacy narrower string-only write allowlist remains unchanged. `notes` and read-only `additional_notes` are separate. `updated_values` exposes submitted fields only, with typed new-field readback.
- The current `validate_trichology_interview_updates()` helper validates **new-only** partial updates, normalizes clears/deduplicates arrays, and is not an HTTP client or authorization bypass. Its valid empty dictionary must not be sent as an empty PATCH. It cannot be imported from this bundled 1.0.0 SDK.
- Send the original revision in `If-Match` (technically optional, strongly recommended). Preserve dirty drafts on 409; explicit compare/merge, no automatic overwrite. Audit, revision and eligible source-change capture remain transactional.

Native interview answers use separate **unencrypted** nullable columns/JSON TEXT lists; encrypted AI jobs/artifacts are separate. Migration 084 is confirmed applied in the inspected deployment and must not be rerun there. The typed bridge needs no new migration, worker, capability, recording/RPL or Case expansion. A read-only plugin adding writing needs reviewed exact manifest-version approval and explicit existing write grant, not blanket reapproval of unchanged valid grants.

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

Open `http://127.0.0.1:8000/`. The older preview uses bundled public UI assets and mock feedback: **no real authentication, authorization, API, clinical data, email, upload or provider**. It is not proof of current host styling/catalog parity; fonts use local fallbacks. Browser visual review remains separate.

This documentation update does not publish new implementation, build artifacts or claim host test results. Static checks do not establish MariaDB concurrency/schema execution, authenticated browser acceptance, live provider completion or security certification. Existing Case reads remain frozen; employee mutations are permanently excluded and the staff directory stays read-only.
