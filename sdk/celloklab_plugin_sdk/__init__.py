"""Standalone, standard-library-only Celloklab partner contracts."""
from .context import PluginContext
from .registrar import PluginRegistrar
from .ui import UIFragment, UIHook, PluginPage, plugin_page_id
from .ai import AI_CAPABILITY, AIProtocol, AIResult, PluginAIProtocol, PluginAIResult, plugin_ai_feature_id
from .clinical_ai import (TRICHOLOGY_CHANGED, TRICHOLOGY_SUMMARY_CAPABILITY,
                         TRICHOLOGY_SUMMARY_CAPABILITIES, MAX_TRICHOLOGY_PROMPT_LENGTH,
                         TrichologySnapshot, TrichologySummaryPrompt, TrichologySummaryRegistration)
from .clinical_ai import __all__ as _clinical_exports

SDK_VERSION = "1.0"
__version__ = "1.0.0"
__all__ = ["PluginContext", "PluginRegistrar", "UIFragment", "UIHook", "PluginPage", "plugin_page_id", "SDK_VERSION",
           "AI_CAPABILITY", "AIProtocol", "AIResult", "PluginAIProtocol", "PluginAIResult", "plugin_ai_feature_id"] + _clinical_exports
