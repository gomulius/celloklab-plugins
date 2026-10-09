<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Celloklab Partner Plugin SDK

Public developer guidelines, standalone SDK contracts and reference examples for administrator-reviewed Celloklab plugins. Partners need no private application repository, database credentials or patient data. This is **not** the Celloklab application, a marketplace, an upload installer or a public patient-data API.

## Documentation-only publication: read this first

The documentation describes the inspected current **Python SDK 1.1.0** and host contracts. The default `main` branch retains **older public SDK/code/catalog/demo snapshots at distribution 1.0.0**. Updating Markdown does not update these files or the bundled wheel. Manifest SDK remains **1.0**, browser UI Kit **1.0.0**, and plugin versions are independent.

**Installing or rebuilding this checkout gives SDK 1.0.0, not 1.1.0.** In particular, it does not supply the current `trichology.py` or `bookings.py` modules, typed interview editor or booking demo. References to those additions in technical guides describe current contracts, not files available here. Confirm deployed-host support with the platform administrator before integration. No public 1.1.0 artifact or GitHub release is asserted by this documentation update; do not seek private host access as an installation workaround.

GitHub is the documentation delivery surface: browse this branch and pin its reviewed commit. **No ZIP is required or generated.** SDK 1.1.0 implementation/artifact publication is a separate reviewed release, not part of this docs-only branch.

## Contents

| Directory | Purpose |
|---|---|
| `docs/` | All 14 technical guides indexed below |
| `sdk/` | Older standalone Python SDK 1.0.0, catalogs and offline build backend |
| `wheels/` | Existing SDK 1.0.0 wheel; not a current-contract upgrade |
| `starter/` | Existing page, modal, floating panel and declaration examples |
| `examples/example_ai/` | Existing neutral-text AI page and right-panel example |
| `examples/trichology_ai_summary/` | Existing source-change-driven, read-only summary card |
| `preview/` | Older offline UI preview with mock feedback, no real API |
| `LICENSES/` | Full standard license texts |

## Complete documentation index (14 guides)

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
| [Typed Trichology Interview Contract](docs/PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md) | All 41 new fields, codes, types, read/write and concurrency |
| [Extended Trichology Interview](docs/TRICHOLOGY_INTERVIEW_EXTENSION.md) | Native fields, storage, migration and integration boundaries |
| [Official RPL Catalog Operations](docs/RPL_CATALOG_OPERATIONS.md) | Administrator import, local medicine search and immutable medication snapshots |
| [Administrator Installation Guide](docs/PLATFORM_ADMIN_PLUGIN_INSTALLATION_SKILL.md) | Administrator-only review, manual prerequisites and activation |
| [System Maintenance Guide](docs/PLUGIN_SYSTEM_MAINTENANCE.md) | Host maintenance, workers, diagnostics and reconciliation |

The last two guides are published here as documentation for administrators/maintainers, **not partner runtime permissions or private implementation access**. Any archive exclusions described there concern a separate packaging workflow, not GitHub documentation availability. Start with development and API guides; consult the specific domain contract before using an endpoint. See also [SDK README](sdk/README.md) and the [neutral AI](examples/example_ai/README.md) / [summary](examples/trichology_ai_summary/README.md) sample READMEs.

## Current typed trichology contract (SDK 1.1.0)

The extended interview is **not read-only or strings-only**. Existing `patient.read_trichology_record` and `patient.write_trichology_record` grants cover GET/PATCH on `/api/plugins/{plugin_id}/patients/{patient_id}/trichology?tenant_slug=...`, subject to current clinical role, active doctor profile/clinic assignment and assigned-patient authority. No new grant or AI requirement is introduced.

