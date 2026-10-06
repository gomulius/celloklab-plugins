/* Same-origin host UI only. No storage, background retries or clinical APIs. */
(() => {
  'use strict';
  // Shared across duplicate asset loads; identities never share paid execution state.
  const states = window.CelloklabExampleAIStates ||= new Map();
  for (const panel of document.querySelectorAll('[data-plugin-ai-demo]')) {
    if (panel.dataset.initialized === 'true') continue;
    const prompt = panel.querySelector('[data-ai-prompt]');
    const generate = panel.querySelector('[data-ai-generate]');
    const replay = panel.querySelector('[data-ai-replay]');
    const fresh = panel.querySelector('[data-ai-new]');
    const loading = panel.querySelector('[data-ai-loading]');
    const status = panel.querySelector('[data-ai-status]');
    const output = panel.querySelector('[data-ai-output]');
    if (!prompt || !generate || !replay || !fresh || !loading || !status || !output) continue;
    panel.dataset.initialized = 'true';
    const identity = JSON.stringify([panel.dataset.pluginId, panel.dataset.tenantSlug]);
    if (!states.has(identity)) {
      const state = {operation: null, busy: false, settled: false, views: [], message: null, text: ''};
      states.set(identity, state);
      window.addEventListener('beforeunload', event => {
        if (state.operation && !state.settled) { event.preventDefault(); event.returnValue = ''; }
      });
    }
    const state = states.get(identity);
    const view = {panel, prompt, generate, replay, fresh, loading, status, output,
      fixed: prompt.hasAttribute('data-ai-fixed-prompt')};
    state.views.push(view);

    function sync() {
      for (const item of state.views) {
        item.generate.disabled = state.busy || !!state.operation;
        item.replay.hidden = !state.operation || state.settled;
        item.replay.disabled = state.busy || !state.operation || state.settled;
        item.fresh.disabled = state.busy || !state.settled;
        item.prompt.readOnly = item.fixed || !!state.operation;
        item.loading.hidden = !state.busy;
        item.panel.setAttribute('aria-busy', state.busy ? 'true' : 'false');
        if (state.message !== null) item.status.textContent = state.message;
        item.output.textContent = state.text;
      }
    }
    function notify(type, message) {
      // A presentation failure never changes a confirmed execution into a retry.
      try { window.CelloklabPluginUI.notify({type, message}); } catch (_) {}
    }
    function uncertain(message) {
      state.settled = false;
      state.text = '';
      state.message = `${message} Oryginalny klucz: ${state.operation.key}. Użyj wyłącznie sprawdzenia tego samego wykonania; nie uruchamiaj nowego.`;
      notify('warning', message);
    }
    function validResult(result) {
      return result && typeof result.execution_id === 'string' && result.execution_id.length > 0 &&
        typeof result.status === 'string' && Number.isSafeInteger(result.credit_cost) && result.credit_cost >= 0 &&
        typeof result.charged === 'boolean' && typeof result.replayed === 'boolean' &&
        (result.text === undefined || typeof result.text === 'string');
    }
    async function send(isReplay) {
      if (state.busy || (isReplay && (!state.operation || state.settled)) || (!isReplay && state.operation)) return;
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
      if (!csrf || !panel.dataset.pluginId || !panel.dataset.tenantSlug || !window.crypto?.randomUUID) {
        status.textContent = 'Brak uwierzytelnionego kontekstu platformy, tokenu CSRF lub bezpiecznego generatora UUID. Nie wysłano żądania.';
        return;
      }
      if (!state.operation) {
        const text = prompt.value.trim();
        if (!text || Array.from(text).length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) {
          status.textContent = 'Wpisz 1–1000 znaków zwykłego, neutralnego tekstu bez znaków sterujących.';
          return;
        }
        state.operation = {key: window.crypto.randomUUID(), body: JSON.stringify({user_prompt: text})};
      }
      const operation = state.operation;
      state.busy = true;
      state.message = `Oczekiwanie na potwierdzenie wykonania. Klucz: ${operation.key}`;
      sync();
      try {
        const url = `/api/plugins/${encodeURIComponent(panel.dataset.pluginId)}/ai/completion?tenant_slug=${encodeURIComponent(panel.dataset.tenantSlug)}`;
        const response = await fetch(url, {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: {'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Idempotency-Key': operation.key},
          body: operation.body
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const messages = {
            401: 'Wymagane jest logowanie; wróć do uwierzytelnionej strony platformy.',
            402: 'Brak wystarczających kredytów AI w tej klinice. Skontaktuj się z administratorem kliniki.',
            403: 'Brak dostępu. Sprawdź aktywne członkostwo, zatwierdzenie wtyczki i przyznane uprawnienie AI.',
            404: 'Funkcja AI wtyczki lub jej adres jest niedostępny.',
            409: 'Konflikt: oryginalny klucz może być już powiązany z inną instrukcją lub wykonaniem. Nie zastępuj klucza, aby ominąć konflikt.',
            413: 'Treść żądania jest zbyt duża.',
            415: 'Nieobsługiwany format żądania. Wymagany jest JSON.',
            422: 'Platforma odrzuciła instrukcję lub format żądania.',
            428: 'Platforma wymaga prawidłowego klucza wykonania i zabezpieczeń żądania.',
            429: 'Osiągnięto limit żądań platformy. Brak automatycznego ponowienia.',
            503: 'Nie udało się potwierdzić wykonania AI. Zachowaj oryginalny klucz i poproś administratora o sprawdzenie diagnostyki; nie uruchamiaj nowego wykonania.'
          };
          // Trust only stable safe codes, never arbitrary server exception/message text.
          const deniedMessages = {
            ai_unavailable: 'Wykonanie AI jest niedostępne. Zachowaj oryginalny klucz i poproś administratora o sprawdzenie diagnostyki; nie uruchamiaj nowego wykonania.',
            plugin_state_unavailable: 'Stan wtyczki jest niedostępny. Zachowaj oryginalny klucz i poproś administratora o sprawdzenie stanu wtyczek.',
            ai_policy_denied: 'AI jest niedostępne. Wymagana jest globalna aktywacja na platformie oraz jawne włączenie przez administratora tej kliniki. Administrator powinien też sprawdzić konfigurację i licencję AI.',
            actor_denied: 'Brak dostępu. Sprawdź aktywne członkostwo i uprawnienia w tej klinice.',
            capability_denied: 'Wtyczka nie ma przyznanego uprawnienia AI. Skontaktuj się z administratorem platformy.',
            csrf_required: 'Brak tokenu CSRF. Odśwież stronę i sprawdź sesję; zachowaj oryginalny klucz wykonania.',
            csrf_denied: 'Odrzucono zabezpieczenie żądania. Sprawdź sesję i korzystaj ze strony platformy; zachowaj oryginalny klucz wykonania.'
          };
          const deniedMessage = (response.status === 403 || response.status === 503) && Object.prototype.hasOwnProperty.call(deniedMessages, payload?.detail?.code)
            ? deniedMessages[payload.detail.code] : null;
          // Even rejection of a replay does not settle an earlier uncertain write.
          uncertain(deniedMessage || messages[response.status] || `Odpowiedź platformy HTTP ${response.status}; wykonanie nie zostało potwierdzone.`);
          return;
        }
        const result = payload?.result;
        if (!validResult(result)) {
          uncertain('Nieprawidłowy lub nieczytelny wynik; wykonanie nie zostało potwierdzone.');
          return;
        }
        const statusLabels = {pending: 'oczekujące', succeeded: 'zakończone pomyślnie', completed: 'zakończone', failed: 'nieudane'};
        const statusLabel = Object.prototype.hasOwnProperty.call(statusLabels, result.status) ? statusLabels[result.status] : 'nieznany stan';
        state.message = `Wykonanie ${result.execution_id}: ${statusLabel}; koszt w kredytach: ${result.credit_cost}; naliczono: ${result.charged ? 'tak' : 'nie'}; ponownie sprawdzono: ${result.replayed ? 'tak' : 'nie'}.`;
        // Never render output as HTML, and never recover text for pending/failed replays.
        state.text = result.status !== 'pending' && result.status !== 'failed' ? (result.text || '') : '';
        state.settled = result.status === 'succeeded' || result.status === 'completed' || result.status === 'failed';
        if (state.settled) {
          if (!state.text) state.message += ' Brak tekstu wyniku do odzyskania; instrukcja i wynik nie są zapisywane do ponownego odczytu.';
          notify(result.status === 'failed' ? 'warning' : 'success', 'Potwierdzono stan wykonania.');
        } else {
          state.message += ' Zachowaj ten klucz. Sprawdzaj wyłącznie przez jawne ponowienie tego samego żądania; brak automatycznych ponowień.';
          notify('info', 'Wykonanie nie ma jeszcze stanu końcowego. Zachowano oryginalny klucz.');
        }
      } catch (_) {
        uncertain('Połączenie nie powiodło się; wykonanie mogło się zakończyć i zużyć kredyty.');
      } finally {
        state.busy = false;
        sync();
      }
    }
    generate.addEventListener('click', () => send(false));
    replay.addEventListener('click', () => send(true));
    fresh.addEventListener('click', () => {
      if (state.busy || !state.settled) return;
      state.operation = null;
      state.settled = false;
      state.text = '';
      state.message = 'Gotowe do odrębnego wykonania. Ponowne generowanie może zużyć dodatkowe kredyty.';
      sync();
      if (!view.fixed) prompt.focus();
    });
    sync();
  }
})();
