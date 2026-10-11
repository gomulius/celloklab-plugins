"""No-AI expanded interview editor; the host retains clinical authorization."""
from celloklab_plugin_sdk import (
    PluginRegistrar, UIFragment, TRICHOLOGY_INTERVIEW_FIELDS, FIELD_LABELS,
    OPTIONS, MULTI_FIELDS,
)


def register(registrar: PluginRegistrar) -> None:
    registrar.register_fragment('patient.records.sections', UIFragment(
        template='templates/interview.html', hook='patient.records.sections',
        fragment_id='trichology-interview', page_ids=('documentation_form',),
        tab_id='tab-wywiad', roles=('medical_staff', 'specialist', 'trichologist', 'doctor'),
        # The documentation mount/runtime enforce assigned clinical specialist scope.
        # requires_doctor would incorrectly exclude eligible non-doctor specialists.
        requires_doctor=False, js_assets=('interview.js',),
        context={'interview_schema': [
            {'code': code, 'label': FIELD_LABELS[code],
             'kind': 'boolean' if code == 'post_transplant' else
                     'multi' if code in MULTI_FIELDS else
                     'choice' if code in OPTIONS else 'text',
             'options': OPTIONS.get(code, {})}
            for code in TRICHOLOGY_INTERVIEW_FIELDS
        ]},
    ))