- GET preserves legacy/top-level Polish display fields and `field_labels`, and adds all 41 typed keys in `record.interview_values` plus code-to-Polish-caption `record.interview_options`.
- Flat, nonempty PATCH submits only dirty fields: text/null, exact choice codes/null, five coded arrays/null and actual boolean/null `post_transplant`. Omitted fields stay unchanged; null/empty-string clears new fields, `[]` clears multi-selects, and `false` is a real answer. Never submit display captions or JSON-encoded arrays.
- The narrower legacy write allowlist remains string-only; `notes` and read-only `additional_notes` remain distinct. `updated_values` returns only submitted fields, with typed new-field readback.
- Send the original GET revision in `If-Match` (legacy optional, strongly recommended). On 409 preserve the draft and compare explicitly; never silently fetch a fresh revision and overwrite.
- Source-change audit/events/revisions remain transactional. The separate AI `TrichologySnapshot.fields` contract **still uses strings/null**; it is not the editable typed DTO. The existing summary demo stays read-only.

See the interview contract for every field, code, bound and clearing rule. Migration 084 is confirmed applied in the inspected deployment; do not rerun it there or assume that fact applies to another deployment. Native interview columns are unencrypted, separate from encrypted AI snapshots/artifacts. Recording/transcription/RPL and Case expansion are out of scope.

## Install and validate the bundled older snapshot locally

Python 3.10 or newer is required. From this repository root (these commands install **1.0.0 only**):

```sh
python -m venv .venv
# Linux/macOS; on Windows activate .venv\Scripts\activate instead:
. .venv/bin/activate
python -m pip install --no-index --no-deps wheels/celloklab_plugin_sdk-1.0.0-py3-none-any.whl
celloklab-plugin-validate starter
celloklab-plugin-validate examples/example_ai
celloklab-plugin-validate examples/trichology_ai_summary
```

Offline validation checks the bundled older declarations/static policy, not all new 1.1.0 contracts. It never executes a plugin, grants authority, proves browser/security behavior or activates anything. Rebuilding the existing public sources also yields 1.0.0:

```sh
python -m pip wheel ./sdk --no-deps --no-build-isolation --no-index -w /tmp/celloklab-wheels
```

Open `preview/index.html` for the older offline preview: **no real authentication, API, email, upload, clinical data or provider calls**. Feedback is mock; fonts use local fallbacks.

## Runtime and security boundaries

- All new or maintained user-facing plugin/module/admin UI must be **Polish**, including accessibility, status, errors and output framing. Developer prose and technical identifiers may be English.
- Plugins are reviewed, trusted in-process Python/Jinja/JavaScript, **not a sandbox**. Administrator approval/grants do not replace actor, clinic or patient authorization.
- Never put secrets, patient data, prompts or clinical output in logs, browser persistence or this repository.
- Host administrators own credentials, models/providers, costs, licensing and platform availability. Literal `AI` plugins additionally need independent clinic-admin consent; no-AI plugins do not acquire AI-policy dependencies.
- Neutral completion text is ephemeral and replay is metadata-only. Clinical summary snapshots/artifacts are separately encrypted and retained by the host; uncertainty stays pending for evidence-based reconciliation without automatic provider replay.
- `trichology.record.changed` is a narrow transactional summary workflow, **not a general event bus or arbitrary job API**.
- Dedicated legacy native AI generation has been removed in the current host; there is no native pilot-disable step. Native clinical forms and historical clinical data remain.
- Existing Case reads are retained and frozen; Case expansion and employee mutations are excluded. The staff directory remains read-only.
- Publication grants no deployment approval or platform access. Installation, missing reviewed manual migrations and worker operation belong to administrators. Never rerun confirmed migrations or start duplicate workers.

## Versions, licensing and feedback

Pin the reviewed documentation commit; a changing branch is not a compatibility guarantee or evidence of installed-host support. Historical tests/artifact inventories in release notes concern their stated implementation snapshots, not tests or a rebuilt release from this docs-only checkout.

- **Markdown documentation:** [CC BY 4.0](LICENSES/CC-BY-4.0.txt).
- **Code, templates, catalogs and documentation code snippets:** [Apache 2.0](LICENSES/Apache-2.0.txt).

Licenses cover distributed materials, not the private application, trademarks or service access. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Existing bundled wheels retain their own notices.

Use GitHub issues for non-sensitive documentation questions and reproducible defects with synthetic examples. Never post credentials, patient records, clinical prompts/results or private logs. Report security concerns privately to the repository owner.
