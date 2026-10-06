"""Offline advisory checks. Does not import or execute partner entrypoints.

Not a CSS parser, sandbox, authorization emulator or security guarantee.
The optional ui-declarations.json is checked; dynamic registrations are not.
"""
import argparse
from .email_contract import MAX_BYTES, descriptors, validate_tokens, HOST_VARIABLES, SELF_VARIABLES
import json
from pathlib import Path, PurePosixPath
import re
from .catalog import CAPABILITIES, UI_HOOKS, DESIGN_TOKENS
from .ui import PluginPage, UIFragment
from .ai import plugin_ai_feature_id
from .clinical_ai import TRICHOLOGY_CHANGED, TRICHOLOGY_SUMMARY_CAPABILITY, TRICHOLOGY_SUMMARY_CAPABILITIES


def contained(root, value):
    if not isinstance(value, str) or not value or '\\' in value or ':' in value:
        raise ValueError('expected a relative POSIX path')
    path = PurePosixPath(value)
    if path.is_absolute() or '..' in path.parts:
        raise ValueError('path escapes plugin directory')
    resolved = (root / value).resolve()
    if root not in resolved.parents or not resolved.is_file():
        raise ValueError('file missing or outside plugin directory')
    return resolved


def safe_visual(value):
    parts = value.strip().split()
    return bool(parts) and all(p in {'0', 'auto', 'none', 'inherit', 'transparent', 'currentColor'} or
                               re.fullmatch(r'(?:\d+(?:\.\d+)?|\.\d+)%', p) for p in parts)


def css_lint(source):
    """Conservative token policy; comments/strings are lexed, not blindly deleted."""
    errors = []
    tokens = re.findall(r'/\*.*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|.', source, re.S)
    clean = ''.join(' ' if t.startswith('/*') else t for t in tokens)
    if '/*' in clean or clean.count('{') != clean.count('}'):
        errors.append(('css.syntax', 'Unbalanced CSS/comment'))
    if re.search(r'@|\\', clean):
        errors.append(('css.unsupported', 'At-rules and CSS escapes are not supported by offline policy'))
    if re.search(r'url\s*\(', clean, re.I):
        errors.append(('css.url', 'Partner CSS URLs are forbidden (including remote URLs)'))
    for selector, body in re.findall(r'([^{}]+)\{([^{}]*)\}', clean):
        for part in selector.split(','):
            if not re.match(r'^\.partner-[a-z0-9_-]+(?:[\s.:#\[>+~]|$)', part.strip()) or re.search(r':root|\b(?:body|html)\b|\.clk-', part, re.I):
                errors.append(('css.selector', 'Selectors must start with a .partner-* scope and cannot target host globals'))
        for declaration in body.split(';'):
            if not declaration.strip():
                continue
            if ':' not in declaration:
                errors.append(('css.syntax', 'Malformed declaration'))
                continue
            prop, value = declaration.split(':', 1)
            prop, value = prop.strip().lower(), value.strip()
            if prop.startswith('--') or '!important' in value:
                errors.append(('css.override', 'Custom token overrides and !important are forbidden'))
            if re.search(r'#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|color)\(', value, re.I):
                errors.append(('css.color', 'Literal colors are forbidden'))
            # Recognize innermost var() first, including safe optional fallbacks.
            residual = value
            variable = re.compile(r'var\(\s*(--[a-z][a-z0-9-]*)\s*(?:,\s*([^()]*))?\)')
            for _ in range(20):
                if not variable.search(residual):
                    break
                def replace_var(match):
                    token, fallback = match.groups()
                    if token not in DESIGN_TOKENS:
                        errors.append(('css.unknown-token', 'Token is not in the public UI-kit design catalog'))
                    if fallback is not None and not safe_visual(fallback):
                        errors.append(('css.literal', 'Fallback must use a known token, zero, percentage or neutral keyword'))
                    return 'inherit'
                residual = variable.sub(replace_var, residual)
            if 'var(' in residual or re.search(r'\d(?:px|rem|em|vh|vw|pt)\b', residual, re.I):
                errors.append(('css.literal', 'Use UI-kit tokens instead of literal dimensions'))
            if re.search(r'color|background|border|shadow|font|margin|padding|gap|radius|width|height|spacing', prop):
                if not safe_visual(residual):
                    errors.append(('css.token', 'Visual values must use UI-kit tokens'))
    return sorted(set(errors))


