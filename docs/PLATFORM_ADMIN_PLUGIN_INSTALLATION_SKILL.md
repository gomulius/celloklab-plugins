# Platform administrator: reviewed plugin installation

## Akceptacja rezerwacji kontaktowych recepcji

Kontrakt: `PLUGIN_BOOKING_CONTRACT.md`; referencja `example.bookings` 1.0.0, strona `calendar`, bez AI. Zatwierdź źródło i dokładną wersję, przyznaj tylko potrzebne `visits.schedule_guest`, `visits.read_bookings`, `visits.attach_patient`, `visits.read_availability`, `visits.reschedule_booking`, `visits.cancel_booking`. `visits.schedule` pozostaje oddzielnym grantem tworzenia zarejestrowanego pacjenta. Rola aktywnej recepcji i ograniczenia aktorów mieszanych są niezależne od grantów. Nie wymagaj aktywacji/licencji AI dla tej wtyczki.

Administrator kliniki ustala czas zabiegów w natywnym katalogu; wizyty zachowują migawkę czasu, a legacy/brak wyboru = 60 minut. Nie zmieniaj historii przez zmianę katalogu. Aktywacja wymaga wyłącznie brakujących, ręcznie zatwierdzonych migracji core, callbacku `authorization_guard` działającego w tej samej transakcji, obligatoryjnego audytu i testu replay po przypisaniu do tej samej wizyty. Nie aktywuj SDK na core bez callbacku: adapter celowo odmawia wykonania. Zweryfikuj brak dostępu administratora/klinicysty bez recepcji, cofnięcie grantów podczas transakcji, pacjenta innej kliniki, kilku profili tej samej osoby i kolizje rzeczywistych przedziałów. Sprawdź polski UI/CSRF, konflikty i zachowanie pól; wynik lokalnych testów nie zastępuje MariaDB/browser E2E. Kontakty nie tworzą kont ani dokumentacji, operacje nie obiecują wysyłki e-mail. Prywatny przewodnik pozostaje poza pakietem partnerskim.

## Mandatory Polish UI and explicit clinic AI approval

Reject new or maintained module/plugin UI with untranslated user-facing titles/navigation, labels/buttons/help/placeholders/tooltips, accessibility names, loading/status/errors/validation, confirmations/toasts/notifications or output framing. **All such UI must be Polish**, including partner and administrator screens. Developer prose may be English; internal IDs/API fields/safe codes remain unchanged. Map wire states to Polish labels and flags to „tak”/„nie”; never expose raw exceptions. This does not certify unrelated legacy UI as translated.

Every plugin requesting literal `AI` is hidden on all clinic-facing surfaces until platform-global activation plus explicit opt-in by that clinic's local administrator, including non-AI content. Authorized management consoles remain available for setup. Plugins without requested `AI` keep existing role/page/plugin rules in all eligible clinics, with no dependency on AI settings/license/activation.

Apply only missing reviewed manual migration **080** for default-off `tenant_plugin_ai_activations`, in addition to ledger migration 079. No automatic backfill: existing `tenant_ai_feature_settings` is not approval. Clinic administrators must explicitly re-enable each AI-requesting plugin. Verify finalized SQL/schema before operations, never rerun confirmed migrations. Existing grants/licensing/settings/credits remain independent. Test opt-in and revocation without bypassing pending/replay/CSRF/idempotency safeguards.

Private host operations guide. Do not include this file or `PLUGIN_SYSTEM_MAINTENANCE.md` in partner distribution. Partner development needs only public contracts, catalogs, starter, wheel and preview—not private repository access.

## Trust and release gates

Install only reviewed, pinned source releases. Plugins execute trusted Python in the host process; capability approval is not a sandbox. Review Python/dependencies, Jinja, JavaScript, local email sources and static assets; reject secret/data bundles and arbitrary database access. There is no dashboard ZIP installer, marketplace, automatic dependency resolution or external API-key plugin runtime. Deploy source through the normal reviewed host Git/deployment workflow; preserve unrelated work and use the authorized `hetzner` branch.

Validate with the standalone `celloklab-plugin-validate` CLI before integration. A clean result is static evidence, not security certification. Review dynamic registration separately. The authoritative runtime contract is `PLUGIN_API_REFERENCE.md`; UI/style/page/email/notification catalogs describe supported declarations and mounts. A named capability/hook is not proof of an implemented endpoint or live mount.

