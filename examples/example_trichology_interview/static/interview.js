/* Same-origin host session only. No native form submission, storage, AI or retries. */
(() => {
  'use strict';
  for (const root of document.querySelectorAll('[data-trichology-interview]')) {
    if (root.dataset.initialized) continue;
    root.dataset.initialized = 'true';
    const status = root.querySelector('[data-status]');
    const save = root.querySelector('[data-save]');
    const refresh = root.querySelector('[data-refresh]');
    const fields = root.querySelector('[data-fields]');
    const dirtyLabel = root.querySelector('[data-dirty]');
    const editors = new Map();
    let baseline = {}, revision = null, busy = false, blocked = true, rebased = false;
    // Only user-changed fields survive denial, in this closure, never browser storage.
    let deniedDraft = {};
    const normalize = value => value === '' ? null : value;
    let schema;
    try { schema = JSON.parse(root.querySelector('[data-interview-schema]').textContent); }
    catch (_) { status.textContent = 'Nie udało się odczytać schematu wywiadu.'; continue; }
    const url = `/api/plugins/${encodeURIComponent(root.dataset.pluginId)}/patients/${encodeURIComponent(root.dataset.patientId)}/trichology?${new URLSearchParams({tenant_slug: root.dataset.tenantSlug})}`;
    const same = (a, b) => Array.isArray(a) && Array.isArray(b)
      ? a.length === b.length && a.every(v => b.includes(v)) : a === b;
    function changes() {
      const result = {};
      for (const [code, editor] of editors) {
        if (!Object.hasOwn(baseline, code)) continue;
        const value = editor.read();
        if (!same(value, baseline[code])) result[code] = value;
      }
      return result;
    }
    function controls() {
      const dirty = Object.keys(changes()).length > 0;
      root.dataset.pluginDirty = dirty ? 'true' : 'false';
      dirtyLabel.hidden = !dirty;
      root.setAttribute('aria-busy', busy ? 'true' : 'false');
      for (const node of fields.querySelectorAll('textarea, select, input, button')) node.disabled = busy || blocked || !revision;
      save.disabled = busy || blocked || !revision || !dirty;
      refresh.disabled = busy;
    }
    function node(tag, text, parent) {
      const element = document.createElement(tag);
      if (text !== undefined) element.textContent = text;
      parent.append(element); return element;
    }
    function option(select, value, label) { node('option', label, select).value = value; }
    function build() {
      for (const field of schema) {
        const box = node('div', undefined, fields); box.className = 'clk-ui-field';
        const label = node('label', field.label, box); label.className = 'clk-ui-label';
        const input = node(field.kind === 'text' ? 'textarea' : 'select', undefined, box);
        input.id = `trichology-interview-${field.code}`; label.htmlFor = input.id;
        input.dataset.pluginNonform = ''; // No name: never participates in native FormData.
        input.className = field.kind === 'text' ? 'clk-ui-textarea' : 'clk-ui-select';
        input.disabled = true;
        if (field.kind === 'text') { input.maxLength = 20000; input.rows = 3; }
        else if (field.kind === 'boolean') {
          option(input, '', 'Brak danych'); option(input, 'true', 'Tak'); option(input, 'false', 'Nie');
        } else {
          if (field.kind === 'multi') input.multiple = true;
          else option(input, '', 'Brak danych');
          for (const [code, title] of Object.entries(field.options)) option(input, code, title);
        }
        // Multi selection keeps null distinct from [] with an explicit clear action.
        let multiNull = true;
        const editor = {
          input,
          read: () => field.kind === 'boolean' ? (input.value === '' ? null : input.value === 'true')
            : field.kind === 'multi' ? (multiNull ? null : Array.from(input.selectedOptions, o => o.value))
            : (input.value === '' ? null : input.value),
          write: value => {
            if (field.kind === 'multi') {
              multiNull = value === null;
              for (const o of input.options) o.selected = Array.isArray(value) && value.includes(o.value);
            } else input.value = value === null ? '' : String(value);
          }
        };
        if (field.kind === 'multi') {
          const help = node('p', 'Wybór wielu: Ctrl / Cmd lub Shift. Wyczyść, aby ustawić brak danych.', box);
          help.className = 'clk-ui-help'; help.id = `${input.id}-help`; input.setAttribute('aria-describedby', help.id);
          const clear = node('button', 'Wyczyść wybór', box); clear.type = 'button';
          clear.className = 'clk-ui-button clk-ui-button--secondary clk-ui-button--small';
          clear.addEventListener('click', () => {
            if (busy || blocked || !revision) return; editor.write(null); controls();
          });
          input.addEventListener('change', () => { multiNull = false; controls(); });
        }
        editors.set(field.code, editor);
      }
    }
    function valid(field, value, options) {
      value = normalize(value);
      if (value === null) return true;
      if (field.kind === 'boolean') return typeof value === 'boolean';
      if (field.kind === 'multi') return Array.isArray(value) && value.every(v => typeof v === 'string' && Object.hasOwn(options, v));
      if (field.kind === 'choice') return typeof value === 'string' && Object.hasOwn(options, value);
      return typeof value === 'string';
    }
    async function request(body) {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
      if (!csrf || !root.dataset.patientId || !root.dataset.tenantSlug) throw new Error('Brak kontekstu sesji. Odśwież stronę po zabezpieczeniu zmian.');
      const options = {credentials: 'same-origin', cache: 'no-store', headers: {'X-CSRF-Token': csrf}};
      if (body !== undefined) Object.assign(options, {method: 'PATCH',
        headers: {...options.headers, 'Content-Type': 'application/json', 'If-Match': revision}, body: JSON.stringify(body)});
      let response;
      try { response = await fetch(url, options); }
      catch (_) { throw new Error('Nie udało się potwierdzić operacji. Zachowano pola; odczytaj aktualną wersję przed ponownym zapisem.'); }
      if (!response.ok) {
        const messages = {401: 'Sesja wygasła. Dane ukryto; Twoje niezapisane zmiany pozostają tylko w pamięci tej strony. Nie zamykaj jej przed ponownym logowaniem i odczytem.',
          403: 'Brak uprawnienia do dokumentacji tego pacjenta w tej klinice. Dane ukryto; szkic pozostaje tylko w pamięci do uprawnionego odczytu.',
          404: 'Wywiad nie jest dostępny w tej klinice. Dane ukryto; szkic pozostaje tylko w pamięci do uprawnionego odczytu.',
          409: 'Konflikt wersji. Zachowano pola; odczytaj aktualną wersję przed ponownym zapisem.',
          412: 'Konflikt wersji. Zachowano pola; odczytaj aktualną wersję przed ponownym zapisem.',
          422: 'Nieprawidłowe dane wywiadu. Zachowano pola; sprawdź wartości.',
          428: 'Brak aktualnej wersji. Odczytaj wywiad przed zapisem.'};
        if ([401, 403, 404].includes(response.status)) {
          deniedDraft = {...deniedDraft, ...changes()};
          baseline = {}; revision = null; blocked = true; rebased = false;
          for (const editor of editors.values()) editor.write(null);
        }
        throw new Error(messages[response.status] || 'Nie udało się potwierdzić operacji. Zachowano pola; odczytaj aktualną wersję.');
      }
      const data = await response.json().catch(() => null);
      const result = data?.[body === undefined ? 'record' : 'result'];
      if (!result || typeof result.revision !== 'string' || !result.revision) throw new Error('Nieczytelna odpowiedź. Zachowano pola; odczytaj aktualną wersję.');
      return result;
    }
    async function load() {
      if (busy) return;
      const pending = changes();
      busy = true; controls();
      try {
        const record = await request();
        if (!record.interview_values || !record.interview_options || !record.field_labels) throw new Error('Brak typowanych danych wywiadu. Edycja nie jest dostępna.');
        for (const field of schema) {
          const options = record.interview_options[field.code] || {};
          if (!Object.hasOwn(record.interview_values, field.code) || !valid(field, record.interview_values[field.code], options)) throw new Error('Nieprawidłowy schemat danych wywiadu. Zachowano pola.');
          // Pin this reference's reviewed SDK choices; do not silently drop unknown codes.
          if (field.kind === 'choice' || field.kind === 'multi') {
            if (Object.keys(options).length !== Object.keys(field.options).length || Object.entries(field.options).some(([code, label]) => options[code] !== label)) throw new Error('Schemat opcji zmienił się. Wymagana jest aktualizacja modułu.');
          }
        }
        baseline = Object.fromEntries(schema.map(field => [field.code, normalize(record.interview_values[field.code])]));
        revision = record.revision; blocked = false;
        let restored = pending;
        if (Object.keys(deniedDraft).length && window.confirm('Odzyskano uprawniony dostęp. Czy przywrócić Twoje niezapisane zmiany przechowywane wyłącznie w pamięci tej strony?')) {
          restored = {...deniedDraft, ...pending}; deniedDraft = {};
        }
        for (const field of schema) editors.get(field.code).write(Object.hasOwn(restored, field.code) ? restored[field.code] : baseline[field.code]);
        rebased = Object.keys(changes()).length > 0;
        status.textContent = rebased ? 'Odczytano aktualną wersję i zachowano Twoje zmiany. Sprawdź je przed osobnym zapisem.' : 'Odczytano aktualną wersję wywiadu.';
      } catch (error) { blocked = true; status.textContent = error.message; }
      finally { busy = false; controls(); }
    }
    async function persist() {
      if (busy || blocked || !revision) return;
      if (window.celloklabPatientFormDirty === true) {
        status.textContent = 'Formularz pacjenta ma niezapisane zmiany. Najpierw zapisz je lub odrzuć i odczytaj aktualny wywiad, a następnie zapisz zmiany modułu.';
        return;
      }
      const patch = changes();
      if (!Object.keys(patch).length) return;
      if (rebased && !window.confirm('Zachowano Twoje zmiany po ponownym odczycie. Czy zapisać je na aktualnej wersji wywiadu?')) return;
      const nativeControls = nativeSnapshot(patch);
      busy = true; controls();
      try {
        const result = await request(patch);
        const values = result.updated_values;
        if (!values || Object.keys(values).length !== Object.keys(patch).length || Object.keys(patch).some(code => !Object.hasOwn(values, code) || !valid(schema.find(f => f.code === code), values[code], schema.find(f => f.code === code).options))) throw new Error('Nieczytelny wynik zapisu. Zachowano pola; odczytaj aktualną wersję.');
        syncNative(values, nativeControls);
        for (const [code, raw] of Object.entries(values)) { const value = normalize(raw); baseline[code] = value; editors.get(code).write(value); }
        revision = result.revision; rebased = false;
        status.textContent = 'Zapisano zmienione pola wywiadu partnera i uaktualniono odpowiadające im pola formularza pacjenta. Pozostałych pól nie zmieniono.';
      } catch (error) { blocked = true; status.textContent = error.message; }
      finally { busy = false; controls(); }
    }
    function nativeSnapshot(patch) {
      const form = document.getElementById('patientForm');
      const snapshot = [];
      if (!form) return snapshot;
      for (const group of form.querySelectorAll('[data-trichology-field]')) {
        const code = group.dataset.trichologyField;
        if (!Object.hasOwn(patch, code)) continue;
        for (const input of group.querySelectorAll('input, textarea, select')) {
          if (input.name === code) snapshot.push({code, input, value: input.value, checked: input.checked});
        }
      }
      return snapshot;
    }
    function syncNative(values, snapshot) {
      const editedCodes = new Set(snapshot.filter(({input, value, checked}) => input.value !== value || input.checked !== checked).map(({code}) => code));
      for (const {code, input} of snapshot) {
        // Also protect edits made while PATCH was in flight; never emit dirty events.
        if (editedCodes.has(code)) continue;
        const value = normalize(values[code]);
        if (input.type === 'checkbox') input.checked = Array.isArray(value) && value.includes(input.value);
        else if (input.type === 'radio') input.checked = value === input.value;
        else if (schema.find(f => f.code === code).kind === 'boolean') input.value = value === null ? '' : value ? 'yes' : 'no';
        else input.value = value === null ? '' : String(value);
      }
      const saved = Object.fromEntries(Object.entries(values).map(([code, value]) => [code, normalize(value)]));
      const dataNode = document.getElementById('patient-data');
      if (dataNode) {
        try { const data = JSON.parse(dataNode.textContent); Object.assign(data, saved); dataNode.textContent = JSON.stringify(data); }
        catch (_) { /* The host may not expose a JSON initialization snapshot. */ }
      }
      // documentation_form.js keeps its initialization object in global lexical scope.
      try { if (typeof patientData !== 'undefined' && patientData) Object.assign(patientData, saved); }
      catch (_) { /* Native script is not initialized on this page. */ }
    }
    build();
    // These edits belong to this independent saver, never to the native dirty flag.
    const edited = event => { event.stopPropagation(); controls(); };
    root.addEventListener('input', edited); root.addEventListener('change', edited);
    // Never let Enter in this non-form editor trigger the enclosing native form.
    root.addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA' && event.target.tagName !== 'BUTTON') event.preventDefault();
    });
    save.addEventListener('click', persist); refresh.addEventListener('click', load);
    window.addEventListener('beforeunload', event => {
      if (busy || Object.keys(changes()).length || Object.keys(deniedDraft).length) { event.preventDefault(); event.returnValue = ''; }
    });
    // Leave the native submit and its dirty tracker untouched. Our fields are unnamed,
    // explicitly non-form, and our unload guard owns only this editor's unsaved state.
    load();
  }
})();
