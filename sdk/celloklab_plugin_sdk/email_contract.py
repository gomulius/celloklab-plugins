"""Static local-email contract checks, matching the host's reviewed format.

No rendering, approval, transport, host import, or partner-code execution.
"""
from pathlib import PurePosixPath
import re

MAX_BYTES = 100 * 1024
ALIAS = re.compile(r'[a-z0-9]+(?:[_-][a-z0-9]+)*\Z')
NAME = re.compile(r'[a-z][a-z0-9_]{0,63}\Z')
HOST_VARIABLES = {'action_url', 'action_label'}
RESERVED_VARIABLES = HOST_VARIABLES | {'subject', 'html', 'from', 'to', 'reply_to', 'template_id', 'template_env'}
SELF_VARIABLES = {'title', 'message'}
TOKEN = re.compile(r'\{\{([#^/]?)([a-z][a-z0-9_]{0,63})\}\}')


def descriptors(raw):
    emails = raw.get('emails', {})
    if type(emails) is not dict or set(emails) - {'templates'}:
        raise ValueError('Invalid emails manifest')
    entries = emails.get('templates', [])
    if type(entries) is not list or len(entries) > 20:
        raise ValueError('Invalid email templates')
    result = {}
    for item in entries:
        if type(item) is not dict or set(item) != {'alias', 'subject', 'localfile', 'variables', 'revision'}:
            raise ValueError('Invalid local email descriptor')
        alias, subject, filename, variables, revision = (item[k] for k in
            ('alias', 'subject', 'localfile', 'variables', 'revision'))
        if type(alias) is not str or len(alias) > 80 or not ALIAS.fullmatch(alias) or alias in result:
            raise ValueError('Invalid or duplicate template alias')
        if (type(subject) is not str or not subject.strip() or len(subject) > 200
                or any(ord(c) < 32 or ord(c) == 127 for c in subject)
                or '{{' in subject or '{%' in subject):
            raise ValueError('Invalid fixed email subject')
        if type(revision) is not str or not revision or len(revision) > 80 or not re.fullmatch(r'[a-zA-Z0-9._-]+', revision):
            raise ValueError('Invalid template revision')
        if (type(filename) is not str or len(filename) > 240 or '\\' in filename
                or any(ord(c) < 32 for c in filename)):
            raise ValueError('Invalid local HTML file')
        path = PurePosixPath(filename)
        if path.is_absolute() or '..' in path.parts or path.suffix.lower() != '.html' or not path.parts:
            raise ValueError('Local email must be a relative HTML file')
        if type(variables) is not dict or len(variables) > 20:
            raise ValueError('Invalid variable contract')
        for name, maximum in variables.items():
            if (type(name) is not str or not NAME.fullmatch(name) or name in RESERVED_VARIABLES
                    or type(maximum) is not int or not 1 <= maximum <= 4000):
                raise ValueError('Invalid or reserved email variable')
        result[alias] = dict(item, variables=dict(variables))
    return result


def validate_tokens(source, allowed):
    if '{{{' in source or '}}}' in source:
        raise ValueError('Triple placeholders are not allowed')
    stripped = TOKEN.sub('', source)
    if '{%' in stripped or '{#' in stripped:
        raise ValueError('Jinja code is not allowed')
    if '{{' in stripped or '}}' in stripped:
        raise ValueError('Unsupported template placeholder')
    stack = []
    for match in TOKEN.finditer(source):
        marker, name = match.groups()
        if name not in allowed:
            raise ValueError('Undeclared template variable')
        if marker in ('#', '^'):
            stack.append(name)
        elif marker == '/':
            if not stack or stack.pop() != name:
                raise ValueError('Unbalanced template conditional')
    if stack:
        raise ValueError('Unbalanced template conditional')
