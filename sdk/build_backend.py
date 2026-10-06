"""Minimal PEP 517 backend. Explicit public package only, no third-party build deps."""
import base64
import hashlib
from pathlib import Path
import tarfile
import io
import zipfile

NAME = 'celloklab_plugin_sdk-1.0.0'
ROOT = Path(__file__).resolve().parent
PACKAGE = ROOT / 'celloklab_plugin_sdk'
if not PACKAGE.is_dir():
    PACKAGE = ROOT.parent / 'celloklab_plugin_sdk'


LICENSE_FILES = ('LICENSE', 'NOTICE', 'LICENSES/Apache-2.0.txt', 'LICENSES/CC-BY-4.0.txt')

PUBLIC_FILES = ('__init__.py', 'catalog.py', 'context.py', 'registrar.py', 'protocols.py',
                'ui.py', 'validation.py', 'email_contract.py', 'ai.py', 'clinical_ai.py', 'capabilities.json',
                'design_tokens.json', 'page_catalog.json')


def _sources():
    sources = []
    root = PACKAGE.resolve(strict=True)
    for name in PUBLIC_FILES:
        path = (PACKAGE / name).resolve(strict=True)
        if root not in path.parents or not path.is_file():
            raise ValueError('Public package source escapes package: ' + name)
        sources.append((path, 'celloklab_plugin_sdk/' + name))
    return sources


def build_wheel(wheel_directory, config_settings=None, metadata_directory=None):
    name = NAME + '-py3-none-any.whl'
    metadata = NAME + '.dist-info/'
    payload = {arc: p.read_bytes() for p, arc in _sources()}
    payload[metadata + 'METADATA'] = b'Metadata-Version: 2.4\nName: celloklab-plugin-sdk\nVersion: 1.0.0\nRequires-Python: >=3.10\nSummary: Standalone Celloklab partner contracts\nLicense-Expression: Apache-2.0\nLicense-File: LICENSE\nLicense-File: NOTICE\nLicense-File: LICENSES/Apache-2.0.txt\nLicense-File: LICENSES/CC-BY-4.0.txt\n\n'
    for license_file in LICENSE_FILES:
        payload[metadata + 'licenses/' + license_file] = (ROOT / license_file).read_bytes()
    payload[metadata + 'WHEEL'] = b'Wheel-Version: 1.0\nGenerator: celloklab-stdlib\nRoot-Is-Purelib: true\nTag: py3-none-any\n'
    payload[metadata + 'entry_points.txt'] = b'[console_scripts]\ncelloklab-plugin-validate = celloklab_plugin_sdk.validation:main\n'
    records = []
    for arc, data in payload.items():
        digest = base64.urlsafe_b64encode(hashlib.sha256(data).digest()).rstrip(b'=').decode()
        records.append(f'{arc},sha256={digest},{len(data)}')
    payload[metadata + 'RECORD'] = ('\n'.join(records) + '\n' + metadata + 'RECORD,,\n').encode()
    Path(wheel_directory).mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(Path(wheel_directory) / name, 'w', zipfile.ZIP_DEFLATED) as archive:
        for arc, data in sorted(payload.items()):
            info = zipfile.ZipInfo(arc, (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
    return name


def build_sdist(sdist_directory, config_settings=None):
    name = NAME + '.tar.gz'
    Path(sdist_directory).mkdir(parents=True, exist_ok=True)
    entries = _sources() + [(ROOT / 'build_backend.py', 'build_backend.py'), (ROOT / 'pyproject.toml', 'pyproject.toml')]
    entries += [(ROOT / name, name) for name in LICENSE_FILES]
    with tarfile.open(Path(sdist_directory) / name, 'w:gz') as archive:
        for p, arc in entries:
            data = p.read_bytes()
            info = tarfile.TarInfo(NAME + '/' + arc)
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
    return name