Employee mutations are permanently excluded; retain existing `clinic.read_staff`. Existing Case reads are preserved and frozen, without expansion/mutations/native changes. New tables/jobs/capabilities require core/SDK impact review and a reviewed host persistence adapter—not a partner database connector or arbitrary export.

## Database prerequisites: manual only

Migrations are administrator-reviewed MariaDB SQL, applied manually (for example using the approved database administration tool). Verify schema and deployment migration evidence, take the required backup and record operator/result. **Do not rerun any migration already confirmed applied.** Plugin AI adds manual migration **079** for its execution ledger and **080** for default-off explicit clinic approval. No automatic runner/startup/plugin SQL is authorized; apply only missing reviewed migrations, not the previous sequence again.

| Existing migration | Purpose |
|---|---|
| `074_platform_plugins.sql` | Plugin lifecycle, capability/settings and idempotency persistence |
| `075_plugin_email_outbox.sql` | Durable plugin email jobs |
| `076_plugin_staff_email_outbox.sql` | Staff-recipient email job fields |
| `077_plugin_local_email_template_approvals.sql` | Approval of exact plugin-local template revisions/content |
| `078_media_cleanup_queue.sql` | Durable shared-core media cleanup jobs |
| `079_plugin_ai_executions.sql` | Plugin AI execution ledger and safe reservation/reconciliation metadata |
| `080_tenant_plugin_ai_activations.sql` | Default-off explicit local clinic-admin AI plugin opt-in; no backfill from legacy settings |
| `081_plugin_trichology_ai_summaries.sql` | Independent clinical source versions, encrypted summary jobs/artifacts; manually reviewed before this automation is enabled |

If a required schema is missing, stop that feature and arrange reviewed manual application of the missing migration; never interpret a 503 as permission to rerun the whole sequence. Existing catalog column definitions constrain service create/write; verify actual MariaDB metadata instead of guessing lengths/enum/precision. No production MariaDB verification is implied by local unit tests.

## Integration and activation

1. Obtain immutable release identity/checksum and dependency/source inventory. Compare declared capabilities/hooks to reviewed functionality; request the minimum grants.
2. Integrate the plugin folder under the host's configured discovery roots through reviewed source deployment. Use unique module names and contained relative templates/static paths. There is no upload-install endpoint. Public assets must contain no secrets or patient data.
3. Deploy/restart through normal operations, then inspect authoritative discovery status/version/error. A filesystem copy alone is not enablement; Python import caching makes restart distinct from re-enable.
4. Open the host plugin management page as a super-admin. The management API is `/api/admin/plugins`; `GET` lists discovered plugins. Approve the deployed exact version with `POST /{plugin_id}/approve-version`, body `{"version":"<deployed version>"}`.
5. Enable with `POST /{plugin_id}/enable`, body `{"capabilities":["<reviewed declared capability>"]}`. Undeclared grants must reject. Review the resulting enabled state/grants; disable with `POST /{plugin_id}/disable` if validation fails.
6. Configure only nonsecret global scalar settings through `GET`/`PUT /{plugin_id}/settings` (`{"settings":{…}}`). The endpoint allows at most 50 flat keys, key length 100, payload 16 KiB and rejects secret-like keys and nested data. Do not store provider credentials here; it is not a general secret vault or per-clinic configuration API.
7. Test enabled/disabled, changed-version approval, revoked grant, missing DB state and multi-worker request refresh. New requests must use current persisted state, not stale activation memory.

Management requires the current user's super-admin flag. That privilege **does not grant runtime clinical data access**. Install approval, capability approval, email-source approval and actor authorization are separate gates.

## Local email approval and Resend

Plugin emails use local reviewed source, not per-plugin ENV mappings or partner-controlled Resend IDs. The existing native Resend transport/template flows remain unchanged. Configure the provider secret through approved host secret management, never in a manifest, settings, command transcript or partner ZIP.

Under `/api/admin/plugins/{plugin_id}`:

- `GET /email-templates`: descriptors, plugin version, approval hash/status/evidence.
- `GET /email-templates/{alias}/source`: literal source JSON; render source as text, not executable HTML.
- `GET /email-templates/{alias}/preview?expected_hash=<reviewed hash>`: sanitized preview bound to that hash; not a send or approval.
- `POST /email-templates/{alias}/approve`, body `{"expected_hash":"<reviewed hash>"}`: approve exact current version/descriptor/revision/content.
- `POST /email-templates/{alias}/revoke`: revoke effective approval.

Check placeholders/variable bounds, destination-page visibility and source safety. No Jinja or HTML-valued variables. Any content/version/descriptor change needs renewed review. Apply only missing 075–077 migrations and operate the outbox worker. Self sends and staff sends have different payloads; staff sender requires current local `tenant_admin`, recipient active same-clinic staff. Native email must not be modified to accommodate plugins. Provider accepted is not confirmed delivery.

## Plugin AI configuration and reconciliation

If a provider key was saved by the former mismatched admin writer, deploy the corrected writer and explicitly re-enter/save that provider's API key in the AI provider console. Save and execution now use the same `THIRD_PARTY_CREDENTIALS_KEY` domain. Leaving the field blank preserves the existing encrypted value and does not repair it. Never paste credentials into chat/logs, change the environment encryption key, add a PII decryption fallback or rerun unrelated SQL. Existing terminal failed executions remain terminal; a new deliberate execution after repair can consume credits if successful.

For terminal `failed` / `charged=false`, read the safe log `Plugin AI completion outcome=... reason=... http_status=...`. Share only that line. `not_dispatched` names a fixed pre-network check; `rejected` reports provider HTTP rejection without leaking its body. HTTP 400/401/404/429 alone is not a complete diagnosis—do not infer key/model error without further evidence. This is distinct from the phase/errno database diagnostic. No new migration is needed for completion diagnostics and no configuration is automatically changed.

503 troubleshooting: read only the safe response `detail.code`, then the application entry `Plugin AI database failure phase=... errno=...`. Share only fixed phase and numeric errno, never HAR/cookies/tokens/SQL payloads or exception bodies. A 503 is not proof of provider misconfiguration. Preserve the original key/payload; explicit replay checks/reuses that execution without duplicate dispatch. `commit` uncertainty requires evidence-based reconciliation, not fresh-key retry or automatic refund. Do not rerun a migration until actual schema/error evidence establishes a missing prerequisite.

`example.ai` also mounts a **Uruchom AI** button in the existing global right panel on ordinary staff pages, not platform-admin pages. It sends a fixed neutral gardening prompt immediately and shows the result; the own-page demo remains. Page/panel share pending/execution state in the current document. Verify the button, loader, plain-text output, explicit same-request replay and double-click protection with synthetic clinic context. UI presence never bypasses AI grants or tenant policy. The panel itself adds no schema, but this rollout requires missing migration 080 and explicit clinic-admin opt-in before any clinic-facing AI plugin UI is visible.

1. Review pinned neutral-text plugin source and exact uppercase `AI` request. Deploy/discover, approve its exact version and enable with explicit `AI` grant. Page visibility is not authorization. Generation requires active local staff; no patient fetch or clinical/doctor-assignment authority is inferred. Case reads remain frozen; employee mutations stay excluded.
2. Confirm existing host AI schema and only missing manual migrations **079** and **080**. `/api/admin/ai/features` merges one feature per literal `AI` plugin: `plugin_ai_` plus the full SHA-256 hex digest of its exact UTF-8 plugin ID. An unconfigured entry is virtual, disabled, model-less and not persisted. Do not insert null-model rows or choose arbitrary models on discovery; existing configured rows survive rediscovery/version changes without resetting settings/grants.
3. In the existing AI provider/model console configure provider secrets through approved host handling, select an **active model and active provider**, choose nonnegative integer cost, optionally review a system-prompt supplement to the plugin's user instructions and explicitly activate the feature. POST `/api/admin/ai/features` takes `id`, `default_model_id`, `credit_cost`, `is_globally_active` (integer 0/1), optional `system_prompt` and optional bounded `parameters` (`temperature`, `top_p`, `thinking_budget`). Plugin activation may omit the prompt or leave it null/blank; native AI and multimodal system prompts remain required. The plugin exemption requires a discovered literal `AI` declaration, not merely a hash-shaped feature ID. First valid model selection/save materializes a disabled row before the reviewed configuration update. Failed save is not activation. Never put provider credentials in plugin settings/source/bundle.
4. Require explicit opt-in by the administrator of each clinic using the dedicated clinic AI management console and migration 080. Separately verify tenant AI licensing/entitlement, effective cost and sufficient balance. Legacy `tenant_ai_feature_settings.is_active` is not plugin consent or an additional plugin availability flag; native AI retains its existing semantics. Feature saves do not enable plugins, grant `AI`, approve a clinic or allocate credits.
5. Test with synthetic **neutral, nonconfidential text**: POST `/api/plugins/{plugin_id}/ai/completion?tenant_slug=...`, host session/CSRF and UUID `Idempotency-Key`, exactly `{"user_prompt":"..."}` (maximum 20000 characters, body cap 64 KiB). Test current/revoked role/version/grant/configuration/license/credit denials and extra caller feature/model/cost fields. Reused prompt redaction is not anonymity/security certification or provider-retention assurance.

