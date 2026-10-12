<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Celloklab Partner Plugin SDK

Public developer guidelines, standalone SDK contracts and reference examples for administrator-reviewed Celloklab plugins. Partners need no private application repository, database credentials or patient data. This is **not** the Celloklab application, a marketplace, an upload installer or a public patient-data API.

## SDK 1.2.2 — stage 2 publication

This checkout publishes standalone **Python SDK 1.2.2** source, catalogs and reference examples, including `trichology.py`, `bookings.py`, `clinical_tasks.py` and `live_interview.py`. Manifest SDK remains **1.0**, browser UI Kit **1.0.0**; the independent **`vision.visit-assistant` plugin is 2.0.0**, not SDK 2.0.0.

Building `sdk/` now produces **1.2.2**. The release owner builds and verifies the current wheel separately; retained **1.2.0 FOUNDATION** and 1.0.0 wheels are historical and do not install the current 1.2.2 contracts. Source publication is not evidence of a GitHub release, deployment or installed-host support. Confirm host compatibility with the platform administrator; private host modules are not published here.

Stage 2 implements host REST sessions, microphone capture, incremental PCM packets, STT followed by text analysis, authorization and one fixed credit fee per bounded session. The independent Vision example supplies callbacks and a Polish proposal panel; the host owns transport, providers, billing and enable/disable. **`example_live_interview` remains a separate synthetic preview**, with start disabled, no audio/provider calls and no clinical writes. The standalone Python SDK is a contract package, not the private host runtime. See the authoritative live contract below.

Audio packets normally cover about **2 seconds**; near-two-second feedback is a goal, **not measured latency or an SLA**. Regular PCM packets require at least **0.5 seconds**; a final tail may contain just **2 bytes**. The host stores no raw audio in the database, but does persist encrypted session snapshots, transcripts, proposals and chunk results. Only explicit clinician acceptance through the existing guarded bridge can write the card. Real HTTPS microphone/browser, provider and production MariaDB acceptance remains unverified.

GitHub is the source/documentation delivery surface: browse this branch and pin its reviewed commit. **No ZIP is required or generated.** The verified 1.2.2 wheel is included; publication does not, configure providers or publish private application code.

## Contents

| Directory | Purpose |
|---|---|
| `docs/` | Technical guides indexed below |
| `sdk/` | Standalone Python SDK 1.2.2, catalogs and offline build backend |
| `wheels/` | Release-owner-built wheels; retained 1.2.0/1.0.0 wheels are historical |
| `starter/` | Existing page, modal, floating panel and declaration examples |
| `examples/example_ai/` | Existing neutral-text AI page and right-panel example |
| `examples/trichology_ai_summary/` | Existing source-change-driven, read-only summary card |
| `examples/example_trichology_interview/` | Synchronized typed interview read/write reference |
| `examples/example_bookings/` | Synchronized booking contract reference |
| `examples/example_live_interview/` | FOUNDATION synthetic proposal preview; live start disabled |
| `examples/vision_visit_assistant/` | Independent Vision 2.0.0 live proposal plugin; requires compatible host runtime |
| `browser/` | Public live audio client, PCM worklet and existing-form bridge |
| `preview/` | Offline UI preview with mock feedback, no real API |
| `LICENSES/` | Full standard license texts |

## Complete documentation index

