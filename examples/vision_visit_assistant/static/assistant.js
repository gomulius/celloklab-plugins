/* Independent Vision review UI. Only explicit acceptance of displayed fields writes. */
(function () {
    'use strict';
    const pluginId = 'vision.visit-assistant';
    const states = {idle: 'Gotowy.', starting: 'Uruchamianie sesji…', recording: 'Nagrywanie.',
        paused: 'Wstrzymano.', stopping: 'Kończenie sesji…',
        stopped: 'Zakończono.', retry: 'Ponów oczekujące żądanie.'};
    const errors = {
        stt_language_rejected: 'Odrzucono fragment rozpoznany w obcym alfabecie. Nagrywanie trwa; ten tekst nie trafi do propozycji.',
        audio_not_delivered: 'Część nagrania pozostaje nieprzetworzona. Nie potwierdzono dostarczenia całego audio.',
        audio_backpressure: 'Osiągnięto limit bufora nagrania. Sprawdź stan przetwarzania.',
        analysis_invalid_json: 'Audio i transkrypcja zostały przyjęte. Analiza zwróciła nieprawidłowy wynik JSON; zachowano poprzednie propozycje i pytania. Nagrywanie może trwać dalej — nie ponawiaj tego fragmentu.',
        analysis_callback_failed: 'Audio i transkrypcja zostały przyjęte. Nie udało się przetworzyć analizy; zachowano poprzednie propozycje i pytania. Nie ponawiaj tego fragmentu.',
        analysis_evidence_invalid: 'Audio i transkrypcja zostały przyjęte. Wynik analizy nie przeszedł walidacji propozycji lub dowodów; zachowano poprzednie propozycje i pytania. Nie ponawiaj tego fragmentu.',
        analysis_provider_rejected: 'Przetwarzanie analizy jest niedostępne. Mikrofon nadal zbiera audio do bufora.',
        stt_provider_rejected: 'Przetwarzanie transkrypcji jest niedostępne. Mikrofon nadal zbiera audio do bufora.',
        stt_invalid_output: 'Przetwarzanie transkrypcji zwróciło błędny wynik. Mikrofon nadal zbiera audio do bufora.',
        analysis_pending: 'Analiza oczekuje na potwierdzenie. Mikrofon nadal przechwytuje audio do bufora.',
        stt_pending: 'Transkrypcja oczekuje na potwierdzenie. Mikrofon nadal przechwytuje audio do bufora.',
        usage_pending: 'Nie potwierdzono zapisu rozliczenia dostawcy. Sesja oczekuje na wyjaśnienie; nie rozpoczynaj nowej sesji.',
        context_limit: 'Osiągnięto limit rozmowy. Sesja zakończona; dotychczasowa transkrypcja i wyniki zostały zachowane.',
        runtime_failure: 'Sesja zakończona z błędem przetwarzania. Sprawdź zachowane wyniki; nie ponawiaj przyjętego fragmentu.',
        session_failed: 'Przetwarzanie na serwerze zakończyło się błędem. Mikrofon nadal zbiera audio do bufora; wyniki nie są aktualizowane.',
        live_speech_model_required: 'Brak modelu transkrypcji. Administrator platformy musi go wybrać w Pluginy → vision.visit-assistant → Audio wywiadu na żywo.',
        live_speech_model_unavailable: 'Model transkrypcji lub jego dostawca jest niedostępny. Administrator platformy musi sprawdzić konfigurację audio wtyczki.',
        live_duration_invalid: 'Nieprawidłowy limit czasu wywiadu. Administrator platformy musi ustawić od 60 do 7200 sekund.',
        microphone_unavailable: 'Nie można włączyć mikrofonu. Sesja została bezpiecznie zatrzymana.',
        start_rejected: 'Nie uruchomiono sesji. Sprawdź kredyty i konfigurację dostępu przed ponownym rozpoczęciem.',
        access_revoked: 'Dostęp cofnięty. Mikrofon wyłączony.',
        audio_uncertain: 'Nagrywanie trwa. Przetwarzanie oczekuje na potwierdzenie serwera; audio pozostaje w buforze.',
        start_uncertain: 'Nie potwierdzono uruchomienia sesji. Ponów to samo żądanie — nie rozpoczynaj nowej sesji.',
        recording_activation_uncertain: 'Nie potwierdzono zgody serwera na nagrywanie. Mikrofon pozostaje wyłączony; ponów oczekujące żądanie.',
        recording_activation_rejected: 'Nie można rozpocząć nagrywania w tej sesji. Mikrofon pozostaje wyłączony.',
        audio_flush_failed: 'Nie udało się odczytać ostatniego fragmentu mikrofonu. Nagrywanie zatrzymano.'};
    const technicalErrors = new Set(['analysis_invalid_json', 'analysis_callback_failed', 'analysis_evidence_invalid',
        'analysis_provider_rejected', 'stt_provider_rejected', 'stt_invalid_output', 'analysis_pending',
        'stt_pending', 'usage_pending', 'runtime_failure', 'session_failed', 'audio_uncertain',
        'stt_language_rejected', 'questions_uncertain', 'analysis_result_schema', 'analysis_sources_mismatch',
        'analysis_field_unknown', 'analysis_value_invalid', 'analysis_source_schema', 'analysis_source_unbound', 'analysis_tips_invalid', 'analysis_safety_filtered', 'analysis_speaker_unconfirmed']);
    const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
    const denied = code => ['access_revoked', 'forbidden', 'plugin_disabled', 'access_denied', 'authentication_required', 'not_found', 'actor_denied', 'capability_denied'].includes(code);
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
            // Both roots are plugin-owned registered fragments. Never move or
            // inject content into private host sections or initialize a second client.
            this.proposalRoot = Array.from(document.querySelectorAll('[data-vision-proposals]')).find(slot =>
                slot.dataset.visionContext === root.dataset.visionContext);
            this.bridge = window.CelloklabTrichologyFormBridge;
            this.proposals = new Map();
            this.groups = [];
            this.dismissedTips = new Set();
            this.shownTips = new Set();
            this.diagnosticKeys = new Set();
            this.record = null;
            this.sessionId = null;
            this.latest = null;
            this.access = true;
            this.scope = 0;
            this.ready = false;
            this.preflightVersion = 0;
            this.accessChecked = false;
            this.disclosure = root.querySelector('.va-main');
            this.gate = root.querySelector('[data-prerequisites]');
            this.readyControls = root.querySelector('[data-ready-controls]');
            this.info = root.querySelector('[data-info]');
            this.accessStatus = root.querySelector('[data-access-status]');
            this.microphoneStatus = root.querySelector('[data-microphone-status]');
            this.checkAccessButton = root.querySelector('[data-check-access]');
            this.checkMicrophoneButton = root.querySelector('[data-check-microphone]');
            this.status = root.querySelector('[data-status]');
            this.consent = root.querySelector('[data-consent]');
            this.consent.checked = false;
            this.errorMessage = '';
            this.resetAudioView();
            this.buttons = Object.fromEntries(['start', 'pause', 'resume', 'stop', 'retry', 'questions'].map(action => [action, root.querySelector('[data-action="' + action + '"]')]));
            this.setReady(false);
            this.disclosure.addEventListener('toggle', () => {
                if (this.disclosure.open) this.checkPrerequisites();
            });
            this.checkAccessButton.addEventListener('click', () => this.checkPrerequisites());
            this.checkMicrophoneButton.addEventListener('click', () => this.checkPrerequisites(true));
            if (!this.bridge || !window.CelloklabLiveAudio) {
                this.status.textContent = 'Host nie udostępnia obsługi wywiadu na żywo.';
                this.accessStatus.textContent = this.status.textContent;
                for (const button of Object.values(this.buttons)) button.disabled = true;
                return;
            }
            this.makeClient();
            this.consent.addEventListener('change', () => {
                this.root.querySelector('[data-consent-block]').hidden = this.consent.checked;
                this.refreshControls();
                if (!this.errorMessage) this.status.textContent = this.consent.checked ? 'Gotowy.' : 'Zgoda wymagana do nagrywania.';
            });
            this.sessionState(null, this.client.state);
            this.bridge.registerBeforeTabChangeGuard(() => {
                if (!this.client.capturing && !['starting', 'recording'].includes(this.client.state)) return true;
                const message = 'Najpierw zakończ wywiad z AI, aby zmienić zakładkę.';
                this.status.textContent = message;
                window.showNotification?.(message, 'warning');
                return false;
            });
            this.buttons.start.addEventListener('click', () => this.run(async () => {
                if (!this.access || !this.canStart()) return;
                if (!this.consent.checked) { this.status.textContent = 'Zgoda wymagana do nagrywania.'; return; }
                this.prepareClient();
                const scope = this.scope;
                let read;
                try { read = await this.bridge.readRecord(pluginId); }
                catch (error) { if (scope === this.scope) this.rejectRead('network_error'); throw error; }
                if (scope !== this.scope || !this.access || !this.ready) return;
                if (!read.ok) { this.rejectRead(read.code); throw new Error('record_unavailable'); }
                this.record = read.record;
                await this.client.start({recordingConsent: true});
            }));
            for (const action of ['pause', 'resume', 'stop', 'retry']) this.buttons[action].addEventListener('click', () => this.run(() => {
                if (action === 'resume' && (!this.consent.checked || this.questionsOnly())) return;
                return this.client[action === 'retry' ? 'retryPending' : action]();
            }));
            this.buttons.questions.addEventListener('click', () => this.run(async () => {
                if (!this.access || this.questionsPending) return;
                this.prepareClient();
                this.questionsPending = true;
                this.refreshControls();
                this.status.textContent = 'Przygotowywanie pytań…';
                const tipVersion = this.tipVersion || 0;
                try {
                    await this.client.requestQuestions();
                    if (this.access && !this.errorMessage) {
                        this.status.textContent = (this.tipVersion || 0) > tipVersion ? 'Pytania gotowe.' : 'Nie otrzymano pytań. Ponów żądanie.';
                    }
                }
                finally {
                    this.questionsPending = false;
                    this.refreshControls();
                }
            }));
            if (this.disclosure.open) this.checkPrerequisites();
        }
        setReady(ready, stopCapture = true) {
            const wasReady = this.ready;
            this.ready = ready;
            this.readyControls.hidden = !ready;
            this.info.hidden = !ready;
            if (!ready) this.info.open = false;
            this.gate.hidden = ready;
            if (!ready && wasReady) {
                this.scope++;
            }
            // Public stop releases capture, including an in-flight start.
            if (!ready && stopCapture && (this.client?.capturing || this.client?.state === 'starting')) {
                Promise.resolve(this.client.stop()).catch(() => {});
            }
            if (this.client) this.refreshControls();
        }
        rejectRead(code) {
            this.accessChecked = false;
            // A denial uses revoke (no audio flush), not a normal session stop.
            this.setReady(false, !denied(code));
            this.checkMicrophoneButton.disabled = true;
            const messages = {
                actor_denied: 'Nie potwierdzono dostępu do karty. Sprawdź, czy pacjent jest przypisany do zalogowanego specjalisty i czy aktywny jest właściwy profil kliniczny.',
                capability_denied: 'Brak uprawnienia do odczytu karty pacjenta przez Vision. Poproś administratora o nadanie wtyczce wymaganych uprawnień odczytu.',
                access_revoked: 'Dostęp do karty został cofnięty. Sprawdź uprawnienia i aktywny profil kliniczny.'
            };
            this.accessStatus.textContent = messages[code] || (denied(code) ?
                'Nie potwierdzono dostępu do karty pacjenta. Sprawdź zalogowane konto, aktywny profil kliniczny i uprawnienia.' :
                'Nie udało się potwierdzić odczytu karty pacjenta. Sprawdź połączenie i ponów sprawdzenie.');
            this.microphoneStatus.textContent = 'Mikrofon sprawdzimy dopiero po potwierdzeniu dostępu do karty.';
            if (denied(code)) this.clearAccess(code);
        }
        async checkPrerequisites(explicitMicrophone = false) {
            const version = ++this.preflightVersion;
            this.accessChecked = false;
            this.setReady(false, false);
            this.checkMicrophoneButton.disabled = true;
            this.accessStatus.textContent = 'Sprawdzanie dostępu do karty pacjenta…';
            this.microphoneStatus.textContent = 'Oczekiwanie na potwierdzenie dostępu do karty.';
            const current = () => version === this.preflightVersion;
            try {
                if (!this.bridge || !window.CelloklabLiveAudio) { this.rejectRead('host_unavailable'); return; }
                const read = await this.bridge.readRecord(pluginId);
                if (!current()) return;
                if (!read?.ok) { this.rejectRead(read?.code); return; }
                this.access = true;
                this.accessChecked = true;
                this.record = read.record;
                this.accessStatus.textContent = 'Dostęp do karty pacjenta potwierdzony.';
                if (window.isSecureContext !== true) {
                    this.setReady(false);
                    this.microphoneStatus.textContent = 'Mikrofon wymaga bezpiecznego połączenia HTTPS. Otwórz kartę w bezpiecznej wersji strony.';
                    return;
                }
                if (!navigator.mediaDevices?.getUserMedia) {
                    this.setReady(false);
                    this.microphoneStatus.textContent = 'Ta przeglądarka nie udostępnia obsługi mikrofonu. Użyj przeglądarki obsługującej nagrywanie audio.';
                    return;
                }
                let permission = null;
                try { permission = await navigator.permissions?.query({name: 'microphone'}); } catch (_) { /* Explicit check below. */ }
                if (!current()) return;
                if (permission && permission !== this.microphonePermission) {
                    if (this.microphonePermission && this.permissionListener) this.microphonePermission.removeEventListener?.('change', this.permissionListener);
                    this.microphonePermission = permission;
                    this.permissionListener = () => {
                        // Granting a prompted verification must finish and release
                        // its stream before it can reveal the player.
                        if (permission.state === 'granted' && this.microphoneCheckVersion === this.preflightVersion) return;
                        // Invalidate before any awaited read or device verification.
                        this.preflightVersion++;
                        this.setReady(false);
                        this.checkPrerequisites();
                    };
                    permission.addEventListener?.('change', this.permissionListener);
                }
                this.checkMicrophoneButton.disabled = false;
                if (permission?.state === 'denied') {
                    this.setReady(false);
                    this.microphoneStatus.textContent = 'Dostęp do mikrofonu jest zablokowany. Zezwól na mikrofon w ustawieniach tej strony i ponów sprawdzenie.';
                    return;
                }
                if (explicitMicrophone) {
                    this.checkMicrophoneButton.disabled = true;
                    this.microphoneStatus.textContent = 'Sprawdzanie mikrofonu…';
                    let stream;
                    this.microphoneCheckVersion = version;
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({audio: true});
                        if (!stream.getTracks().some(track => track.kind === 'audio' && track.readyState !== 'ended')) throw Object.assign(new Error(), {name: 'NotFoundError'});
                    } finally {
                        // Even stale checks must release every verification track.
                        for (const track of stream?.getTracks() || []) track.stop();
                        if (this.microphoneCheckVersion === version) this.microphoneCheckVersion = null;
                    }
                    if (!current()) return;
                } else if (permission?.state !== 'granted') {
                    this.setReady(false);
                    this.microphoneStatus.textContent = 'Kliknij „Sprawdź mikrofon”, aby potwierdzić dostęp do urządzenia. Przeglądarka może poprosić o zgodę.';
                    return;
                } else if (navigator.mediaDevices.enumerateDevices) {
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    if (!current()) return;
                    if (!devices.some(device => device.kind === 'audioinput')) throw Object.assign(new Error(), {name: 'NotFoundError'});
                } else {
                    this.setReady(false);
                    this.microphoneStatus.textContent = 'Kliknij „Sprawdź mikrofon”, aby potwierdzić dostępność urządzenia.';
                    return;
                }
                if (!current() || !this.access || permission?.state === 'denied') return;
                this.microphoneStatus.textContent = 'Dostęp do mikrofonu potwierdzony. Mikrofon pozostaje wyłączony do rozpoczęcia wywiadu.';
                this.setReady(true);
            } catch (error) {
                if (!current()) return;
                if (!this.accessChecked) { this.rejectRead('network_error'); return; }
                this.setReady(false);
                this.microphoneStatus.textContent = ({
                    NotAllowedError: 'Nie udzielono dostępu do mikrofonu. Zezwól na mikrofon w ustawieniach strony i kliknij „Sprawdź mikrofon”.',
                    NotFoundError: 'Nie znaleziono mikrofonu. Podłącz urządzenie i kliknij „Sprawdź mikrofon”.',
                    NotReadableError: 'Mikrofon jest zajęty lub niedostępny. Zamknij inne aplikacje używające mikrofonu i ponów sprawdzenie.'
                })[error.name] || 'Nie udało się sprawdzić mikrofonu. Sprawdź urządzenie i ponów sprawdzenie.';
            } finally {
                if (current()) this.checkMicrophoneButton.disabled = !this.accessChecked || window.isSecureContext !== true || !navigator.mediaDevices?.getUserMedia;
            }
        }
        canStart() {
            return this.client.state === 'idle' || this.client.restartable || (this.questionsOnly() && this.client.state === 'paused');
        }
        questionsOnly() {
            return this.client.questionsOnly === true || this.client.session?.recording_consent === false;
        }
        prepareClient() {
            // A paused question-only session must retain its ID, fee and client.
            if (!this.client.restartable) return;
            this.client.dispose();
            this.sessionId = null; this.latest = null;
            this.dismissedTips.clear(); this.shownTips.clear();
            this.resetAudioView();
            this.root.querySelector('[data-tips]').replaceChildren();
            this.makeClient();
        }
        refreshControls() {
            const state = this.client.state;
            const pending = this.operationPending || this.questionsPending || this.client.startPending ||
                this.client.questionsSending || ['starting', 'stopping', 'retry'].includes(state);
            const canStart = this.canStart();
            this.buttons.start.disabled = !this.access || !canStart || !this.consent.checked || Boolean(pending);
            this.buttons.pause.disabled = !this.access || state !== 'recording' || Boolean(this.operationPending);
            this.buttons.resume.disabled = !this.access || state !== 'paused' || !this.consent.checked || this.questionsOnly() || Boolean(pending);
            this.buttons.questions.disabled = !this.access || Boolean(pending);
            this.buttons.stop.disabled = !this.access || !this.client.session || ['idle', 'stopped', 'stopping'].includes(state) || Boolean(this.operationPending);
            this.buttons.retry.hidden = state !== 'retry';
            this.buttons.retry.disabled = !this.access || Boolean(this.operationPending);
            this.consent.disabled = !this.access || !canStart || Boolean(pending);
            if (!this.ready) {
                for (const button of Object.values(this.buttons)) button.disabled = true;
                this.consent.disabled = true;
            }
        }
        makeClient() {
            this.client = window.CelloklabLiveAudio.create({pluginId, profileId: 'interview',
                onUpdate: session => this.update(session), onSession: (session, state) => this.sessionState(session, state),
                onAudioLevel: level => this.audioLevel(level),
                onTransport: transport => {
                    const details = this.root.querySelector('[data-audio-accepted]');
                    details.textContent = 'Audio w buforze: ' + transport.bufferedSeconds.toFixed(1) + ' s. Stan przetwarzania: ' +
                        ({ready: 'gotowe', sending: 'wysyłanie', pending: 'oczekiwanie na potwierdzenie', recovering: 'sprawdzanie potwierdzenia', failed: 'przetwarzanie niedostępne'}[transport.status] || 'oczekiwanie');
                    this.diagnose('transport_' + transport.status);
                    if (this.client?.capturing && !this.errorMessage) this.status.textContent = 'Nagrywanie.';
                },
                onError: error => {
                    this.diagnose(error.code);
                    if (technicalErrors.has(error.code)) return;
                    if (denied(error.code)) this.rejectRead(error.code);
                    if (error.code === 'microphone_unavailable') {
                        this.preflightVersion++;
                        this.setReady(false);
                        this.microphoneStatus.textContent = 'Nie można włączyć mikrofonu. Sprawdź urządzenie i kliknij „Sprawdź mikrofon”.';
                    }
                    this.errorMessage = errors[error.code] || 'Nie udało się zakończyć operacji. Sprawdź stan sesji i ponów oczekujące żądanie.';
                    this.status.textContent = this.errorMessage;
                    this.refreshControls();
                }});
        }
        diagnose(code) {
            // Codes/counts only; never log session IDs, field values, quotes or raw responses.
            if (typeof code !== 'string' || !/^[a-z0-9_]{1,80}$/.test(code) || this.diagnosticKeys.has(code)) return;
            this.diagnosticKeys.add(code);
            console.warn('[Vision] diagnostyka:', code);
        }
        clearAccess(code = 'access_revoked') {
            this.preflightVersion++;
            this.accessChecked = false;
            this.setReady(false, false);
            this.checkMicrophoneButton.disabled = true;
            if (code === 'access_revoked') this.accessStatus.textContent = 'Dostęp do karty został cofnięty. Sprawdź uprawnienia i aktywny profil kliniczny.';
            if (!this.access) return;
            this.access = false; this.scope++;
            if ((this.client.active || this.client.startPending || this.client.capturing) && this.client.session?.status !== 'revoked') this.client.revoke?.().catch(() => {});
            for (const item of this.proposals.values()) {
                item.status = 'revoked';
                for (const control of item.controls || []) control.disabled = true;
            }
            this.proposals.clear(); this.groups = []; this.dismissedTips.clear(); this.shownTips.clear(); this.record = this.latest = null;
            this.proposalRoot?.querySelector('[data-proposals]').replaceChildren();
            this.root.querySelector('[data-tips]').replaceChildren();
            this.resetAudioView();
            this.root.querySelector('[data-budget]').textContent = '';
            if (this.proposalRoot) this.proposalRoot.querySelector('[data-proposals-empty]').hidden = false;
            for (const button of Object.values(this.buttons)) button.disabled = true;
            this.root.querySelector('[data-consent]').disabled = true;
        }
        async run(action) {
            if (!this.access || !this.ready || this.operationPending) return;
            this.operationPending = true;
            this.errorMessage = '';
            this.status.textContent = 'Trwa operacja…';
            this.refreshControls();
            try { await action(); }
            catch (_) {
                if (!this.errorMessage) this.errorMessage = 'Nie udało się wykonać operacji. Karta pozostaje bez zmian.';
                this.status.textContent = this.errorMessage;
            }
            finally { this.operationPending = false; this.refreshControls(); }
        }
        resetAudioView() {
            this.audioLevel({rms: 0, peak: 0, active: false});
            this.root.querySelector('[data-audio-accepted]').textContent = 'Fragmenty audio potwierdzone przez serwer: 0.';
            this.root.querySelector('[data-transcript]').replaceChildren();
            this.root.querySelector('[data-transcript-empty]').hidden = false;
            this.root.querySelector('[data-transcript-empty]').textContent = 'Brak transkrypcji — oczekiwanie na wynik dostawcy AI.';
        }
        audioLevel(level) {
            const active = this.access && level?.active === true;
            const rms = active && Number.isFinite(level.rms) ? Math.max(0, Math.min(1, level.rms)) : 0;
            // Bounded history of derived levels only, never PCM or persisted audio.
            if (!active) this.levelHistory = Array(32).fill(0);
            else { this.levelHistory = (this.levelHistory || Array(32).fill(0)).slice(1); this.levelHistory.push(Math.min(1, Math.sqrt(rms) * 3)); }
            const wave = this.root.querySelector('[data-audio-wave]');
            if (wave) wave.setAttribute('d', this.levelHistory.map((value, i) => (i ? 'L' : 'M') + (i * 240 / 31).toFixed(1) + ' ' + (24 + (i % 2 ? -1 : 1) * value * 21).toFixed(1)).join(' '));
            // Logarithmic meter aids quiet speech.
            this.root.querySelector('[data-audio-meter]').value = rms > 0 ? Math.max(0, Math.min(1, (20 * Math.log10(rms) + 60) / 60)) : 0;
            this.root.querySelector('[data-audio-signal]').textContent = !active ? 'Mikrofon wyłączony.' :
                rms > 0.001 ? 'Mikrofon odbiera sygnał.' : 'Mikrofon włączony — cisza lub bardzo słaby sygnał.';
        }
        transcript(session) {
            const list = this.root.querySelector('[data-transcript]');
            list.replaceChildren();
            const segments = (Array.isArray(session.segments) ? session.segments : []).filter(s => typeof s?.text === 'string' && s.text.trim()).slice(-4);
            for (const segment of segments) {
                const row = element('li', undefined, 'va-transcript-segment');
                const timing = Number.isFinite(segment.start) && Number.isFinite(segment.end) ? segment.start.toFixed(1) + '–' + segment.end.toFixed(1) + ' s' : 'Fragment';
                row.appendChild(element('span', timing + (typeof segment.speaker === 'string' ? ' · ' + segment.speaker.slice(0, 80) : ''), 'va-label'));
                row.appendChild(element('p', segment.text.slice(0, 2000)));
                list.appendChild(row);
            }
            const empty = this.root.querySelector('[data-transcript-empty]');
            empty.hidden = segments.length > 0;
            empty.textContent = session.next_sequence > 0 ? 'Serwer potwierdził audio, ale nie zwrócił jeszcze transkrypcji. To nie jest potwierdzenie rozpoznania mowy.' : 'Brak transkrypcji — oczekiwanie na wynik dostawcy AI.';
            const count = Number.isSafeInteger(session.next_sequence) && session.next_sequence >= 0 ? session.next_sequence : 0;
            this.root.querySelector('[data-audio-accepted]').textContent = 'Fragmenty audio potwierdzone przez serwer: ' + count + '.';
        }
        proposalState() {
            if (this.proposalRoot) this.proposalRoot.querySelector('[data-proposals-empty]').hidden = Array.from(this.proposals.values()).some(item => ['pending', 'saving'].includes(item.status));
        }
        sessionState(session, state) {
            if (session?.status === 'revoked') this.clearAccess();
            if (!this.access) return;
            if (state === 'stopped' && this.previousState !== 'stopped') {
                this.consent.checked = false;
                this.root.querySelector('[data-consent-block]').hidden = false;
            }
            this.previousState = state;
            this.status.textContent = this.errorMessage || (this.questionsPending ? 'Przygotowywanie pytań…' :
                state === 'idle' && !this.consent.checked ? 'Zgoda wymagana do nagrywania.' : states[state] || 'Sprawdzanie sesji…');
            if (state !== 'recording') this.audioLevel({active: false});
            this.refreshControls();
            if (session) this.root.querySelector('[data-budget]').textContent = 'Stała opłata za tę sesję: ' + display(session.credit_cost) +
                ' kredytów. ' + (session.charged ? 'Opłata naliczona.' : 'Opłata jeszcze nienaliczona.') + ' Limit sesji: ' + display(session.max_duration_seconds) + ' s.';
        }
        update(session) {
            if (session.status === 'revoked') { this.clearAccess(); return; }
            if (!this.access) return;
            if (this.sessionId && this.sessionId !== session.session_id) return;
            this.sessionId = session.session_id;
            this.latest = session;
            this.transcript(session);
            const tips = this.root.querySelector('[data-tips]');
            const incomingTips = (Array.isArray(session.tips) ? session.tips : []).filter(tip => typeof tip === 'string' && tip.trim()).slice(0, 4);
            // Lifecycle/audio responses with no tips must not erase questions.
            if (incomingTips.length) {
                this.tipVersion = (this.tipVersion || 0) + 1;
                for (const tip of incomingTips) {
                    if (this.dismissedTips.has(tip) || this.shownTips.has(tip)) continue;
                    this.shownTips.add(tip);
                    const pill = element('li', undefined, 'va-question-pill');
                    pill.appendChild(element('span', tip));
                    const remove = this.iconButton('Usuń zadane pytanie', 'fa-xmark', 'va-question-remove');
                    remove.addEventListener('click', () => {
                        if (!this.access) return;
                        this.dismissedTips.add(tip);
                        pill.hidden = true;
                    });
                    pill.appendChild(remove);
                    tips.appendChild(pill);
                }
            }
            const suggestions = Array.isArray(session.suggestions) ? session.suggestions : [];
            const diagnostic = [suggestions.length, (session.segments || []).length, session.error_code || 'none'].join('_');
            this.diagnose('result_' + diagnostic);
            const counts = session.extraction_counts;
            if (counts) {
                const values = ['model_updates','validated_proposals','unchanged_proposals','published_proposals'].map(k => Number.isSafeInteger(counts[k]) && counts[k] >= 0 ? counts[k] : 0);
                this.diagnose('extraction_' + values.join('_'));
            }
            for (const proposal of suggestions) this.addProposal(proposal, session);
            this.proposalState();
        }
        addProposal(proposal, session) {
            if (!this.proposalRoot) {
                this.proposalRoot = Array.from(document.querySelectorAll('[data-vision-proposals]')).find(slot => slot.dataset.visionContext === this.root.dataset.visionContext);
                if (!this.proposalRoot) { this.diagnose('proposal_slot_missing'); return; }
            }
            // Preferred host shape is one field per suggestion. Also accept the
            // public updates/sources DTO with host-attached base_values/revision.
            const fields = typeof proposal?.field === 'string' ? {[proposal.field]: own(proposal, 'value') ? proposal.value : proposal.proposed_value} : proposal?.updates;
            const id = proposal?.proposal_id || proposal?.id;
            if (!id || !fields || typeof fields !== 'object') return;
            const schema = this.bridge.getSchema();
            for (const [field, value] of Object.entries(fields)) {
                const key = session.session_id + ':' + id + ':' + field;
                if (this.proposals.has(key)) continue;
                if (!own(schema, field)) { this.diagnose('proposal_field_unavailable'); continue; }
                const descriptor = schema[field];
                if (!this.valid(descriptor, value)) { this.diagnose('proposal_value_invalid'); continue; }
                // Revision MUST be captured at the proposal's source. Never
                // substitute the latest record revision just to make PATCH work.
                const revision = proposal.revision ?? proposal.source_revision ?? proposal.context?.revision;
                const baselines = proposal.base_values || proposal.current_values;
                const hasBaseline = own(proposal, 'current_value') || (baselines && own(baselines, field)) || (proposal.context && own(proposal.context, 'baseline'));
                const current = own(proposal, 'current_value') ? proposal.current_value : baselines && own(baselines, field) ? baselines[field] : proposal.context?.baseline;
                if (typeof revision !== 'string' || !hasBaseline || (current !== null && !this.valid(descriptor, current))) { this.diagnose('proposal_baseline_invalid'); continue; }
                let refs = proposal.sources?.[field] || proposal.evidence || proposal.sources;
                if (Array.isArray(refs) && refs.every(ref => typeof ref === 'string')) {
                    refs = refs.map(quote => {
                        const segment = (session.segments || []).find(s => s.text === quote && (proposal.segment_ids || []).includes(s.segment_id));
                        return segment ? {quote, start: segment.start, end: segment.end, speaker: segment.speaker} : null;
                    });
                }
                if (!Array.isArray(refs) || !refs.length || !refs.every(ref => ref && typeof ref.quote === 'string' && ref.quote.trim())) { this.diagnose('proposal_evidence_invalid'); continue; }
                // AI adds checkbox selections; it must not silently remove a
                // clinician's persisted selections. The exact union is shown
                // before acceptance, not appended invisibly during saving.
                const proposed = descriptor.type === 'string[]' ? [...new Set([...(current || []), ...(value || [])])] : value;
                if (!this.valid(descriptor, proposed)) { this.diagnose('proposal_value_invalid'); continue; }
                const item = {key, proposal, field, value: Array.isArray(proposed) ? Object.freeze([...proposed]) : proposed,
                    current: Array.isArray(current) ? Object.freeze([...current]) : current,
                    revision, status: 'pending', refs: refs.map(ref => ({...ref})), descriptor};
                this.proposals.set(key, item);
                // Exact source identity and original revision, never semantic
                // text matching or rebasing. Closed/saving groups cannot gain
                // unseen fields. Duplicate-field proposals stay separate.
                const sourceKey = JSON.stringify([session.session_id, revision,
                    [...(proposal.segment_ids || [])].sort(), refs.map(ref =>
                        [ref.quote, ref.start ?? null, ref.end ?? null, ref.speaker ?? null]).sort()]);
                let group = this.groups.find(g => g.sourceKey === sourceKey &&
                    g.items.every(member => member.status === 'pending') && !g.items.some(member => member.field === field));
                if (!group) { group = {sourceKey, items: []}; this.groups.push(group); }
                group.items.push(item);
                this.render(group);
            }
        }
        valid(schema, value) {
            if (value === null) return schema.nullable !== false;
            if (schema.type === 'boolean') return typeof value === 'boolean';
            if (schema.type === 'string[]') return Array.isArray(value) && value.length <= 200 && value.every(v => typeof v === 'string' && (!schema.choices || schema.choices.includes(v))) && new Set(value).size === value.length;
            return typeof value === 'string' && value.length <= 20000 && (!schema.choices || schema.choices.includes(value));
        }
        render(group) {
            const items = [...group.items], item = items[0];
            const card = group.card || element('article', undefined, 'clk-ui-card clk-ui-card--compact va-proposal');
            const firstRender = !group.card;
            group.card = card;
            card.replaceChildren();
            const body = element('div', undefined, 'clk-ui-card-body va-proposal-content');
            card.appendChild(body);
            if (items.length > 1) body.appendChild(element('strong', 'Jedna wypowiedź · ' + items.length + ' pól'));
            for (const member of items) {
                body.appendChild(element('strong', this.record?.native_field_labels?.[member.field] || this.record?.field_labels?.[member.field] || member.descriptor.label || member.field));
                body.appendChild(element('p', 'Było: ' + this.fieldDisplay(member, member.current), 'va-baseline clk-ui-help'));
                body.appendChild(element('p', 'Propozycja: ' + this.fieldDisplay(member, member.value), 'va-proposed'));
            }
            for (const ref of item.refs) body.appendChild(element('blockquote', 'Źródło' +
                (Number.isFinite(ref.start) && Number.isFinite(ref.end) ? ' (' + ref.start + '–' + ref.end + ' s)' : '') + ': „' + ref.quote + '”', 'va-source clk-ui-help'));
            const note = element('p', '', 'clk-ui-help');
            note.setAttribute('role', 'status');
            body.appendChild(note);
            const actions = element('div', undefined, 'clk-ui-row va-proposal-actions');
            body.appendChild(actions);
            const accept = this.iconButton(items.length > 1 ? 'Akceptuj wszystkie pola wypowiedzi' : 'Akceptuj propozycję', 'fa-check', 'va-accept');
            const reject = this.iconButton(items.length > 1 ? 'Odrzuć wszystkie pola wypowiedzi' : 'Odrzuć propozycję', 'fa-xmark', 'va-reject');
            items.forEach(member => { member.controls = [accept, reject]; });
            for (const button of item.controls) actions.appendChild(button);
            reject.addEventListener('click', () => {
                if (!this.access || items.some(member => member.status !== 'pending') || group.card !== card || group.items.length !== items.length) return;
                items.forEach(member => { member.status = 'rejected'; }); card.hidden = true;
                this.proposalState();
                // Tombstone retained for this proposal only: later independent
                // proposals for the same field remain reviewable.
            });
            accept.addEventListener('click', async () => {
                if (!this.access || items.some(member => member.status !== 'pending') || group.items.length !== items.length) return;
                const scope = this.scope;
                if (items.some(member => !this.valid(member.descriptor, member.value))) { note.textContent = 'Wybierz poprawną wartość pola.'; return; }
                items.forEach(member => { member.status = 'saving'; });
                accept.disabled = reject.disabled = true;
                try {
                    const result = await this.bridge.savePatch(pluginId, Object.fromEntries(items.map(member => [member.field, member.value])),
                        {revision: item.revision, expected_values: Object.fromEntries(items.map(member => [member.field, member.current]))});
                    if (scope !== this.scope || !this.access) return;
                    if (!result.ok) {
                        if (denied(result.code)) { this.rejectRead(result.code); return; }
                        items.forEach(member => { member.status = 'pending'; });
                        const saveErrors = {
                            native_dirty: 'Najpierw zapisz ręczne zmiany w karcie pacjenta. Propozycja pozostaje do sprawdzenia; niczego nie nadpisano.',
                            draft_changed: 'Pole zostało zmienione podczas akceptacji. Zachowano ręczną edycję; niczego nie zapisano.',
                            revision_conflict: 'Karta zmieniła się od powstania propozycji. Poczekaj na nową propozycję opartą na aktualnej karcie.',
                            baseline_conflict: 'Wartość pola w formularzu różni się od zapisanej karty. Zapisz ręczne zmiany przed ponowną analizą.',
                            invalid_patch: 'Proponowana wartość nie pasuje do edytowalnego pola formularza.',
                            invalid_baseline: 'Nieprawidłowa wartość bazowa propozycji. Niczego nie zapisano.',
                            save_locked: 'Trwa inny zapis karty. Spróbuj po jego zakończeniu.',
                            csrf_required: 'Brak tokenu sesji do zapisu. Otwórz ponownie kartę po zachowaniu ręcznych zmian.',
                            network_error: 'Nie potwierdzono zapisu z powodu błędu połączenia. Sprawdź kartę przed ponowieniem.',
                            form_unavailable: 'Formularz wywiadu jest niedostępny.',
                            invalid_confirmation: 'Serwer nie zwrócił prawidłowego potwierdzenia zapisu. Sprawdź kartę przed ponowieniem.',
                            revision_required: 'Propozycja nie ma prawidłowej wersji źródłowej karty.',
                            invalid_record: 'Odczyt karty nie zawiera prawidłowej wartości tego pola.'
                        };
                        note.textContent = saveErrors[result.code] || 'Nie potwierdzono zapisu zmiany. Sprawdź odpowiedź żądania zapisu w panelu Network.';
                        accept.disabled = reject.disabled = false;
                        return;
                    }
                    items.forEach(member => { member.status = 'accepted'; });
                    card.hidden = true;
                    this.proposalState();
                    note.textContent = result.preserved?.length ? 'Zapisano. Zachowano nowszą ręczną edycję formularza.' : 'Zapisano zatwierdzoną zmianę.';
                    // Bridge returns application status, not the full new record.
                    // Refresh only after confirmed success. Existing proposals
                    // keep their original revision and are never silently rebased.
                    // A failed refresh must not turn a confirmed save back into
                    // a retryable proposal (and risk a duplicate PATCH).
                    const read = await this.bridge.readRecord(pluginId).catch(() => null);
                    if (scope === this.scope && this.access && !read?.ok) { this.rejectRead(read?.code || 'network_error'); return; }
                    if (scope === this.scope && this.access && read?.ok) this.record = read.record;
                } catch (_) {
                    if (scope !== this.scope || !this.access) return;
                    items.forEach(member => { member.status = 'pending'; }); accept.disabled = reject.disabled = false;
                    note.textContent = 'Nie potwierdzono zapisu. Sprawdź kartę przed ponowieniem.';
                }
            });
            if (firstRender) this.proposalRoot.querySelector('[data-proposals]').appendChild(card);
        }
        fieldDisplay(item, value) {
            if (item.field === 'supplements_list' && typeof value === 'string') {
                try {
                    const rows = JSON.parse(value);
                    if (Array.isArray(rows)) return rows.map(row => [row.name, row.dose, row.frequency, row.since ? 'od ' + row.since : '', row.schedule].filter(Boolean).join(' · ')).join('; ') || '(brak)';
                } catch (_) { /* Historical plain text remains visible. */ }
            }
            const labels = {...(item.descriptor.choice_labels || {}), ...(this.record?.interview_options?.[item.field] || {}), ...(this.record?.native_options?.[item.field] || {})};
            const label = choice => labels[choice] || (item.descriptor.choices ? 'Wartość bez etykiety' : display(choice));
            if (value == null || value === '' || typeof value === 'boolean') return display(value);
            return Array.isArray(value) ? value.map(label).join(', ') || '(brak)' : label(value);
        }
        iconButton(label, icon, className) {
            const button = element('button', undefined, 'clk-ui-button va-icon ' + className);
            button.type = 'button';
            button.setAttribute('aria-label', label); button.setAttribute('title', label);
            const glyph = element('i', undefined, 'fa-solid ' + icon);
            glyph.setAttribute('aria-hidden', 'true'); button.appendChild(glyph);
            return button;
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