The AI providers page keeps instructions behind clickable **i** buttons (Polish text), including provider credentials/base URL, model and feature fields, inheritance and OpenRouter import; configuration statuses stay visible. Open the relevant help before editing. Blank fields/JSON `null` inherit in order: provider-specific feature → generic feature → model → call fallback; zero remains explicit. A reasoning budget is not an output-token cap. OpenRouter sends positive budgets as `reasoning.max_tokens`, zero as `reasoning.enabled=false` and `provider.require_parameters=true`; generic direct OpenAI-compatible integrations reject supplied budgets. Native Anthropic supports zero/off or positive budgets ≥1024 with `max_tokens` greater than the budget; Gemini retains its existing `thinkingBudget` mapping. See `PLUGIN_API_REFERENCE.md` for bounds and payload semantics; model support still needs validation.

Credits are atomically reserved/debited with the execution claim before dispatch. Success consumes the reservation; definite provider failure refunds it. Uncertain provider outcome or crashed in-progress execution stays pending and retains the reserve for **manual reconciliation**, without automatic provider replay/lease reset/speculative refund. Never bypass pending state with a fresh paid UUID or bulk-refund based only on elapsed time.

Results contain `execution_id`, `status` (`pending`/`succeeded`/`failed`), `credit_cost`, `charged`, `replayed`, optional text only on first success. All replays are metadata only; raw prompt/generated output are not stored in execution/idempotency/audit records. Changed payload under the same key is 409. Explicit exact-request replay still requires current authorization. A timeout/500/denied replay does not settle the execution or prove refund; no blind retries.

For unresolved pending executions gather only safe execution/tenant/plugin/actor/key and reservation/transaction metadata plus approved provider acceptance evidence. Determine dispatch/consumption/refund from reviewed evidence; if uncertain, leave the reserve pending. Record operator decision and use an approved transaction-bound reconciliation procedure, without prompts/output/credentials or improvised reset/replay SQL. This guide promises no automatic reconciliation worker or administrator replay endpoint. Preserve execution ledger/unresolved reservations through disable/rollback.

## Worker monitoring (read-only)

Open **Zarządzanie Platformą → Workery** (`/admin/workers`); `GET /api/admin/workers` is the no-store metadata equivalent. Active platform administrator authority is checked freshly in SQL. No worker restart/stop, job retry or financial reconciliation controls are provided. No new migration or configuration variables are required. Deploy through the existing supervisor to inherit the local telemetry identity; standalone uvicorn cannot confirm worker processes. Do not launch a second loop just because the panel reports missing data.

Process observation is local to the serving container (fresh30s), while heartbeat is emitted synchronously by actual worker operations (fresh660s, accounting for240s task and300s backoff). Missing/stale heartbeat is not proof of successful work or definitive process failure. Generation-local handled counters are not successes/delivered emails/billed AI calls. The panel shows start/restarts/last exit/next restart and fixed historical error text separately from current activity. Queue counts are global platform DB aggregates: waiting/in-progress/failed/review/completed/other. Review covers uncertain mail, blocked media and pending AI. Missing schema/DB means unavailable counts, not zero. AI pending still needs evidence-based reconciliation, never blind replay.

