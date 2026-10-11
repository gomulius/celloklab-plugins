/* Host-owned clinical form bridge. Memory only; never persist drafts or PHI. */
(function () {
    'use strict';
    const TEXT_FIELDS = ('chief_complaint complaint_duration complaint_onset shedding_pattern previous_episodes seasonality flaking_type scalp_symptom_details care_details heat_styling chemical_treatments traction_factors medication_changes current_medications hormonal_status menstrual_cycle pregnancy_postpartum contraception trt_status weight_change transplant_details previous_treatments measurements family_history_details visit_recommendations notes trichology_treatments other_conditions allergies_details supplements_list surgeries').split(' ');
    const CHOICE_FIELDS = ('complaint_dynamics shedding_amount hair_loss_pattern sebum_timing washing_frequency menopause_status scale_norwood scale_ludwig scale_salt scale_pull_test').split(' ');
    const MULTI_FIELDS = ('affected_areas scalp_symptoms scalp_condition shaft_condition androgen_symptoms').split(' ');
    const snapshots = new WeakMap();
    const confirmations = new WeakSet();
    let state = null, lock = null;
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const clone = value => JSON.parse(JSON.stringify(value));
    const controlValue = c => c.type === 'checkbox' || c.type === 'radio' ? c.checked : c.value;
    function init() {
        if (state) return state;
        if (document.body?.dataset.pageId !== 'documentation_form') return null;
        const pane = document.getElementById('tab-wywiad');
        const form = document.getElementById('patientForm');
        const identity = document.getElementById('patient-data');
        if (!pane || !form || !identity?.dataset.patientId || !identity.dataset.tenantSlug) return null;
        const fields = new Map();
        [...TEXT_FIELDS, ...CHOICE_FIELDS, ...MULTI_FIELDS, 'post_transplant'].forEach(name => {
            const controls = Array.from(pane.querySelectorAll('[name="' + name + '"]')).filter(c => !c.closest('[data-plugin-nonform]'));
            // Dynamic medication/RPL lists and unrelated controls deliberately excluded.
            if (!controls.length || controls.some(c => c.disabled || c.readOnly)) return;
            const kind = MULTI_FIELDS.includes(name) ? 'string[]' : name === 'post_transplant' ? 'boolean' : 'string';
            const choices = kind === 'string[]' || CHOICE_FIELDS.includes(name) ?
                Array.from(new Set(controls.flatMap(c => c.options ? Array.from(c.options).map(o => o.value) : [c.value]).filter(Boolean))) : null;
            fields.set(name, {controls, kind, choices, legacy: ['notes', 'trichology_treatments', 'other_conditions', 'allergies_details', 'supplements_list', 'surgeries'].includes(name)});
        });
        state = {form, fields, ownRevisionEdges: new Map(),
            context: Object.freeze({pageId: 'documentation_form', tabId: 'tab-wywiad', patientId: identity.dataset.patientId, tenantSlug: identity.dataset.tenantSlug})};
        return state;
    }
    function read(field) {
        const controls = field.controls;
        if (field.kind === 'string[]') return controls.filter(c => c.checked).map(c => c.value);
        if (field.kind === 'boolean') return controls[0].value === 'yes' ? true : controls[0].value === 'no' ? false : null;
        if (controls[0].type === 'radio') return controls.find(c => c.checked)?.value || null;
        return controls[0].value || null;
    }
    function boundedText(value) {
        if (typeof value !== 'string') return false;
        let characters = 0, bytes = 0;
        for (const character of value) {
            const point = character.codePointAt(0);
            if (point >= 0xd800 && point <= 0xdfff) return false;
            characters++;
            bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
            if (characters > 20000 || bytes > 65535) return false;
        }
        return true;
    }
    function valid(field, value, forWrite = false) {
        if (value === null) return !forWrite || !field.legacy;
        if (field.kind === 'boolean') return typeof value === 'boolean';
        if (field.kind === 'string[]') return Array.isArray(value) && value.length <= 200 && value.every(v => typeof v === 'string' && field.choices.includes(v)) && new Set(value).size === value.length;
        return boundedText(value) && (!field.choices || value === '' || field.choices.includes(value));
    }
    function writable(field) {
        return field.controls.every(c => c.isConnected && !c.disabled && !c.readOnly);
    }
    function captureSnapshot() {
        const s = init();
        if (!s) return null;
        const values = {};
        s.fields.forEach((field, name) => { if (writable(field)) values[name] = read(field); });
        Object.values(values).forEach(value => { if (Array.isArray(value)) Object.freeze(value); });
        const snapshot = Object.freeze({context: s.context, values: Object.freeze(values)});
        snapshots.set(snapshot, {state: s, consumed: false});
        return snapshot;
    }
    function write(field, value) {
        field.controls.forEach(c => {
            if (field.kind === 'string[]') c.checked = (value || []).includes(c.value);
            else if (c.type === 'radio') c.checked = c.value === value;
            else c.value = field.kind === 'boolean' ? value === true ? 'yes' : value === false ? 'no' : '' : value ?? '';
        });
    }
    function nativeDirty(s) {
        return window.CelloklabPatientFormState?.isDirty() ?? true;
    }
    function applyConfirmedPatch(snapshot, result) {
        const ticket = snapshots.get(snapshot), s = init();
        // Only successful same-origin PATCH responses obtained by savePatch are
        // confirmations. A proposal, GET, or plugin-created object cannot apply.
        if (!ticket || ticket.consumed || ticket.state !== s || !confirmations.has(result) ||
            result.patient_id !== s.context.patientId || typeof result.revision !== 'string' || !result.revision ||
            !result.updated_values || !Array.isArray(result.updated_fields) ||
            !same(Object.keys(result.updated_values).sort(), [...result.updated_fields].sort())) return {ok: false, code: 'invalid_confirmation'};
        for (const [name, value] of Object.entries(result.updated_values)) {
            const field = s.fields.get(name);
            if (!field || !Object.prototype.hasOwnProperty.call(snapshot.values, name) || !valid(field, value)) return {ok: false, code: 'invalid_confirmation'};
        }
        ticket.consumed = true;
        const applied = [], preserved = [], savedControls = new Map();
        for (const [name, value] of Object.entries(result.updated_values)) {
            const field = s.fields.get(name);
            const unchanged = writable(field) && same(read(field), snapshot.values[name]);
            const live = field.controls.map(controlValue);
            // Advance the saved baseline even if the user typed during PATCH.
            field.controls.forEach(c => {
                const saved = field.kind === 'string[]' ? (value || []).includes(c.value) : c.type === 'radio' ? c.value === value : field.kind === 'boolean' ? value === true ? 'yes' : value === false ? 'no' : '' : value ?? '';
                savedControls.set(c, saved);
                if (c.type === 'checkbox' || c.type === 'radio') c.defaultChecked = saved;
                else if (c.tagName === 'SELECT') Array.from(c.options).forEach(option => { option.defaultSelected = option.value === saved; });
                else c.defaultValue = saved;
            });
            if (unchanged) { write(field, value); applied.push(name); }
            else {
                // Updating select/default reset baselines can change pristine
                // selectedness in real browsers. Restore the exact live draft.
                field.controls.forEach((c, index) => {
                    if (c.type === 'checkbox' || c.type === 'radio') c.checked = live[index];
                    else c.value = live[index];
                });
                preserved.push(name);
            }
        }
        // Advance only confirmed fields in the shared persistence baseline.
        syncInitialization(s, Object.keys(result.updated_values));
        window.CelloklabPatientFormState.acceptSavedControls(savedControls);
        window.dispatchEvent(new CustomEvent('celloklab:trichology-patch-applied', {detail: Object.freeze({applied: Object.freeze(applied), preserved: Object.freeze(preserved)})}));
        return {ok: true, applied, preserved};
    }
    function syncInitialization(s, names) {
        // Host initialization sources contain live values, not saved baselines:
        // late native initialization must not erase edits made during PATCH.
        const values = Object.fromEntries(names.map(name => [name, clone(read(s.fields.get(name)))]));
        const identity = document.getElementById('patient-data');
        try {
            const data = JSON.parse(identity.textContent);
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                Object.assign(data, values);
                identity.textContent = JSON.stringify(data);
            }
        } catch (_) { /* No logging or storage of host JSON. */ }
        try {
            if (typeof patientData !== 'undefined' && patientData && typeof patientData === 'object') Object.assign(patientData, clone(values));
        } catch (_) { /* A classic-script binding may still be in its TDZ. */ }
    }
    function acquireSaveLock() {
        if (lock || (typeof isSubmitting !== 'undefined' && isSubmitting)) return null;
        lock = Object.freeze({});
        return lock;
    }
    function releaseSaveLock(token) {
        if (!token || token !== lock) return false;
        lock = null;
        return true;
    }
    const revisionValid = value => typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,200}$/.test(value);
    const pluginValid = value => typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,127}$/.test(value);
    const MAX_OWN_REVISION_EDGES = 1000;
    const revisionKey = (pluginId, revision) => JSON.stringify([pluginId, revision]);
    function ownRevisionConflict(s, pluginId, original, current, names) {
        // State owns the patient/tenant scope; plugin IDs cannot share edges.
        // GETs and plugin hints never add edges. Missing links fail closed.
        const visited = new Set();
        let fieldChanged = false;
        while (original !== current) {
            if (visited.has(original)) return 'revision_conflict';
            visited.add(original);
            const edge = s.ownRevisionEdges.get(revisionKey(pluginId, original));
            if (!edge) return 'revision_conflict';
            if (names.some(name => edge.fields.includes(name))) fieldChanged = true;
            original = edge.revision;
        }
        // Without expected_values the fallback is today's native snapshot,
        // not the old proposal baseline: never use it to rewrite an own field.
        return fieldChanged ? 'baseline_conflict' : null;
    }
    function rememberOwnRevision(s, pluginId, previous, next, fields) {
        if (previous === next) return;
        const key = revisionKey(pluginId, previous);
        s.ownRevisionEdges.delete(key);
        s.ownRevisionEdges.set(key, {revision: next, fields: [...fields]});
        // Bound all plugins together, retaining enough history for late proposals.
        if (s.ownRevisionEdges.size > MAX_OWN_REVISION_EDGES) s.ownRevisionEdges.delete(s.ownRevisionEdges.keys().next().value);
    }
    const statusCode = status => ({401: 'authentication_required', 403: 'access_denied', 404: 'not_found', 409: 'revision_conflict', 412: 'revision_conflict', 422: 'validation_failed', 428: 'revision_required'}[status] || 'request_failed');
    function recordURL(s, pluginId) {
        return '/api/plugins/' + encodeURIComponent(pluginId) + '/patients/' + encodeURIComponent(s.context.patientId) + '/trichology?tenant_slug=' + encodeURIComponent(s.context.tenantSlug);
    }
    async function readRecord(pluginId, options = {}) {
        const s = init();
        if (!s) return {ok: false, code: 'form_unavailable'};
        if (!pluginValid(pluginId) || !options || typeof options !== 'object') return {ok: false, code: 'invalid_request'};
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
        if (!csrf) return {ok: false, code: 'csrf_required'};
        try {
            const response = await fetch(recordURL(s, pluginId), {credentials: 'same-origin', cache: 'no-store', signal: options.signal,
                headers: {'Accept': 'application/json', 'X-CSRF-Token': csrf}});
            if (!response.ok) return {ok: false, code: statusCode(response.status)};
            const dto = await response.json();
            const record = dto?.record;
            if (!record || record.patient_id !== s.context.patientId || !revisionValid(record.revision)) return {ok: false, code: 'invalid_record'};
            return {ok: true, record};
        } catch (_) { return {ok: false, code: options.signal?.aborted ? 'aborted' : 'network_error'}; }
    }
    function recordValue(record, name, field) {
        const source = field.legacy ? record : record.interview_values;
        if (!source || !Object.prototype.hasOwnProperty.call(source, name)) return {ok: false};
        const value = source[name];
        return valid(field, value) ? {ok: true, value} : {ok: false};
    }
    function equivalent(field, a, b) {
        // Blank controls represent nullable SQL values. Multi-choice ordering
        // is not clinically meaningful, and null and [] are both empty groups.
        if (field.kind === 'string[]') return same([...(a || [])].sort(), [...(b || [])].sort());
        return same(a === '' ? null : a, b === '' ? null : b);
    }
    async function savePatch(pluginId, changes, options = {}) {
        const s = init();
        if (!s) return {ok: false, code: 'form_unavailable'};
        if (!pluginValid(pluginId) || !changes || typeof changes !== 'object' || Array.isArray(changes) || !options || typeof options !== 'object') return {ok: false, code: 'invalid_patch'};
        if (!window.CelloklabPatientFormState?.isReady()) return {ok: false, code: 'form_initializing'};
        const names = Object.keys(changes);
        if (!names.length || names.some(name => !s.fields.has(name) || !writable(s.fields.get(name)) || !valid(s.fields.get(name), changes[name], true))) return {ok: false, code: 'invalid_patch'};
        // A fresh GET may advance only through our confirmed writes, never
        // through external revisions or plugin-supplied rebase hints.
        if (!revisionValid(options.revision)) return {ok: false, code: 'revision_required'};
        const originalRevision = options.revision, expected = options.expected_values;
        if (expected !== undefined && (!expected || typeof expected !== 'object' || Array.isArray(expected) ||
            names.some(name => !Object.prototype.hasOwnProperty.call(expected, name) || !valid(s.fields.get(name), expected[name])))) return {ok: false, code: 'invalid_baseline'};
        if (nativeDirty(s)) return {ok: false, code: 'native_dirty'};
        const token = acquireSaveLock();
        if (!token) return {ok: false, code: 'save_locked'};
        const snapshot = captureSnapshot(); // Before the first await, not after GET.
        const payload = clone(changes);
        const baseline = Object.fromEntries(names.map(name => [name, clone(expected === undefined ? snapshot.values[name] : expected[name])]));
        const url = recordURL(s, pluginId);
        try {
            const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
            if (!csrf) return {ok: false, code: 'csrf_required'};
            const current = await readRecord(pluginId, options);
            if (!current.ok) return current;
            const currentRevision = current.record.revision;
            const revisionConflict = ownRevisionConflict(s, pluginId, originalRevision, currentRevision, names);
            if (revisionConflict) return {ok: false, code: revisionConflict};
            if (names.some(name => !same(read(s.fields.get(name)), snapshot.values[name]))) return {ok: false, code: 'draft_changed'};
            if (nativeDirty(s)) return {ok: false, code: 'native_dirty'};
            for (const name of names) {
                const field = s.fields.get(name), actual = recordValue(current.record, name, field);
                if (!actual.ok) return {ok: false, code: 'invalid_record'};
                if (!equivalent(field, baseline[name], actual.value) || !equivalent(field, snapshot.values[name], actual.value)) return {ok: false, code: 'baseline_conflict'};
            }
            if (options.signal?.aborted) return {ok: false, code: 'aborted'};
            const saved = await fetch(url, {method: 'PATCH', credentials: 'same-origin', cache: 'no-store', signal: options.signal,
                headers: {'Accept': 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'If-Match': '"' + currentRevision + '"'}, body: JSON.stringify(payload)});
            if (!saved.ok) return {ok: false, code: statusCode(saved.status)};
            const envelope = await saved.json();
            const result = envelope.result;
            if (!result || !Array.isArray(result.updated_fields) || !revisionValid(result.revision) || !same([...result.updated_fields].sort(), [...names].sort())) return {ok: false, code: 'invalid_confirmation'};
            confirmations.add(result);
            const applied = applyConfirmedPatch(snapshot, result);
            // A failed, malformed or ambiguous PATCH must never authorize a
            // later proposal. Register only after full host confirmation.
            if (applied.ok) rememberOwnRevision(s, pluginId, currentRevision, result.revision, names);
            return applied;
        } catch (_) { return {ok: false, code: options.signal?.aborted ? 'aborted' : 'network_error'}; }
        finally { releaseSaveLock(token); }
    }
    window.CelloklabTrichologyFormBridge = Object.freeze({
        version: 1,
        // Available in <head>, before synchronous plugin fragment scripts and
        // before the native tab controller initializes at the end of the page.
        registerBeforeTabChangeGuard(guard) {
            if (typeof guard !== 'function') throw new TypeError('Expected tab guard');
            const listener = event => {
                if (event.detail?.pageId === 'documentation_form') event.detail.waitUntil(Promise.resolve().then(() => guard(event.detail)));
            };
            window.addEventListener('celloklab:before-tab-change', listener);
            return () => window.removeEventListener('celloklab:before-tab-change', listener);
        },
        getContext() { return init()?.context || null; },
        getSchema() {
            const s = init();
            if (!s) return Object.freeze({});
            return Object.freeze(Object.fromEntries(Array.from(s.fields, ([name, field]) => [name, Object.freeze({type: field.kind, nullable: !field.legacy, choices: field.choices ? Object.freeze([...field.choices]) : null})])));
        },
        captureSnapshot, applyConfirmedPatch, readRecord, savePatch,
        isDirty() { const s = init(); return Boolean(s && nativeDirty(s)); },
        acquireSaveLock, releaseSaveLock,
        isSaveLocked() { return Boolean(lock); }
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
    else init();
})();