def bounded_text(path, maximum=MAX_BYTES):
    with path.open('rb') as stream:
        data = stream.read(maximum + 1)
    if not data or len(data) > maximum:
        raise ValueError('File empty or exceeds offline size bound')
    return data.decode('utf-8')


def validate_settings(settings):
    """Flat non-secret configuration; mirrors host settings bounds, not grants."""
    if type(settings) is not dict or len(settings) > 50:
        raise ValueError('Too many or invalid plugin settings')
    blocked = ('secret', 'token', 'password', 'credential', 'private_key', 'api_key')
    for key, value in settings.items():
        if not isinstance(key, str) or len(key) > 100 or any(word in key.lower() for word in blocked):
            raise ValueError('Secret-like plugin settings are not allowed here')
        if isinstance(value, (dict, list)):
            raise ValueError('Nested plugin settings are not allowed')
        if not isinstance(value, (str, int, float, bool)) and value is not None:
            raise ValueError('Unsupported plugin setting value')
    if len(str(settings).encode('utf-8')) > 16_384:
        raise ValueError('Plugin settings are too large')
    return dict(settings)


def validate(folder):
    root = Path(folder).resolve()
    errors = []
    warnings = [{'code': 'static.scope', 'file': 'ui-declarations.json', 'message': 'Advisory only: dynamic register() output, HTML/JS safety, grants and host authorization are not evaluated.'}]
    def error(code, file, message):
        errors.append({'code': code, 'file': file, 'message': message})
    def checkpath(value, base=''):
        try:
            return contained(root, (base + '/' if base else '') + value)
        except (ValueError, TypeError) as exc:
            error('path.invalid', str(value), str(exc))
    manifest = checkpath('manifest.json')
    data = None
    try:
        if manifest:
            data = json.loads(bounded_text(manifest))
        if not isinstance(data, dict):
            raise ValueError('manifest must be a JSON object')
        for name in ('id', 'version', 'sdk_version', 'publisher'):
            if not isinstance(data.get(name), str) or not data[name].strip():
                error('manifest.required', 'manifest.json', name + ' must be non-empty text')
        try:
            plugin_ai_feature_id(data.get('id', ''))
        except ValueError:
            error('manifest.id', 'manifest.json', 'Invalid plugin id (maximum 190 characters)')
        if not re.fullmatch(r'1(?:\.\d+)*', str(data.get('sdk_version', ''))):
            error('manifest.sdk', 'manifest.json', 'SDK major 1 is required')
        entry = data.get('entrypoint', {})
        entry = entry.get('module', '') if isinstance(entry, dict) else entry
        if not isinstance(entry, str) or not re.fullmatch(r'[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*:[A-Za-z_]\w*', entry):
            error('manifest.entrypoint', 'manifest.json', 'Expected module:callable')
        else:
            checkpath(entry.split(':')[0].replace('.', '/') + '.py')
        for key, nested, known in [('capabilities', 'requested', CAPABILITIES), ('ui', 'hooks', UI_HOOKS)]:
            section = data.get(key, {})
            values = section.get(nested, []) if isinstance(section, dict) else section
            if not isinstance(values, list) or any(not isinstance(v, str) for v in values):
                error('manifest.names', 'manifest.json', key + ' must be a list of strings')
            else:
                for v in sorted(set(values) - known):
                    error('manifest.unknown', 'manifest.json', 'Unknown ' + key + ': ' + v)
        if 'settings' in data:
            validate_settings(data['settings'])
        for alias, item in descriptors(data).items():
            path = checkpath(item['localfile'])
            if path:
                validate_tokens(bounded_text(path), set(item['variables']) | HOST_VARIABLES |
                                (SELF_VARIABLES if alias == 'notification' else set()))
        capability_section = data.get('capabilities', {})
        requested = capability_section.get('requested', []) if isinstance(capability_section, dict) else capability_section
        event_section = data.get('events', {})
        subscribed = event_section.get('subscribe', []) if isinstance(event_section, dict) else event_section
        if not isinstance(subscribed, list) or any(not isinstance(event, str) for event in subscribed):
            error('manifest.events', 'manifest.json', 'events.subscribe must be a list of strings')
        elif isinstance(requested, list) and all(isinstance(v, str) for v in requested):
            if TRICHOLOGY_SUMMARY_CAPABILITY in requested or TRICHOLOGY_CHANGED in subscribed:
                if not TRICHOLOGY_SUMMARY_CAPABILITIES.issubset(requested):
                    error('clinical.capability', 'manifest.json', 'Trichology summary requires AI, patient.read_trichology_record and ai.trichology_summary')
                if subscribed != [TRICHOLOGY_CHANGED]:
                    error('clinical.event', 'manifest.json', 'Trichology summary supports only trichology.record.changed')
        if descriptors(data) and isinstance(requested, list) and all(isinstance(v, str) for v in requested) and not set(requested) & {'emails.send_self_template', 'emails.send_staff_template'}:
            error('email.capability', 'manifest.json', 'Local email templates require an email send capability request; host grants and approval remain required')
    except (OSError, ValueError, TypeError, KeyError, AttributeError, UnicodeError, RecursionError) as exc:
        error('manifest.syntax', 'manifest.json', str(exc))
    for p in sorted(root.rglob('*')):
        if p.is_file():
            rel = p.relative_to(root).as_posix()
            if checkpath(rel) is None:
                continue
            if p.suffix == '.css':
                try:
                    for code, message in css_lint(bounded_text(p)):
                        error(code, rel, message)
                except (OSError, UnicodeError, ValueError) as exc:
                    error('file.encoding', rel, str(exc))
    declaration = root / 'ui-declarations.json'
    if declaration.exists():
        try:
            items = json.loads(bounded_text(contained(root, 'ui-declarations.json')))
            if not isinstance(items, list):
                raise ValueError('UI declarations must be a list')
            for item in items:
                item = dict(item)
                kind = item.pop('kind')
                if kind not in {'page', 'fragment'}:
                    raise ValueError('Unknown declaration kind')
                cls = PluginPage if kind == 'page' else UIFragment
                for key in ('roles', 'page_ids', 'css_assets', 'js_assets'):
                    if key in item:
                        if not isinstance(item[key], list):
                            raise ValueError(key + ' must be a list')
                        item[key] = tuple(item[key])
                contract = cls(**item)
                contract.validate()
                hook = 'ui.page' if kind == 'page' else contract.hook
                if hook not in (data or {}).get('ui', {}).get('hooks', []):
                    raise ValueError('Declaration hook not requested in manifest')
                if kind == 'fragment' and any(p.startswith('plugin:') and not p.startswith('plugin:' + (data or {}).get('id', '') + ':') for p in contract.page_ids):
                    raise ValueError('Cannot target another plugin page')
                # Host templates resolve from the plugin root. Keep legacy
                # templates-directory-relative declarations valid offline too.
                template_base = '' if contract.template.startswith('templates/') else 'templates'
                checkpath(contract.template, template_base)
                for value in contract.css_assets + contract.js_assets:
                    checkpath(value, 'static')
        except (OSError, ValueError, TypeError, KeyError, AttributeError, UnicodeError, RecursionError) as exc:
            error('ui.declaration', 'ui-declarations.json', str(exc))
    else:
        warnings.append({'code': 'ui.absent', 'file': 'ui-declarations.json', 'message': 'No static UI declarations supplied; registration was not executed.'})
    errors.sort(key=lambda x: (x['file'], x['code'], x['message']))
    return {'schema_version': 1, 'ok': not errors, 'errors': errors, 'warnings': warnings}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plugin_folder')
    args = parser.parse_args(argv)
    result = validate(args.plugin_folder)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result['ok'] else 1

if __name__ == '__main__':
    raise SystemExit(main())
