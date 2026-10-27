// G3: route edit requests to the actual native image engine; never fake inference.
(() => {
  'use strict';
  const send = document.getElementById('sendBtn');
  const input = document.getElementById('prompt');
  if (!send || !input) return;
  const original = send.onclick;
  const append = (message) => {
    const log = document.getElementById('chatlog');
    if (!log) return;
    const el = document.createElement('div');
    el.className = 'bubble ai';
    el.textContent = message;
    log.append(el);
    el.scrollIntoView({block:'end'});
  };
  send.onclick = async () => {
    const text = input.value.trim();
    const isEdit = /edit|retouch|photo|portrait|φωτο|επεξεργ|ρετούς|διόρθω/i.test(text);
    if (!isEdit) { if (typeof original === 'function') original(); return; }
    const api = window.Capacitor?.Plugins?.AmsImageEngine;
    if (!api?.status) { if (typeof original === 'function') original(); return; }
    let state;
    try { state = await api.status(); }
    catch (e) { append('Native AI status failed: ' + String(e?.message || e)); return; }
    if (!state.binaryInstalled || !state.modelSelected) {
      if (typeof original === 'function') original();
      append('Real AI edit is unavailable: ' + (!state.binaryInstalled ? 'native engine missing.' : 'SD 1.5 model not imported. Open More → System → Set up local AI image editing.'));
      return;
    }
    // Native picker, generation and output preview are implemented in the existing engine panel.
    // Do not claim conversational understanding: this is a prompt handoff only.
    if (typeof original === 'function') original();
    const launcher = document.getElementById('ams-ai-open');
    if (!launcher) { append('Native AI editor panel unavailable.'); return; }
    launcher.click();
    const nativePrompt = document.getElementById('ams-ai-prompt');
    if (nativePrompt && text) nativePrompt.value = text;
    append('Native AI editor opened with your instructions. Choose a photo and run the local model. This is not yet autonomous AI chat.');
  };
})();
