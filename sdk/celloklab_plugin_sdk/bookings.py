"""Host-independent organizational booking contracts (not a transport client)."""
from typing import Any, Protocol
from .context import PluginContext

READ_BOOKINGS = 'visits.read_bookings'
SCHEDULE_GUEST = 'visits.schedule_guest'
ATTACH_PATIENT = 'visits.attach_patient'
READ_AVAILABILITY = 'visits.read_availability'
RESCHEDULE_BOOKING = 'visits.reschedule_booking'
CANCEL_BOOKING = 'visits.cancel_booking'
BOOKING_CAPABILITIES = frozenset({READ_BOOKINGS, SCHEDULE_GUEST, ATTACH_PATIENT,
    READ_AVAILABILITY, RESCHEDULE_BOOKING, CANCEL_BOOKING})


class BookingsProtocol(Protocol):
    def catalog(self, context: PluginContext) -> dict: ...
    def providers(self, context: PluginContext) -> Any: ...
    def availability(self, context: PluginContext, doctor_id: str, start: str, end: str) -> dict: ...
    def list_bookings(self, context: PluginContext, visit_id: int | None = None,
                      unassigned_only: bool = False) -> Any: ...
    def create_booking(self, context: PluginContext, payload: dict,
                       idempotency_key: str) -> dict: ...
    def attach_patient(self, context: PluginContext, visit_id: int, patient_id: str,
                       revision: str) -> dict: ...
    def reschedule_booking(self, context: PluginContext, visit_id: int, visit_date: str,
                           revision: str) -> dict: ...
    def cancel_booking(self, context: PluginContext, visit_id: int, revision: str) -> dict: ...