Private ephemeral telemetry is stored with0700 directory/0600 atomic bounded JSON under the local `/tmp` namespace, with fixed role/schema and PID/generation matching. Do not share that directory across supervisors/containers. It contains no prompts, clinical output, recipients, patient identifiers, commands or secrets. Help is under clickable i, times UTC, refresh manual. Verify local worker heartbeat and queue interpretation after deploying; no claim of cluster-wide monitoring or durable incident history. Rollback removes monitoring only; keep queues/leases/fences/financial state untouched.

## Independent trichology AI pilot

The trichology-tab **Notatka trychologa** uses the existing clinical `patient_clinic_records.notes`; **Dodatkowe informacje** uses the separate `additional_notes` shared with reception. Preserve historical contents of both fields: no copying/merging, clearing, backfill or new notes migration is required. Both fields are already summary sources, and both use the existing pre-provider redaction boundary (not an anonymity guarantee). With the existing clinical grants and explicit AI consent, verify a notes-only edit/clear queues work and marks the previous summary noncurrent, while a no-op queues nothing. `additional_notes` is not writable through the plugin trichology PATCH. No new capability or worker is introduced by exposing the existing clinical note.

Deploy/approve exact version `1.0.0` of `trichology.ai-summary`, reviewing its public-SDK source and entirely Polish read-only non-form card. Explicit grants are **`AI`, `patient.read_trichology_record`, `ai.trichology_summary`**; exact event is `trichology.record.changed` through narrow `register_trichology_summary()`. This is not general event delivery/jobs, arbitrary clinical prompt submission or a physician CaseMedical extension. The approved host integration only adds transactional source-change capture, including clears; native forms/AI are otherwise unchanged. Source fields exclude previous AI output and assignment/access changes; no-op saves create no generation.

Confirm deployment evidence for prerequisites 079/080 without asking to rerun already confirmed SQL. Review final migration 081, back up and manually apply it **only if missing**, before enabling this automation; no automatic migration runner is installed. Configure its own `plugin_ai_feature_id("trichology.ai-summary")`, active model/provider, nonnegative cost and explicit global activation. Verify exact grants, clinic license/credits and independent explicit local tenant-admin consent. Native feature settings/consent do not activate this plugin. For a pilot, **manually disable old `patient_summary_generation` in that clinic**, to prevent duplicate paid work; no code auto-disables native AI.

Docker/Passenger ENTRYPOINT automatically runs one trichology worker through `scripts/deployment_supervisor.py`, independently of the email/media children. Verify safe startup log `code=worker_started role=trichology`; restart/backoff is independent, and SIGTERM/SIGINT allows up to 300 seconds for cancellation/finalization. The container termination timeout must permit that grace. Do not run a duplicate worker/cron. Direct uvicorn is web-only: supervise a separate loop in that deployment. For an explicitly authorized standalone batch (not an additional deployment loop):

```sh
python scripts/process_plugin_trichology_summaries.py --limit 20
python scripts/process_plugin_trichology_summaries.py --limit 20 --loop
```

Default single-run limit is 20, allowed 1–100; `--loop` runs continuously beyond that limit with backoff 5–300 seconds and a 240-second task deadline. SIGTERM/SIGINT cancels processing with fail-closed uncertainty handling. Queue lease is 300 seconds, maximum 6 bounded pre-dispatch attempts. Monitor aggregate safe results only. A committed dispatch fence or uncertain crash leaves `pending` for manual evidence-based reconciliation, never automatic retry/new-key bypass/speculative refund. A valid paid response becoming stale or unauthorized is not refunded merely because publication is suppressed. Disable/revocation cancels before dispatch and prevents unauthorized publication without settling previous uncertainty.

GET `/api/plugins/trichology.ai-summary/patients/{patient_id}/trichology-summary?tenant_slug=...` uses host session and `X-CSRF-Token`, with no clinical prompt POST. `summary` fields: `status`, `source_revision`, `current_revision`, `is_current`, `text`, `generated_at`, `job_id`; statuses: `queued`, `processing`, `pending`, `failed`, `stale`, `succeeded`, `cancelled`, `absent`. The full section is initially collapsed (native details/summary); it opens by click/keyboard without generation or form submission. The output has its own labeled result card, and the saved artifact `generated_at` is displayed as Polish date/time inside the expanded section. Missing/invalid dates stay hidden; naive host times are not labeled UTC. The card polls at most 30 reads at 2-second intervals and renders plain text. Active clinical doctor profile/clinic assignment and assigned patient are required even when the card is visible; test reception/admin/finance denial, revoked grant/consent/assignment, old-source suppression and encrypted output reads.

