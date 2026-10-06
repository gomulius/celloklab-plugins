/** Celloklab Plugin UI v1.0.0 — adapter to the host's one native toast renderer. */
(function (host) {
    'use strict';
    if (host.CelloklabPluginUI !== undefined) {
        if (host.CelloklabPluginUI.version === '1.0.0') return;
        throw new Error('CelloklabPluginUI: incompatible existing SDK');
    }

    // Capture the common renderer before page scripts: do not replace page callbacks,
    // or accidentally delegate to a later page-local showToast implementation.
    const nativeNotify = host.showToast;
    const types = ['success', 'info', 'warning', 'error'];
    const guards = new Map();
    const initialized = new WeakSet();
    let floating = null;
    let modal = null;
    if (typeof host.addEventListener === 'function') host.addEventListener('beforeunload', e => {
        if (Array.from(document.querySelectorAll('[data-plugin-surface]')).some(el => el.dataset.dirty === 'true')) {
            e.preventDefault(); e.returnValue = '';
        }
    });
    function surface(id, kind) {
        const el = document.getElementById('plugin-surface-' + id);
        if (!el || el.dataset.pluginSurface !== id || (kind && el.dataset.surfaceKind !== kind)) {
            throw new Error('CelloklabPluginUI: unknown surface');
        }
        if (!initialized.has(el)) {
            initialized.add(el);
            el.addEventListener('input', () => { el.dataset.dirty = 'true'; });
            el.addEventListener('change', () => { el.dataset.dirty = 'true'; });
            el.addEventListener('cancel', e => { e.preventDefault(); close(id); });
            el.addEventListener('keydown', e => {
                if (e.key === 'Escape') { e.preventDefault(); close(id); }
                if (e.key !== 'Tab' || el.dataset.surfaceKind !== 'modal') return;
                const items = Array.from(el.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')).filter(x => !x.disabled && x.tabIndex >= 0 && x.getClientRects().length);
                if (!items.length) { e.preventDefault(); el.focus(); return; }
                const first = items[0], last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            });
        }
        return el;
    }
    function setLoading(id, loading, label) {
        if (typeof loading !== 'boolean') throw new TypeError('CelloklabPluginUI.setLoading: loading must be boolean');
        if (label !== undefined && (typeof label !== 'string' || !label.trim() || Array.from(label).length > 200)) {
            throw new TypeError('CelloklabPluginUI.setLoading: label must contain 1–200 Unicode code points');
        }
        const el = surface(id);
        const status = el.querySelector(':scope > [data-plugin-surface-loading]');
        const text = status && status.querySelector('[data-plugin-loading-label]');
        if (!status || !text) throw new Error('CelloklabPluginUI.setLoading: loading status unavailable');
        // Callers own the async operation and must clear loading in finally.
        // Static content is ready immediately: opening a surface never starts loading.
        text.textContent = loading ? (label === undefined ? 'Ładowanie…' : label) : '';
        status.hidden = !loading;
        el.setAttribute('aria-busy', String(loading));
    }
    async function close(id, minimize) {
        const el = surface(id);
        if (el.dataset.closing === 'true') return false;
        el.dataset.closing = 'true';
        try {
            if (!minimize && el.dataset.dirty === 'true') {
                const guard = guards.get(id);
                // No guard means fail closed: never silently discard a form.
                if (!guard || await guard({id, action: 'close', element: el}) !== true) return false;
            }
            el.close();
            if (modal === id) modal = null;
            if (floating === id && !minimize) floating = null;
            el.dataset.minimized = minimize ? 'true' : 'false';
            document.querySelectorAll('[data-plugin-action="open"]').forEach(button => {
                if (button.dataset.pluginTarget === id) button.hidden = !minimize;
            });
            if (el._pluginOpener && el._pluginOpener.isConnected) el._pluginOpener.focus();
            return true;
        } finally { el.dataset.closing = 'false'; }
    }
    async function open(id, kind) {
        const el = surface(id, kind);
        if (el.open) return true;
        if (modal && modal !== id && !await close(modal)) return false;
        if (kind === 'floating' && floating && floating !== id && !await close(floating)) return false;
        el._pluginOpener = document.activeElement;
        el.dataset.minimized = 'false';
        if (kind === 'modal') { el.showModal(); modal = id; }
        else { el.show(); floating = id; }
        document.querySelectorAll('[data-plugin-action="open"]').forEach(button => {
            if (button.dataset.pluginTarget === id) button.hidden = true;
        });
        const first = el.querySelector('button, input, select, textarea, [tabindex]');
        (first || el).focus();
        return true;
    }
    document.addEventListener('click', async e => {
        const button = e.target.closest && e.target.closest('[data-plugin-action]');
        if (!button) return;
        const id = button.dataset.pluginTarget;
        try {
            const el = surface(id);
            if (button.dataset.pluginAction === 'close') await close(id);
            else if (button.dataset.pluginAction === 'minimize') await close(id, true);
            else if (button.dataset.pluginAction === 'open') await open(id, el.dataset.surfaceKind);
            else if (button.dataset.pluginAction === 'expand') {
                el.classList.toggle('clk-ui-surface--expanded');
                button.setAttribute('aria-pressed', String(el.classList.contains('clk-ui-surface--expanded')));
            }
        } catch (error) { if (host.console) host.console.error(error); }
    });
    host.CelloklabPluginUI = Object.freeze({
        version: '1.0.0',
        openModal: id => open(id, 'modal'),
        closeModal: id => { surface(id, 'modal'); return close(id); },
        openFloating: id => open(id, 'floating'),
        minimizeFloating: id => { surface(id, 'floating'); return close(id, true); },
        closeFloating: id => { surface(id, 'floating'); return close(id); },
        registerCloseGuard: (id, callback) => {
            surface(id);
            if (typeof callback !== 'function') throw new TypeError('close guard must be async-compatible callback');
            guards.set(id, callback);
            return () => guards.delete(id);
        },
        markClean: id => { surface(id).dataset.dirty = 'false'; },
        setLoading,
        notify: function (options) {
            if (!options || typeof options !== 'object' || Array.isArray(options)) {
                throw new TypeError('CelloklabPluginUI.notify: options must be an object');
            }
            if (Object.keys(options).some(key => !['type', 'message', 'duration'].includes(key))) {
                throw new TypeError('CelloklabPluginUI.notify: unsupported option');
            }
            if (!types.includes(options.type)) {
                throw new TypeError('CelloklabPluginUI.notify: invalid type');
            }
            if (typeof options.message !== 'string' || !options.message.trim() ||
                Array.from(options.message).length > 2000) {
                throw new TypeError('CelloklabPluginUI.notify: message must contain 1–2000 Unicode code points');
            }
            if (options.duration !== undefined && (!Number.isInteger(options.duration) ||
                options.duration < 1000 || options.duration > 30000)) {
                throw new TypeError('CelloklabPluginUI.notify: duration must be 1000–30000 milliseconds');
            }
            if (typeof nativeNotify !== 'function' || !host.bootstrap ||
                typeof host.bootstrap.Toast !== 'function') {
                throw new Error('CelloklabPluginUI.notify: native toast engine unavailable');
            }
            const nativeOptions = {type: options.type, message: options.message};
            if (options.duration !== undefined) nativeOptions.delay = options.duration;
            const element = nativeNotify(nativeOptions);
            if (!element || element.nodeType !== 1 || !element.isConnected) {
                throw new Error('CelloklabPluginUI.notify: native toast was not rendered');
            }
            return element;
        }
    });
})(window);
