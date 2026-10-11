/* Host-owned clinical form bridge. Memory only; never persist drafts or PHI. */
(function () {
    'use strict';
    const TEXT_FIELDS = ('chief_complaint complaint_duration complaint_onset shedding_pattern previous_episodes seasonality flaking_type scalp_symptom_details care_details heat_styling chemical_treatments traction_factors medication_changes current_medications hormonal_status menstrual_cycle pregnancy_postpartum contraception trt_status weight_change transplant_details previous_treatments measurements family_history_details visit_recommendations notes trichology_treatments other_conditions allergies_details surgeries chronic_diseases_other scalp_history current_shampoo peeling_details styling_details other_treatments minoxidil_details allergic_reactions cosmetic_allergies work_stress life_stress habits_details diet_details activity_details sleep_hours sleep_quality family_hair_loss_details family_genetic_diseases family_skin_diseases diseases').split(' ');
    const CHOICE_FIELDS = ('complaint_dynamics shedding_amount hair_loss_pattern sebum_timing washing_frequency menopause_status scale_norwood scale_ludwig scale_salt scale_pull_test family_hair_loss').split(' ');
    const MULTI_FIELDS = ('affected_areas scalp_symptoms scalp_condition shaft_condition androgen_symptoms chronic_diseases allergies habits diet physical_activity hair_styling').split(' ');
    const BOOLEAN_FIELDS = ('post_transplant uses_peeling uses_minoxidil').split(' ');
    const NATIVE_LABELS = {
        chronic_diseases: 'Choroby przewlekłe', chronic_diseases_other: 'Inne choroby przewlekłe',
        surgeries: 'Operacje i zabiegi', other_conditions: 'Inne schorzenia', scalp_history: 'Historia chorób skóry głowy',
        current_shampoo: 'Aktualny szampon', uses_peeling: 'Stosuje peeling', peeling_details: 'Peeling — szczegóły',
        hair_styling: 'Zabiegi chemiczne', styling_details: 'Stylizacja — szczegóły', other_treatments: 'Inne zabiegi',
        trichology_treatments: 'Zabiegi trychologiczne', uses_minoxidil: 'Stosuje minoksydyl', minoxidil_details: 'Minoksydyl — szczegóły',
        allergies: 'Alergie', allergies_details: 'Alergie — szczegóły', allergic_reactions: 'Reakcje alergiczne',
        cosmetic_allergies: 'Alergie na kosmetyki', work_stress: 'Stres w pracy', life_stress: 'Stres poza pracą',
        habits: 'Używki', habits_details: 'Używki — szczegóły', diet: 'Dieta', diet_details: 'Dieta — szczegóły',
        physical_activity: 'Aktywność fizyczna', activity_details: 'Aktywność — szczegóły', sleep_hours: 'Godziny snu',
        sleep_quality: 'Jakość snu', family_hair_loss: 'Wypadanie włosów w rodzinie',
        family_hair_loss_details: 'Wypadanie włosów w rodzinie — szczegóły', family_genetic_diseases: 'Choroby genetyczne w rodzinie',
        family_skin_diseases: 'Choroby skóry w rodzinie', diseases: 'Choroby (zapis historyczny)', notes: 'Uwagi'
    };
    const snapshots = new WeakMap();
    const confirmations = new WeakSet();
    let state = null, lock = null;
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const clone = value => JSON.parse(JSON.stringify(value));
    const controlValue = c => c.type === 'checkbox' || c.type === 'radio' ? c.checked : c.value;
    function registerSupplements(s) {
        const host = window.CelloklabPatientFormState;
        if (host?.supplementsWritable()) s.fields.set('supplements_list', {
            kind: 'string', dynamic: true, controls: [], choices: null, choiceLabels: {}, label: 'Suplementy'
        });
        return s;
    }
    function init() {
        if (state) return registerSupplements(state);
        if (document.body?.dataset.pageId !== 'documentation_form') return null;
        const pane = document.getElementById('tab-wywiad');
        const form = document.getElementById('patientForm');
        const identity = document.getElementById('patient-data');
        if (!pane || !form || !identity?.dataset.patientId || !identity.dataset.tenantSlug) return null;
        const fields = new Map();
        [...TEXT_FIELDS, ...CHOICE_FIELDS, ...MULTI_FIELDS, ...BOOLEAN_FIELDS].forEach(name => {
            const controls = Array.from(pane.querySelectorAll('[name="' + name + '"]')).filter(c => !c.closest('[data-plugin-nonform]'));
            // Dynamic medication/RPL rows deliberately excluded.
            // Never expose a hidden stand-in as a writable native field.
            if (!controls.length || controls.some(c => c.disabled || c.readOnly || c.type === 'hidden')) return;
            const kind = MULTI_FIELDS.includes(name) ? 'string[]' : BOOLEAN_FIELDS.includes(name) ? 'boolean' : 'string';
            const choices = kind === 'string[]' || CHOICE_FIELDS.includes(name) ?
                Array.from(new Set(controls.flatMap(c => c.options ? Array.from(c.options).map(o => o.value) : [c.value]).filter(Boolean))) : null;
            const labelFor = c => Array.from(c.labels || []).map(label => label.textContent.trim()).join(' ') ||
                c.closest('.form-group')?.querySelector?.('label')?.textContent?.trim() || '';
            const choiceLabels = {};
            controls.forEach(c => {
                if (c.options) Array.from(c.options).forEach(o => { if (o.value) choiceLabels[o.value] = o.textContent.trim(); });
                else if (choices) choiceLabels[c.value] = labelFor(c) || c.value;
            });
            const groupLabel = controls[0].closest('.form-group')?.querySelector?.('legend, label')?.textContent?.trim();
            fields.set(name, {controls, kind, choices, choiceLabels, label: NATIVE_LABELS[name] || groupLabel || labelFor(controls[0]), legacy: name === 'notes'});
        });
        state = {form, fields, ownRevisionEdges: new Map(),
            context: Object.freeze({pageId: 'documentation_form', tabId: 'tab-wywiad', patientId: identity.dataset.patientId, tenantSlug: identity.dataset.tenantSlug})};
        return registerSupplements(state);
    }
    function read(field) {
        if (field.dynamic) return window.CelloklabPatientFormState.readSupplements();
        const controls = field.controls;
        if (field.kind === 'string[]') return controls.filter(c => c.checked).map(c => c.value);
        if (field.kind === 'boolean') return controls[0].type === 'checkbox' ? controls[0].checked : controls[0].value === 'yes' ? true : controls[0].value === 'no' ? false : null;
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
        if (field.dynamic) return window.CelloklabPatientFormState.decodeSupplements(value, forWrite) !== null;
        if (value === null) return !forWrite || !field.legacy;
        if (field.kind === 'boolean') return typeof value === 'boolean';
        if (field.kind === 'string[]') return Array.isArray(value) && value.length <= 200 && value.every(v => typeof v === 'string' && field.choices.includes(v)) && new Set(value).size === value.length;
        if (!boundedText(value) || (field.choices && value !== '' && !field.choices.includes(value))) return false;
        const control = field.controls[0];
        if (control.type === 'number' && value !== '') {
            const number = Number(value);
            if (!value.trim() || !Number.isFinite(number) ||
                (control.min !== '' && control.min != null && number < Number(control.min)) ||
                (control.max !== '' && control.max != null && number > Number(control.max))) return false;
        }
        return true;
    }
    function writable(field) {
        if (field.dynamic) return window.CelloklabPatientFormState.supplementsWritable();
        return field.controls.every(c => c.isConnected && !c.disabled && !c.readOnly);
    }
    function captureSnapshot() {
        const s = init();
        if (!s) return null;
        const values = {};
        s.fields.forEach((field, name) => { if (writable(field)) values[name] = read(field); });
        Object.values(values).forEach(value => { if (Array.isArray(value)) Object.freeze(value); });
        const snapshot = Object.freeze({context: s.context, values: Object.freeze(values)});
        snapshots.set(snapshot, {state: s, consumed: false, supplementDraft: clone(window.CelloklabPatientFormState?.supplementDraft() ?? null)});
        return snapshot;
    }
    function write(field, value) {
        field.controls.forEach(c => {
            if (field.kind === 'string[]') c.checked = (value || []).includes(c.value);
            else if (field.kind === 'boolean' && c.type === 'checkbox') c.checked = value === true;
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
        if (Object.prototype.hasOwnProperty.call(result.updated_values, 'supplements_list') &&
            (!window.CelloklabPatientFormState.isReady() || !document.getElementById('supplements-container'))) return {ok: false, code: 'form_unavailable'};
        ticket.consumed = true;
        const applied = [], preserved = [], savedControls = new Map();
        for (const [name, value] of Object.entries(result.updated_values)) {
            const field = s.fields.get(name);
            if (field.dynamic) {
                const synced = window.CelloklabPatientFormState.acceptSavedSupplements(value, ticket.supplementDraft);
                if (!synced.ok) return {ok: false, code: 'form_unavailable'};
                (synced.preserved ? preserved : applied).push(name);
                continue;
            }
            const unchanged = writable(field) && same(read(field), snapshot.values[name]);
            const live = field.controls.map(controlValue);
            // Advance the saved baseline even if the user typed during PATCH.
            field.controls.forEach(c => {
                const saved = field.kind === 'string[]' ? (value || []).includes(c.value) : field.kind === 'boolean' && c.type === 'checkbox' ? value === true : c.type === 'radio' ? c.value === value : field.kind === 'boolean' ? value === true ? 'yes' : value === false ? 'no' : '' : value ?? '';
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
        // Prefer the complete typed native DTO. Only older hosts lacking this
        // field may fall back; a present malformed native value fails closed.
        const source = record.native_values && Object.prototype.hasOwnProperty.call(record.native_values, name) ? record.native_values :
            record.interview_values && Object.prototype.hasOwnProperty.call(record.interview_values, name) ? record.interview_values : record;
        if (!source || !Object.prototype.hasOwnProperty.call(source, name)) return {ok: false};
        const value = source[name];
        return valid(field, value) ? {ok: true, value} : {ok: false};
    }
    function equivalent(field, a, b) {
        if (field.dynamic) return same(window.CelloklabPatientFormState.decodeSupplements(a), window.CelloklabPatientFormState.decodeSupplements(b));
        // Blank controls represent nullable SQL values. Multi-choice ordering
        // is not clinically meaningful, and null and [] are both empty groups.
        if (field.kind === 'string[]') return same([...(a || [])].sort(), [...(b || [])].sort());
        if (field.kind === 'boolean' && field.controls[0].type === 'checkbox') return (a === true) === (b === true);
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
            if (names.includes('supplements_list') && (!writable(s.fields.get('supplements_list')) ||
                !same(window.CelloklabPatientFormState.supplementDraft(), snapshots.get(snapshot).supplementDraft))) return {ok: false, code: 'draft_changed'};
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
            // A confirmation may normalize blank/null or choice ordering, but
            // cannot introduce a different value than the reviewed patch.
            if (!result.updated_values || names.some(name => !Object.prototype.hasOwnProperty.call(result.updated_values, name) ||
                !valid(s.fields.get(name), result.updated_values[name]) || !equivalent(s.fields.get(name), payload[name], result.updated_values[name]))) return {ok: false, code: 'invalid_confirmation'};
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
            return Object.freeze(Object.fromEntries(Array.from(s.fields).filter(([, field]) => writable(field)).map(([name, field]) => [name, Object.freeze({type: field.kind, nullable: field.dynamic ? false : !field.legacy, label: field.label, choice_labels: Object.freeze({...field.choiceLabels}), choices: field.choices ? Object.freeze([...field.choices]) : null,
                ...(field.dynamic ? {encoding: 'json', row_fields: Object.freeze(['name', 'dose', 'frequency', 'since', 'schedule']), max_rows: 200, max_row_text: 2000} : {})})])));
        },
        captureSnapshot, applyConfirmedPatch, readRecord, savePatch,
        isDirty() { const s = init(); return Boolean(s && nativeDirty(s)); },
        acquireSaveLock, releaseSaveLock,
        isSaveLocked() { return Boolean(lock); }
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
    else init();
})();
