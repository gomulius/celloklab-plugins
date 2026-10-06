# Plugin email contract — local approved source

Current supported routes, payloads, limits and actor policy are documented in PLUGIN_API_REFERENCE.md (email section). Partner development uses PLUGIN_DEVELOPMENT_SKILL.md, which includes a complete XHTML example; the same source is in starter/emails/notification.html. This document replaces obsolete provider-template ENV/import instructions for plugins only.

## Source and approval

Partner ships HTML and manifest emails.templates descriptors: alias, fixed subject, localfile, variables (name -> maximum length), revision. Maximum 20 templates, 100 KiB per HTML file; relative .html path contained in plugin directory. Plain placeholders {{name}} and balanced positive/inverted conditionals supported; no Jinja, filters, expressions, triple braces or raw HTML variables. Host action_url/action_label are reserved. Exact declared staff variable keys required. Local HTML is reviewed code, not an isolated sandbox.

Platform super-admin reviews source and rendered synthetic preview in Pluginy platformy -> Szablony email; approves the reviewed hash. Hash binds exact file bytes, descriptor and plugin version. Changes require reapproval. Preview iframe blocks scripts, remote images and links; appearance is approximate, not email-client certification. Approval is separate from lifecycle approval and capability grants. Native MFA/account/system Resend templates and configuration remain unchanged. Plugins need no Resend-dashboard import, RESEND_TMPL_* or PLUGIN_EMAIL_TEMPLATES mapping. Only shared transport secrets remain host-side.

## Sending

Self: emails.send_self_template, fixed notification alias and host-neutral variables to actor only. Staff: emails.send_staff_template, active local tenant_admin sender and active local staff recipient; plugin supplies recipient_user_id, approved template_key and declared plain variables, not raw email/HTML/subject/provider ID. Optional action is an authorized own plugin page checked as recipient. Existing accounts reused for delivery, no accounts created. Employee mutations are excluded.

POST requires UUID Idempotency-Key kept with exact payload across uncertain retries; 202 is queued, not sent. Status polling is owner/plugin/tenant scoped. Queued/sending/sent/failed/uncertain; sent is provider acceptance, delivery unknown. Existing supervisor runs outbox worker. Payload and frozen provider parameters encrypted; stable Resend key and limited retries prevent blind duplicates. Native email helpers unaffected. Limits and diagnostic codes are in the API reference. No clinical notes/identity/tokens in messages or audit; text limits do not detect PII semantically.

Legacy provider-era jobs are preserved but not rewritten: unattempted unsupported jobs fail; attempted jobs become uncertain. Administrator reconciliation required before creating replacement intent. Never reset keys or resend uncertain jobs blindly. Existing manual migrations 075–077 are host prerequisites, not partner runtime DDL; do not rerun already confirmed migrations. Local tests do not prove MariaDB races/provider delivery.
