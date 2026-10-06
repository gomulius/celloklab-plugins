"""Pure public catalog snapshots; never imports the host."""
import json
from importlib.resources import files

PAGE_CATALOG = json.loads(files(__package__).joinpath('page_catalog.json').read_text(encoding='utf-8'))
PAGE_IDS = frozenset(item['page_id'] for item in PAGE_CATALOG['templates'])
CAPABILITY_CATALOG = json.loads(files(__package__).joinpath('capabilities.json').read_text(encoding='utf-8'))
CAPABILITIES = frozenset(CAPABILITY_CATALOG['capabilities'])
UI_HOOKS = frozenset(CAPABILITY_CATALOG['ui_hooks'])
DESIGN_TOKENS = frozenset(json.loads(files(__package__).joinpath('design_tokens.json').read_text(encoding='utf-8'))['tokens'])
