"""Neutral AI reference page and global panel; no clinical APIs."""
from celloklab_plugin_sdk import PluginPage, PluginRegistrar, UIFragment

STAFF_ROLES = ("reception_staff", "medical_staff", "specialist", "trichologist",
               "doctor", "finance_officer", "tenant_admin")


def register(registrar: PluginRegistrar) -> None:
    registrar.register_page(PluginPage(
        page_id="completion", title="Wtyczka AI — demo neutralnego tekstu",
        template="templates/completion.html", nav_label="Wtyczka — demo AI",
        roles=STAFF_ROLES,
        js_assets=("completion.js",),
    ))
    registrar.register_fragment("global.panel.right", UIFragment(
        template="templates/panel.html", hook="global.panel.right", placement="global_panel",
        fragment_id="ai-completion-panel", roles=STAFF_ROLES,
        js_assets=("completion.js",),
    ))
