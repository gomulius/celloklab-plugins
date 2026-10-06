"""Public AI contracts; provider configuration and execution belong to the host.

One host-managed feature exists per plugin. Callers cannot choose a feature,
model, system prompt or credit cost. This module is not an HTTP client and
provides no execution, storage, credentials or retry implementation.
"""
from __future__ import annotations

import hashlib
import re
from typing import Protocol, TypedDict

from .context import PluginContext

AI_CAPABILITY = "AI"
MAX_PLUGIN_ID_LENGTH = 190
PLUGIN_ID_RE = re.compile(r"^[a-z0-9]+(?:[._-][a-z0-9]+)*$")


def plugin_ai_feature_id(plugin_id: str) -> str:
    """Derive the stable host feature ID from a valid, unmodified plugin ID.

    Validation matches the manifest's lowercase ASCII slug grammar, with the
    persistence bound of 190 characters. No trimming or case folding occurs.
    """
    if (not isinstance(plugin_id, str) or len(plugin_id) > MAX_PLUGIN_ID_LENGTH
            or not PLUGIN_ID_RE.fullmatch(plugin_id)):
        raise ValueError("plugin_id must be a valid lowercase plugin ID (maximum 190 characters)")
    return "plugin_ai_" + hashlib.sha256(plugin_id.encode("utf-8")).hexdigest()


class _AIResultMetadata(TypedDict):
    execution_id: str
    status: str
    credit_cost: int
    charged: bool
    replayed: bool


class AIResult(_AIResultMetadata, total=False):
    """Safe execution metadata and optional ephemeral plain-text output.

    Status is host-defined (pending, succeeded or failed). A replay reports the
    original execution, not a second provider invocation or charge. Pending and
    failed replays contain no text. Prompts and generated output must not be
    persisted in execution/idempotency/audit records; a successful replay may
    therefore have no text either. Never infer output recovery from `replayed`.
    """
    text: str


class AIProtocol(Protocol):
    """Host-authorized AI adapter, not an authorization or billing bypass.

    The host revalidates the current actor, tenant, plugin/version and exact AI
    grant on every call/replay. Supply bounded plain user text and a canonical
    UUID idempotency key. Keep the same key and payload after an uncertain
    response; a changed payload with that key conflicts. Do not blindly retry.
    """

    async def generate(
        self, context: PluginContext, user_prompt: str, idempotency_key: str
    ) -> AIResult: ...


# Explicit plugin-prefixed names for host adapters and partner discoverability.
PluginAIResult = AIResult
PluginAIProtocol = AIProtocol

__all__ = ["AI_CAPABILITY", "AIResult", "AIProtocol", "PluginAIResult",
           "PluginAIProtocol", "plugin_ai_feature_id"]
