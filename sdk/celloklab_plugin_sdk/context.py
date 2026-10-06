"""Immutable context made available to plugin SDK operations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import FrozenSet


@dataclass(frozen=True)
class PluginContext:
    plugin_id: str
    plugin_version: str
    actor_id: str | None
    actor_type: str
    tenant_id: int | None
    request_id: str
    granted_capabilities: FrozenSet[str]

    def require(self, capability: str) -> None:
        if capability not in self.granted_capabilities:
            raise PermissionError(
                f"Plugin {self.plugin_id!r} lacks capability {capability!r}"
            )

    def with_capabilities(self, capabilities: set[str] | frozenset[str]) -> "PluginContext":
        """Return a copy with host-approved capabilities only."""
        return PluginContext(
            plugin_id=self.plugin_id,
            plugin_version=self.plugin_version,
            actor_id=self.actor_id,
            actor_type=self.actor_type,
            tenant_id=self.tenant_id,
            request_id=self.request_id,
            granted_capabilities=frozenset(capabilities),
        )
