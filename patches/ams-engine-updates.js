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
    const installButton = document.createElement('button');
    installButton.type = 'button';
    installButton.textContent = 'Download & install compatible image model (~4.3 GB)';
    installButton.disabled = true;
    installButton.style.marginTop = '10px';
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
        const eligible = models.find(m => m.id === 'sd15-emaonly' && m.eligible && Number(scan.freeBytes) >= 5500000000);
        installButton.disabled = !eligible;
        output.textContent = 'Android API: ' + scan.androidApi +
          '\nCPU: ' + (scan.abis || []).join(', ') +
          '\nFree storage: ' + (Number(scan.freeBytes)/1073741824).toFixed(1) + ' GiB' +
          '\nCatalog entries: ' + models.length + '\nInstallable on this device: ' + models.filter(m => m.eligible).length +
          '\nInstaller: ' + (scan.modelInstallerReady ? 'AVAILABLE' : 'NOT READY') +
          '\n' + (catalog.reason || scan.reason || '');
      } catch (err) {
        installButton.disabled = true;
        output.textContent = 'FAILED: ' + (err?.message || String(err));
      } finally { button.disabled = false; }
    });
    installButton.addEventListener('click', async () => {
      const api = window.Capacitor?.Plugins?.AmsEngineManager;
      if (!api?.install) { output.textContent = 'Native installer unavailable'; return; }
      if (!window.confirm('Download approximately 4.3 GB over your connection? This model has not yet passed an on-device inference test.')) return;
      installButton.disabled = true;
      button.disabled = true;
      output.textContent = 'Starting verified model download…';
      try {
        const listener = await api.addListener('updateProgress', ev => {
          const pct = ev.totalBytes ? Math.floor(ev.bytes * 100 / ev.totalBytes) : 0;
          output.textContent = ev.stage + ' ' + pct + '%\\n' + (ev.message || '');
        });
        try {
          const result = await api.install({id:'sd15-emaonly'});
          output.textContent = 'Downloaded and SHA-256 verified. Inference still requires testing.\\n' + result.state;
        } finally { await listener.remove(); }
      } catch (err) { output.textContent = 'FAILED: ' + (err?.message || String(err)); }
      finally { button.disabled = false; installButton.disabled = true; }
    });
    card.append(heading, button, installButton, output);
    const first = more.querySelector('.panel');
    if (first?.parentNode) first.parentNode.insertBefore(card, first.nextSibling);
    else more.append(card);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
