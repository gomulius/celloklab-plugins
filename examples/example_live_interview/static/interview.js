/* Wyłącznie syntetyczny podgląd. Bez sieci, mikrofonu, zapisu lub zmiany formularza. */
(function () {
    'use strict';
    function init() {
        document.querySelectorAll('[data-live-interview-example]').forEach(root => {
            if (root.dataset.exampleReady) return;
            root.dataset.exampleReady = 'true';
            const button = root.querySelector('[data-synthetic-show]');
            const status = root.querySelector('[data-synthetic-status]');
            button.addEventListener('click', () => {
                try {
                    const events = JSON.parse(root.querySelector('[data-synthetic-events]').textContent);
                    const value = events.proposal?.updates?.chief_complaint;
                    const source = events.proposal?.sources?.chief_complaint?.[0];
                    if (events.synthetic !== true || value !== 'Przykładowy wywiad — dane syntetyczne' ||
                        source?.quote !== value || source.segment_id !== events.segment?.segment_id ||
                        events.segment?.segment?.text !== value) throw new Error('invalid_example');
                    // DTOs were validated in Python; this is not a live event transport.
                    root.querySelector('[data-synthetic-value]').textContent = value;
                    root.querySelector('[data-synthetic-source]').textContent = source.quote;
                    root.querySelector('[data-synthetic-review]').hidden = false;
                    status.textContent = 'Pokazano dane syntetyczne. Niczego nie nagrano ani nie zapisano.';
                } catch (_) {
                    root.querySelector('[data-synthetic-review]').hidden = true;
                    status.textContent = 'Nie można wyświetlić przykładu. Dokumentacja pozostaje bez zmian.';
                }
            });
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
    else init();
})();
