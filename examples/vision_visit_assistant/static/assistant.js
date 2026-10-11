/* Independent Vision review UI. Only an explicit per-proposal click can write. */
(function () {
    'use strict';
    const pluginId = 'vision.visit-assistant';
    const states = {idle: 'Gotowy do wywiadu.', starting: 'Uruchamianie sesji…', recording: 'Mikrofon włączony — trwa wywiad.',
        paused: 'Wstrzymano — mikrofon wyłączony.', stopping: 'Kończenie i oczekiwanie na ostatnie wyniki…',
        stopped: 'Wywiad zakończony — mikrofon wyłączony.', retry: 'Mikrofon wyłączony. Ponów oczekujące żądanie bez rozpoczynania nowej sesji.'};
    const errors = {
        live_speech_model_required: 'Brak modelu transkrypcji. Administrator platformy musi go wybrać w Pluginy → vision.visit-assistant → Audio wywiadu na żywo.',
        live_speech_model_unavailable: 'Model transkrypcji lub jego dostawca jest niedostępny. Administrator platformy musi sprawdzić konfigurację audio wtyczki.',
        live_duration_invalid: 'Nieprawidłowy limit czasu wywiadu. Administrator platformy musi ustawić od 60 do 7200 sekund.',
        microphone_unavailable: 'Nie można włączyć mikrofonu. Sesja została bezpiecznie zatrzymana.',
        start_rejected: 'Nie uruchomiono sesji. Sprawdź kredyty i konfigurację dostępu przed ponownym rozpoczęciem.',
        access_revoked: 'Dostęp cofnięty. Mikrofon wyłączony.', audio_backpressure: 'Przesyłanie jest zbyt wolne. Nagrywanie przerwano — część audio nie została przesłana. Ponów oczekujące fragmenty, a potem zakończ sesję.',
        audio_uncertain: 'Nie potwierdzono odbioru audio. Mikrofon wyłączony. Ponów ten sam fragment.',
        start_uncertain: 'Nie potwierdzono uruchomienia sesji. Ponów to samo żądanie — nie rozpoczynaj nowej sesji.',
        audio_flush_failed: 'Nie udało się odczytać ostatniego fragmentu mikrofonu. Nagrywanie zatrzymano.'};
    const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
    const denied = code => ['access_revoked', 'forbidden', 'plugin_disabled', 'access_denied', 'authentication_required', 'not_found'].includes(code);
    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
    }
    function display(value) { return value == null || value === '' ? '(brak)' : Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? value ? 'Tak' : 'Nie' : String(value); }
    class Assistant {
        constructor(root) {
            this.root = root;
            this.bridge = window.CelloklabTrichologyFormBridge;
            this.proposals = new Map();
            this.record = null;
            this.sessionId = null;
            this.latest = null;
            this.access = true;
            this.scope = 0;
            this.status = root.querySelector('[data-status]');
            this.buttons = Object.fromEntries(['start', 'pause', 'resume', 'stop', 'retry'].map(action => [action, root.querySelector('[data-action="' + action + '"]')]));
            if (!this.bridge || !window.CelloklabLiveAudio) {
                this.status.textContent = 'Host nie udostępnia obsługi wywiadu na żywo.';
                this.buttons.start.disabled = true;
                return;
            }
            this.makeClient();
            this.bridge.registerBeforeTabChangeGuard(() => {
                if (!this.client.capturing && !['starting', 'recording'].includes(this.client.state)) return true;
                const message = 'Najpierw zakończ wywiad z AI, aby zmienić zakładkę.';
                this.status.textContent = message;
                window.showNotification?.(message, 'warning');
                return false;
            });
            this.buttons.start.addEventListener('click', () => this.run(async () => {
                if (!this.access || !['idle', 'stopped'].includes(this.client.state)) return;
                if (!root.querySelector('[data-consent]').checked) { this.status.textContent = 'Potwierdź zgodę pacjenta przed uruchomieniem mikrofonu.'; return; }
                if (this.client.restartable) {
                    this.client.dispose();
                    this.sessionId = null; this.latest = null;
                    this.makeClient();
                }
                const scope = this.scope;
                const read = await this.bridge.readRecord(pluginId);
                if (scope !== this.scope || !this.access) return;
                if (!read.ok) { if (denied(read.code)) this.clearAccess(); throw new Error('record_unavailable'); }
                this.record = read.record;
                await this.client.start({recordingConsent: true});
            }));
            for (const action of ['pause', 'resume', 'stop', 'retry']) this.buttons[action].addEventListener('click', () => this.run(() => this.client[action === 'retry' ? 'retryPending' : action]()));
        }
        makeClient() {
            this.client = window.CelloklabLiveAudio.create({pluginId, profileId: 'interview',
                onUpdate: session => this.update(session), onSession: (session, state) => this.sessionState(session, state),
                onError: error => {
                    if (error.code === 'access_revoked') this.clearAccess();
                    this.status.textContent = errors[error.code] || 'Nie udało się zakończyć operacji. Mikrofon jest wyłączony; sprawdź stan sesji i ponów oczekujące żądanie.';
                }});
        }
        clearAccess() {
            if (!this.access) return;
            this.access = false; this.scope++;
            if ((this.client.active || this.client.startPending) && this.client.session?.status !== 'revoked') this.client.revoke?.().catch(() => {});
            for (const item of this.proposals.values()) {
                item.status = 'revoked';
                for (const control of item.controls || []) control.disabled = true;
            }
            this.proposals.clear(); this.record = this.latest = null;
            this.root.querySelector('[data-proposals]').replaceChildren();
            this.root.querySelector('[data-tips]').replaceChildren();
            for (const button of Object.values(this.buttons)) button.disabled = true;
            this.root.querySelector('[data-consent]').disabled = true;
        }
        async run(action) {
            try { await action(); }
            catch (_) { if (!['retry', 'stopped'].includes(this.client.state)) this.status.textContent = 'Nie udało się wykonać operacji. Karta pozostaje bez zmian.'; }
        }
        sessionState(session, state) {
            if (session?.status === 'revoked') this.clearAccess();
            if (!this.access) return;
            this.status.textContent = states[state] || 'Sprawdzanie sesji…';
            const canStart = state === 'idle' || this.client.restartable;
            this.buttons.start.disabled = !canStart;
            this.buttons.pause.disabled = state !== 'recording';
            this.buttons.resume.disabled = state !== 'paused';
            this.buttons.stop.disabled = !session || state === 'stopped' || state === 'stopping';
            this.buttons.retry.hidden = state !== 'retry';
            this.root.querySelector('[data-consent]').disabled = !canStart;
            if (session) this.root.querySelector('[data-budget]').textContent = 'Stała opłata za tę sesję: ' + display(session.credit_cost) +
                ' kredytów. ' + (session.charged ? 'Opłata naliczona.' : 'Opłata jeszcze nienaliczona.') + ' Limit sesji: ' + display(session.max_duration_seconds) + ' s.';
        }
        update(session) {
            if (session.status === 'revoked') { this.clearAccess(); return; }
            if (!this.access) return;
            if (this.sessionId && this.sessionId !== session.session_id) return;
            this.sessionId = session.session_id;
            this.latest = session;
            const tips = this.root.querySelector('[data-tips]');
            tips.replaceChildren();
            for (const tip of (session.tips || []).slice(0, 4)) if (typeof tip === 'string') tips.appendChild(element('li', tip));
            for (const proposal of session.suggestions || []) this.addProposal(proposal, session);
        }
        addProposal(proposal, session) {
            // Preferred host shape is one field per suggestion. Also accept the
            // public updates/sources DTO with host-attached base_values/revision.
            const fields = typeof proposal?.field === 'string' ? {[proposal.field]: proposal.value ?? proposal.proposed_value} : proposal?.updates;
            const id = proposal?.proposal_id || proposal?.id;
            if (!id || !fields || typeof fields !== 'object') return;
            const schema = this.bridge.getSchema();
            for (const [field, value] of Object.entries(fields)) {
                const key = session.session_id + ':' + id + ':' + field;
                if (this.proposals.has(key) || !own(schema, field)) continue;
                const descriptor = schema[field];
                if (!this.valid(descriptor, value)) continue;
                // Revision MUST be captured at the proposal's source. Never
                // substitute the latest record revision just to make PATCH work.
                const revision = proposal.revision ?? proposal.source_revision ?? proposal.context?.revision;
                const baselines = proposal.base_values || proposal.current_values;
                const hasBaseline = own(proposal, 'current_value') || (baselines && own(baselines, field)) || (proposal.context && own(proposal.context, 'baseline'));
                const current = own(proposal, 'current_value') ? proposal.current_value : baselines && own(baselines, field) ? baselines[field] : proposal.context?.baseline;
                if (typeof revision !== 'string' || !hasBaseline || (current !== null && !this.valid(descriptor, current))) continue;
                let refs = proposal.sources?.[field] || proposal.evidence || proposal.sources;
                if (Array.isArray(refs) && refs.every(ref => typeof ref === 'string')) {
                    refs = refs.map(quote => {
                        const segment = (session.segments || []).find(s => s.text === quote && (proposal.segment_ids || []).includes(s.segment_id));
                        return segment ? {quote, start: segment.start, end: segment.end, speaker: segment.speaker} : null;
                    });
                }
                if (!Array.isArray(refs) || !refs.length || !refs.every(ref => ref && typeof ref.quote === 'string' && ref.quote.trim())) continue;
                const item = {key, proposal, field, value, current, revision, status: 'pending', refs, descriptor};
                this.proposals.set(key, item);
                this.render(item);
            }
        }
        valid(schema, value) {
            if (value === null) return schema.nullable !== false;
            if (schema.type === 'boolean') return typeof value === 'boolean';
            if (schema.type === 'string[]') return Array.isArray(value) && value.length <= 200 && value.every(v => typeof v === 'string' && (!schema.choices || schema.choices.includes(v))) && new Set(value).size === value.length;
            return typeof value === 'string' && value.length <= 20000 && (!schema.choices || schema.choices.includes(value));
        }
        render(item) {
            const card = element('article', undefined, 'clk-ui-card clk-ui-card--compact clk-ui-mt-2');
            const body = element('div', undefined, 'clk-ui-card-body');
            card.appendChild(body);
            body.appendChild(element('strong', this.record?.field_labels?.[item.field] || item.field));
            body.appendChild(element('p', 'Było: ' + display(item.current)));
            const next = element('p', 'Propozycja: ' + display(item.value));
            body.appendChild(next);
            for (const ref of item.refs) body.appendChild(element('blockquote', 'Źródło (' + display(ref.start) + '–' + display(ref.end) + ' s): „' + ref.quote + '”'));
            const editor = this.editor(item);
            editor.hidden = true;
            body.appendChild(editor);
            const note = element('p', '', 'clk-ui-help');
            note.setAttribute('role', 'status');
            body.appendChild(note);
            const actions = element('div', undefined, 'clk-ui-row');
            body.appendChild(actions);
            const accept = element('button', 'Akceptuj', 'clk-ui-button clk-ui-button--primary');
            const edit = element('button', 'Edytuj', 'clk-ui-button clk-ui-button--secondary');
            const reject = element('button', 'Odrzuć', 'clk-ui-button clk-ui-button--secondary');
            item.controls = [accept, edit, reject, editor];
            for (const button of [accept, edit, reject]) { button.type = 'button'; actions.appendChild(button); }
            edit.addEventListener('click', () => { if (!this.access || item.status !== 'pending') return; editor.hidden = false; editor.focus(); accept.textContent = 'Zapisz zatwierdzoną zmianę'; });
            reject.addEventListener('click', () => {
                if (!this.access || item.status !== 'pending') return;
                item.status = 'rejected'; card.hidden = true;
                // Tombstone retained for this proposal only: later independent
                // proposals for the same field remain reviewable.
            });
            accept.addEventListener('click', async () => {
                if (!this.access || item.status !== 'pending') return;
                const scope = this.scope;
                const value = editor.hidden ? item.value : this.editorValue(editor, item);
                if (!this.valid(item.descriptor, value)) { note.textContent = 'Wybierz poprawną wartość pola.'; return; }
                item.status = 'saving';
                accept.disabled = edit.disabled = reject.disabled = true;
                try {
                    const result = await this.bridge.savePatch(pluginId, {[item.field]: value},
                        {revision: item.revision, expected_values: {[item.field]: item.current}});
                    if (scope !== this.scope || !this.access) return;
                    if (!result.ok) {
                        if (denied(result.code)) { this.clearAccess(); return; }
                        item.status = 'pending';
                        note.textContent = ['revision_conflict', 'baseline_conflict'].includes(result.code) ?
                            'Karta zmieniła się od powstania propozycji. Sprawdź aktualną kartę i poczekaj na nową propozycję; niczego nie zapisano.' :
                            'Nie zapisano zmiany. Sprawdź niezapisane edycje karty lub dostęp.';
                        accept.disabled = edit.disabled = reject.disabled = false;
                        return;
                    }
                    item.status = 'accepted';
                    note.textContent = result.preserved?.length ? 'Zapisano. Zachowano nowszą ręczną edycję formularza.' : 'Zapisano zatwierdzoną zmianę.';
                    // Bridge returns application status, not the full new record.
                    // Refresh only after confirmed success. Existing proposals
                    // keep their original revision and are never silently rebased.
                    const read = await this.bridge.readRecord(pluginId);
                    if (!read.ok && denied(read.code)) { this.clearAccess(); return; }
                    if (scope === this.scope && this.access && read.ok) this.record = read.record;
                } catch (_) {
                    if (scope !== this.scope || !this.access) return;
                    item.status = 'pending'; accept.disabled = edit.disabled = reject.disabled = false;
                    note.textContent = 'Nie potwierdzono zapisu. Sprawdź kartę przed ponowieniem.';
                }
            });
            this.root.querySelector('[data-proposals]').appendChild(card);
        }
        editor(item) {
            const descriptor = item.descriptor;
            let node;
            if (descriptor.choices || descriptor.type === 'boolean') {
                node = element('select');
                node.multiple = descriptor.type === 'string[]';
                const choices = descriptor.type === 'boolean' ? ['true', 'false'] : descriptor.choices;
                for (const choice of choices) {
                    const option = element('option', descriptor.type === 'boolean' ? choice === 'true' ? 'Tak' : 'Nie' :
                        this.record?.interview_options?.[item.field]?.[choice] || choice);
                    option.value = choice;
                    option.selected = Array.isArray(item.value) ? item.value.includes(choice) : String(item.value) === choice;
                    node.appendChild(option);
                }
            } else { node = element('textarea'); node.value = item.value ?? ''; node.maxLength = 20000; }
            node.className = node.tagName === 'SELECT' ? 'clk-ui-select' : 'clk-ui-textarea';
            node.setAttribute('aria-label', 'Edytuj propozycję');
            return node;
        }
        editorValue(node, item) {
            if (item.descriptor.type === 'string[]') return Array.from(node.selectedOptions).map(option => option.value);
            if (item.descriptor.type === 'boolean') return node.value === 'true';
            return node.value;
        }
    }
    function init() {
        document.querySelectorAll('[data-vision-visit-assistant]').forEach(root => {
            if (root.dataset.visionReady) return;
            root.dataset.visionReady = 'true';
            // Panel collapse only hides DOM; the instance/guard remain live.
            new Assistant(root);
        });
    }
    window.CelloklabVisionVisitAssistant = Object.freeze({Assistant, init});
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
    else init();
})();
