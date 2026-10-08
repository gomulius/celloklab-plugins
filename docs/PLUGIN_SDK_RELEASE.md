# SDK contract status and GitHub publication

## Authoritative contract versus public source snapshot

This documentation describes implemented, committed host behavior reviewed at commit `8c390880ac8f8fbddcf367b3d5d6d9218c12f785`. It is not a GitHub release announcement, artifact certificate or production acceptance report.

The committed host's standalone Python SDK declares **1.1.0** consistently in its package, packaging metadata and standard-library build backend. Manifest compatibility remains **SDK `1.0`**; browser UI Kit remains **`1.0.0`**. These are separate version domains.

The public repository's checked-in `sdk/` source, packaging metadata and included wheel are still the **1.0.0 snapshot**. That snapshot does not include `trichology.py`, `bookings.py`, `examples/example_trichology_interview/` or `examples/example_bookings/`. Updating documentation does not upgrade those files or publish a 1.1.0 wheel. Do not claim those missing examples are present, import the new helpers from the old snapshot, or infer a release/tag/download URL. Source publication/version synchronization is a separate, reviewed task.

## GitHub-first partner workflow

Use the public GitHub repository as the entry point: review a pinned commit, read [PLUGIN_DEVELOPMENT_SKILL.md](PLUGIN_DEVELOPMENT_SKILL.md), inspect the actual `sdk/`, `starter/`, `examples/` and `preview/` inventory, and install only the version present in that pinned source. No generated partner ZIP is required or generated for this documentation update. No private host checkout, installation skill, database credentials or migrations are partner prerequisites.

Public SDK contracts are standard-library-only context/registrar/UI/protocol/catalog/validation definitions, not HTTP clients, database adapters, private Request exports or a sandbox. The existing offline preview has no real API/authentication/authorization/upload/email/provider. Its mock toast and fallback fonts are not production visual parity; older snapshot UI strings are not evidence of compliance with the current Polish UI mandate.

## Implemented additions

### Typed trichology interview

GET retains legacy and Polish scalar display fields and adds all **41** typed `interview_values` plus `interview_options` and labels. Flat PATCH adds those 41 fields alongside the unchanged narrower legacy string-only allowlist. Omission preserves; new null/empty values clear; empty arrays clear selections; `false` is a valid answer. Only submitted fields are returned in typed write readback. Exact types, all choices, limits, authority, revisions and safe draft handling are in [PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md](PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md).

The host-independent 1.1.0 module exports constants/catalogs, `TrichologyInterviewUpdates` and `validate_trichology_interview_updates`. Existing `patient.read_trichology_record` and `patient.write_trichology_record` grants suffice; a plugin newly requesting writes needs explicit write approval and exact manifest-version review, not a new capability or blanket reset of unchanged grants. Current clinical role, active doctor profile/clinic assignment and assigned-patient scope remain mandatory. Legacy-optional `If-Match` is strongly recommended; conflicts and uncertain writes must preserve dirty input, not silently overwrite.

The committed host reference is `example.trichology-interview` version **1.0.0**. It uses unnamed, dynamically created non-form controls, separate PATCH, native-dirty blocking, submitted-field-only native synchronization and preservation of edits made during the request. Denial clears displayed clinical data and disables editing while retaining only user-dirty fields in transient memory; restoration requires an authorized reread and explicit confirmation. It is not yet present under public `examples/`. Native interview columns are nullable and unencrypted; encrypted AI snapshots/artifacts are separate. The bridge needs no additional migration, worker, AI grant, recording/transcription/RPL or Case expansion. Migration 084 is user-confirmed applied for the referenced deployment and must not be rerun; this source audit does not independently verify schema state.

### Organizational bookings

