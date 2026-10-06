<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Celloklab Partner Plugin SDK

Public developer guidelines, standalone SDK contracts and reference examples for building administrator-reviewed plugins for the Celloklab platform.

This repository lets external partners consult current guidelines without access to the private application repository, database credentials or patient data. It is **not** the Celloklab application, a plugin marketplace, an upload installer or a public patient-data API.

## Contents

| Directory | Purpose |
|---|---|
| `docs/` | The complete eight-document partner guide set |
| `sdk/` | Host-independent Python SDK, catalogs and offline build backend |
| `wheels/` | Prebuilt installable SDK wheel |
| `starter/` | Starter page, modal, floating panel and declaration examples |
| `examples/example_ai/` | Neutral AI example using host-managed model/provider and AI credits |
| `examples/trichology_ai_summary/` | Narrow, source-change-driven trichology summary reference |
| `preview/` | Offline UI preview with mock feedback and no real API |
| `LICENSES/` | Full standard license texts |

## Start here

1. Read [Plugin Development Guide](docs/PLUGIN_DEVELOPMENT_SKILL.md).
2. Check exact routes, fields and permissions in [API Reference](docs/PLUGIN_API_REFERENCE.md).
3. Follow [UI Style Guide](docs/PLUGIN_UI_STYLE_GUIDE.md), [Page Catalog](docs/PLUGIN_PAGE_CATALOG.md) and [Hook Catalog](docs/PLUGIN_UI_HOOK_CATALOG.md).
4. Consult [Email Contract](docs/PLUGIN_EMAIL_CONTRACT.md), [Notification Contract](docs/PLUGIN_NOTIFICATION_CONTRACT.md) and [SDK Release Notes](docs/PLUGIN_SDK_RELEASE.md).

All new user-facing plugin UI must be Polish. Developer prose and technical identifiers may be English.

## Install and validate locally

Python 3.10 or newer is required. From this repository root:

```sh
python -m venv .venv
# Linux/macOS; on Windows activate .venv\Scripts\activate instead:
. .venv/bin/activate
python -m pip install --no-index --no-deps wheels/celloklab_plugin_sdk-1.0.0-py3-none-any.whl
celloklab-plugin-validate starter
celloklab-plugin-validate examples/example_ai
celloklab-plugin-validate examples/trichology_ai_summary
```

Offline validation checks declarations and static policy. It does not execute a plugin, establish host permissions, prove browser/security behavior or activate anything on Celloklab.

Rebuild the wheel from the public sources without downloading build dependencies:

```sh
python -m pip wheel ./sdk --no-deps --no-build-isolation --no-index -w /tmp/celloklab-wheels
```

Open `preview/index.html` for an offline presentation preview. It has **no real authentication, API, email, upload, clinical data or provider calls**; feedback is mock and fonts use local fallbacks.

## Runtime and security boundaries

- Plugins are trusted, reviewed in-process Python/Jinja/JavaScript, **not a sandbox**.
- Platform administrators approve versions/capabilities; grants do not replace actor, clinic or patient authorization.
- Clinical access is enforced by the host. Do not put secrets, patient data, prompts or clinical output in logs, browser storage or this repository.
- The host owns provider credentials, routing, AI credit costs and activation. AI plugins additionally require independent clinic approval and appropriate entitlement.
- The implemented `trichology.record.changed` contract is narrow: actual changed-source writes enqueue host-owned summary work transactionally. It is **not a general event bus or arbitrary background-job API**.
- Existing Case reads are retained and frozen. Employee mutations are excluded; the staff directory is read-only.
- Publication of this SDK does not grant deployment approval or platform access. Installation/configuration and any reviewed schema changes are handled by the platform administrator, not the partner SDK.

## Versions and updates

`main` contains the current published snapshot. Pin a repository commit when developing against a specific deployment; a changing branch is not a compatibility guarantee. The platform administrator must confirm that a deployed host implements the contracts you intend to use.

Manifest SDK contract **1.0**, Python distribution **1.0.0**, and plugin versions are separate version domains. Updates in this repository do not automatically update an installed host or approve a plugin version. The current snapshot retains the existing distribution version; use the commit identity to distinguish snapshots.

## Licensing

- **Markdown documentation:** [CC BY 4.0](LICENSES/CC-BY-4.0.txt).
- **Code, templates, catalogs and code snippets in documentation:** [Apache 2.0](LICENSES/Apache-2.0.txt).
- Bundled wheels include the license texts and attribution notices.

These licenses cover only the distributed materials, not the private Celloklab application, trademarks or service access. See [LICENSE](LICENSE) for the precise scope and [NOTICE](NOTICE) for attribution. Third-party notices, if present, continue to apply.

## Feedback and responsible disclosure

Use GitHub issues for non-sensitive documentation questions and reproducible SDK defects with synthetic examples. Never post credentials, patient records, clinical prompts/results or private application logs. Report security concerns privately to the repository owner rather than publishing exploitation details or confidential evidence.
