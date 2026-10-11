"""Standalone, standard-library-only Celloklab partner contracts."""
from .context import PluginContext
from .registrar import PluginRegistrar
from .ui import UIFragment, UIHook, PluginPage, plugin_page_id
from .ai import AI_CAPABILITY, AIProtocol, AIResult, PluginAIProtocol, PluginAIResult, plugin_ai_feature_id
from .clinical_ai import (TRICHOLOGY_CHANGED, TRICHOLOGY_SUMMARY_CAPABILITY,
                         TRICHOLOGY_SUMMARY_CAPABILITIES, MAX_TRICHOLOGY_PROMPT_LENGTH,
                         TrichologySnapshot, TrichologySummaryPrompt, TrichologySummaryRegistration)
from .clinical_ai import __all__ as _clinical_exports

from .bookings import BookingsProtocol, BOOKING_CAPABILITIES
from .trichology import (TRICHOLOGY_INTERVIEW_FIELDS, FIELD_LABELS, OPTIONS, MULTI_FIELDS,
                        TrichologyInterviewUpdates, validate_trichology_interview_updates)
from .trichology import __all__ as _trichology_exports
from .trichology import (LEGACY_NATIVE_FIELDS, LEGACY_NATIVE_OPTIONS, LEGACY_NATIVE_MULTI_FIELDS,
                        NATIVE_TRICHOLOGY_FIELDS, NATIVE_OPTIONS, NATIVE_MULTI_FIELDS,
                        NATIVE_BOOLEAN_FIELDS, NATIVE_FIELD_LABELS, NativeTrichologyUpdates,
                        validate_native_trichology_updates)

from .clinical_tasks import (TaskInputs, TaskAttachmentText, TranscriptSegment, TaskContext,
                             TaskPrompt, TaskRegistration, register_tasks, validate_task_result,
                             CLINICAL_TASKS_CAPABILITY, CLINICAL_TASKS_CAPABILITIES,
                             TRANSCRIPTION_CAPABILITY, MODEL_CLASSES, OUTPUTS)
from .clinical_tasks import __all__ as _task_exports
from .live_interview import (LIVE_INTERVIEW_CAPABILITY, LIVE_INTERVIEW_CAPABILITIES,
                             LiveInterviewRegistration, LiveSegmentEvent,
                             TranscriptSourceReference, LiveProposalEvent, register_live_interviews)
from .live_interview import __all__ as _live_exports

SDK_VERSION = "1.0"
__version__ = "1.2.2"
__all__ = ["PluginContext", "PluginRegistrar", "UIFragment", "UIHook", "PluginPage", "plugin_page_id", "SDK_VERSION",
           "AI_CAPABILITY", "AIProtocol", "AIResult", "PluginAIProtocol", "PluginAIResult", "plugin_ai_feature_id", "BookingsProtocol", "BOOKING_CAPABILITIES"] + _clinical_exports + _trichology_exports + _task_exports + _live_exports
