// AMS Android: keep the chat composer above bottom navigation and keyboard.
(() => {
  const style = document.createElement('style');
  style.textContent = `
    .ams-mobile-composer {
      position: fixed !important;
      left: 16px !important;
      right: 16px !important;
      bottom: calc(84px + env(safe-area-inset-bottom, 0px)) !important;
      width: auto !important;
      max-width: none !important;
      z-index: 1000 !important;
    }
    body.ams-mobile-chat { padding-bottom: 185px !important; }
    @media (max-height: 500px) {
      .ams-mobile-composer { bottom: calc(8px + env(safe-area-inset-bottom, 0px)) !important; }
    }
  `;
  style.textContent += `
    html { padding-top: env(safe-area-inset-top, 0px); }
    body { padding-top: 0 !important; }
    .ams-mobile-chat .ams-mobile-composer { box-sizing: border-box; }
    .ams-mobile-modes {
      position: fixed !important;
      left: 16px !important;
      right: 16px !important;
      bottom: calc(170px + env(safe-area-inset-bottom, 0px)) !important;
      z-index: 999 !important;
      width: auto !important;
    }
  `;
  document.head.appendChild(style);
  function positionComposer() {
    const inputs = [...document.querySelectorAll('input, textarea')];
    const input = inputs.find(el => /describe your edit or ask ams/i.test(el.getAttribute('placeholder') || ''));
    if (!input) return;
    // The composer contains the text field and the send control, not the whole chat.
    let composer = input.parentElement;
    for (let i = 0; i < 4 && composer?.parentElement; i++) {
      const buttons = composer.querySelectorAll('button');
      if (buttons.length >= 2) break;
      composer = composer.parentElement;
    }
    if (!composer || composer === document.body) return;
    document.querySelectorAll('.ams-mobile-composer').forEach(el => {
      if (el !== composer) el.classList.remove('ams-mobile-composer');
    });
    composer.classList.add('ams-mobile-composer');
    document.body.classList.add('ams-mobile-chat');
    const modeButton = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === 'AUTO');
    const modeRow = modeButton?.parentElement;
    if (modeRow && ['BRIGHT','CLEAN','INTENSE'].every(label =>
      [...modeRow.querySelectorAll('button')].some(el => el.textContent.trim() === label))) {
      modeRow.classList.add('ams-mobile-modes');
    }
  }
  new MutationObserver(positionComposer).observe(document.body, {childList:true,subtree:true});
  positionComposer();
})();
