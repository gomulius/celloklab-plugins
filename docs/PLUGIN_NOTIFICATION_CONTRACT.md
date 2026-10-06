# Plugin bell notifications

Use existing native bell/API/table, not parallel notification storage. Full route/payload/limit/error details: PLUGIN_API_REFERENCE.md.

- notifications.send_self: active tenant staff sends bounded title/message to the current actor.
- notifications.send_staff: active local tenant_admin sends to a selected active staff user of the same clinic.
- Recipient discovery requires a staff-send capability and local tenant_admin; exposes user_id/display_name, never email.
- Optional action_page_id must be an own registered page authorized for the recipient. Host builds URL; no arbitrary URLs/type/metadata.
- UUID Idempotency-Key must be retained with the exact recipient/payload until confirmed. Same request replays without duplicate; a changed payload conflicts.
- Self limit20 new/hour per clinic/actor. Staff limit20/hour per clinic/sender and clinic/recipient across plugins. Audit and notification insert share one transaction. Limits rely on retained audit and key continuity.
- Titles1–160, message1–1000, bounded request8192 bytes. Neutral nonclinical content only; bounds do not semantically detect PII. Backend derives scope; permissions cannot be elevated by capability.

After confirmed insertion/replay dispatch document event celloklab:notifications-changed without payload. Native bell reads its authoritative count immediately, coalescing in-flight refreshes; don't locally increment or mark read. Other browsers use the native60-second poll—no push/realtime claim. Native toasts acknowledge operations, not permanent messages.

Reference example.notifications1.3.0 retains self and staff demo pages; staff page tenantadmin-only. Existing native notifications unaffected. Email is a separate approved local-template contract in PLUGIN_EMAIL_CONTRACT.md. No employee invitations/role mutations, patient notifications or external-doctor delivery are added.
