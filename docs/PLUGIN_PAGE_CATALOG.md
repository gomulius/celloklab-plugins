# Plugin page catalog

Committed host inventory at `8c390880ac8f8fbddcf367b3d5d6d9218c12f785`: **97 catalog entries**, matching both host catalog copies and every committed core HTML template except the four internal shells/includes listed below. Stable text IDs derive from core templates; partial IDs are inventory entries, not independent page render targets. A page target does not create a live hook or authorize data access. Administrative/email/portal inventory entries do not imply plugin mounting. Use explicit SDK `page_ids` plus host-controlled tab/role restrictions.

The public `sdk/celloklab_plugin_sdk/page_catalog.json` remains a **98-entry historical snapshot**: it still lists removed `admin.reporting_ai_stats` and `labs`, and omits `emails.plugin_notification`. This Markdown inventory describes the current committed host; it does not rewrite that JSON or upgrade the public SDK. See [PLUGIN_SDK_RELEASE.md](PLUGIN_SDK_RELEASE.md).

Excluded internal templates are `plugin_before_content.html`, `plugin_page.html`, `plugin_surfaces.html` and `trichology_interview_extensions.html`. Includes retain the outer page identity; own plugin pages use `plugin:<plugin_id>:<page_id>`, not a targetable host shell ID.

