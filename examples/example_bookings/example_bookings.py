"""Reception booking reference. UI never grants actor or clinical authority."""
from celloklab_plugin_sdk import PluginPage, PluginRegistrar


def register(registrar: PluginRegistrar) -> None:
    registrar.register_page(PluginPage(
        page_id='calendar', title='Rezerwacje — demo recepcji',
        nav_label='Rezerwacje — demo', template='templates/calendar.html',
        roles=('reception_staff',), js_assets=('bookings.js',),
    ))
