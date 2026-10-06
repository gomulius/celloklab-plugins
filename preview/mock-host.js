/* PREVIEW ONLY. Not the native toast engine, API, or authentication. */
window.bootstrap = {Toast: function PreviewOnlyToast() {}};
window.showToast = options => {
    const element = document.createElement('p');
    element.className = 'clk-ui-alert clk-ui-alert--' + options.type;
    element.textContent = '[Preview mock] ' + options.message;
    element.setAttribute('role', 'status');
    document.getElementById('preview-notifications').appendChild(element);
    setTimeout(() => element.remove(), options.delay || 4000);
    return element;
};
