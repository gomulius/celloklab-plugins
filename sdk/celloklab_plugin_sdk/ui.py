"""Typed UI contracts exposed to plugin authors."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Mapping
import re


def plugin_page_id(plugin_id: str, page_id: str) -> str:
    return f"plugin:{plugin_id}:{page_id}"


@dataclass(frozen=True)
class PluginPage:
    """Declarative content rendered inside the host base layout (no custom routes)."""
    page_id: str
    title: str
    template: str
    roles: tuple[str, ...] = ()
    requires_doctor: bool = False
    nav_label: str | None = None
    css_assets: tuple[str, ...] = ()
    js_assets: tuple[str, ...] = ()
    # Optional flat comma-separated hook allowlist setting (absent = all).
    enabled_hooks_setting: str | None = None

    def validate(self) -> None:
        if not isinstance(self.page_id, str) or not re.fullmatch(r"[a-z0-9]+(?:[_-][a-z0-9]+)*", self.page_id):
            raise ValueError("page_id must be a local lowercase slug")
        if not isinstance(self.title, str) or not self.title.strip() or len(self.title) > 160:
            raise ValueError("page title is required (maximum 160 characters)")
        if self.nav_label is not None and (not isinstance(self.nav_label, str) or not self.nav_label.strip() or len(self.nav_label) > 80):
            raise ValueError("nav_label must be explicit non-empty text")
        UIFragment(template=self.template, hook="ui.page", roles=self.roles,
                   requires_doctor=self.requires_doctor, css_assets=self.css_assets,
                   js_assets=self.js_assets, enabled_hooks_setting=self.enabled_hooks_setting).validate()


@dataclass(frozen=True)
class UIHook:
    name: str
    title: str
    description: str = ""


@dataclass(frozen=True)
class UIFragment:
    """Safe server-rendered fragment description.

    The host, not the plugin, resolves the template path and renders it with
    the approved context. ``template`` must be a relative path inside the
    plugin's declared templates directory.
    """

    template: str
    hook: str
    context: Mapping[str, object] = field(default_factory=dict)
    css_assets: tuple[str, ...] = ()
    js_assets: tuple[str, ...] = ()
    placement: str = "inline"
    widget_id: str | None = None
    default_col_span: int = 1
    # Prefer explicit IDs from app/plugins/page_catalog.json for partner plugins.
    # Empty page_ids intentionally retain legacy global placement.
    page_ids: tuple[str, ...] = ()
    roles: tuple[str, ...] = ()
    requires_doctor: bool = False
    tab_id: str | None = None
    surface_id: str | None = None
    title: str = ""
    enabled_hooks_setting: str | None = None
    # Lower priorities render first. Dashboard saved layouts remain authoritative.
    priority: int = 100
    fragment_id: str | None = None

    @property
    def stable_id(self) -> str:
        """Legacy identity never depends on callable addresses or load order."""
        return self.fragment_id or self.widget_id or self.surface_id or self.template

    def validate(self) -> None:
        if type(self.priority) is not int or not 0 <= self.priority <= 1000:
            raise ValueError("priority must be an integer between 0 and 1000")
        if self.fragment_id is not None and (not isinstance(self.fragment_id, str) or not re.fullmatch(r"[a-z0-9]+(?:[_-][a-z0-9]+)*", self.fragment_id)):
            raise ValueError("fragment_id must be a local lowercase slug")
        if self.enabled_hooks_setting is not None and (not isinstance(self.enabled_hooks_setting, str) or not re.fullmatch(r"[a-z][a-z0-9_]{0,99}", self.enabled_hooks_setting)):
            raise ValueError("enabled_hooks_setting must be a flat setting key")
        if not self.template or self.template.startswith("/") or ".." in self.template.split("/"):
            raise ValueError("template must be a relative plugin template path")
        if not self.hook:
            raise ValueError("UI fragment hook is required")
        if self.placement not in {"inline", "dashboard_widget", "global_panel", "popup_modal", "floating_panel"}:
            raise ValueError("unsupported UI fragment placement")
        if self.placement in {"popup_modal", "floating_panel"}:
            expected = "ui.modal" if self.placement == "popup_modal" else "ui.floating"
            if self.hook != expected or not self.surface_id or not re.fullmatch(r"[a-z0-9]+(?:[_-][a-z0-9]+)*", self.surface_id):
                raise ValueError("surface requires matching hook and local surface_id slug")
            if not self.title.strip() or len(self.title) > 160:
                raise ValueError("surface title is required")
        if self.placement == "dashboard_widget" and not self.widget_id:
            raise ValueError("dashboard widgets require widget_id")
        if self.default_col_span not in {1, 2, 3}:
            raise ValueError("dashboard widget col span must be 1, 2, or 3")
        from .catalog import PAGE_IDS
        if not isinstance(self.page_ids, tuple) or any(page not in PAGE_IDS and not re.fullmatch(r"plugin:[a-z0-9._-]+:[a-z0-9_-]+", page) for page in self.page_ids):
            raise ValueError("page_ids must contain known catalog IDs")
        if not isinstance(self.roles, tuple) or any(not isinstance(role, str) or not role.strip() for role in self.roles):
            raise ValueError("roles must be a tuple of non-empty role names")
        if not isinstance(self.requires_doctor, bool):
            raise ValueError("requires_doctor must be boolean")
        if self.tab_id is not None and (not isinstance(self.tab_id, str) or not self.tab_id.strip()):
            raise ValueError("tab_id must be a non-empty string")
        for asset in (*self.css_assets, *self.js_assets):
            if asset.startswith("/") or ".." in asset.split("/"):
                raise ValueError("plugin asset path escapes its declared directory")