| Guide | Purpose |
|---|---|
| [Plugin Development Guide](docs/PLUGIN_DEVELOPMENT_SKILL.md) | Development, review, authorization and handoff |
| [API Reference](docs/PLUGIN_API_REFERENCE.md) | Routes, DTOs, grants, headers and safe errors |
| [SDK Release Notes](docs/PLUGIN_SDK_RELEASE.md) | Current contracts, version domains and evidence limits |
| [UI Style Guide](docs/PLUGIN_UI_STYLE_GUIDE.md) | Polish UI and shared UI Kit rules |
| [Page Catalog](docs/PLUGIN_PAGE_CATALOG.md) | Supported page declarations and mounting boundaries |
| [Hook Catalog](docs/PLUGIN_UI_HOOK_CATALOG.md) | Slots, targeting and non-form integration |
| [Email Contract](docs/PLUGIN_EMAIL_CONTRACT.md) | Local-source approval and host-owned delivery |
| [Notification Contract](docs/PLUGIN_NOTIFICATION_CONTRACT.md) | Scoped recipients and notification behavior |
| [Booking Contract](docs/PLUGIN_BOOKING_CONTRACT.md) | Organizational reservations and reception scope |
| [Typed Trichology Interview Contract](docs/PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md) | 76 native fields across 12 sections; compatible 41-field contract, codes, types and concurrency |
| [Live Interview Stage 2 Contract](docs/PLUGIN_LIVE_INTERVIEW_CONTRACT.md) | Runtime sessions, audio, authorization, fixed session fee, retention and acceptance limits |
| [Browser Live Audio Client](browser/live-audio.js) / [PCM Worklet](browser/live-pcm-worklet.js) | Shared host session client and incremental microphone capture; not provider clients |
| [Browser Form Bridge](browser/trichology-form-bridge.js) | Public bridge source; original-revision writes and native-form guards explained in the live contract |
| [Extended Trichology Interview](docs/TRICHOLOGY_INTERVIEW_EXTENSION.md) | Native fields, storage, migration and integration boundaries |
| [Official RPL Catalog Operations](docs/RPL_CATALOG_OPERATIONS.md) | Administrator import, local medicine search and immutable medication snapshots |
| [Administrator Installation Guide](docs/PLATFORM_ADMIN_PLUGIN_INSTALLATION_SKILL.md) | Administrator-only review, manual prerequisites and activation |
| [System Maintenance Guide](docs/PLUGIN_SYSTEM_MAINTENANCE.md) | Host maintenance, workers, diagnostics and reconciliation |

The last two guides are published here as documentation for administrators/maintainers, **not partner runtime permissions or private implementation access**. Any archive exclusions described there concern a separate packaging workflow, not GitHub documentation availability. Start with development and API guides; consult the specific domain contract before using an endpoint. See also [SDK README](sdk/README.md) and the [neutral AI](examples/example_ai/README.md) / [summary](examples/trichology_ai_summary/README.md) sample READMEs.

## Current typed trichology contract (included in SDK 1.2.2)

The extended interview is **not read-only or strings-only**. Existing `patient.read_trichology_record` and `patient.write_trichology_record` grants cover GET/PATCH on `/api/plugins/{plugin_id}/patients/{patient_id}/trichology?tenant_slug=...`, subject to current clinical authority. An active local `specialist` assigned to this patient through `patient_clinic_records.assigned_specialist_id = users.id` (user UUID) needs no `doctors` profile or `doctor_clinic_assignments` (DCA) for these patient-scoped trichology capabilities. Other clinical actors retain doctor-profile/clinic-assignment checks; medical-documentation, visit and Case policies are unchanged. No new grant or AI requirement is introduced.

- GET preserves legacy/top-level Polish display fields and `field_labels`, and adds all 41 typed keys in `record.interview_values` plus code-to-Polish-caption `record.interview_options`.
- Flat, nonempty PATCH submits only dirty fields: text/null, exact choice codes/null, five coded arrays/null and actual boolean/null `post_transplant`. Omitted fields stay unchanged; null/empty-string clears new fields, `[]` clears multi-selects, and `false` is a real answer. Never submit display captions or JSON-encoded arrays.
- The narrower legacy write allowlist remains string-only; `notes` and read-only `additional_notes` remain distinct. `updated_values` returns only submitted fields, with typed new-field readback.
- Send the original GET revision in `If-Match` (legacy optional, strongly recommended). On 409 preserve the draft and compare explicitly; never silently fetch a fresh revision and overwrite.
- Source-change audit/events/revisions remain transactional. The separate AI `TrichologySnapshot.fields` contract **still uses strings/null**; it is not the editable typed DTO. The existing summary demo stays read-only.

See the interview contract for every field, code, bound and clearing rule. Migration 084 is confirmed applied in the inspected deployment; do not rerun it there or assume that fact applies to another deployment. Native interview columns are unencrypted, separate from encrypted AI snapshots/artifacts. Stage 2 live runtime is distinct from typed editing; Case expansion remains out of scope.

## Build, install and validate SDK 1.2.2 locally

Python 3.10 or newer is required. From this repository root, build the current standalone source or use a release-owner-verified 1.2.2 wheel:

```sh
python -m venv .venv
# Linux/macOS; on Windows activate .venv\Scripts\activate instead:
. .venv/bin/activate
python -m pip wheel ./sdk --no-deps --no-build-isolation --no-index -w /tmp/celloklab-wheels
python -m pip install --no-index --no-deps /tmp/celloklab-wheels/celloklab_plugin_sdk-1.2.2-py3-none-any.whl
celloklab-plugin-validate starter
celloklab-plugin-validate examples/example_ai
celloklab-plugin-validate examples/trichology_ai_summary
celloklab-plugin-validate examples/example_trichology_interview
celloklab-plugin-validate examples/example_bookings
celloklab-plugin-validate examples/example_live_interview
celloklab-plugin-validate examples/vision_visit_assistant
```

Offline validation checks declarations/static policy. It never executes a plugin, grants authority, proves browser/security behavior or activates anything. Retained 1.2.0 FOUNDATION and 1.0.0 wheels install only their historical snapshots, not SDK 1.2.2.

Open `preview/index.html` for the offline preview: **no real authentication, API, email, upload, clinical data or provider calls**. Feedback is mock; fonts use local fallbacks.

## Runtime and security boundaries

- All new or maintained user-facing plugin/module/admin UI must be **Polish**, including accessibility, status, errors and output framing. Developer prose and technical identifiers may be English.
- Plugins are reviewed, trusted in-process Python/Jinja/JavaScript, **not a sandbox**. Administrator approval/grants do not replace actor, clinic or patient authorization.
- Never put secrets, patient data, prompts or clinical output in logs, browser persistence or this repository.
- Host administrators own credentials, models/providers, costs, licensing and platform availability. Literal `AI` plugins additionally need independent clinic-admin consent; no-AI plugins do not acquire AI-policy dependencies.
- Vision can be enabled/disabled independently through the existing host plugin lifecycle. Vision execution, including recording, requires an active user/tenant, active local `specialist` role and this patient's assignment through `assigned_specialist_id = users.id` (user UUID), without a `doctors` profile or DCA. Both UI declarations use `roles: ["specialist"]`, `requires_doctor: false`; mixed roles containing `specialist` are allowed, while doctor-only, reception-only and admin-only actors are denied. The exception is limited to patient-scoped trichology read/write; medical-documentation, visit and Case policies are unchanged. Existing `AI`, `ai.live_interview` and `patient.read_trichology_record` grants authorize live execution; `patient.write_trichology_record` remains a separate write gate. No new grant is introduced.
- Stage 2 requires only missing, manually reviewed `088_plugin_live_interviews.sql` after operator approval/backup; confirm existing prerequisites without rerunning old migrations, especially 084. This publication performs no migration, provider configuration or deployment. There is no new live worker.
- Neutral completion text is ephemeral and replay is metadata-only. Clinical summary snapshots/artifacts are separately encrypted and retained by the host; uncertainty stays pending for evidence-based reconciliation without automatic provider replay.
- `trichology.record.changed` is a narrow transactional summary workflow, **not a general event bus or arbitrary job API**.
- Dedicated legacy native AI generation has been removed in the current host; there is no native pilot-disable step. Native clinical forms and historical clinical data remain.
- Existing Case reads are retained and frozen; Case expansion and employee mutations are excluded. The staff directory remains read-only.
- Publication grants no deployment approval or platform access. Installation, missing reviewed manual migrations and worker operation belong to administrators. Never rerun confirmed migrations or start duplicate workers.

## Versions, licensing and feedback

Pin the reviewed source/documentation commit; a changing branch is not a compatibility guarantee or evidence of installed-host support. Historical tests/artifact inventories in release notes concern their stated implementation snapshots, not proof of a rebuilt 1.2.2 wheel, production deployment or live audio/provider acceptance. Current wheel verification and regression results are reported separately by the release owner.

- **Markdown documentation:** [CC BY 4.0](LICENSES/CC-BY-4.0.txt).
- **Code, templates, catalogs and documentation code snippets:** [Apache 2.0](LICENSES/Apache-2.0.txt).

Licenses cover distributed materials, not the private application, trademarks or service access. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Existing bundled wheels retain their own notices.

Use GitHub issues for non-sensitive documentation questions and reproducible defects with synthetic examples. Never post credentials, patient records, clinical prompts/results or private logs. Report security concerns privately to the repository owner.