| Page ID | Template | Partial |
|---|---|---|
| `404` | `404.html` | no |
| `accept_invitation` | `accept_invitation.html` | no |
| `accept_referral` | `accept_referral.html` | no |
| `admin.ai_credits_management` | `admin/ai_credits_management.html` | no |
| `admin.ai_credits_statistics` | `admin/ai_credits_statistics.html` | no |
| `admin.ai_providers_config` | `admin/ai_providers_config.html` | no |
| `admin.announcements` | `admin/announcements.html` | no |
| `admin.audit_logs` | `admin/audit_logs.html` | no |
| `admin.clinical_dictionaries` | `admin/clinical_dictionaries.html` | no |
| `admin.doctors` | `admin/doctors.html` | no |
| `admin.email-log` | `admin/email-log.html` | no |
| `admin.external_api` | `admin/external_api.html` | no |
| `admin.license` | `admin/license.html` | no |
| `admin.patient_data_audit` | `admin/patient_data_audit.html` | no |
| `admin.patient_referrals` | `admin/patient_referrals.html` | no |
| `admin.plugins` | `admin/plugins.html` | no |
| `admin.recommended_clinics` | `admin/recommended_clinics.html` | no |
| `admin.reporting_clinics` | `admin/reporting_clinics.html` | no |
| `admin.tenants` | `admin/tenants.html` | no |
| `admin.users` | `admin/users.html` | no |
| `admin.workers` | `admin/workers.html` | no |
| `ai_credits_utilization` | `ai_credits_utilization.html` | no |
| `appointment_booking_detail` | `appointment_booking_detail.html` | no |
| `audit_logs` | `audit_logs.html` | no |
| `base` | `base.html` | yes |
| `care_plan.care_plan` | `care_plan/care_plan.html` | no |
| `care_plan` | `care_plan.html` | no |
| `dashboard` | `dashboard.html` | no |
| `dashboard_analytics` | `dashboard_analytics.html` | no |
| `dashboard_clinic` | `dashboard_clinic.html` | no |
| `dashboard_doctor` | `dashboard_doctor.html` | no |
| `dashboard_platform_admin` | `dashboard_platform_admin.html` | no |
| `dashboard_reception` | `dashboard_reception.html` | no |
| `doctor_invitation` | `doctor_invitation.html` | no |
| `documentation_form` | `documentation_form.html` | no |
| `emails.appointment_confirmation` | `emails/appointment_confirmation.html` | no |
| `emails.clinic_creation` | `emails/clinic_creation.html` | no |
| `emails.clinic_patient_data_deleted` | `emails/clinic_patient_data_deleted.html` | no |
| `emails.doctor_clinic_assignment` | `emails/doctor_clinic_assignment.html` | no |
| `emails.doctor_invitation` | `emails/doctor_invitation.html` | no |
| `emails.external_doctor_case_access` | `emails/external_doctor_case_access.html` | no |
| `emails.external_doctor_consent` | `emails/external_doctor_consent.html` | no |
| `emails.invitation` | `emails/invitation.html` | no |
| `emails.license_restored` | `emails/license_restored.html` | no |
| `emails.license_suspension` | `emails/license_suspension.html` | no |
| `emails.license_termination` | `emails/license_termination.html` | no |
| `emails.mfa_code_resend` | `emails/mfa_code_resend.html` | no |
| `emails.notification` | `emails/notification.html` | no |
| `emails.password_reset` | `emails/password_reset.html` | no |
| `emails.patient_contact` | `emails/patient_contact.html` | no |
| `emails.patient_data_deleted` | `emails/patient_data_deleted.html` | no |
| `emails.patient_welcome` | `emails/patient_welcome.html` | no |
| `emails.plugin_notification` | `emails/plugin_notification.html` | no |
| `emails.referral_patient_notification` | `emails/referral_patient_notification.html` | no |
| `emails.referral_support_notification` | `emails/referral_support_notification.html` | no |
| `emails.resend_clinic_patient_data_deleted` | `emails/resend_clinic_patient_data_deleted.html` | no |
| `emails.resend_patient_data_deleted` | `emails/resend_patient_data_deleted.html` | no |
| `emails.visit_cancellation` | `emails/visit_cancellation.html` | no |
| `employees` | `employees.html` | no |
| `external_doctor_access` | `external_doctor_access.html` | no |
| `external_doctor_activation` | `external_doctor_activation.html` | no |
| `login` | `login.html` | no |
| `maintenance` | `maintenance.html` | no |
| `mfa_verify` | `mfa_verify.html` | no |
| `no_tenant_selected` | `no_tenant_selected.html` | no |
| `patient.edit_patient` | `patient/edit_patient.html` | no |
| `patient-billing` | `patient-billing.html` | no |
| `patient_consent` | `patient_consent.html` | no |
| `patient_portal.activation` | `patient_portal/activation.html` | no |
| `patient_portal.care_plans` | `patient_portal/care_plans.html` | no |
| `patient_portal.contact` | `patient_portal/contact.html` | no |
| `patient_portal.dashboard` | `patient_portal/dashboard.html` | no |
| `patient_portal.mfa_verify` | `patient_portal/mfa_verify.html` | no |
| `patient_portal.password_reset` | `patient_portal/password_reset.html` | no |
| `patient_portal.patient_login` | `patient_portal/patient_login.html` | no |
| `patient_portal.patient_portal_base` | `patient_portal/patient_portal_base.html` | yes |
| `patient_portal.payments` | `patient_portal/payments.html` | no |
| `patient_portal.photos` | `patient_portal/photos.html` | no |
| `patient_portal.records` | `patient_portal/records.html` | no |
| `patient_portal.settings` | `patient_portal/settings.html` | no |
| `patient_portal.visits` | `patient_portal/visits.html` | no |
| `patients` | `patients.html` | no |
| `polecane-kliniki` | `polecane-kliniki.html` | no |
| `polecane-produkty` | `polecane-produkty.html` | no |
| `polecani-fryzjerzy` | `polecani-fryzjerzy.html` | no |
| `profile` | `profile.html` | no |
| `recommended_clinics` | `recommended_clinics.html` | no |
| `register` | `register.html` | no |
| `reset_password` | `reset_password.html` | no |
| `schedule_appointment` | `schedule_appointment.html` | no |
| `settings` | `settings.html` | no |
| `specialist_forum` | `specialist_forum.html` | no |
| `specialists` | `specialists.html` | no |
| `trichoscopy` | `trichoscopy.html` | no |
| `unauthorized` | `unauthorized.html` | no |
| `visit_detail` | `visit_detail.html` | no |
| `visits.visit_form` | `visits/visit_form.html` | no |

Medical tab: page `documentation_form`, slot `patient.medical_documentation.sections`, tab `tab-dokumentacja-medyczna`; existing medical access + assigned active doctor required.
