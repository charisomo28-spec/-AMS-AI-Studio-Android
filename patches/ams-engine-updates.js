// AMS G1: real native bridge diagnostics; no simulated model installation.
(() => {
  'use strict';
  function mount() {
    const more = document.getElementById('morePage');
    if (!more || document.getElementById('ams-g1-update')) return;
    const card = document.createElement('section');
    card.id = 'ams-g1-update';
    card.className = 'panel';
    card.style.cssText = 'margin-top:14px;padding:16px;border:1px solid #b89542;border-radius:14px';
    const heading = document.createElement('h3');
    heading.textContent = 'AI Engine Updates';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Check for AI updates';
    const output = document.createElement('pre');
    output.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;margin-top:12px';
    output.setAttribute('aria-live','polite');
    output.textContent = 'Not checked';
    button.addEventListener('click', async () => {
      button.disabled = true;
      output.textContent = 'Checking device and trusted model catalog…';
      try {
        const api = window.Capacitor?.Plugins?.AmsEngineManager;
        if (!api?.scan || !api?.catalog) throw Error('Native Engine Manager bridge missing');
        const scan = await api.scan();
        const catalog = await api.catalog();
        const models = Array.isArray(catalog.models) ? catalog.models : [];
        output.textContent = 'Android API: ' + scan.androidApi +
          '\nCPU: ' + (scan.abis || []).join(', ') +
          '\nFree storage: ' + (Number(scan.freeBytes)/1073741824).toFixed(1) + ' GiB' +
          '\nVerified compatible models: ' + models.length +
          '\nInstaller: ' + (scan.modelInstallerReady ? 'AVAILABLE' : 'NOT READY') +
          '\n' + (catalog.reason || scan.reason || '');
      } catch (err) {
        output.textContent = 'FAILED: ' + (err?.message || String(err));
      } finally { button.disabled = false; }
    });
    card.append(heading, button, output);
    const first = more.querySelector('.panel');
    if (first?.parentNode) first.parentNode.insertBefore(card, first.nextSibling);
    else more.append(card);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
