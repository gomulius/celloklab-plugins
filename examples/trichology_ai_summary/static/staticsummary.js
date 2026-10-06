/* Tylko odczyt: kolejkę i generowanie kontroluje host, nie przeglądarka. */
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
    absent: 'Brak podsumowania. Powstanie automatycznie po zapisaniu zmienionej dokumentacji.',
    empty: 'Brak podsumowania. Powstanie automatycznie po zapisaniu dokumentacji.',
    missing: 'Brak podsumowania. Powstanie automatycznie po zapisaniu dokumentacji.',
    none: 'Brak podsumowania. Powstanie automatycznie po zapisaniu dokumentacji.'
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
  document.querySelectorAll('[data-trichology-ai-summary]').forEach(card => {
    if (card.dataset.summaryMounted === 'true') return;
    card.dataset.summaryMounted = 'true';
    const status = card.querySelector('[data-summary-status]');
    const output = card.querySelector('[data-summary-text]');
    const result = card.querySelector('[data-summary-result]');
    const generated = card.querySelector('[data-summary-generated]');
    const obsolete = card.querySelector('[data-summary-obsolete]');
    const revision = card.querySelector('[data-summary-revision]');
    // Native host identity only, never infer IDs from URLs, clinical fields or storage.
    // The non-form hook currently supplies no template_context; #patient-data is
    // the host-rendered identity block used by the native patient card itself.
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
    let requests = 0;
    let timer = null;
    let stopped = false;
    async function read() {
      if (stopped || requests >= MAX_REQUESTS) return;
      requests += 1;
      try {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
        const response = await fetch(url, {
          method: 'GET', credentials: 'same-origin', cache: 'no-store',
          headers: {'X-CSRF-Token': csrf}
        });
        if (!response.ok) {
          output.textContent = '';
          output.hidden = true;
          result.hidden = true;
          generated.textContent = '';
          generated.hidden = true;
          obsolete.hidden = true;
          revision.hidden = true;
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
        status.textContent = labels[summary.status] || 'Podsumowanie jest obecnie niedostępne.';
        const hasText = typeof summary.text === 'string' && summary.text.length > 0;
        output.textContent = hasText ? summary.text : '';
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
        if (pending.has(summary.status)) {
          if (requests < MAX_REQUESTS) timer = window.setTimeout(read, INTERVAL_MS);
          else if (summary.status !== 'pending') status.textContent = 'Podsumowanie nie zostało jeszcze przygotowane. Możesz sprawdzić wynik później; nie uruchamiaj drugiej generacji.';
        }
      } catch (_) {
        output.textContent = '';
        output.hidden = true;
        result.hidden = true;
        generated.textContent = '';
        generated.hidden = true;
        obsolete.hidden = true;
        revision.hidden = true;
        status.textContent = 'Nie udało się odczytać podsumowania. Odśwież kartę, aby spróbować ponownie.';
      }
    }
    // Native save redirects to the saved card: that new mount reads the queued job.
    window.addEventListener('pagehide', () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      output.textContent = '';
      result.hidden = true;
      generated.textContent = '';
      generated.hidden = true;
    }, {once: true});
    read();
  });
})();