Unlike neutral completion, the host persists encrypted clinical snapshots/artifacts. Minimization/redaction are not anonymity guarantees; no PHI may enter logs/ledger/audit/financial metadata. Core GDPR hard-delete removes artifacts, jobs and tracked sources before the clinical record within its existing transaction. Synthetic SQL/deletion-race tests confirm no clinical artifact recreation; financial execution/reservation metadata is preserved. Verify the actual MariaDB deletion/concurrency behavior before production acceptance; local SQLite evidence is not a live purge guarantee. No MariaDB/browser/live-provider acceptance is established by isolated SDK tests.

## Media cleanup operations

Migration 078 is required for newly queued shared-core tombstones. Physical object deletion is asynchronous, not part of the browser response. Run the read-only report first:

```sh
python scripts/process_media_cleanup.py --report-dry-run
```

Once authorized to process queued jobs, run bounded batches or a supervised long-lived worker:

```sh
python scripts/process_media_cleanup.py --limit 20
python scripts/process_media_cleanup.py --loop --limit 20
```

The CLI limit is 1–100 (default 20), lease is 5 minutes, maximum 6 attempts, task deadline 240 seconds, DB socket bounds 10 seconds. Loop waits 5 seconds when healthy and backs off errors up to 300 seconds. SIGTERM/SIGINT finishes the current task then stops without resetting leases. Monitor only aggregate status/error codes, never snapshots/object keys/patient IDs or connector exception text. Review `blocked`/`failed` jobs; do not force-delete storage objects.

The shared-core lifecycle atomically tombstones, stores an encrypted snapshot and audits. Cleanup validates provider/path/tenant ownership, unchanged snapshot, parent deletion and broad references across photos/attachments/native references, including thumbnails and migrated source copies. Missing reference schema, restored parent, shared reference, unsafe paths or uncertain ownership block purge. Historical soft-deleted rows without a durable job and known retention/ownership are **report-only**; report bytes are metadata estimates, not reclaimed space. Do not mass enqueue historical objects or invent a retention period. Retention policy/holds require explicit operational review.

## Acceptance and rollback

Use synthetic patients/staff/clinic fixtures. Verify:

- Local reception basic data, strictly assigned clinician patient/own-visit scope, mixed-role restrictions, no clinical access from pure admin/finance/platform roles; scheduling requires literal local reception role and unknown consultation combinations fail closed.
- Clinic profile/service writes/read-only staff are local-tenant-admin scoped; staff notification/email sends additionally require tenant admin; self sends address only self.
- Separate domain revisions, required vs optional If-Match, idempotent replay/conflict, rate limits, upload scanner/encrypted storage/CSRF bounds, deletion/reference locks and queue status.
- Existing frozen Case reads retain relation/own-document/published-only rules; no employee or Case mutation becomes available.
- UI hooks target actual page/tab/role guards, stable priority and identity, shared native style/toast/loading, modal dirty/focus guards and native forms unchanged.
- AI read-only virtual entries/preserved configuration, explicit active model/provider/cost activation with an optional plugin system supplement and retained native prompt requirement with no implicit grants/license/credit changes; route/CSRF/body/key bounds, one dispatch/debit, success consumption, definite-failure refund, conflict/metadata-only replay, uncertain/crashed pending reserve/manual reconciliation and revoked-authority replay denial. Offline/SQLite tests do not establish MariaDB/browser/provider acceptance.

Do not label local tests as a production MariaDB or authenticated browser end-to-end test. Standalone preview has no real API and uses marked mock toast/local font fallback. Pending deployment checks must be reported explicitly.

Rollback starts with disabling/revoking grants and local template approvals, then a reviewed source rollback/restart. Preserve audit, clinical data and durable jobs; do not undo confirmed migrations or delete logs as cleanup. Email jobs revalidate current authority/approval; queued media cleanup is shared-core lifecycle work and is not automatically cancelled by disabling a plugin. Inspect job state before any operational change.