The implemented host adds six least-privilege capabilities and organizational routes while retaining patient visit routes. Anonymous busy intervals, contact reservations, same-visit patient attachment, date-only rescheduling, cancellation, duration snapshots and real overlap checks are documented in [PLUGIN_BOOKING_CONTRACT.md](PLUGIN_BOOKING_CONTRACT.md). Its public protocol/reference example remain absent from the checked-in 1.0.0 snapshot. Current actor/grant revalidation and a supported core `authorization_guard` are required; missing support fails closed. Guests do not gain clinical records or accounts.

### UI, messaging and AI

Implemented browser bridges cover patient/visit reads and allowed writes, media, care plans, clinic profile/services/read-only staff, bell notifications, approved local-source email/Resend jobs, neutral AI and the narrow clinical trichology summary. Follow [PLUGIN_API_REFERENCE.md](PLUGIN_API_REFERENCE.md), [PLUGIN_UI_HOOK_CATALOG.md](PLUGIN_UI_HOOK_CATALOG.md), [PLUGIN_UI_STYLE_GUIDE.md](PLUGIN_UI_STYLE_GUIDE.md), [PLUGIN_NOTIFICATION_CONTRACT.md](PLUGIN_NOTIFICATION_CONTRACT.md) and [PLUGIN_EMAIL_CONTRACT.md](PLUGIN_EMAIL_CONTRACT.md).

All maintained user-facing UI must be Polish; IDs/codes and English developer prose remain unchanged. Every plugin requesting literal `AI` requires platform activation and independent clinic-admin opt-in for clinic-facing visibility; current grants/licensing/availability/credits and runtime authority remain separate. No-AI plugins acquire no AI dependency. Neutral completion reserves credits before dispatch, returns first-success text only, and replays metadata only; uncertain dispatch remains pending for reconciliation without automatic provider replay. Clinical automation separately persists encrypted snapshots/artifacts and uses transaction-bound source changes, current assigned-patient authority, bounded worker attempts and no redispatch after a committed dispatch fence. Neither redaction nor encryption guarantees anonymity or production acceptance.

Existing Case reads remain **implemented, preserved and frozen**. No Case/physician-document expansion, staff mutation, arbitrary table export, general event bus/job API, marketplace installer or external API-key runtime is introduced.

## Static source allowlists and publication limits

The inspected host packaging source explicitly lists `trichology.py` and `bookings.py` among the 15 public package files. Its legacy bundle script lists 10 public guides, the starter, neutral AI example, clinical summary example, six-file typed interview example and six-file booking example. This is source-level allowlist evidence only: the script was not run, and no archive/wheel inventory, checksum, isolated installation or test pass is claimed here. `TRICHOLOGY_INTERVIEW_EXTENSION.md` is not in that legacy script's guide allowlist. GitHub documentation is not defined by that historical ZIP allowlist.

Private installation/maintenance instructions, private host/configuration, migrations, environment files, logs, audit/patient data and unlicensed third-party fonts must never be copied into a partner artifact merely because a builder exists. Administrator operational work remains separate from partner development.

The host page catalog and its SDK copy currently agree with the exact committed template inventory. The public SDK JSON remains stale; the corrected Markdown inventory identifies that difference in [PLUGIN_PAGE_CATALOG.md](PLUGIN_PAGE_CATALOG.md). Catalog entries do not prove a live mount or authorize data.

## Verification boundary

This pass performs read-only committed-source/AST checks for field names/types/labels/options, legacy allowlists, endpoint method/path coverage, capabilities, hooks, page inventory, version metadata and packaging source allowlists, plus Markdown link/diff checks. Historical suite and ZIP counts from earlier documents are not current release evidence and are intentionally not repeated as newly run results.

No SDK/host code, JSON, packaging metadata, wheel or ZIP is modified or generated. No build, migration, provider call, authenticated browser test, MariaDB concurrency test, commit or push is performed. Release/integration owners must separately attach actual version-synchronized source, test commands/results and immutable publication identity. Source and static documentation checks do not establish production schema application, live provider delivery, browser geometry/accessibility or security certification.
