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
    const KNOWLEDGE = Array.isArray(window.CelloklabVisionKnowledge) ? window.CelloklabVisionKnowledge : [];
    const KNOWLEDGE_CODES = window.CelloklabVisionKnowledgeCodes || {};
    const CATEGORY = {disease: 'pojęcie', drug: 'lek', substance: 'substancja', procedure: 'zabieg'};
    const compiled = KNOWLEDGE.map(item => {
        try { return {...item, re: new RegExp(item.pattern, 'iu')}; } catch (_) { return null; }
    }).filter(Boolean);
    // Lexical mentions only: intentionally NOT a diagnosis/negation classifier.
    function termsIn(text) {
        const found = new Map();
        if (typeof text !== 'string' || !text.trim()) return found;
        const mentions = compiled.map(item => ({item, index: text.search(item.re)})).filter(entry => entry.index >= 0).sort((a, b) => a.index - b.index);
        for (const {item} of mentions) found.set(item.term, item);
        if (found.has('niedoczynnosc_tarczycy') || found.has('nadczynnosc_tarczycy') || found.has('hashimoto') || found.has('lewotyroksyna')) found.delete('choroba_tarczycy');
        return found;
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
            this.cardTerms = new Map();
            this.conversationTerms = new Map();
            this.dismissedInsights = new Set();
            this.setupTabs();
            this.ready = false;
            this.preflightVersion = 0;
            this.accessChecked = false;
            this.disclosure = root.querySelector('.va-main');
            this.chatHistory = [];
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
            this.setupChat();
            this.setupReviewBanner();
            root.querySelector('[data-close]')?.addEventListener('click', () => this.closeSafely());
            root.querySelector('.va-summary')?.addEventListener('click', event => {
                if (this.disclosure.open && (this.chatPending || this.client.capturing || this.client.active || this.client.startPending)) {
                    event.preventDefault(); this.closeSafely();
                }
            });
            this.consent.addEventListener('change', () => {
                if (!this.consent.checked && this.client.capturing) Promise.resolve(this.client.stop()).catch(() => {});
                this.refreshChatControls();
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
                if (!this.accessChecked || !this.access || !this.ready || !this.canStart()) return;
                if (!this.consent.checked) { this.status.textContent = 'Zgoda wymagana do nagrywania.'; return; }
                this.prepareClient();
                const scope = this.scope;
                let read;
                try { read = await this.bridge.readRecord(pluginId); }
                catch (error) { if (scope === this.scope) this.rejectRead('network_error'); throw error; }
                if (scope !== this.scope || !this.access || !this.ready || !this.consent.checked) return;
                if (!read.ok) { this.rejectRead(read.code); throw new Error('record_unavailable'); }
                this.record = read.record;
                this.cardInsights(this.record);
                await this.client.start({recordingConsent: true});
            }));
            for (const action of ['pause', 'resume', 'stop', 'retry']) this.buttons[action].addEventListener('click', () => this.run(() => {
                if (action === 'resume' && (!this.ready || !this.consent.checked || this.questionsOnly())) return;
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
            this.ready = ready;
            this.readyControls.hidden = !this.accessChecked;
            this.info.hidden = !this.accessChecked;
            if (!this.accessChecked) this.info.open = false;
            this.gate.hidden = ready;

            // Public stop releases capture, including an in-flight start.
            if (!ready && stopCapture && (this.client?.capturing || this.client?.state === 'starting')) {
                Promise.resolve(this.client.stop()).catch(() => {});
            }
            if (this.client) this.refreshControls();
            if (ready) this.cardInsights(this.record);
        }
        rejectRead(code) {
            this.accessChecked = false;
            if (!denied(code)) this.scope++;
            // A denial uses revoke (no audio flush), not a normal session stop.
            this.setReady(false, !denied(code));
            this.checkMicrophoneButton.disabled = true;
            const messages = {
                actor_denied: 'Nie potwierdzono dostępu do karty. Sprawdź, czy pacjent jest przypisany do zalogowanego specjalisty i czy aktywny jest użytkownik oraz jego rola specjalisty w tej klinice.',
                capability_denied: 'Brak uprawnienia do odczytu karty pacjenta przez Vision. Poproś administratora o nadanie wtyczce wymaganych uprawnień odczytu.',
                access_revoked: 'Dostęp do karty został cofnięty. Sprawdź aktywną rolę specjalisty w tej klinice i przypisanie pacjenta.'
            };
            this.accessStatus.textContent = messages[code] || (denied(code) ?
                'Nie potwierdzono dostępu do karty pacjenta. Sprawdź zalogowane konto, aktywną rolę specjalisty w tej klinice i przypisanie pacjenta.' :
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
                this.readyControls.hidden = false;
                this.refreshChatControls();
                this.patientName();
                this.cardInsights(this.record);
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
        setupTabs() {
            const tabs = Array.from(this.root.querySelectorAll('[data-va-tab]'));
            const panes = Array.from(this.root.querySelectorAll('[data-va-pane]'));
            const show = name => {
                if (!this.accessChecked || !this.access || !tabs.some(tab => tab.dataset.vaTab === name)) return;
                for (const tab of tabs) {
                    const selected = tab.dataset.vaTab === name;
                    tab.setAttribute('aria-selected', String(selected));
                    tab.setAttribute('tabindex', selected ? '0' : '-1');
                }
                for (const pane of panes) pane.hidden = pane.dataset.vaPane !== name;
            };
            tabs.forEach((tab, index) => {
                tab.addEventListener('click', () => show(tab.dataset.vaTab));
                tab.addEventListener('keydown', event => {
                    if (!this.accessChecked || !this.access) return;
                    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length :
                        event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length :
                        event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
                    if (next === null) return;
                    event.preventDefault(); show(tabs[next].dataset.vaTab); tabs[next].focus();
                });
            });
            this.showTab = show;
        }
        cardInsights(record) {
            if (!this.access || !this.accessChecked) return;
            const values = {...(record?.interview_values || {}), ...(record?.native_values || {})};
            const terms = new Map();
            for (const code of Array.isArray(values.chronic_diseases) ? values.chronic_diseases : []) {
                const item = compiled.find(entry => entry.term === KNOWLEDGE_CODES[code]);
                if (item) terms.set(item.term, item);
            }
            const texts = ['chronic_diseases_other', 'other_conditions', 'current_medications', 'medication_changes', 'medication_list',
                'supplements_list', 'trichology_treatments', 'previous_treatments', 'hormonal_status', 'contraception', 'trt_status']
                .map(field => values[field] ?? record?.[field]).filter(value => typeof value === 'string');
            for (const [term, item] of termsIn(texts.join('\n'))) terms.set(term, item);
            if (terms.has('niedoczynnosc_tarczycy') || terms.has('nadczynnosc_tarczycy') || terms.has('hashimoto') || terms.has('lewotyroksyna')) terms.delete('choroba_tarczycy');
            this.cardTerms = terms;
            this.renderInsights();
        }
        renderInsights(conversation = this.conversationTerms) {
            if (!this.access || !this.accessChecked) return;
            this.conversationTerms = conversation;
            const box = this.root.querySelector('[data-insights]');
            const older = this.root.querySelector('[data-older-insights-list]');
            older?.replaceChildren();
            const merged = new Map([...this.cardTerms].map(([term, item]) => [term, {item, where: 'Wzmianka w karcie'}]));
            for (const [term, item] of conversation) { merged.delete(term); merged.set(term, {item, where: 'Wzmianka w rozmowie'}); }
            box.replaceChildren();
            let visible = 0;
            for (const [term, {item, where}] of [...merged].reverse()) {
                if (this.dismissedInsights.has(term)) continue;
                visible++;
                const card = element('article', undefined, visible === 1 ? 'va-insight va-insight-new' : 'va-insight');
                card.appendChild(element('small', where + ' · ' + (CATEGORY[item.category] || 'pojęcie')));
                card.appendChild(element('strong', item.title));
                card.appendChild(element('p', item.summary));
                if (item.ask) card.appendChild(element('p', 'Warto dopytać: ' + item.ask, 'va-ask'));
                const hide = this.iconButton('Ukryj objaśnienie: ' + item.title, 'fa-xmark', 'va-insight-hide');
                hide.addEventListener('click', () => {
                    if (!this.access || !this.accessChecked) return;
                    this.dismissedInsights.add(term); this.renderInsights();
                });
                card.appendChild(hide);
                (visible > 3 && older ? older : box).appendChild(card);
            }
            const disclosure = this.root.querySelector('[data-older-insights]'); if (disclosure) disclosure.hidden = visible <= 3;
            this.root.querySelector('[data-insights-box]').hidden = visible === 0;
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
            this.dismissedInsights.clear(); this.conversationTerms.clear();
            this.renderInsights();
            this.resetAudioView();
            this.root.querySelector('[data-tips]').replaceChildren();
            this.root.querySelector('[data-older-tips]')?.replaceChildren();
            this.chatHistory = [];
            this.root.querySelector('[data-conversation]')?.replaceChildren();
            this.makeClient();
        }
        refreshControls() {
            const state = this.client.state;
            const pending = this.operationPending || this.questionsPending || this.chatPending || this.client.startPending ||
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
            this.buttons.stop.disabled = !this.accessChecked || !this.access || !this.client.session || ['idle', 'stopped', 'stopping'].includes(state) || Boolean(this.operationPending);
            this.refreshChatControls();
            this.headerState();
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
            this.cardTerms.clear(); this.conversationTerms.clear(); this.dismissedInsights.clear();
            this.root.querySelector('[data-insights]').replaceChildren();
            this.root.querySelector('[data-older-insights-list]')?.replaceChildren();
            this.root.querySelector('[data-insights-box]').hidden = true;
            this.checkMicrophoneButton.disabled = true;
            if (code === 'access_revoked') this.accessStatus.textContent = 'Dostęp do karty został cofnięty. Sprawdź aktywną rolę specjalisty w tej klinice i przypisanie pacjenta.';
            if (!this.access) return;
            this.access = false; this.scope++;
            this.chatHistory = [];
            this.root.querySelector('[data-conversation]')?.replaceChildren();
            this.root.querySelector('[data-medication-candidates]')?.replaceChildren();
            this.root.querySelector('[data-sidebar-proposals]')?.replaceChildren();
            const name = this.root.querySelector('[data-patient-name]'); if (name) name.textContent = '';
            const input = this.root.querySelector('[data-chat-input]'); if (input) input.value = '';
            this.refreshChatControls();
            for (const group of this.groups) for (const node of group.inlineNodes || []) node.remove?.();
            if ((this.client.session || this.client.startPending || this.client.capturing) && this.client.session?.status !== 'revoked') this.client.revoke?.().catch(() => {});
            for (const item of this.proposals.values()) {
                item.status = 'revoked';
                for (const control of item.controls || []) control.disabled = true;
            }
            this.proposals.clear(); this.groups = []; this.dismissedTips.clear(); this.shownTips.clear(); this.record = this.latest = null;
            this.proposalRoot?.querySelector('[data-proposals]').replaceChildren();
            this.root.querySelector('[data-tips]').replaceChildren();
            this.resetAudioView();
            this.root.querySelector('[data-older-tips]')?.replaceChildren();
            const wait = this.root.querySelector('[data-chat-wait]'); if (wait) wait.textContent = '';
            this.root.querySelector('[data-budget]').textContent = '';
            if (this.proposalRoot) this.proposalRoot.querySelector('[data-proposals-empty]').hidden = false;
            for (const button of Object.values(this.buttons)) button.disabled = true;
            this.root.querySelector('[data-consent]').disabled = true;
        }
        async run(action) {
            if (!this.access || !this.accessChecked || this.operationPending) return;
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
            const badge = this.root.querySelector('[data-segment-count]');
            badge.textContent = '0'; badge.hidden = true;
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
            const meter = this.root.querySelector('[data-audio-meter]');
            if (meter) meter.value = rms > 0 ? Math.max(0, Math.min(1, (20 * Math.log10(rms) + 60) / 60)) : 0;
            const signal = this.root.querySelector('[data-audio-signal]');
            if (signal) signal.textContent = !active ? 'Mikrofon wyłączony.' :
                rms > 0.001 ? 'Mikrofon odbiera sygnał.' : 'Mikrofon włączony — cisza lub bardzo słaby sygnał.';
        }
        transcript(session) {
            const list = this.root.querySelector('[data-transcript]');
            const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
            list.replaceChildren();
            const all = (Array.isArray(session.segments) ? session.segments : []).filter(s => typeof s?.text === 'string' && s.text.trim());
            const segments = all.slice(-300);
            for (const segment of segments) {
                const row = element('li', undefined, 'va-transcript-segment');
                const timing = Number.isFinite(segment.start) && Number.isFinite(segment.end) ? segment.start.toFixed(1) + '–' + segment.end.toFixed(1) + ' s' : 'Fragment';
                row.appendChild(element('span', timing + (typeof segment.speaker === 'string' ? ' · ' + segment.speaker.slice(0, 80) : ''), 'va-label'));
                row.appendChild(element('p', segment.text.slice(0, 2000)));
                list.appendChild(row);
            }
            if (atBottom) list.scrollTop = list.scrollHeight;
            const badge = this.root.querySelector('[data-segment-count]');
            badge.textContent = String(all.length); badge.hidden = !all.length;
            if (this.accessChecked) {
                const mentions = new Map();
                for (const segment of all) for (const [term, item] of termsIn(segment.text)) { mentions.delete(term); mentions.set(term, item); }
                this.renderInsights(mentions);
            }
            const empty = this.root.querySelector('[data-transcript-empty]');
            empty.hidden = segments.length > 0;
            empty.textContent = session.next_sequence > 0 ? 'Serwer potwierdził audio, ale nie zwrócił jeszcze transkrypcji. To nie jest potwierdzenie rozpoznania mowy.' : 'Brak transkrypcji — oczekiwanie na wynik dostawcy AI.';
            const count = Number.isSafeInteger(session.next_sequence) && session.next_sequence >= 0 ? session.next_sequence : 0;
            this.root.querySelector('[data-audio-accepted]').textContent = 'Fragmenty audio potwierdzone przez serwer: ' + count + '.';
        }
        proposalState() {
            if (this.proposalRoot) this.proposalRoot.querySelector('[data-proposals-empty]').hidden = Array.from(this.proposals.values()).some(item => ['pending', 'saving'].includes(item.status));
            const items = [...this.proposals.values()].filter(item => ['pending', 'saving'].includes(item.status));
            const count = this.root.querySelector('[data-proposal-count]'); if (count) count.textContent = String(items.length);
            const banner = this.proposalRoot?.querySelector('[data-banner-count]'); if (banner) banner.textContent = items.length ? items.length + ' pól do sprawdzenia' : '';
            for (const action of ['accept', 'reject']) {
                const button = this.proposalRoot?.querySelector('[data-' + action + '-all]');
                if (button) button.disabled = !this.accessChecked || !items.length || items.some(item => item.status !== 'pending');
            }
            for (const group of this.groups) if (group.items.every(item => ['accepted', 'rejected', 'revoked'].includes(item.status))) {
                for (const node of group.inlineNodes || []) node.hidden = true;
            }
        }
        sessionState(session, state) {
            if (session?.status === 'revoked') this.clearAccess();
            if (!this.access) return;
            if (state === 'stopped' && this.previousState !== 'stopped') {
                this.consent.checked = false;
                this.root.querySelector('[data-consent-block]').hidden = false;
            }
            this.previousState = state;
            const finalAnalysis = state === 'stopped' && (this.client.analysisSending || this.client.analysisUncertain ||
                ['waiting', 'pending'].includes(session?.analysis?.status));
            this.status.textContent = this.errorMessage || (this.questionsPending ? 'Przygotowywanie pytań…' :
                finalAnalysis ? 'Mikrofon wyłączony. Oczekiwanie na końcową analizę…' :
                state === 'idle' && !this.consent.checked ? 'Zgoda wymagana do nagrywania.' : states[state] || 'Sprawdzanie sesji…');
            if (state !== 'recording') this.audioLevel({active: false});
            this.refreshControls();
            if (session) this.root.querySelector('[data-budget]').textContent = 'Stała opłata za tę sesję: ' + display(session.credit_cost) +
                ' kredytów. ' + (session.charged ? 'Opłata naliczona.' : 'Opłata jeszcze nienaliczona.') + ' Limit sesji: ' + display(session.max_duration_seconds) + ' s.';
        }
        update(session) {
            if (session.status === 'revoked') { this.clearAccess(); return; }
            if (!this.access || !this.accessChecked) return;
            if (this.sessionId && this.sessionId !== session.session_id) return;
            if (Number.isInteger(session.revision) && Number.isInteger(this.latest?.revision) && session.revision < this.latest.revision) return;
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
                        this.compactQuestions();
                    });
                    pill.appendChild(remove);
                    tips.insertBefore ? tips.insertBefore(pill, tips.firstChild) : tips.appendChild(pill);
                }
                this.compactQuestions();
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
                if (['chronic_diseases_other', 'other_conditions'].includes(field) && typeof value === 'string' && /(?:łysieni\w*|lysieni\w*|wysienie)\s+androgenow/iu.test(value)) { this.diagnose('proposal_value_invalid'); continue; }
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
                    refs = refs.map((quote, index) => {
                        const segment = (session.segments || []).find(s => s.text === quote && (proposal.segment_ids || []).includes(s.segment_id)) ||
                            (proposal.source === 'transcript' && refs.length === (proposal.segment_ids || []).length ? (session.segments || []).find(s => s.segment_id === proposal.segment_ids[index]) : null);
                        return segment ? {quote: segment.text, start: segment.start, end: segment.end, speaker: segment.speaker} :
                            proposal.source === 'message' && !(proposal.segment_ids || []).length ? {quote} : null;
                    });
                }
                if (!Array.isArray(refs) || !refs.length || !refs.every(ref => ref && typeof ref.quote === 'string' && ref.quote.trim())) { this.diagnose('proposal_evidence_invalid'); continue; }
                if (field === 'current_medications' && this.medicationMentions(value, refs) === null) { this.diagnose('proposal_medication_details_invalid'); continue; }
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
                let group = !proposal.vision_rpl_addition && this.groups.find(g => g.sourceKey === sourceKey &&
                    g.items.every(member => member.status === 'pending') && !g.items.some(member => member.field === field));
                if (!group) { group = {sourceKey, items: []}; this.groups.push(group); }
                group.items.push(item);
                this.render(group);
                if (field === 'current_medications') this.medicationHints(item, session);
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
            for (const node of group.inlineNodes || []) node.remove?.();
            group.inlineNodes = [];
            const body = element('div', undefined, 'clk-ui-card-body va-proposal-content');
            card.appendChild(body);
            if (items.length > 1) body.appendChild(element('strong', 'Jedna wypowiedź · ' + items.length + ' pól'));
            for (const member of items) {
                body.appendChild(element('strong', this.record?.native_field_labels?.[member.field] || this.record?.field_labels?.[member.field] || member.descriptor.label || member.field));
                body.appendChild(element('p', 'Było: ' + this.fieldDisplay(member, member.current), 'va-baseline clk-ui-help'));
                body.appendChild(element('p', 'Propozycja: ' + this.fieldDisplay(member, member.value), 'va-proposed'));
                for (const ref of member.refs) if (this.phonetic(ref.quote)) body.appendChild(element('small', 'Korekta STT — do potwierdzenia: „' + this.correctedPhonetic(ref.quote) + '”. Cytat źródłowy pozostaje oryginalny.'));
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
                if (!this.accessChecked || !this.access || this.batchPending || items.some(member => member.status !== 'pending') || group.card !== card || group.items.length !== items.length) return;
                items.forEach(member => { member.status = 'rejected'; }); card.hidden = true;
                this.proposalState();
                // Tombstone retained for this proposal only: later independent
                // proposals for the same field remain reviewable.
            });
            accept.addEventListener('click', async () => {
                if (!this.accessChecked || !this.access || this.batchPending || items.some(member => member.status !== 'pending') || group.items.length !== items.length) return;
                const scope = this.scope;
                if (items.some(member => !this.valid(member.descriptor, member.value))) { note.textContent = 'Wybierz poprawną wartość pola.'; return; }
                items.forEach(member => { member.status = 'saving'; });
                for (const member of items) for (const control of member.controls) control.disabled = true;
                this.proposalState();
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
                    if (scope === this.scope && this.access && read?.ok) {
                        this.record = read.record;
                        this.cardInsights(this.record);
                    }
                } catch (_) {
                    if (scope !== this.scope || !this.access) return;
                    items.forEach(member => { member.status = 'pending'; }); accept.disabled = reject.disabled = false;
                    note.textContent = 'Nie potwierdzono zapisu. Sprawdź kartę przed ponowieniem.';
                } finally {
                    if (scope === this.scope && this.access) for (const member of items) for (const control of member.controls) control.disabled = member.status !== 'pending';
                    this.proposalState();
                }
            });
            if (firstRender) (this.root.querySelector('[data-sidebar-proposals]') || this.proposalRoot.querySelector('[data-proposals]')).appendChild(card);
            for (const member of items) {
                const mount = this.bridge.getFieldMount?.(member.field);
                if (!mount?.appendChild) continue;
                const inline = element('aside', undefined, 'clk-plugin-ui vision-proposals va-inline-proposal');
                inline.setAttribute('data-plugin-nonform', '');
                inline.appendChild(element('strong', 'AI · ' + this.fieldDisplay(member, member.value)));
                inline.appendChild(element('small', 'Było: ' + this.fieldDisplay(member, member.current)));
                for (const ref of member.refs) if (this.phonetic(ref.quote)) inline.appendChild(element('small', 'Do potwierdzenia: „' + this.correctedPhonetic(ref.quote) + '”'));
                for (const ref of member.refs) inline.appendChild(element('blockquote', '„' + ref.quote + '”'));
                const yes = this.iconButton('Akceptuj sprawdzoną propozycję', 'fa-check', 'va-accept');
                const no = this.iconButton('Odrzuć propozycję', 'fa-xmark', 'va-reject');
                yes.addEventListener('click', () => accept.click()); no.addEventListener('click', () => reject.click());
                member.controls.push(yes, no); inline.appendChild(yes); inline.appendChild(no);
                mount.appendChild(inline); group.inlineNodes.push(inline);
            }
        }
        phonetic(text) { return /\bdu\s+(?:testeret|das\s+teret)\b|\bwysienie\s+androgenowe\b/iu.test(text); }
        correctedPhonetic(text) { return text.replace(/\bdu\s+(?:testeret|das\s+teret)\b/giu, 'dutasteryd').replace(/\bwysienie\s+androgenowe\b/giu, 'łysienie androgenowe'); }
        patientName() {
            if (!this.accessChecked || !this.access) return;
            const target = this.root.querySelector('[data-patient-name]');
            const context = this.bridge.getContext();
            const identity = document.querySelector?.('[id="patient-data"]');
            if (!target || identity?.dataset.patientId !== context?.patientId || identity?.dataset.tenantSlug !== context?.tenantSlug) return;
            const first = document.querySelector?.('#patientForm [name="first_name"]')?.value || '';
            const last = document.querySelector?.('#patientForm [name="last_name"]')?.value || '';
            target.textContent = (first + ' ' + last).trim().slice(0, 160);
        }
        headerState() {
            const active = this.client?.capturing && this.client?.state === 'recording';
            const analyzing = this.chatPending || ['starting', 'stopping'].includes(this.client?.state);
            const label = this.root.querySelector('[data-header-label]');
            if (label) label.textContent = active ? 'Nagrywanie' : analyzing ? 'Analizuję…' : 'Gotowy';
            const header = this.root.querySelector('[data-header-status]');
            if (header) header.dataset.state = active ? 'recording' : analyzing ? 'analyzing' : 'ready';
            const strip = this.root.querySelector('[data-recording-strip]'); if (strip) strip.hidden = !active;
            if (this.buttons?.start) this.buttons.start.hidden = active;
            if (this.buttons?.stop) this.buttons.stop.hidden = !this.client?.active;
            if (active && !this.recordingSince) {
                this.recordingSince = Date.now();
                const timer = this.root.querySelector('[data-recording-timer]'); if (timer) timer.textContent = '00:00';
            }
            if (!active) { this.recordingSince = null; if (typeof clearInterval === 'function') clearInterval(this.recordingTimer); this.recordingTimer = null; }
            else if (!this.recordingTimer && typeof setInterval === 'function') this.recordingTimer = setInterval(() => {
                const seconds = Math.floor((Date.now() - this.recordingSince) / 1000);
                const timer = this.root.querySelector('[data-recording-timer]');
                if (timer) timer.textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
            }, 1000);
        }
        async closeSafely() {
            if (this.closing) return;
            if (this.chatPending) { this.status.textContent = 'Zaczekaj na zakończenie wiadomości przed zamknięciem asystenta.'; return; }
            this.closing = true;
            this.refreshChatControls();
            try {
                if (this.client.capturing || this.client.active || this.client.startPending) await this.client.stop();
                if (this.client.capturing || this.client.startPending || this.client.state === 'retry') {
                    this.status.textContent = 'Nie potwierdzono zatrzymania. Mikrofon wyłączony; sprawdź stan sesji przed zamknięciem.';
                    return;
                }
                this.disclosure.open = false;
            } catch (_) { this.status.textContent = 'Nie potwierdzono zatrzymania sesji. Asystent pozostaje otwarty.'; }
            finally { this.closing = false; this.refreshChatControls(); this.headerState(); }
        }
        setupChat() {
            const input = this.root.querySelector('[data-chat-input]');
            this.root.querySelector('[data-chat-send]')?.addEventListener('click', () => this.sendChat(input?.value));
            input?.addEventListener('keydown', event => {
                if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); this.sendChat(input.value); }
            });
            for (const button of this.root.querySelectorAll('[data-chat-quick]')) button.addEventListener('click', () => this.sendChat(button.dataset.chatQuick));
            this.refreshChatControls();
        }
        refreshChatControls() {
            const disabled = !this.accessChecked || !this.access || this.chatPending || this.chatUncertain || this.closing || this.operationPending;
            for (const selector of ['[data-chat-input]', '[data-chat-send]']) {
                const node = this.root.querySelector(selector); if (node) node.disabled = Boolean(disabled);
            }
            for (const node of this.root.querySelectorAll('[data-chat-quick]')) node.disabled = Boolean(disabled);
        }
        chatBubble(role, text) {
            const list = this.root.querySelector('[data-conversation]'); if (!list) return;
            const node = element('p', (role === 'assistant' ? '✦ ' : '') + text, 'va-message va-message-' + role);
            list.appendChild(node); while (list.children.length > 60) list.removeChild(list.firstChild);
            list.scrollTop = list.scrollHeight;
        }
        async sendChat(message) {
            if (!this.accessChecked || !this.access || this.closing || this.operationPending || this.chatPending || this.chatUncertain || typeof message !== 'string' || !message.trim() || message.length > 4000) return;
            const scope = this.scope;
            this.chatPending = true; this.refreshControls();
            const wait = this.root.querySelector('[data-chat-wait]'); if (wait) wait.textContent = 'Analizuję wiadomość…';
            try {
                const read = await this.bridge.readRecord(pluginId);
                if (scope !== this.scope || !this.access) return;
                if (!read.ok) { this.rejectRead(read.code); return; }
                this.record = read.record;
                this.cardInsights(this.record);
                this.prepareClient();
                const history = []; let size = 0;
                for (const entry of [...this.chatHistory].reverse().slice(0, 20)) {
                    if (size + entry.content.length > 20000) break;
                    size += entry.content.length; history.unshift(entry);
                }
                this.chatBubble('user', message);
                const result = await this.client.sendChat(message, history);
                if (scope !== this.scope || !this.access) return;
                if (result.status !== 'completed' || result.replayed) {
                    this.chatUncertain = true;
                    if (wait) wait.textContent = 'Wynik oczekuje na potwierdzenie lub nie jest dostępny do odtworzenia. Nie ponawiamy automatycznie.';
                    return;
                }
                this.chatHistory.push({role: 'user', content: message});
                if (result.reply) { this.chatBubble('assistant', result.reply); this.chatHistory.push({role: 'assistant', content: result.reply.slice(0, 4000)}); }
                this.chatHistory = this.chatHistory.slice(-20);
                const input = this.root.querySelector('[data-chat-input]'); if (input) input.value = '';
                const session = this.client.session || this.latest;
                if (session) for (const proposal of result.suggestions) this.addProposal(proposal, session);
                this.proposalState();
                if (['trichology', 'photos', 'visits'].includes(result.navigation)) {
                    const navigated = await this.bridge.navigateSection?.(result.navigation);
                    if (scope !== this.scope || !this.access) return;
                    if (navigated !== true) { if (wait) wait.textContent = 'Nie zmieniono sekcji — zakończ nagrywanie lub otwórz sekcję ręcznie.'; return; }
                }
                if (wait) wait.textContent = '';
            } catch (error) {
                if (scope !== this.scope || !this.access) return;
                if (error.message === 'access_revoked') { this.rejectRead('access_revoked'); return; }
                this.chatUncertain = true;
                if (wait) wait.textContent = 'Nie potwierdzono odpowiedzi. Nie wysyłamy ponownie — operacja mogła zostać rozliczona.';
            } finally { this.chatPending = false; this.refreshControls(); }
        }
        compactQuestions() {
            const tips = this.root.querySelector('[data-tips]');
            const older = this.root.querySelector('[data-older-tips]');
            if (!older) return;
            const visible = [...Array.from(tips.children), ...Array.from(older.children)].filter(node => !node.hidden);
            tips.replaceChildren(); older.replaceChildren();
            visible.forEach((node, index) => (index < 3 ? tips : older).appendChild(node));
            const disclosure = this.root.querySelector('[data-older-questions]'); if (disclosure) disclosure.hidden = !older.children.length;
        }
        setupReviewBanner() {
            this.proposalRoot?.querySelector('[data-open-assistant]')?.addEventListener('click', () => {
                this.disclosure.open = true;
                this.checkPrerequisites();
            });
            this.proposalRoot?.querySelector('[data-reject-all]')?.addEventListener('click', () => {
                if (!this.accessChecked || !this.access) return;
                for (const group of this.groups) if (group.items.every(item => item.status === 'pending')) {
                    group.items.forEach(item => { item.status = 'rejected'; }); group.card.hidden = true;
                }
                this.proposalState();
            });
            this.proposalRoot?.querySelector('[data-accept-all]')?.addEventListener('click', () => this.acceptAll());
        }
        async acceptAll() {
            const note = this.proposalRoot?.querySelector('[data-batch-status]');
            const items = [...this.proposals.values()].filter(item => item.status === 'pending');
            if (!this.accessChecked || !this.access || this.batchPending || !items.length || [...this.proposals.values()].some(item => item.status === 'saving')) return;
            const revision = items[0].revision, patch = {}, baselines = {};
            for (const item of items) {
                if (item.revision !== revision || !this.valid(item.descriptor, item.value) ||
                    (own(patch, item.field) && (JSON.stringify(patch[item.field]) !== JSON.stringify(item.value) || JSON.stringify(baselines[item.field]) !== JSON.stringify(item.current)))) {
                    if (note) note.textContent = 'Propozycje mają różne wersje lub sprzeczne wartości. Akceptuj je osobno; niczego nie zapisano.';
                    return;
                }
                patch[item.field] = item.value; baselines[item.field] = item.current;
            }
            if (!window.confirm('Zapisz wszystkie ' + items.length + ' sprawdzone pola? Sprawdź wcześniej propozycje i oryginalne cytaty.')) return;
            const scope = this.scope;
            this.batchPending = true; items.forEach(item => { item.status = 'saving'; for (const control of item.controls) control.disabled = true; }); this.proposalState();
            try {
                const result = await this.bridge.savePatch(pluginId, patch, {revision, expected_values: baselines});
                if (scope !== this.scope || !this.access) return;
                if (!result.ok) {
                    if (denied(result.code)) { this.rejectRead(result.code); return; }
                    if (note) note.textContent = 'Nie zapisano: konflikt, ręczne zmiany lub niepotwierdzony zapis. Nie zmieniono wersji propozycji. Sprawdź kartę.';
                    items.forEach(item => { item.status = 'pending'; }); return;
                }
                items.forEach(item => { item.status = 'accepted'; });
                for (const group of this.groups) if (group.items.every(item => item.status === 'accepted')) group.card.hidden = true;
                if (note) note.textContent = 'Zapisano jeden zatwierdzony PATCH. Nie uruchomiono podsumowania.';
                const read = await this.bridge.readRecord(pluginId).catch(() => null);
                if (scope === this.scope && this.access) {
                    if (!read?.ok) this.rejectRead(read?.code || 'network_error');
                    else { this.record = read.record; this.cardInsights(this.record); }
                }
            } catch (_) {
                if (scope !== this.scope || !this.access) return;
                items.forEach(item => { item.status = 'pending'; });
                if (note) note.textContent = 'Nie potwierdzono zapisu. Sprawdź kartę przed ponowieniem.';
            } finally {
                this.batchPending = false;
                if (scope === this.scope && this.access) for (const item of items) for (const control of item.controls) control.disabled = item.status !== 'pending';
                this.proposalState();
            }
        }
        async searchMedications(query) {
            if (!this.accessChecked || !this.access) throw new Error('access_revoked');
            if (!this.bridge.searchMedications) throw new Error('catalog_unavailable');
            return this.bridge.searchMedications(pluginId, query);
        }
        async medicationHints(item, session) {
            const slot = this.root.querySelector('[data-medication-candidates]');
            if (!slot || !this.accessChecked || !this.access) return;
            const mentions = this.medicationMentions(item.value, item.refs);
            if (mentions === null) { this.diagnose('proposal_medication_details_invalid'); return; }
            const terms = mentions ? mentions.map(mention => [mention.name.replace(/\s*\(do potwierdzenia[^)]*\)/iu, ''), {title: mention.name, mention}]) : [...termsIn(item.value)].filter(([, term]) => term.category === 'drug').slice(0, 8);
            if (!terms.length && typeof item.value === 'string' && item.value.trim()) terms.push([item.value.slice(0, 100), {title: 'Nazwa do wyszukania'}]);
            // Capture this original list with the source proposal, not at selection
            // time. Subsequent reads must never silently rebase the addition.
            const values = {...(this.record?.interview_values || {}), ...(this.record?.native_values || {})};
            const baseline = own(values, 'medication_list') ? values.medication_list : this.record?.medication_list ?? null;
            const sourceRevision = this.record?.revision;
            const scope = this.scope;
            for (const [term, knowledge] of terms) {
                if (slot.children.length >= 30) slot.removeChild(slot.firstChild);
                const row = element('article', undefined, 'va-medication-candidate'); row.setAttribute('data-plugin-nonform', '');
                row.appendChild(element('strong', 'RPL · ' + knowledge.title + ' — wybór specjalisty'));
                if (knowledge.mention) {
                    row.appendChild(element('small', 'Nazwa źródłowa: „' + knowledge.mention.raw_name + '” · ' + [knowledge.mention.dose, knowledge.mention.frequency, knowledge.mention.since, knowledge.mention.schedule].filter(Boolean).join(' · ')));
                }
                if (item.refs.some(ref => this.phonetic(ref.quote))) row.appendChild(element('small', 'Nazwa rozpoznana fonetycznie — do potwierdzenia.'));
                const query = element('input'); query.value = term.replace(/_/g, ' '); query.maxLength = 100; query.setAttribute('aria-label', 'Nazwa leku do wyszukania w RPL'); query.setAttribute('data-plugin-nonform', ''); row.appendChild(query);
                const search = element('button', 'Szukaj RPL', 'clk-ui-button'); search.type = 'button'; row.appendChild(search);
                const results = element('div'); row.appendChild(results); slot.appendChild(row);
                let lookupVersion = 0;
                const lookup = async () => {
                    if (scope !== this.scope || !this.access || !this.accessChecked || !query.value.trim() || query.value.length > 100) return;
                    search.disabled = true; results.replaceChildren();
                    const version = ++lookupVersion;
                    try {
                        const result = await this.searchMedications(query.value.trim());
                        if (scope !== this.scope || !this.access || version !== lookupVersion) return;
                        if (result?.ok === false) { if (denied(result.code)) this.rejectRead(result.code); throw new Error('catalog_unavailable'); }
                        const validCandidate = p => p && typeof p.rpl_id === 'string' && /^\d{1,64}$/.test(p.rpl_id) &&
                            Number.isSafeInteger(p.import_id) && p.import_id > 0 &&
                            typeof p.catalog_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.catalog_date) &&
                            typeof p.name === 'string' && p.name.trim() && p.name === p.name.trim() && p.name.length <= 2000 &&
                            ['strength', 'form', 'substance'].every(key => typeof p[key] === 'string');
                        const candidates = (result.candidates || []).filter(validCandidate).slice(0, 20);
                        if (!candidates.length) { results.appendChild(element('p', 'Brak dopasowania RPL. Potwierdź nazwę z pacjentem; wskazówka tekstowa pozostaje do sprawdzenia. Nie utworzono leku ani ID.')); return; }
                        const select = element('select'); select.setAttribute('data-plugin-nonform', ''); select.setAttribute('aria-label', 'Wybierz oficjalny produkt RPL');
                        const placeholder = element('option', 'Wybierz produkt…'); placeholder.value = ''; select.appendChild(placeholder);
                        candidates.forEach((candidate, i) => { const option = element('option', [candidate.name, candidate.strength, candidate.form, candidate.substance].filter(Boolean).join(' · ')); option.value = String(i); select.appendChild(option); });
                        const choose = element('button', 'Dodaj propozycję wybranego leku', 'clk-ui-button'); choose.type = 'button'; choose.disabled = true;
                        select.addEventListener('change', () => { choose.disabled = select.value === ''; });
                        choose.addEventListener('click', () => {
                            if (scope !== this.scope || !this.access || !this.accessChecked || this.batchPending || version !== lookupVersion || select.value === '') return;
                            const candidate = candidates[Number(select.value)]; if (!candidate) return;
                            const schema = this.bridge.getSchema();
                            if (!schema.medication_list) { results.appendChild(element('p', 'Host nie udostępnia edytowalnej listy leków. Niczego nie zapisano.')); return; }
                            if (sourceRevision !== item.revision || this.record?.revision !== item.revision || item.status !== 'pending') { results.appendChild(element('p', 'Karta lub propozycja ma inny stan niż wypowiedź. Zaczekaj na nową propozycję.')); return; }
                            const additions = [...this.proposals.values()].filter(p => p.field === 'medication_list' && p.proposal.vision_rpl_addition && p.proposal.vision_session === session.session_id && p.revision === item.revision && p.current === baseline);
                            if (additions.some(p => p.status !== 'pending')) { results.appendChild(element('p', 'Lista została już zatwierdzona, odrzucona lub jest zapisywana. Zaczekaj na nową analizę.')); return; }
                            const merged = additions[0];
                            let rows = [];
                            try { rows = merged ? JSON.parse(merged.value) : baseline == null || baseline === '' ? [] : typeof baseline === 'string' ? JSON.parse(baseline) : baseline; } catch (_) { rows = null; }
                            if (!Array.isArray(rows)) { results.appendChild(element('p', 'Istniejąca lista ma historyczny format. Sprawdź ją ręcznie; niczego nie zastąpiono.')); return; }
                            if (rows.some(row => row?.rpl_id === candidate.rpl_id)) { results.appendChild(element('p', 'Ten produkt jest już na liście. Sprawdź istniejący wiersz.')); return; }
                            const medication = {name: candidate.name, rpl_id: candidate.rpl_id, import_id: candidate.import_id};
                            for (const key of ['catalog_date', 'strength', 'form', 'substance']) medication[key] = candidate[key];
                            for (const key of ['dose', 'frequency', 'since', 'schedule']) medication[key] = knowledge.mention?.[key] || '';
                            const newRows = [...rows, medication];
                            if (merged) {
                                // Merge BEFORE review/save and redraw the entire target list
                                // plus all original evidence. No hidden merge inside PATCH.
                                merged.value = JSON.stringify(newRows);
                                for (const ref of item.refs) if (!merged.refs.some(r => JSON.stringify(r) === JSON.stringify(ref))) merged.refs.push({...ref});
                                merged.proposal = {...merged.proposal, value: merged.value, evidence: merged.refs.map(ref => ({...ref}))};
                                this.render(this.groups.find(g => g.items.includes(merged)));
                            } else {
                                const proposal = {...item.proposal, vision_rpl_addition: true, vision_session: session.session_id, proposal_id: (item.proposal.proposal_id || item.proposal.id) + ':rpl:' + candidate.rpl_id, field: 'medication_list', value: JSON.stringify(newRows), current_value: baseline, revision: item.revision, evidence: item.refs.map(ref => ({...ref}))};
                                this.addProposal(proposal, session);
                            }
                            this.proposalState(); choose.disabled = true;
                        });
                        results.appendChild(select); results.appendChild(choose);
                    } catch (_) { if (scope === this.scope && this.access && version === lookupVersion) results.appendChild(element('p', 'Wyszukiwanie RPL niedostępne. Potwierdź nazwę; nie utworzono ID.')); }
                    finally { if (scope === this.scope && this.access && version === lookupVersion) search.disabled = false; }
                };
                search.addEventListener('click', lookup);
                await lookup();
            }
        }
        medicationMentions(value, refs) {
            if (typeof value !== 'string' || !value.trimStart().startsWith('{')) return undefined;
            try {
                const data = JSON.parse(value), keys = ['name', 'raw_name', 'dose', 'frequency', 'since', 'schedule'];
                if (Object.keys(data).sort().join(',') !== 'medication_mentions,summary' || typeof data.summary !== 'string' || !data.summary.trim() || !Array.isArray(data.medication_mentions) || !data.medication_mentions.length || data.medication_mentions.length > 8) return null;
                if (!data.medication_mentions.every(row => row && Object.keys(row).sort().join(',') === [...keys].sort().join(',') && keys.every(k => typeof row[k] === 'string' && row[k].length <= 200 && row[k] === row[k].trim()) && row.name && row.raw_name && keys.filter(k => k !== 'name').every(k => !row[k] || refs.some(ref => ref.quote.includes(row[k]))) && (row.name === row.raw_name || row.name.toLowerCase().includes('do potwierdzenia')))) return null;
                return data.medication_mentions;
            } catch (_) { return null; }
        }
        fieldDisplay(item, value) {
            if (item.field === 'current_medications' && typeof value === 'string') {
                const mentions = this.medicationMentions(value, item.refs);
                if (mentions) return JSON.parse(value).summary + ' · ' + mentions.map(row => [row.name, 'źródłowo: „' + row.raw_name + '”', row.dose, row.frequency, row.since, row.schedule].filter(Boolean).join(' · ')).join('; ');
            }
            if (['supplements_list', 'medication_list'].includes(item.field) && typeof value === 'string') {
                try {
                    const rows = JSON.parse(value);
                    if (Array.isArray(rows)) return rows.map(row => [row.name, row.strength, row.form, row.dose, row.frequency, row.since ? (/^od\s/iu.test(row.since) ? row.since : 'od ' + row.since) : '', row.schedule].filter(Boolean).join(' · ')).join('; ') || '(brak)';
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
