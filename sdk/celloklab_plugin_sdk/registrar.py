"""Registrar passed to plugin entrypoints."""

from __future__ import annotations

from typing import Callable

from .ui import UIFragment, PluginPage
from .clinical_ai import TrichologySummaryRegistration
from .clinical_tasks import TaskRegistration
from .live_interview import LiveInterviewRegistration
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .protocols import RegistryProtocol as PluginRegistry


class PluginRegistrar:
    """Narrow registration surface; no Request or database is exposed."""

    def __init__(self, plugin_id: str, registry: PluginRegistry) -> None:
        self.plugin_id = plugin_id
        self._registry = registry

    def register_trichology_summary(self, registration: TrichologySummaryRegistration) -> None:
        """Declare source-only automation; host authorizes and executes it."""
        if not isinstance(registration, TrichologySummaryRegistration):
            raise TypeError("expected TrichologySummaryRegistration")
        registration.validate()
        self._registry.register_trichology_summary(self.plugin_id, registration)

    def register_clinical_task(self, registration: TaskRegistration) -> None:
        """Declare a pure text task, not runtime availability or authorization."""
        if not isinstance(registration, TaskRegistration):
            raise TypeError("Wymagany jest TaskRegistration.")
        registration.validate()
        self._registry.register_clinical_task(self.plugin_id, registration)

    def register_live_interview(self, registration: LiveInterviewRegistration) -> None:
        """Declare a review-only live session, without starting audio or AI."""
        if not isinstance(registration, LiveInterviewRegistration):
            raise TypeError("Wymagany jest LiveInterviewRegistration.")
        registration.validate()
        self._registry.register_live_interview(self.plugin_id, registration)

    def register_ui(self, hook: str, renderer: Callable[..., UIFragment | None]) -> None:
        """Register a renderer for a manifest-declared UI hook."""
        self._registry.register_ui_hook(self.plugin_id, hook, renderer)

    def register_fragment(self, hook: str, fragment: UIFragment) -> None:
        """Register a static UI fragment after validating its contract."""
        fragment.validate()
        if any(page.startswith('plugin:') and not page.startswith(f'plugin:{self.plugin_id}:') for page in fragment.page_ids):
            raise ValueError("fragment cannot target another plugin's pages")
        if fragment.hook != hook:
            raise ValueError("fragment hook does not match registration hook")
        if fragment.surface_id and any(pid == self.plugin_id and getattr(renderer(None, {}), 'surface_id', None) == fragment.surface_id
                                       for name in ('ui.modal', 'ui.floating') for pid, renderer in self._registry.ui_hooks(name)):
            raise ValueError("duplicate plugin surface_id")
        # Only declared IDs are unique: legacy repeated templates remain compatible.
        # Inspect static registration metadata, never invoke arbitrary renderers here.
        if fragment.fragment_id and any(
            pid == self.plugin_id and getattr(renderer, '_fragment_id', None) == fragment.fragment_id
            for pid, renderer in self._registry.ui_hooks(hook)
        ):
            raise ValueError("duplicate plugin fragment_id within hook")
        def renderer(*_):
            return fragment
        renderer._fragment_id = fragment.fragment_id
        self._registry.register_ui_hook(self.plugin_id, hook, renderer)

    def register_page(self, page: PluginPage) -> None:
        """Requires manifest ui.hooks to include ui.page."""
        page.validate()
        if any(pid == self.plugin_id and renderer(None, {}).page_id == page.page_id
               for pid, renderer in self._registry.ui_hooks('ui.page')):
            raise ValueError("duplicate plugin page_id")
        self._registry.register_ui_hook(self.plugin_id, 'ui.page', lambda *_: page)
