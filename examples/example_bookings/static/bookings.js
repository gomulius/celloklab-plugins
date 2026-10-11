/* Reception-only host session. No local storage, automatic retries or patient accounts. */
(() => {
  'use strict';
  for (const root of document.querySelectorAll('[data-booking-demo]')) {
    if (root.dataset.initialized) continue;
    root.dataset.initialized = 'true';
    const form = root.querySelector('[data-create]');
    const status = root.querySelector('[data-status]');
    const provider = root.querySelector('[data-provider]');
    const treatment = root.querySelector('[data-treatment]');
    const procedures = new Map();
    function preview() {
      const row = procedures.get(treatment.value);
      root.querySelector('[data-preview]').textContent = row ? `${row.name} — ${row.duration_minutes} min` : 'Wybierz procedurę.';
    }
    treatment.addEventListener('change', preview);
    const day = root.querySelector('[data-day]');
    const retry = root.querySelector('[data-retry]');
    const fresh = root.querySelector('[data-new]');
    let busy = false, operation = null, confirmed = false, uncertainMutation = false;
    const base = `/api/plugins/${encodeURIComponent(root.dataset.pluginId)}/bookings`;
    const tenant = root.dataset.tenantSlug;
    const controls = () => {
      for (const node of root.querySelectorAll('button, input, select')) node.disabled = busy;
      for (const node of form.querySelectorAll('input, select, button[type="submit"]')) node.disabled = busy || !!operation;
      retry.hidden = !operation || confirmed;
      retry.disabled = busy;
      fresh.disabled = busy || !confirmed;
      root.setAttribute('aria-busy', busy ? 'true' : 'false');
    };
    async function request(path, body, headers = {}, query = {}) {
      const params = new URLSearchParams({tenant_slug: tenant, ...query});
      const options = {credentials: 'same-origin', cache: 'no-store', headers};
      if (body !== undefined) {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
        if (!csrf) throw new Error('Brak tokenu CSRF. Odśwież stronę po sprawdzeniu poprzedniej operacji.');
        options.method = 'POST';
        options.headers = {...headers, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf};
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
      const response = await fetch(`${base}${path}?${params}`, options);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const messages = {403: 'Brak uprawnienia w tej klinice lub aktywnej zgody na tę operację.',
          409: 'Konflikt terminu lub wersji. Zachowano pola; odczytaj rezerwację ponownie.',
          422: 'Nieprawidłowe dane. Sprawdź termin, specjalistę i dane kontaktowe.',
          428: 'Wymagany jest oryginalny klucz żądania lub wersja rezerwacji.'};
        throw new Error(messages[response.status] || 'Nie udało się potwierdzić operacji. Nie ponawiaj jej nowym kluczem.');
      }
      if (!data || !Object.prototype.hasOwnProperty.call(data, 'result')) throw new Error('Nieczytelna odpowiedź. Sprawdź kalendarz przed kolejną zmianą.');
      return data.result;
    }
    function text(tag, value, parent) {
      const node = document.createElement(tag); node.textContent = value; parent.append(node); return node;
    }
    function action(parent, label, callback) {
      const button = text('button', label, parent); button.type = 'button';
      button.className = 'clk-ui-button clk-ui-button--secondary clk-ui-button--small';
      button.addEventListener('click', callback);
    }
    async function mutate(row, path, body) {
      if (busy || uncertainMutation || !row.revision) return;
      busy = true; controls();
      try {
        await request(`/${row.visit_id || row.id}/${path}`, body, {'If-Match': row.revision});
        status.textContent = 'Potwierdzono zmianę. Odczytaj kalendarz, aby uzyskać aktualną wersję.';
        // Disable old row controls until an explicit authoritative reread.
        uncertainMutation = true;
      } catch (error) {
        uncertainMutation = true;
        status.textContent = `${error.message} Nie ponawiaj zmiany bez jawnego odczytu.`;
      } finally { busy = false; controls(); }
    }
    function calendar(rows) {
      const container = root.querySelector('[data-calendar]'); container.replaceChildren();
      for (const row of rows) {
        if (!String(row.visit_date || '').startsWith(day.value) || row.doctor_id !== provider.value) continue;
        const card = document.createElement('div'); card.className = 'clk-ui-card clk-ui-card--compact clk-ui-stack'; container.append(card);
        const labels = {zaplanowana: 'zaplanowana', scheduled: 'zaplanowana', cancelled_by_reception: 'anulowana przez recepcję', cancelled: 'anulowana', anulowana: 'anulowana'};
        text('p', `${row.visit_date} — ${row.visit_end || 'brak godziny końca'} (${row.duration_minutes || 60} min); ${labels[row.status] || 'inny stan'}`, card);
        text('p', row.patient_id ? 'Przypisano zarejestrowanego pacjenta' : 'Rezerwacja kontaktowa — bez dokumentacji', card);
        const contact = row.contact || {};
        text('p', [contact.name, contact.surname].filter(Boolean).join(' '), card);
        const actions = document.createElement('div'); actions.className = 'clk-ui-row'; card.append(actions);
        if (!row.patient_id) {
          const label = text('label', 'Identyfikator już zarejestrowanego pacjenta', card);
          const input = document.createElement('input'); input.className = 'clk-ui-input';
          input.id = `booking-patient-${row.visit_id || row.id}`; label.htmlFor = input.id; card.append(input);
          action(actions, 'Przypisz pacjenta', () => {
            if (!input.value.trim()) { status.textContent = 'Wpisz identyfikator już zarejestrowanego pacjenta.'; return; }
            mutate(row, 'attach-patient', {patient_id: input.value.trim()});
          });
        }
        const shiftLabel = text('label', 'Nowy termin', card);
        const shift = document.createElement('input'); shift.type = 'datetime-local'; shift.className = 'clk-ui-input';
        shift.id = `booking-shift-${row.visit_id || row.id}`; shiftLabel.htmlFor = shift.id; card.append(shift);
        action(actions, 'Przełóż', () => {
          if (shift.value) mutate(row, 'reschedule', {visit_date: shift.value});
          else status.textContent = 'Wybierz nowy termin.';
        });
        action(actions, 'Anuluj', () => {
          if (window.confirm('Czy anulować tę rezerwację? Historia zostanie zachowana.')) mutate(row, 'cancel', {});
        });
      }
      if (!container.children.length) text('p', 'Brak rezerwacji w wybranym dniu.', container);
    }
    async function refresh() {
      if (busy || !day.value || !provider.value) return;
      busy = true; controls();
      try {
        const next = new Date(`${day.value}T12:00:00`); next.setDate(next.getDate() + 1);
        const end = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}T00:00`;
        const available = await request('/availability', undefined, {}, {doctor_id: provider.value, start: `${day.value}T00:00`, end});
        const list = await request('');
        const rows = Array.isArray(list) ? list : list.bookings || [];
        calendar(rows);
        const intervals = root.querySelector('[data-busy]'); intervals.replaceChildren();
        for (const interval of available.busy || available.busy_intervals || []) text('li', `${interval.start || interval.visit_date} — ${interval.end || interval.visit_end}`, intervals);
        if (!intervals.children.length) text('li', 'Brak zajętych przedziałów.', intervals);
        uncertainMutation = false;
        status.textContent = 'Odczytano aktualny kalendarz. Cała doba jest dostępna poza zajętymi przedziałami; brak reguł godzin pracy.';
      } catch (error) {
        root.querySelector('[data-calendar]').replaceChildren(); root.querySelector('[data-busy]').replaceChildren();
        status.textContent = error.message;
      } finally { busy = false; controls(); }
    }
    async function create() {
      if (busy || confirmed) return;
      if (!operation) {
        if (!form.reportValidity() || !provider.value || !window.crypto?.randomUUID) return;
        const fields = new FormData(form);
        const selected = procedures.get(treatment.value);
        if (!selected) { status.textContent = 'Wybierz aktywną procedurę.'; return; }
        operation = {key: crypto.randomUUID(), body: JSON.stringify({doctor_id: provider.value,
          visit_date: fields.get('visit_date'), visit_type: selected.visit_type,
          ...(selected.treatment_id ? {treatment_id: selected.treatment_id} : {}),
          contact: {name: fields.get('name'), surname: fields.get('surname'), phone: fields.get('phone'), email: fields.get('email')}})};
      }
      busy = true; controls();
      try {
        const result = await request('', operation.body, {'Idempotency-Key': operation.key});
        if (!result.visit_id && !result.id) throw new Error('Nieczytelny wynik rezerwacji. Zachowano oryginalne żądanie.');
        confirmed = true; status.textContent = 'Potwierdzono rezerwację. Odczytaj kalendarz lub rozpocznij nową rezerwację.';
      } catch (error) { status.textContent = `${error.message} Zachowano oryginalne dane i klucz; sprawdź wyłącznie tym samym żądaniem.`; }
      finally { busy = false; controls(); }
    }
    form.addEventListener('submit', event => {event.preventDefault(); create();});
    retry.addEventListener('click', create);
    fresh.addEventListener('click', () => { if (busy || !confirmed) return; operation = null; confirmed = false; form.reset(); preview(); controls(); });
    root.querySelector('[data-refresh]').addEventListener('click', refresh);
    window.addEventListener('beforeunload', event => {
      if ((operation && !confirmed) || uncertainMutation || [...form.querySelectorAll('input')].some(input => input.value)) {
        event.preventDefault(); event.returnValue = '';
      }
    });
    (async () => {
      busy = true; controls();
      try {
        const catalog = await request('/catalog');
        for (const row of catalog.treatments || []) {
          procedures.set(String(row.treatment_id), row);
          const option = text('option', `${row.name} — ${row.duration_minutes} min`, treatment);
          option.value = String(row.treatment_id);
        }
        if (catalog.other) {
          const row = {...catalog.other, name: 'Inne — rezerwacja organizacyjna'};
          procedures.set('inne', row);
          text('option', `${row.name} — ${row.duration_minutes} min`, treatment).value = 'inne';
        }
        preview();
        const result = await request('/providers');
        for (const row of Array.isArray(result) ? result : result.providers || []) {
          const option = text('option', row.display_name || 'Specjalista', provider); option.value = row.doctor_id;
        }
        status.textContent = 'Wybierz dzień i odczytaj kalendarz.';
      } catch (error) { status.textContent = error.message; }
      finally {busy = false; controls();}
    })();
  }
})();
