/* Host-owned shared live microphone transport. All clinical state is memory-only. */
(function () {
    'use strict';
    const forbidden = new Set([401, 403, 404]);
    const terminal = new Set(['stopped', 'completed', 'expired', 'revoked', 'failed', 'error']);
    class LiveAudioClient {
        constructor(options) {
            if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(options.pluginId || '')) throw new Error('invalid_plugin');
            this.options = options;
            this._session = null;
            this._state = 'idle';
            this.queue = [];
            this.sequence = 0;
            this.sending = null;
            this.uncertain = false;
            this.stopRequested = false;
            this.startKey = null;
            this.startPending = false;
            this.stream = null;
            this.audio = null;
            this.node = null;
            this.generation = 0;
            this.pollTimer = null;
            this.limitTimer = null;
            this.deadline = null;
            this.leave = () => {
                this.stopRequested = true;
                this._release(false);
                this._clearTimers();
                if (this._session) this._request('/' + this._session.session_id + '/stop', 'POST', {}, {}, true).catch(() => {});
            };
            window.addEventListener('pagehide', this.leave);
        }
        get session() { return this._session ? JSON.parse(JSON.stringify(this._session)) : null; }
        get state() { return this._state; }
        get active() { return Boolean(this._session && !terminal.has(this._session.status) && this._state !== 'stopped'); }
        get capturing() { return Boolean(this.stream || this._state === 'starting'); }
        get restartable() { return this._state === 'stopped' && !this.startPending && !this.sending && !this.uncertain; }
        revoke() { this.stopRequested = true; const error = new Error('access_revoked'); error.status = 403; return this._fail(error); }
        dispose() {
            if (this.active || this.startPending || this.sending) throw new Error('session_unresolved');
            this._clearTimers();
            window.removeEventListener('pagehide', this.leave);
        }
        _set(state) { this._state = state; this.options.onSession?.(this.session, state); }
        _error(code) { this.options.onError?.({code}); }
        _clearTimers() { clearTimeout(this.pollTimer); clearTimeout(this.limitTimer); this.pollTimer = this.limitTimer = null; }
        _base() {
            if (!this.context) throw new Error('context_required');
            return '/api/plugins/' + encodeURIComponent(this.options.pluginId) + '/patients/' + encodeURIComponent(this.context.patientId) + '/live-interviews';
        }
        async _request(path, method, body, extra = {}, keepalive = false) {
            const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
            if (!csrf) throw new Error('csrf_required');
            const response = await fetch(this._base() + path + '?tenant_slug=' + encodeURIComponent(this.context.tenantSlug), {
                method, credentials: 'same-origin', cache: 'no-store', keepalive,
                headers: Object.assign({'Accept': 'application/json', 'X-CSRF-Token': csrf},
                    body instanceof ArrayBuffer ? {'Content-Type': 'audio/pcm'} : body !== undefined ? {'Content-Type': 'application/json'} : {}, extra),
                body: body === undefined ? undefined : body instanceof ArrayBuffer ? body : JSON.stringify(body)
            });
            if (!response.ok) {
                const error = new Error(forbidden.has(response.status) ? 'access_revoked' : 'request_failed');
                error.status = response.status;
                try {
                    const code = (await response.json())?.detail?.code;
                    if (response.status === 424 && ['live_speech_model_required', 'live_speech_model_unavailable', 'live_duration_invalid'].includes(code)) error.code = code;
                } catch (_) { /* Never expose arbitrary response text. */ }
                throw error;
            }
            const envelope = await response.json();
            const s = envelope?.session;
            if (envelope.plugin_id !== this.options.pluginId || !s ||
                !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.session_id) ||
                !Number.isInteger(s.next_sequence) || s.next_sequence < 0 || typeof s.status !== 'string' ||
                (this._session && s.session_id !== this._session.session_id)) throw new Error('invalid_session');
            return s;
        }
        _update(session) {
            if (this._session?.status === 'revoked') return;
            // A concurrent lifecycle GET may complete after a newer audio ACK.
            if (this._session && (session.next_sequence < this._session.next_sequence ||
                (terminal.has(this._session.status) && !terminal.has(session.status)))) return;
            this._session = session;
            this.options.onUpdate?.(this.session);
            this.options.onSession?.(this.session, this._state);
            // Pending is the normal dispatch fence while our own packet is
            // in flight. Only an idle/recovered pending state implies uncertainty.
            if (session.status === 'pending' && (!this.sending || this.uncertain)) {
                this.generation++;
                this.uncertain = true;
                this._release(false);
                this._set('retry');
                this._error('audio_uncertain');
            }
            if (terminal.has(session.status)) {
                this.generation++;
                this._release(false);
                this._clearTimers();
                this.queue = [];
                this.uncertain = false;
                this._set('stopped');
            }
        }
        async start({recordingConsent} = {}) {
            if (recordingConsent !== true) throw new Error('recording_consent_required');
            // A client owns exactly one server session. Never reset/restart an
            // uncertain session and accidentally incur another fixed fee.
            if (this._state !== 'idle') throw new Error('session_already_started');
            this.context = window.CelloklabTrichologyFormBridge?.getContext();
            if (!this.context?.patientId || !this.context?.tenantSlug) throw new Error('context_required');
            this.startKey = crypto.randomUUID();
            this.startPending = true;
            return this._startRequest();
        }
        async _startRequest() {
            this._set('starting');
            try {
                const session = await this._request('', 'POST', {profile_id: this.options.profileId || 'interview', recording_consent: true}, {'Idempotency-Key': this.startKey});
                this.startPending = false;
                this.sequence = session.next_sequence;
                this._update(session);
                if (terminal.has(session.status)) return;
                if (!(session.max_duration_seconds > 0)) throw new Error('invalid_duration');
                this.deadline = Date.now() + session.max_duration_seconds * 1000;
                this.limitTimer = setTimeout(() => this.stop().catch(() => {}), session.max_duration_seconds * 1000);
                this._poll();
                if (this.stopRequested) { await this.stop(); return; }
                if (session.status === 'pending' || this.uncertain) return;
                // Server authorization/consent always precedes microphone permission.
                await this._capture();
            } catch (error) {
                if (this.startPending) {
                    if (error.status >= 400 && error.status < 500 && ![408, 409, 429].includes(error.status)) {
                        this.startPending = false; this._set('stopped');
                    }
                    else this._set('retry');
                } else {
                    await this._release(false);
                    if (this._session && !terminal.has(this._session.status)) {
                        this.stopRequested = true;
                        try { this._update(await this._request('/' + this._session.session_id + '/stop', 'POST', {})); }
                        catch (_) { this._set('retry'); }
                    }
                    this._clearTimers();
                }
                this._error(error.code || (error.message === 'access_revoked' ? error.message : this.startPending ? 'start_uncertain' : !this._session ? 'start_rejected' : 'microphone_unavailable'));
                throw error;
            }
        }
        async _capture() {
            if (this.stopRequested || !this.active || Date.now() >= this.deadline) throw new Error('session_inactive');
            const generation = ++this.generation;
            const stream = await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1, echoCancellation: true}, video: false});
            if (generation !== this.generation || this.stopRequested || !this.active) { stream.getTracks().forEach(t => t.stop()); return; }
            this.stream = stream;
            try {
                const Audio = window.AudioContext || window.webkitAudioContext;
                this.audio = new Audio();
                await this.audio.audioWorklet.addModule('/static/js/plugins/live-pcm-worklet.js');
                if (generation !== this.generation || this.stopRequested) { await this._release(false); return; }
                this.node = new AudioWorkletNode(this.audio, 'celloklab-live-pcm');
                this.node.port.onmessage = event => {
                    if (event.data?.type === 'flushed') { this.flushResolve?.(); return; }
                    if (event.data?.type === 'pcm') this._enqueue(event.data.bytes, event.data.final === true);
                };
                this.node.onprocessorerror = () => this._fail(new Error('audio_processor_failed'));
                this.source = this.audio.createMediaStreamSource(stream);
                this.source.connect(this.node);
                this.node.connect(this.audio.destination);
                await this.audio.resume();
                if (generation !== this.generation || this.stopRequested || !this.active) { await this._release(false); return; }
                this._set('recording');
            } catch (error) { await this._release(false); throw error; }
        }
        _enqueue(bytes, final = false) {
            if (!(bytes instanceof ArrayBuffer) || !bytes.byteLength || bytes.byteLength % 2 || bytes.byteLength > 240000) {
                this._fail(new Error('invalid_audio_packet')); return;
            }
            if (this.queue.length >= 3) {
                // Explicit fatal backpressure: do not silently overwrite a packet.
                this._fail(new Error('audio_backpressure')); return;
            }
            if (!final && bytes.byteLength < 24000) {
                const padded = new Uint8Array(24000); padded.set(new Uint8Array(bytes)); bytes = padded.buffer;
            }
            this.queue.push({sequence: this.sequence + this.queue.length, bytes, final});
            this._drain();
        }
        _drain() {
            if (this.sending || this.uncertain || !this.queue.length || !this.active) return this.sending || Promise.resolve();
            this.sending = (async () => {
                while (this.queue.length && !this.uncertain && this.active) {
                    const packet = this.queue[0];
                    try {
                        const s = await this._request('/' + this._session.session_id + '/audio', 'POST', packet.bytes,
                            {'X-Audio-Sequence': String(packet.sequence), 'X-Audio-Final': packet.final ? 'true' : 'false'});
                        if (s.status === 'pending') {
                            this._update(s);
                            throw new Error('audio_uncertain');
                        }
                        if (s.next_sequence !== packet.sequence + 1) throw new Error('sequence_mismatch');
                        this.queue.shift();
                        this.sequence = s.next_sequence;
                        this._update(s);
                    } catch (error) { await this._fail(error); break; }
                }
            })().finally(() => {
                this.sending = null;
                if (this._state === 'stopped') this.options.onSession?.(this.session, this._state);
            });
            return this.sending;
        }
        async _release(flush, final = false) {
            // Stop physical tracks synchronously, even while requests are pending.
            this.stream?.getTracks().forEach(track => track.stop());
            this.stream = null;
            const node = this.node, audio = this.audio, source = this.source;
            this.node = this.audio = this.source = null;
            if (flush && node) {
                let timeout;

                try {
                    await new Promise((resolve, reject) => {
                        this.flushResolve = resolve;
                        timeout = setTimeout(() => reject(new Error('audio_flush_failed')), 2000);
                        node.port.postMessage({type: 'flush', final});
                    });
                } finally {
                    clearTimeout(timeout); this.flushResolve = null;
                    node.port.onmessage = null; source?.disconnect(); node.disconnect();
                    await audio?.close();
                }
            } else {
                if (node) node.port.onmessage = null;
                source?.disconnect(); node?.disconnect();
                await audio?.close();
            }
        }
        async _fail(error) {
            if (this._session?.status === 'revoked') { await this._release(false); return; }
            this.generation++;
            if (error.message === 'audio_backpressure' || error.message === 'invalid_audio_packet' || error.message === 'audio_processor_failed') this.stopRequested = true;
            this.uncertain = true;
            this._set('retry');
            if (forbidden.has(error.status)) {
                this.stopRequested = true;
                this.queue = []; this.uncertain = false;
                if (this._session) this._session = {...this._session, status: 'revoked', suggestions: [], tips: [], segments: []};
                this._clearTimers(); this._set('stopped');
            }
            try { await this._release(!forbidden.has(error.status) && error.message !== 'audio_backpressure'); }
            catch (_) { this._error('audio_flush_failed'); }
            this._error(error.message === 'audio_backpressure' ? 'audio_backpressure' : forbidden.has(error.status) ? 'access_revoked' : 'audio_uncertain');
        }
        async pause() {
            if (this._state !== 'recording') return;
            this.generation++;
            this._set('paused');
            try { await this._release(true); await this._drain(); }
            catch (error) { await this._fail(error); throw error; }
        }
        async resume() {
            if (this._state !== 'paused' || this.uncertain || this.stopRequested) throw new Error('resume_unavailable');
            try { await this._capture(); }
            catch (error) { await this._fail(error); throw error; }
        }
        async stop() {
            if (!this._session || this._state === 'stopped') return;
            this.stopRequested = true;
            this.generation++;
            this._set('stopping');
            try {
                await this._release(true, true);
                await this._drain();
                if (this.uncertain || this.queue.length) throw new Error('pending_audio_requires_retry');
                if (terminal.has(this._session.status)) return;
                this._update(await this._request('/' + this._session.session_id + '/stop', 'POST', {}));
                if (this._session.status === 'pending') throw new Error('pending_session_requires_reconciliation');
                this._clearTimers(); this._set('stopped');
            } catch (error) {
                if (forbidden.has(error.status)) await this._fail(error);
                else { this._set('retry'); this._error(error.message); }
                throw error;
            }
        }
        async retryPending() {
            if (this.startPending) return this._startRequest(); // Same idempotency key.
            if (!this.active || this.sending) return;
            this.uncertain = false;
            this._set('paused');
            if (!this.queue.length && this._session.status === 'pending') {
                try { this._update(await this._request('/' + this._session.session_id, 'GET')); }
                catch (error) { await this._fail(error); return; }
                if (!this.active || this.uncertain) return;
            }
            await this._drain(); // Same sequence and exact original bytes.
            if (this.uncertain) return;
            if (this.stopRequested) return this.stop();
            this._set('paused'); // Retry never implicitly reopens a microphone.
        }
        _poll() {
            this.pollTimer = setTimeout(async () => {
                if (!this.active) return;
                try { this._update(await this._request('/' + this._session.session_id, 'GET')); }
                catch (error) { await this._fail(error); }
                if (this.active) this._poll();
            }, 5000);
        }
    }
    window.CelloklabLiveAudio = Object.freeze({create: options => new LiveAudioClient(options), LiveAudioClient});
})();
