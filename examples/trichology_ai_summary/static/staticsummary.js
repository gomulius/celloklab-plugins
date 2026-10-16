/* Mount/poll only read. An explicit click requests saved-source generation from the host. */
(() => {
  'use strict';
  const MAX_REQUESTS = 30;
  const INTERVAL_MS = 2000;
  const labels = {
    pending: 'Wynik wywołania AI nie został potwierdzony. Zadanie wymaga sprawdzenia przez administratora; nie zostanie automatycznie ponowione.',
    queued: 'Podsumowanie jest w kolejce i oczekuje na rozpoczęcie generowania.',
    running: 'Trwa przygotowywanie podsumowania.',
    processing: 'Trwa przygotowywanie podsumowania.',
    succeeded: 'Podsumowanie zostało przygotowane.',
    ready: 'Podsumowanie zostało przygotowane.',
    completed: 'Podsumowanie zostało przygotowane.',
    failed: 'Nie udało się przygotować podsumowania.',
    cancelled: 'Przygotowanie podsumowania zostało anulowane.',
    blocked: 'Generowanie podsumowania jest niedostępne.',
    unavailable: 'Podsumowanie jest niedostępne.',
    stale: 'Podsumowanie dotyczy poprzedniej wersji dokumentacji.',
    obsolete: 'Podsumowanie dotyczy poprzedniej wersji dokumentacji.',
    absent: 'Brak podsumowania. Użyj „Zapisz” lub „Podsumuj teraz”, aby podsumować zapisaną dokumentację.',
    empty: 'Brak podsumowania. Użyj „Zapisz” lub „Podsumuj teraz”.',
    missing: 'Brak podsumowania. Użyj „Zapisz” lub „Podsumuj teraz”.',
    none: 'Brak podsumowania. Użyj „Zapisz” lub „Podsumuj teraz”.'
  };
  // Keep the host's wall-clock value: naive DB timestamps do not assert UTC.
  // Never invent a timezone or substitute the browser's current time.
  function generatedLabel(value) {
    if (typeof value !== 'string') return '';
    const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
    if (!match) return '';
    const [, year, month, day, hour, minute, second, zone] = match;
    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() !== Number(year)
        || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)
        || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return '';
    if (zone && zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) return '';
    const suffix = zone === 'Z' ? ' UTC' : zone ? ` UTC${zone}` : '';
    return `Wygenerowano: ${day}.${month}.${year}, ${hour}:${minute}${suffix}.`;
  }
  const pending = new Set(['pending', 'queued', 'running', 'processing']);
  // Deliberately small Markdown subset. All source characters remain text;
  // never parse HTML, URLs, images or attributes supplied by the model.
  function renderSummary(target, text) {
    target.textContent = '';
    function inline(parent, value) {
      value.split(/(\*\*[^*\n]+\*\*)/g).forEach(part => {
        const bold = part.startsWith('**') && part.endsWith('**') && part.length > 4;
        const node = document.createElement(bold ? 'strong' : 'span');
        node.textContent = bold ? part.slice(2, -2) : part;
        parent.appendChild(node);
      });
    }
    let paragraph = null, list = null;
    text.replace(/\r\n?/g, '\n').split('\n').forEach(line => {
      if (!line.trim()) { paragraph = null; list = null; return; }
      const heading = /^#{1,6}\s+(.+)$/.exec(line);
      const item = /^\s*(?:[-*+] |\d+[.)] )(.+)$/.exec(line);
      if (heading) {
        paragraph = null; list = null;
        const node = document.createElement('h4');
        inline(node, heading[1]); target.appendChild(node);
      } else if (item) {
        paragraph = null;
        const type = /^\s*\d/.test(line) ? 'ol' : 'ul';
        if (!list || list.tagName.toLowerCase() !== type) {
          list = document.createElement(type); target.appendChild(list);
        }
        const node = document.createElement('li');
        inline(node, item[1]); list.appendChild(node);
      } else {
        list = null;
        if (!paragraph) { paragraph = document.createElement('p'); target.appendChild(paragraph); }
        else paragraph.appendChild(document.createTextNode('\n'));
        inline(paragraph, line);
      }
    });
  }
  document.querySelectorAll('[data-trichology-ai-summary]').forEach(card => {
    if (card.dataset.summaryMounted === 'true') return;
    card.dataset.summaryMounted = 'true';
    const status = card.querySelector('[data-summary-status]');
    const output = card.querySelector('[data-summary-text]');
    const result = card.querySelector('[data-summary-result]');
    const generated = card.querySelector('[data-summary-generated]');
    const obsolete = card.querySelector('[data-summary-obsolete]');
    const revision = card.querySelector('[data-summary-revision]');
    const button = card.querySelector('[data-summary-request]');

    // Native host identity only, never infer IDs from URLs, clinical fields or storage.
    const nativePatient = document.getElementById('patient-data');
    const patientId = card.dataset.patientId || nativePatient?.dataset.patientId;
    const tenantSlug = card.dataset.tenantSlug || nativePatient?.dataset.tenantSlug;
    const pluginId = card.dataset.pluginId;
    const pane = card.closest('#tab-wywiad');
    if (!pane || !patientId || !tenantSlug || pluginId !== 'trichology.ai-summary') {
      status.textContent = 'Podsumowanie niedostępne — brak kontekstu zapisanej karty pacjenta.';
      return;
    }
    const url = `/api/plugins/${encodeURIComponent(pluginId)}/patients/${encodeURIComponent(patientId)}/trichology-summary?tenant_slug=${encodeURIComponent(tenantSlug)}`;
    let requests = 0, timer = null;
    let stopped = false, reading = false, submitting = false;
    let jobPending = false, uncertain = false, denied = false, reusedRequest = false;
    const reusedMessage = 'Dokumentacja bez zmian — wykorzystano istniejące zadanie; nie uruchomiono nowej generacji. ';
    const uncertainMessage = 'Nie można potwierdzić przyjęcia żądania. Mogło już rozpocząć płatne generowanie. Sprawdzamy tylko wynik — nie wysyłamy ponownie. Sprawdź kartę później lub skontaktuj się z administratorem.';
    function message(text) {
      status.textContent = text;
    }
    function updateButton() {
      button.disabled = stopped || reading || submitting || jobPending || uncertain || denied;
      button.textContent = submitting ? 'Zlecanie podsumowania…' : jobPending ? 'Podsumowanie w toku…' : 'Podsumuj teraz';
    }
    function clearResult() {
      output.textContent = '';
      output.hidden = true;
      result.hidden = true;
      generated.textContent = '';
      generated.hidden = true;
      obsolete.hidden = true;
      revision.hidden = true;
    }
    async function read() {
      if (stopped || reading || requests >= MAX_REQUESTS) return;
      timer = null;
      reading = true;
      updateButton();
      requests += 1;
      try {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
        const response = await fetch(url, {
          method: 'GET', credentials: 'same-origin', cache: 'no-store',
          headers: {'X-CSRF-Token': csrf}
        });
        if (stopped) return;
        if (!response.ok) {
          denied = [401, 403, 404].includes(response.status);
          clearResult();
          status.textContent = response.status === 403
            ? 'Brak uprawnień do podsumowania dokumentacji trychologicznej.'
            : 'Podsumowanie jest obecnie niedostępne.';
          return;
        }
        const envelope = await response.json();
        if (stopped) return;
        const summary = envelope.summary;
        if (envelope.plugin_id !== pluginId || !summary || typeof summary.status !== 'string') {
          throw new Error('invalid envelope');
        }
        jobPending = pending.has(summary.status);
        if (!uncertain) message((reusedRequest ? reusedMessage : '')
          + (labels[summary.status] || 'Podsumowanie jest obecnie niedostępne.'));
        const hasText = typeof summary.text === 'string' && summary.text.length > 0;
        renderSummary(output, hasText ? summary.text : '');
        output.hidden = !hasText;
        result.hidden = !hasText;
        generated.textContent = hasText ? generatedLabel(summary.generated_at) : '';
        generated.hidden = !generated.textContent;
        obsolete.hidden = !hasText || summary.is_current === true;
        const source = typeof summary.source_revision === 'string' ? summary.source_revision : '';
        const current = typeof summary.current_revision === 'string' ? summary.current_revision : '';
        revision.textContent = hasText
          ? (summary.is_current === true ? 'Podsumowanie dotyczy aktualnej dokumentacji.' : 'Dokumentacja zmieniła się od przygotowania tego podsumowania.')
          : (source && source === current ? 'Zadanie dotyczy aktualnej dokumentacji.' : 'Brak podsumowania aktualnej dokumentacji.');
        revision.hidden = !source && !current;
        if (jobPending) {
          if (requests < MAX_REQUESTS) timer = window.setTimeout(read, INTERVAL_MS);
          else if (summary.status !== 'pending' && !uncertain) message((reusedRequest ? reusedMessage : '') + 'Podsumowanie nie zostało jeszcze przygotowane. Możesz sprawdzić wynik później; nie uruchamiaj drugiej generacji.');
        }
        // Uncertainty stays latched even if GET returns an older artifact or no job.
      } catch (_) {
        if (stopped) return;
        clearResult();
        status.textContent = 'Nie udało się odczytać podsumowania. Odśwież kartę, aby spróbować ponownie.';
      } finally {
        reading = false;
        updateButton();
      }
    }
    button.addEventListener('click', async event => {
      event.preventDefault();
      if (stopped || reading || submitting || jobPending || uncertain || denied) return;
      const host = window.CelloklabPatientFormState;
      const bridge = window.CelloklabTrichologyFormBridge;
      // Uninitialized persistence state is NOT evidence of a clean form.
      if (!host?.isReady() || typeof host.isDirty !== 'function') {
        message('Nie można sprawdzić stanu formularza. Poczekaj na wczytanie karty lub odśwież stronę.');
        return;
      }
      if (host.isDirty()) {
        message('Masz niezapisane zmiany w karcie pacjenta. Najpierw użyj „Zapisz”. „Podsumuj teraz” korzysta wyłącznie ze wszystkich zapisanych sekcji i notatek — nie zapisuje formularza.');
        return;
      }
      if (bridge?.isSaveLocked() || (typeof isSubmitting !== 'undefined' && isSubmitting)) {
        message('Trwa zapis dokumentacji. Poczekaj na jego zakończenie.');
        return;
      }
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
      if (!csrf) {
        message('Nie można bezpiecznie zlecić podsumowania. Odśwież stronę i sprawdź sesję.');
        return;
      }
      const lock = bridge?.acquireSaveLock();
      if (bridge && !lock) {
        message('Trwa zapis dokumentacji. Poczekaj na jego zakończenie.');
        return;
      }
      submitting = true;
      updateButton();
      message('Zlecanie podsumowania wszystkich zapisanych sekcji i notatek…');
      if (timer !== null) window.clearTimeout(timer);
      requests = 0;
      let shouldRead = false;
      try {
        const response = await fetch(url, {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: {'X-CSRF-Token': csrf}
          // No body: the host loads the complete saved source, not a browser draft.
        });
        if (stopped) return;
        if (!response.ok) {
          if (response.status >= 500 || response.status === 408) throw new Error('unconfirmed request');
          denied = [401, 403, 404].includes(response.status);
          message(response.status === 403
            ? 'Brak uprawnień do podsumowania dokumentacji trychologicznej w tej klinice.'
            : response.status === 401 ? 'Sesja wygasła. Zaloguj się ponownie.'
            : response.status === 409 ? 'Dokumentacja zmieniła się lub trwa inne zadanie. Odśwież kartę i sprawdź wynik.'
            : response.status === 429 ? 'Limit generowania został osiągnięty. Spróbuj później.'
            : 'Nie można zlecić podsumowania. Sprawdź sesję, uprawnienia i zapisaną dokumentację.');
          return;
        }
        const envelope = await response.json();
        if (stopped) return;
        const request = envelope.request;
        if (![200, 202].includes(response.status) || envelope.plugin_id !== pluginId || !request
            || typeof request.job_id !== 'string' || !request.job_id
            || !Object.prototype.hasOwnProperty.call(labels, request.status)
            || typeof request.source_revision !== 'string' || typeof request.current_revision !== 'string'
            || typeof request.created !== 'boolean' || request.reused !== !request.created) {
          throw new Error('invalid request envelope');
        }
        jobPending = pending.has(request.status);
        reusedRequest = request.reused;
        message((reusedRequest ? reusedMessage : '') + labels[request.status]);
        shouldRead = true;
      } catch (_) {
        if (stopped) return;
        // Never retry a paid POST after a lost response, invalid JSON or server error.
        uncertain = true;
        message(uncertainMessage);
        shouldRead = true;
      } finally {
        submitting = false;
        if (lock) bridge.releaseSaveLock(lock);
        updateButton();
        if (shouldRead && !stopped) read();
      }
    });
    // Native save redirects to the saved card: that new mount only reads the job.
    // Accepted Vision PATCH does not request generation or trigger this reader.
    window.addEventListener('pagehide', () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      clearResult();
      updateButton();
    }, {once: true});
    read();
  });
})();
