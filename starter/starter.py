"""Reviewed plugin code: registration only; no host internals or data writes."""
import json
from pathlib import Path
from celloklab_plugin_sdk import PluginPage, UIFragment, PluginRegistrar


def register(registrar: PluginRegistrar):
    entries = json.loads(Path(__file__).with_name('ui-declarations.json').read_text())
    for raw in entries:
        item = dict(raw)
        kind = item.pop('kind')
        for key in ('roles', 'page_ids', 'css_assets', 'js_assets'):
            if key in item:
                item[key] = tuple(item[key])
        if kind == 'page':
            registrar.register_page(PluginPage(**item))
        else:
            fragment = UIFragment(**item)
            registrar.register_fragment(fragment.hook, fragment)
