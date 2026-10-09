# Plugin browser API reference — SDK 1.0

## Organizacyjne rezerwacje recepcji

Nowe oddzielne `/api/plugins/{plugin_id}/bookings` i sześć najmniejszych grantów, DTO, nagłówki `Idempotency-Key`/`If-Match`, anonimowa dostępność, przypisanie pacjenta do tej samej wizyty oraz granice kliniczne opisuje **[PLUGIN_BOOKING_CONTRACT.md](PLUGIN_BOOKING_CONTRACT.md)**. Zachowane ścieżki pacjenta nie dodają gości do klinicznych odczytów. Odpowiedzi istniejących wizyt/scheduling/rescheduling/cancellation dodają zgodnie wstecznie `duration_minutes` i `visit_end`; katalog scheduling-options dodaje czas, a sprawdzanie kolizji używa rzeczywistych przedziałów, nie tylko identycznych początków. Starsze wzmianki o exact-start opisują poprzedni etap, nie aktualny kontrakt.

## RPL medications and native interview layout

The legacy `medication_list` plugin field still travels as a **JSON-encoded string**, not an array. Structured items allow `name`, `dose`, `schedule`, optional `frequency`, `since`, and `rpl_id`, `import_id`, `catalog_date`, `strength`, `form`, `substance`; canonical stored metadata values are strings. The host validates official selections after clinical authorization and scoped row locking. New IDs resolve against the current import, not client-supplied metadata; existing selected IDs retain their trusted historical snapshot. Exact legacy names may be preserved while regimen fields are edited; adding/renaming name-only medication is rejected. Historical non-JSON text can be retained exactly or explicitly cleared. No automatic legacy mapping or supplements catalog is introduced; product strength is not patient dose. See [the medication contract](PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md#medication-snapshots-legacy-wire-host-validated-rpl-selection) for item/byte bounds and clears.

There is **no generic plugin RPL search capability or endpoint**. Native clinician-only `GET /api/rpl/products` is not an approved SDK route; plugins must not bypass the facade through core APIs. This addition does not expand SDK exports or physician Case functionality. Host-admin RPL operations require separate manual migration 086, never a rerun of confirmed 084; see [RPL operations](RPL_CATALOG_OPERATIONS.md).

Eligible trichology plugin fragments remain above native sections 1–10 (complaint, history, scalp, hair/care, medications/supplements, hormonal/general, transplant/treatment, allergies, lifestyle, scales), followed by family history, visit recommendations and a separate trichologist note. Accessible disclosures start collapsed except section 1; expand/collapse-all also covers the note. Native styles and form/save behavior remain in use.

## Mandatory Polish UI and explicit clinic AI approval

Every new or maintained platform module/plugin, including partner and administrative UI, must present **all user-facing strings in Polish**: titles/navigation, labels/buttons/help/placeholders/tooltips, accessibility names (`aria-label`, `title`), loading/status/errors/validation, confirmations/toasts/notifications and generated-output framing. Developer prose may remain English; internal IDs/API fields/capability names/stable codes stay unchanged. Map wire states to Polish (`pending` → „oczekujące”, `succeeded` → „zakończone pomyślnie”, `failed` → „nieudane”); display `charged`/`replayed` as „tak”/„nie”. Never display raw exceptions. This mandate does not claim unrelated legacy UI was translated by this release.

**Every plugin requesting literal `AI` is hidden on all clinic-facing surfaces until platform-global activation and explicit opt-in by that clinic's local administrator.** This covers navigation, direct own pages, hooks/widgets/panels/modals/floating surfaces, including non-AI content in that plugin. Missing approval/schema fails closed; runtime/replay authority remains independently enforced. Authorized platform/clinic management consoles remain available for setup. No-AI plugins keep existing role/page/plugin rules in every eligible clinic, with no AI settings/license/activation dependency. Disabled, discovered, failed and incompatible plugins are absent from all operational AI catalogs, including platform configuration/credits/license lists and clinic management sales entries. Catalogs refresh lifecycle state before feature transactions; direct configuration/activation of disabled entries is denied. Only the host plugin lifecycle administration retains disabled records for re-enablement. Hidden settings, license assignments and financial evidence remain unchanged and reappear only after explicit enablement; saving visible tier selections cannot erase hidden assignments.

Manual migration **080** adds default-off `tenant_plugin_ai_activations` beside ledger migration 079. No automatic backfill: existing `tenant_ai_feature_settings` or global configuration is not clinic approval. Each clinic administrator must explicitly re-enable each AI-requesting plugin. Current grants and generation licensing/settings/credits remain independent gates. The PA per-clinic availability switch (`tenant_ai_feature_settings.is_active`) is distinct from clinic opt-in: an explicit off setting overrides tier/manual entitlement and blocks operational plugin UI and runtime. PA sees platform availability, not substituted clinic consent. TA management lists may show locked sales entries with red Polish license-denial text and disabled checkboxes, after available modules; Readiness diagnostics report fixed safe reasons for missing configuration, disabled plugin/model/provider, revoked AI grant, version mismatch or an unconfirmed policy read. Insufficient credits are a separate execution condition, not missing access/readiness: the consent checkbox remains usable and the warning shows effective cost and known remaining balance. Unknown/invalid balances never masquerade as zero or provider failure; zero-cost overrides remain zero. Reads never grant access, activate plugins or debit credits.

This reference describes implemented host runtime routes, not hypothetical methods derived from capability names. The standalone Python package exports contracts/catalogs/validation, **not HTTP wrappers, database clients or private Request objects**.

## Common contract

All paths below are relative to **`/api/plugins/{plugin_id}`** and require query parameter **`tenant_slug`**. The host resolves the authenticated browser session, active clinic membership and enabled/approved plugin state. Use same-origin requests with host session cookies and the host CSRF mechanism. These routes are not an external public API and have no partner API-key authentication. Asset/page registration does not grant data authority.

Success JSON is `{ "plugin_id": "…", "<key>": <value> }`; the tables name the actual payload key, not a universal `data` envelope. Media binary endpoints return bytes, not JSON. Most successes are 200; uploads are 201 and email enqueue is 202. Lists do not promise a total count; paginate using the documented limit/offset. Errors normally use `{"detail":{"code":"…","message":"…"}}`; authentication/context and framework validation can have different `detail` shapes. Handle status and safe codes, not raw exception strings.

Authorization shorthand:

| Scope | Implemented authority, independently of capability grants |
|---|---|
| Basic | Active local reception role, or clinical role (`doctor`, `specialist`, `trichologist`, `medical_staff`). Clinical actors need active doctor profile + active clinic assignment and are assigned-patient scoped, even with an additional reception/admin role. Pure tenant/platform administrator, finance/customer roles do not grant this access. |
| Clinical | Clinical roles/profile/assignment as above; assigned patient for clinical records, media and care plans; own doctor visit for full-visit reads/writes. |
| Reception scheduling | Literal active local `reception_staff` required. Mixed clinical/reception actors retain assigned-patient and own-provider restrictions. Minimal appointment data only, not clinical notes. |
| Clinic admin | Active local `tenant_admin`; platform/global role or super-admin flag alone is insufficient. |
| Self messaging | Active local staff membership, current plugin/version/grant; recipient is the session actor. No clinician doctor-assignment requirement is inferred for messaging. |
| Staff messaging | Self checks plus local `tenant_admin` sender; recipient is active same-clinic staff. No arbitrary addresses, patient/customer recipients or cross-clinic sends. |
| Plugin AI | Active local staff, current approved/enabled plugin/version and literal `AI` grant; configured globally active host AI feature/model/provider, explicit local clinic-admin opt-in, tenant AI licensing/entitlement and sufficient credits. Legacy tenant settings are not clinic consent. No patient fetch or clinical authority is inferred; no doctor-profile/assignment requirement is inferred from neutral text generation. |
| Case | Separate frozen Case relationship policy described below; do not apply the general assigned-patient matrix to Case reads. |

A grant is necessary, not sufficient. Server-side role/assignment checks cannot be widened using `dashboard_type`, page IDs or client IDs. `patient_clinic_records.assigned_specialist_id` is a **user ID**; `doctor_id` is a **doctor profile ID**.

Header notation: **M** = required `If-Match` with the revision from that resource's read; **O** = optional legacy `If-Match` (strongly recommended); **I** = required `Idempotency-Key`, canonical UUID string. Quoted revisions are accepted; never synthesize or share revisions across domains. Missing required preconditions usually produce 428; stale revisions produce 409. Legacy O routes permit missing revision, so do not claim universal concurrency protection. For I routes, reuse the same key only for the same intended payload; changed payload under a consumed key yields 409. Replayed requests remain subject to current authority. Upload is not idempotent.

## Patients and clinic records

| Method | Relative path | Capability | Scope | Headers | JSON key / query |
|---|---|---|---|---|---|
| GET | `/patients/search` | `patient.search` | Basic | — | `patients`; required `q`, `limit=10`, clamped 1–20; trimmed query under 2 chars returns empty list |
| GET | `/patients/{patient_id}/identity` | `patient.read_identity` | Basic | — | `patient` |
| PATCH | `/patients/{patient_id}/identity` | `patient.write_identity` | Basic | O | `result` |
| GET | `/patients/{patient_id}/contact` | `patient.read_contact` | Basic | — | `patient` |
| PATCH | `/patients/{patient_id}/contact` | `patient.write_contact` | Basic | O | `result` |
| GET | `/patients/{patient_id}/trichology` | `patient.read_trichology_record` | Clinical | — | `record` |
| PATCH | `/patients/{patient_id}/trichology` | `patient.write_trichology_record` | Clinical | O | `result` |

Search items: `patient_id`, `name`, `surname`. Identity: `patient_id`, `name`, `surname`, `birthdate`, `gender`, `revision`. Contact: `patient_id`, `phone`, `email`, `address`, `revision`. Patch requires at least one supported field; identity fields are `name`, `surname` (maximum 255), `birthdate`, `gender`; contact fields are `phone`, `email`, `address`. JSON null is accepted by the route models but persistence/domain rules still apply. These legacy Pydantic route models ignore extra fields rather than promising strict extra-field rejection; clients must send only the contract fields. Update results include `patient_id`, `updated_fields`, `updated_values`, `revision`. Duplicate surnames are allowed; email uniqueness is clinic-scoped. No patient creation/deletion, reassignment, consent/security or ownership fields are exposed.

Trichology read includes `record_id`, `patient_id`, `tenant_id`, `revision` and these fields:

`medication_list`, `supplements_list`, `allergens`, `allergies`, `allergies_details`, `allergic_reactions`, `cosmetic_allergies`, `diseases`, `chronic_diseases`, `chronic_diseases_other`, `surgeries`, `other_conditions`, `peeling_type`, `peeling_frequency`, `uses_peeling`, `peeling_details`, `shampoo_name`, `shampoo_brand`, `shampoo_frequency`, `current_shampoo`, `uses_minoxidil`, `minoxidil_details`, `hair_styling`, `styling_details`, `hair_density`, `hair_thickness`, `treatment_type`, `treatment_duration`, `treatment_details`, `treatments`, `other_treatments`, `scalp_history`, `trichology_treatments`, `habits`, `habits_details`, `diet`, `diet_details`, `physical_activity`, `activity_details`, `sleep_hours`, `sleep_quality`, `work_stress`, `life_stress`, `family_hair_loss`, `family_hair_loss_details`, `family_genetic_diseases`, `family_skin_diseases`, `notes`, `additional_notes`.

The **unchanged narrower legacy write allowlist** is `medication_list`, `supplements_list`, `allergies`, `allergies_details`, `diseases`, `chronic_diseases`, `surgeries`, `other_conditions`, `treatment_type`, `treatment_duration`, `treatment_details`, `trichology_treatments`, `notes`. Only those legacy values must remain strings up to 20000 characters; empty string clears and legacy null is rejected. PATCH additionally allows **all 41 typed new interview fields** in the flat body. Their exact types, all codes/Polish captions and limits are in **[PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md](PLUGIN_TRICHOLOGY_INTERVIEW_CONTRACT.md)**. Unknown/unsupported fields and empty updates reject. For new fields null/empty text clears, `[]` clears multi-selects, `false` is valid and omitted fields remain unchanged.

Read `record` retains top-level legacy/display fields and `field_labels`, adding `interview_values` with all 41 typed codes/arrays/boolean-or-null/text-or-null and `interview_options` with Polish captions. Never edit by round-tripping the display strings. Result adds `record_id` to the usual update fields; `updated_values` contains only submitted fields, with new fields returned typed, not an unrequested clinical snapshot. Existing clinic record only: no auto-create or physician Case-document writes. Existing read/write capabilities suffice; adding a write request to a read-only plugin requires exact manifest-version review and explicit write approval, not a new capability or blanket reapproval of unchanged grants. Current clinical profile/clinic assignment and assigned-patient authorization, transaction-bound audit/events/revision remain mandatory. `If-Match` remains technically optional but strongly recommended; on 409 retain dirty input and explicitly compare current data, never silently overwrite. There is no general AI webhook/event bus; approved source writes additionally support the narrow transactional `trichology.record.changed` automation below.

`patient_clinic_records.notes` is **Notatka trychologa**, a clinical note in the trichology tab. `additional_notes` is **Dodatkowe informacje**, the separate information field shared with reception; it is readable under this clinical API but is not in its write allowlist. Do not copy, merge or rename one into the other. Existing values in both fields, including historical `notes`, are preserved; this separation requires no new column, migration or capability. Both fields already belong to the summary source snapshot and revision. A notes-only change or clear advances the source version, queues eligible AI work and makes the previous artifact noncurrent; a no-op does not. Both values pass through the existing host redaction boundary before the provider, without an anonymity guarantee.

## Visits and reception scheduling

| Method | Relative path | Capability | Scope | Headers | JSON key / query |
|---|---|---|---|---|---|
| GET | `/visits/today` | `visits.read_today` | Basic | — | `visits`; `dashboard_type=doctor` hint, authority determines actual scope; maximum 100 |
| GET | `/visits/{visit_id}` | `visits.read_full` | Clinical / own visit | — | `visit`; `dashboard_type=reception` does not widen access |
| PATCH | `/visits/{visit_id}` | `visits.write` | Clinical / own visit | O | `visit` |
| GET | `/patients/{patient_id}/visits/scheduling-options` | `visits.read_scheduling_options` | Reception scheduling | — | `options` |
| POST | `/patients/{patient_id}/visits/schedule` | `visits.schedule` | Reception scheduling | I | `result` |
| GET | `/patients/{patient_id}/visits/{visit_id}/appointment` | `visits.reschedule` | Reception scheduling | — | `appointment` |
| POST or PATCH | `/patients/{patient_id}/visits/{visit_id}/reschedule` | `visits.reschedule` | Reception scheduling | M | `appointment` |
| GET | `/patients/{patient_id}/visits/{visit_id}/cancellation` | `visits.cancel` | Reception scheduling | — | `appointment` |
| POST | `/patients/{patient_id}/visits/{visit_id}/cancel` | `visits.cancel` | Reception scheduling | M | `appointment`; body exactly `{}` |

Today summaries: `visit_id`, `patient_id`, `patient_name`, `patient_surname`, `visit_date`, `visit_type`, `status`, `revision`. Full DTO additionally contains `doctor_id`, `purpose`, `diagnosis`, `treatments`, `recommendations`, `notes`, `images`, `cost`, `paid_amount`, `tenant_id`, `created_at`, `updated_at`. Legacy PATCH accepts `visit_date`, `visit_type` (max 100), `status` (max 50), `purpose`, `diagnosis`, `treatments`, `recommendations`, `notes`, `images`, `cost` (nonnegative float), at least one field. Nullable route-model values remain subject to storage constraints; extra fields are ignored by this legacy model. Prefer dedicated scheduling routes for appointment lifecycle; full-visit patch is not a replacement for their collision/reservation logic.

Scheduling-options DTO: `providers` (`doctor_id`, `display_name`, `allowed_visit_types`), `plan_treatments` (`clinic_treatment_id`, `name`, `visit_type`), `catalog_treatments` (`treatment_id`, `name`, `visit_type`, `duration_minutes`), `truncated`, `time_convention="native_local_naive"`, `availability="not_provided"`, `collision_check="duration_overlap"`. Each option list is capped at 100. This patient-specific options endpoint provides catalog duration, but not calendar intervals or working hours; use the separately granted organizational booking availability endpoint for anonymous all-day busy intervals. Unknown or unsupported treatment/type combinations must not be guessed.

Schedule body: required `doctor_id` UUID, `visit_date` local ISO string `YYYY-MM-DDTHH:MM[:SS]` (no timezone), `visit_type` one of `konsultacja`, `zabieg`, `inne`; optional positive strict integer `treatment_id` or `clinic_treatment_id`. Clinic-plan treatment requires `zabieg` and excludes `treatment_id`; catalog treatment excludes `inne`. Future date/provider/catalog/quantity and person-wide duration-overlap collision checks apply. Ownership/status/clinical fields and extras are rejected. Reschedule accepts **only** `visit_date`, keeps provider/type/clinical data and stored duration unchanged and uses the appointment revision. Cancellation uses its own revision/read DTO, writes reception cancellation state and preserves core treatment lifecycle semantics; it is not visit deletion and does not promise patient messaging.

## Photos and attachments

All media calls require Clinical assigned-patient scope. Lists: `limit=100` (1–200), `offset=0` (nonnegative).

| Method | Relative path | Capability | Headers | Response |
|---|---|---|---|---|
| GET | `/patients/{patient_id}/photos` | `patient.read_photos` | — | `photos` |
| GET | `/patients/{patient_id}/photos/{photo_id}/content` | `patient.read_photos` | — | Binary image |
| GET | `/patients/{patient_id}/photos/{photo_id}/thumbnail` | `patient.read_photos` | — | Binary thumbnail |
| POST | `/patients/{patient_id}/photos` | `patient.upload_photos` | CSRF | 201 `result`, multipart |
| PATCH | `/patients/{patient_id}/photos/{photo_id}/metadata` | `patient.write_photo_metadata` | M | `result` |
| DELETE | `/patients/{patient_id}/photos/{photo_id}` | `patient.delete_photos` | M | `result`; empty body, not `{}` |
| GET | `/patients/{patient_id}/attachments` | `patient.read_attachments` | — | `attachments` |
| GET | `/patients/{patient_id}/attachments/{attachment_id}/download` | `patient.read_attachments` | — | Binary attachment |
| POST | `/patients/{patient_id}/attachments` | `patient.upload_attachments` | CSRF | 201 `result`, multipart |
| PATCH | `/patients/{patient_id}/attachments/{attachment_id}/metadata` | `patient.write_attachment_metadata` | M | `result` |
| DELETE | `/patients/{patient_id}/attachments/{attachment_id}` | `patient.delete_attachments` | M | `result`; empty body |

List common fields: `id`, `patient_id`, `original_filename`, `description`, `mime_type`, `file_size`, `created_at`, `updated_at`, `revision`. Photos add `photo_type`, `region`, `visit_id`, `width`, `height`, `taken_at`, `head_location`, `content_url`, nullable `thumbnail_url`; attachments add `download_url`. Use returned session-protected URLs, never object keys/public storage URLs. Responses use `Cache-Control: private, no-store`, `nosniff`, `Vary: Cookie, Authorization`; attachment downloads enforce safe filenames/content policy.

Upload has exactly one `file`, no duplicate fields; photo form allows `description`, `region`, `photo_type`, attachment form only `description`. File 1 byte–10 MiB; multipart request cap is 10 MiB + 64 KiB. `X-CSRF-Token` is required along with host middleware verification; cross/same-site fetch and mismatched Origin are rejected. Extension, actual content/MIME, image bounds/single-frame and explicit clean antivirus result are checked. Encrypted Hetzner writes must be available. Raster photo candidates `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` are decoded/re-encoded as WebP with thumbnail. Attachment extension candidates also include `.pdf`, `.txt`, `.tif`, `.tiff`, `.doc`, `.docx`, `.xls`, `.xlsx`, but extension alone is not acceptance: actual supported content policy is authoritative. TIFF is not in the current decoded raster allowlist. SVG/HTML/active content is not a supported upload path.

Photo metadata PATCH allows nonempty subset of `description` (nullable, max 20000), `region` (nullable, max 255), `photo_type` (`trichoscopy`, `clinical`, `before`, `after`, `document`, `other`). Coordinate-style region is canonicalized as `Punkt: (x, y, z)`, finite coordinates with absolute value <=20; malformed coordinate-like strings are rejected. `head_location` is derived, not writable. Attachment PATCH is exactly `{"description":"…"}`, string max 20000; empty clears, null rejects. No replacement binary, visit/patient ownership or encryption metadata patch.

Deletion atomically tombstones and queues durable shared-core cleanup; result includes patient/media ID, `is_deleted=true`, `storage_retained=true`, `cleanup_status`. Photo reference locks may prevent deletion. This is not immediate physical purge. The administrator must operate migration 078 and the cleanup worker; historical tombstones with unknown retention are dry-report only.

## Home and clinic care plans

All calls require Clinical assigned-patient scope. Read lists: `limit=50` (1–100), `offset=0` (nonnegative), included beside envelope payload.

| Method | Relative path | Capability | Headers | JSON key |
|---|---|---|---|---|
| GET | `/patients/{patient_id}/care-plans/home` | `patient.read_home_care_plans` | — | `plans` |
| GET | `/patients/{patient_id}/care-plans/home/{plan_id}` | `patient.read_home_care_plans` | — | `plan` |
| POST | `/patients/{patient_id}/care-plans/home` | `patient.create_home_care_plans` | I | `result` |
| PATCH | `/patients/{patient_id}/care-plans/home/{plan_id}/items/{item_id}` | `patient.write_home_care_items` | M | `result` |
| DELETE | `/patients/{patient_id}/care-plans/home/{plan_id}/items/{item_id}` | `patient.delete_home_care_items` | M | `result` |
| GET | `/patients/{patient_id}/care-plans/clinic` | `patient.read_clinic_care_plans` | — | `plans` |
| GET | `/patients/{patient_id}/care-plans/clinic/{plan_id}` | `patient.read_clinic_care_plans` | — | `plan` |
| POST | `/patients/{patient_id}/care-plans/clinic` | `patient.create_clinic_care_plans` | I | `result` |
| POST | `/patients/{patient_id}/care-plans/clinic/treatments` | `patient.add_clinic_care_items` | I | `result` |
| PATCH | `/patients/{patient_id}/care-plans/clinic/{plan_id}/treatments/{item_id}` | `patient.write_clinic_care_items` | M | `result` |
| DELETE | `/patients/{patient_id}/care-plans/clinic/{plan_id}/treatments/{item_id}` | `patient.delete_clinic_care_items` | M | `result` |

Parent read fields: `id`, `patient_id`, `name`, `description`, `notes`, `created_at`, `updated_at`, plus `items` or `treatments`. There is no writable plan-level PATCH or plan-delete route. Read children expose their own `revision`. Home items: `id`, `plan_id`, `product_name`, `product_type`, `frequency`, `day_of_week`, `time_of_day`, `instructions`, `position_x`, `position_y`, `created_at`. Clinic treatments: `id`, `plan_id`, `treatment_name`, `treatment_type`, `quantity`, `completed_count`, `status`, `scheduled_date`, `completed_date`, `notes`, `position`, `history`, `created_at`. Clinic plan reads also expose `total_treatments`, `completed_treatments`, `progress_percentage`; these are derived/read-only.

Create parent fields: optional `name` (max 255), `description`, `notes` (max 20000 each), and `items`/`treatments` (maximum 500). Ownership is server-resolved; no patient/record/tenant/creator IDs in the body. Create body limit 1 MiB; aggregate text limit 512 KiB; extras reject. Home create item permits optional `product_name`, `product_type` (max 255), `frequency` (`daily`, `3x_week`, `2x_week`, `weekly`, `every_2_weeks`), `day_of_week` 0–6, `time_of_day` (`morning`, `afternoon`, `evening`), `instructions` (max 20000), strict 32-bit `position_x`, `position_y` (default 0). Create expands an omitted day using the host's frequency map: daily→1,2,3,4,5,6,0; 3x_week→1,3,5; 2x_week→2,5; weekly/every_2_weeks→1; absent frequency defaults to day 1. Explicit day creates one occurrence; omitted time defaults to morning. This is not a date-based alternate-week scheduler. Plugin occurrence edits use Sunday=0; do not rely on the older generic schema's Monday label.

Clinic create accepts `treatment_name`, `treatment_type` (max 255), strict positive 32-bit `quantity` (default 1), optional strict ISO `scheduled_date`, `notes` (max 20000), strict 32-bit `position` (default 0), subject to core persistence semantics. Status/completion/history/ownership are never caller-owned. Append body is **only** `treatments`: 1–500 objects containing positive strict 32-bit `catalog_id`, optional positive `quantity` and nullable `notes` max 20000. It resolves active clinic catalog items and shared-core plan selection; no caller-selected plan ID or custom treatment identity.

Home item PATCH: nonempty subset `product_name`, `product_type` (nonblank max 255), nullable `instructions` max 20000, strict `day_of_week` 0–6, `time_of_day` enum above, strict 32-bit positions. Only instructions may explicitly be null. Frequency is fixed metadata; edits move one occurrence, not a whole product group, and do not expand a schedule. Clinic item PATCH: nonempty subset `treatment_name`, `treatment_type` (nonblank max 255), positive strict 32-bit `quantity`, nullable `notes` max 20000. Lifecycle fields, position/date/completion/history edits are excluded. Quantity cannot violate used/reserved treatments; linked/used clinic items cannot be deleted (`clinical_item_locked`, 409). Read child revision immediately before edit/delete.

## Clinic profile, services and read-only staff

| Method | Relative path | Capability | Scope | Headers | JSON key / query |
|---|---|---|---|---|---|
| GET | `/clinic/profile` | `clinic.read_profile` | Clinic admin | — | `clinic` |
| PATCH | `/clinic/profile` | `clinic.write_profile` | Clinic admin | M | `result` |
| GET | `/clinic/services` | `clinic.read_services` | Clinic admin | — | `services`; limit=50 (1–100), offset>=0, returned alongside |
| POST | `/clinic/services` | `clinic.create_services` | Clinic admin | I | `result` |
| PATCH | `/clinic/services/{service_id}` | `clinic.write_services` | Clinic admin | M | `result` |
| DELETE | `/clinic/services/{service_id}` | `clinic.delete_services` | Clinic admin | M | `result` |
| GET | `/clinic/staff` | `clinic.read_staff` | Clinic admin | — | `staff`; limit=50 (1–100), offset>=0, returned alongside |

Profile read fields: `id`, `name`, `slug`, `phone`, `email`, `contact_person_name`, `website`, `address_street`, `address_postcode`, `address_city`, `address_country`, `revision`. PATCH allows all except `id`/`slug`; nonempty object, string/null except nonblank nonnull name. Control characters reject; email is validated; website must be HTTP(S) without credentials, whitespace or backslashes. Actual database column bounds still apply. No license, billing, encryption, security or tenant-identity edits.

Service fields: `id`, `tenant_id`, `name`, `description`, `type`, `default_price`, `is_active`, `revision`. Create requires `name` and `type`; optional description/price default null and is_active defaults true. Update allows exactly these five content fields, nonempty object. `is_active` is strict bool; description/price may be null; name/type nonblank strings without control characters. Price should be a decimal **string**, nonnegative, at most two decimal places (JSON float rejected); actual MariaDB precision/scale/length/type rules also apply. Type comes from host catalog/enum, not invented partner values. In-use services cannot be deleted (409 `service_in_use`); deactivate instead. Create needs migration-074 idempotency persistence and validated host schema.

Staff items: `id`, `first_name`, `last_name`, `name`, `email`, sorted `roles`, `doctor_verified`, `doctor_profiles` (`id`, `clinic_assignment_active=true`). Directory membership may come from active local staff roles or active local doctor profile assignment. `doctor_verified` means active profile + local assignment, **not** licensing/PWZ verification or clinical authority. This directory is not the narrower messaging recipient list. **Employee mutations are permanently out of scope**: no staff create/update/delete/role/assignment/activation endpoints.

## Bell notifications and approved local email / Resend

| Method | Relative path | Capability | Scope | Headers | JSON key |
|---|---|---|---|---|---|
| POST | `/notifications/self` | `notifications.send_self` | Self messaging | I | `result` |
| GET | `/notifications/recipients` | `notifications.send_staff` or `emails.send_staff_template` | Staff messaging | — | `result` (`items`, `limit`, `offset`); limit=50, 1–100; offset 0–100000 |
| POST | `/notifications/staff` | `notifications.send_staff` | Staff messaging | I | `result` |
| POST | `/emails/self` | `emails.send_self_template` | Self messaging | I | 202 `result` |
| POST | `/emails/staff` | `emails.send_staff_template` | Staff messaging | I | 202 `result` |
| GET | `/emails/{job_id}` | Corresponding self/staff email grant | Sender's own job only | — | `result` |

Bell self body: required `title` (nonblank max 160), `message` (nonblank max 1000), optional `action_page_id` local lowercase slug (max 80); plain strings without control characters, no arbitrary URLs/HTML. Staff adds required UUID `recipient_user_id`. Recipient items expose only `user_id`, `display_name`. Actions resolve the plugin's registered page and require intended recipient visibility; caller cannot supply action_url/label. Results expose notification `id`, `read_at`, `created_at`, `replayed`. Self limit is 20 per clinic/actor/hour across plugins; staff additionally limits recipient per clinic/hour to 20.

Self email body is **only** `{"template_key":"notification","action_page_id":"optional-page"}`: no recipient, title/message or variables. Host supplies self title/message; approved notification template variables must be compatible. Staff email body requires `recipient_user_id`, `template_key`, `variables`, optional `action_page_id`. Variables must exactly match the local descriptor keys and per-variable bounds; nonblank plain strings without control characters. No email addresses, subjects, remote template IDs or HTML variables in send bodies. Plugin local XHTML source/descriptor/revision/version is approved by administrator; changes revoke effective approval until rereview. No ENV template maps; native Resend template flows are unchanged.

Email result: `job_id`, `status`, `acceptance` (`provider_accepted` only for `sent`, otherwise `not_confirmed`), `delivery="unknown"`, and enqueue `replayed`. Sender cannot inspect another sender's job. Limit 5 per clinic/sender/hour; staff additionally 5 per clinic/recipient/hour across plugins. Requires manual migrations 075–077, provider configuration, exact local-source approval and outbox worker. Jobs use bounded retry/revalidation; accepted does not mean delivered. Never claim SMTP or end-to-end delivery confirmation.

## Host-managed plugin AI: neutral text completion

| Method | Relative path | Capability | Scope | Headers | JSON key |
|---|---|---|---|---|---|
| POST | `/ai/completion` | `AI` (exact uppercase literal) | Plugin AI | I + host CSRF | `result` |

Use `/api/plugins/{plugin_id}/ai/completion?tenant_slug=<host clinic slug>` with the authenticated host session, `Content-Type: application/json`, `X-CSRF-Token` and a canonical UUID `Idempotency-Key`. The JSON object is **exactly** `{"user_prompt":"Napisz po polsku krótkie, przyjazne powitanie na warsztaty ogrodnicze."}`: a nonblank string of at most **20000 characters**, subject to plain-text validation and a **64 KiB total request-body cap**. Extra fields and caller-selected patient, feature, model, provider, system prompt, parameters or credit cost are not accepted. This route does not fetch patient data or authorize clinical use. Use neutral, nonconfidential text only.

The standalone SDK exports `AIProtocol.generate(context, user_prompt, idempotency_key)`, `AIResult`, plugin-prefixed aliases, `AI_CAPABILITY="AI"` and `plugin_ai_feature_id(plugin_id)`. These are host adapter contracts, not an HTTP client, provider implementation, billing bypass or sandbox. Each plugin has **one** feature ID: `plugin_ai_` followed by the full SHA-256 hex digest of its exact UTF-8 plugin ID. The helper validates the lowercase manifest ID (maximum 190 characters), without trimming or case folding. A plugin cannot select multiple features or configure its model/cost/prompt through this API.

Administrator discovery/console reads show an unconfigured, virtual **disabled** entry until an administrator selects an active model/provider and saves it. Reads do not persist the entry or choose a model. Administrator configuration of model/provider, nonnegative integer cost and explicit global activation is mandatory before generation. For a discovered plugin declaring literal `AI`, the system prompt is an optional administrator-owned supplement to the plugin's user instructions; null, empty or whitespace-only prompts are omitted, without inventing instructions. Shared multimodal prompts remain required; a hash-shaped feature ID alone does not exempt a feature. Feature configuration does not enable the plugin, grant `AI`, license a clinic, approve clinic opt-in or allocate credits. Explicit clinic approval uses migration **080** (`080_tenant_plugin_ai_activations.sql`); existing tenant licensing/entitlement, cost settings and balances remain independent. Legacy `tenant_ai_feature_settings.is_active` is not plugin consent or an additional plugin availability flag; shared tenant entitlement/cost storage remains in use by plugin AI, but dedicated native AI generation has been removed. The execution ledger requires migration **079**. Apply only missing reviewed manual migrations; no automatic runner or permission to repeat confirmed SQL.

Administrator parameter resolution is **provider-specific feature override → generic feature parameter → model default → call fallback** (text-call temperature defaults to `0.3`). Missing values and JSON `null` inherit; explicit zero is preserved. An unset `top_p` or `thinking_budget` is omitted, not fabricated. Controls are strict finite numbers: temperature 0–2, top P 0–1 and integer thinking budget 0–2147483647, subject to provider/model support. The budget is not an output-token limit. OpenRouter maps a positive budget to `reasoning.max_tokens`, zero to `reasoning.enabled=false`, and sets `provider.require_parameters=true` whenever a budget is supplied; unsupported models may reject rather than silently ignore it. Generic direct OpenAI-compatible integrations reject a supplied budget before dispatch, including zero. Native Anthropic accepts zero without enabling thinking; a positive budget must be at least 1024 and uses `thinking.budget_tokens`, temperature 1 and `max_tokens` strictly greater than the budget. Gemini retains `generationConfig.thinkingConfig.thinkingBudget` mapping. These administrator settings are not plugin request overrides.

Success envelope: `{"plugin_id":"…","result":{"execution_id":"…","status":"succeeded","credit_cost":1,"charged":true,"replayed":false,"text":"Witaj na warsztatach ogrodniczych!"}}`. Result fields are:

| Field | Meaning |
|---|---|
| `execution_id` | Stable execution identity for operational reconciliation |
| `status` | `pending`, `succeeded` or `failed` |
| `credit_cost` | Host-resolved nonnegative integer cost for this execution |
| `charged` | Confirmed succeeded consumption (`true`); pending/failed report `false`. Pending still holds its reserve: `false` does not mean refunded or spendable credits. |
| `replayed` | Same execution metadata, without another provider invocation or charge |
| `text` | Optional ephemeral plain text, returned only on the first successful response; never replay output |

The host atomically reserves/debits credits with the execution claim **before dispatch**. Success consumes the reservation; definite provider failure refunds it. An uncertain provider outcome or crashed in-progress execution retains the reservation and remains pending for **manual reconciliation**, not automatic provider replay. Pending reports `charged=false` but still holds the debit/reservation. Do not infer a refund from this flag, a timeout, 500, missing text or a failed browser connection.

Provider credentials remain host-only and use a single dedicated credential-encryption domain for administrator saves and runtime reads. Correcting an old mismatched stored credential requires an explicit provider-console re-save, not an SDK request or client-supplied key.

A terminal `failed` result confirms no charged consumption for that execution but does not expose the failure reason. Administrators inspect safe completion outcome/reason/HTTP-status logs; provider bodies and exceptions are never returned. Replaying a terminal failed key returns its existing metadata, not another provider call.

A 503 `ai_unavailable` does not identify the failed dependency or prove a provider configuration error. Preserve the exact request/key and ask the administrator for the safe phase/errno diagnostic; never expose arbitrary exception text or replace the key to bypass uncertainty.

Pending metadata returns HTTP **202**; terminal metadata returns **200**, including failed executions. Missing/invalid CSRF is 403, missing UUID key 428, malformed request/key 422, changed-key payload conflict 409, insufficient credits 402, rate limit 429 and unavailable execution storage/provider integration 503. Inactive/unlicensed/unconfigured AI policy is 403. Current limits are 20 new executions per tenant/actor/hour across plugins and at most two reserved executions; replay does not create another execution. Responses are no-store. Handle safe codes and preserve the original request after uncertainty.

Execution/idempotency/audit storage contains safe metadata, not raw user prompts or generated text. All replays are **metadata only**, including succeeded executions; lost output cannot be recovered from the ledger. Reusing a key with a changed payload returns **409**. Replays revalidate current actor/tenant/plugin/version/grant authority and never automatically retry dispatch. After uncertainty retain the exact key/payload, permit only an explicit same-request replay to inspect metadata, and seek administrator reconciliation if still pending. Do not issue a fresh paid key to bypass pending/conflicting state or blindly retry.

The host reuses existing prompt redaction; this is **not an anonymity or security guarantee**, nor a claim about provider retention. Render returned text with `textContent`, never HTML, and do not log/store prompts or output. The bundled `examples/example_ai/` preserves its own page and adds a `global.panel.right` button **Uruchom AI** that immediately submits a fixed neutral gardening prompt and shows the result in the panel. Both mounted surfaces share a transient execution/key/result lock for the same plugin and tenant within the current document; double clicks, duplicate asset loads and pending replay cannot create another execution. Other identities stay isolated. The demo uses a stricter 1000-character input, native loader/toast and explicit replay controls; mounting never automatically invokes AI. It has no patient API calls or provider credentials and is not an offline provider emulator.

## Independent clinical trichology summary

| Method | Relative path | Required capabilities | Scope | Headers | JSON key |
|---|---|---|---|---|---|
| GET | `/patients/{patient_id}/trichology-summary` | `AI` + `patient.read_trichology_record` + `ai.trichology_summary` | Clinical / assigned patient | Host session + `X-CSRF-Token` | `summary` |

Use `/api/plugins/trichology.ai-summary/patients/{patient_id}/trichology-summary?tenant_slug=<host slug>`, same-origin cookies and no-store. No POST accepts arbitrary clinical prompts. GET reads only; it never enqueues or invokes AI. The response envelope is `{"plugin_id":"trichology.ai-summary","summary":{"status":"absent","source_revision":null,"current_revision":"<host revision>","is_current":false,"text":null,"generated_at":null,"job_id":null}}`.

`summary` always contains `status`, `source_revision`, `current_revision`, `is_current`, `text`, `generated_at`, `job_id`. Status is `queued`, `processing`, `pending`, `failed`, `stale`, `succeeded`, `cancelled` or `absent`. Nullable fields describe an available artifact/job, not a promise of generated text. `is_current` checks the source revision/version; stale content is visibly marked, never silently presented as current. A valid paid provider response becoming stale does not imply refund. Read failures use safe no-store 403/404/503 responses, without clinical values or existence disclosure.

The public `clinical_ai.py` contract exports `TrichologySnapshot` (`fields`: approved source-only strings/null), `TrichologySummaryPrompt` (`user_prompt`, 1–20000 characters), `TrichologySummaryRegistration` (`prompt_builder`, exact event `trichology.record.changed`), and the event/capability constants. `PluginRegistrar.register_trichology_summary()` registers one reviewed builder for this exact event. All three capabilities and event declaration are required. This is **not a general event bus, generic job API, clinical reader or provider API**; manifest events outside this narrow registration do not acquire delivery.

Approved host source writes enqueue in the same transaction only for actual changes to the trichology source field list above, including clears; one source change advances one version. AI outputs, assignment/security/access fields and no-op saves do not trigger generation. Host supplies a bounded/minimized scalar snapshot without patient/actor/tenant identities and applies redaction before provider dispatch. Free text may still identify a person: neither minimization nor redaction guarantees anonymity or provider retention.

The host rechecks current actor, clinical role, active doctor profile/clinic assignment, assigned patient, plugin/version/grants, model activation, clinic AI license/credits and explicit local administrator consent before decryption, provider dispatch and publication. Clinical scope remains unchanged even when the UI card is visible; nonclinical actors are denied GET. Disable/revocation cancels undispatched work and suppresses unauthorized publication; already uncertain dispatch remains pending, not safely retryable.

**Storage distinction:** neutral `/ai/completion` output remains ephemeral and its replay metadata-only. This clinical automation deliberately persists encrypted job snapshots and encrypted clinical artifacts tied to source revision. Execution/idempotency/financial/audit/log storage still contains metadata only, not prompts/output. Patient deletion must follow the reviewed host purge/retention policy; do not infer safe deletion from encryption or preserve medical payloads as financial metadata.

`queued` means work is waiting for the host worker; `pending` means dispatch/outcome is uncertain and requires administrator reconciliation, not automatic retry. These states must have distinct Polish messages, preserved after polling stops. Display current/stale information rather than raw revision hashes. The sample is collapsed by default with native details/summary; opening/closing never generates or adds requests. The output is a separate labeled card; show its existing `generated_at` as Polish date/time. Preserve a naive host timestamp without guessing its timezone; show an explicit UTC/offset only when supplied. Hide missing/invalid dates and clear dates/output on denial/failure/unload. Docker/Passenger supervise one dedicated summary worker automatically; direct uvicorn needs a separately supervised loop. Metadata uses compact UI Kit spacing (`clk-ui-gap-1`, compact cards), margin-free read-only blocks and a compact result heading; the short Polish “AI — wymaga” phrase stays together, while surrounding text wraps responsively. This does not change summary content, dates, polling or generation.

The Polish, read-only `examples/trichology_ai_summary/` card is a descendant `clk-ui-card` inside a semantic `.clk-plugin-ui` section per `PLUGIN_UI_STYLE_GUIDE.md` and `PLUGIN_UI_HOOK_CATALOG.md`. It targets `patient.records.sections` / `documentation_form` / `tab-wywiad`, uses host-provided patient/tenant context, and does not nest forms or alter native saving. It renders through `textContent` and polls at most 30 requests with a 2-second interval, stopping on unload. Polling GET is not provider replay. Worker dispatch is host-owned, leased for 300 seconds with at most 6 bounded pre-dispatch attempts; a committed dispatch fence/uncertain crash becomes `pending` for manual reconciliation, never automatic redispatch.

Administrator activation requires only missing, manually reviewed migration **081**, confirmed prerequisites 079/080, an explicitly active model/provider and plugin feature, exact grants/license/credits and independent clinic-admin consent. Do not rerun previously confirmed SQL. Dedicated native AI is removed, not pilot-disabled. The host administrator reviews and applies only missing manual `migrations/083_remove_legacy_native_ai_configuration.sql` after deploying removal of native callers; it removes legacy assignments/settings and clears dispatch configuration while retaining history-referenced inert feature rows. All legacy clinical tables/columns/results and financial/plugin ledgers remain intact; no automatic result conversion or credit reset occurs. There is no native pilot-disable step. Native clinical forms and frozen Case contracts remain unchanged.

## Existing Case reads — preserved and frozen

| Method | Relative path | Capability | JSON key |
|---|---|---|---|
| GET | `/patients/{patient_id}/cases` | `cases.read` | `cases`; limit=50 (1–100), offset>=0, returned alongside |
| GET | `/patients/{patient_id}/cases/{case_id}` | `cases.read` | `case` |
| GET | `/patients/{patient_id}/cases/{case_id}/participants` | `cases.read_participants` | `participants` |
| GET | `/patients/{patient_id}/cases/{case_id}/medical-documentation/own` | `cases.read_own_medical_documentation` | `medical_documentation` |
| GET | `/patients/{patient_id}/cases/{case_id}/published-opinions` | `cases.read_published_opinions` | `published_opinions` |

Require active tenant clinical role and active user/tenant, exclude super-admin users, require responsible-specialist relationship or internal-doctor participant in invited/active state without revocation. General membership/administration is insufficient. Own documentation additionally requires internal-doctor participation with `can_create_medical_documentation=1` and own authorship; that check does not expose a create route. Published opinions are published-only, not drafts or other doctors' private documents. SQL patient/case/tenant/deleted scope and semantic audit remain mandatory.

Case fields: `id`, `title`, `status`, `opened_at`, `closed_at`, `created_at`, `updated_at`, `responsible_specialist_id`. Participants: `id`, `participant_type`, `access_status`, `first_name`, `last_name`. Own documentation: `id`, `case_id`, `participant_id`, `author_user_id`, `external_doctor_id`, `version`, `status`, `created_at`, `updated_at`; published opinion metadata omits case/participant IDs. Both include `diagnosis_snapshot`, `comorbid_diagnoses_snapshot`, `icd9_procedures_snapshot`, `ordered_tests_snapshot`, `referrals_snapshot`, `medications`, `dosage`, `treatment_justification`, `recommendations`, `contraindications`.

These existing reads are retained, **not expanded**. No Case/document mutation, sharing, invitation, draft access, native Case changes or new consent bypass is authorized by this release.

## Exact same-origin request pattern

This contact editor uses the actual envelope and contact-domain revision; IDs/slug must come from the host context or authorized selection, not URL guesses.

```js
async function updatePhone(pluginId, patientId, tenantSlug, phone, csrfToken) {
  const url = `/api/plugins/${encodeURIComponent(pluginId)}/patients/${encodeURIComponent(patientId)}/contact?tenant_slug=${encodeURIComponent(tenantSlug)}`;
  const read = await fetch(url, {credentials: 'same-origin'});
  if (!read.ok) throw new Error('Nie udało się wczytać danych kontaktowych.');
  const {patient} = await read.json();
  const saved = await fetch(url, {
    method: 'PATCH', credentials: 'same-origin',
    headers: {'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, 'If-Match': patient.revision},
    body: JSON.stringify({phone})
  });
  if (!saved.ok) throw new Error(saved.status === 409 ? 'Wczytaj aktualne dane przed zapisaniem.' : 'Zapis nie został potwierdzony.');
  const {result} = await saved.json();
  return result;
}
```

For staff email an exact payload is `{"recipient_user_id":"<authorized staff UUID>","template_key":"notification","variables":{"title":"Gotowe","message":"Otwórz stronę partnera"}}` **only if** the approved descriptor declares exactly title/message with compatible bounds. Supply a new UUID `Idempotency-Key`. For self email use `{"template_key":"notification"}` instead. Never confuse the two schemas.

## Failure and extension rules

Expect 401 unauthenticated, 403 actor/capability denial, 404 unavailable scoped resource, 409 revision/idempotency/scheduling/reference conflicts, 413 oversized upload/body, 415 unsupported media, 422 invalid fields/content, 428 missing required header, 429 rate limit and 503 unavailable schema/provider/storage/approval. Some legacy optional-revision writes instead return generic runtime errors for downstream failures. Handle unknown codes safely and keep dirty input. Do not blindly retry uncertain writes or non-idempotent uploads.

No arbitrary DB export, generic clinic job runner, employee mutations or Case expansion is implemented. A new capability/job/table requires reviewed core/SDK impact, explicit authorization/schema/audit/retention and a reviewed host persistence adapter; MariaDB SQL is administrator-applied manually. Capabilities/catalogs are public snapshots, not guarantees of new routes or mounts.
