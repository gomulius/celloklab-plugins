'use strict';
document.querySelectorAll('.partner-starter').forEach(root => {
    root.querySelector('[data-partner-toast]').addEventListener('click', () => {
        CelloklabPluginUI.notify({type: 'info', message: 'Partner sample: plain text only'});
    });
    root.querySelector('[data-partner-file]').addEventListener('change', event => {
        const file = event.target.files[0];
        root.querySelector('[data-partner-status]').textContent = file ? 'Selected locally: ' + file.name : 'Nothing selected.';
        // Intentionally no fetch: real upload requires host authorization and review.
    });
});
