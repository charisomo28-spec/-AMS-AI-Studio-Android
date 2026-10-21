// AMS mobile editor: persistent image preview while manual controls scroll.
(() => {
  "use strict";
  const CSS = `
    #ams-pinned-preview {
      display: none; position: fixed; z-index: 800;
      top: calc(env(safe-area-inset-top, 0px) + 104px);
      left: 12px; right: 12px; height: min(33dvh, 310px);
      background: #0d1424; border: 1px solid #2a3954;
      border-radius: 16px; overflow: hidden; box-shadow: 0 6px 28px #0008;
      align-items: center; justify-content: center;
    }
    body.ams-editor-pinned #ams-pinned-preview { display: flex; }
    #ams-pinned-preview > img, #ams-pinned-preview > canvas {
      display: block !important; width: 100% !important;
      height: 100% !important; max-width: 100% !important;
      max-height: 100% !important; object-fit: contain !important;
      border-radius: 0 !important;
    }
    #ams-pinned-preview .ams-preview-label {
      position: absolute; left: 10px; bottom: 10px;
      color: #fff; padding: 3px 8px; font: 12px system-ui;
      border-radius: 7px; background: #0009; pointer-events: none;
    }
    body.ams-editor-pinned { padding-top: min(33dvh, 310px) !important; }
    body.ams-editor-pinned .ams-mobile-composer,
    body.ams-editor-pinned .ams-mobile-modes { display: none !important; }
    @media (max-height: 600px) {
      #ams-pinned-preview { top: 68px; height: 28dvh; }
      body.ams-editor-pinned { padding-top: 28dvh !important; }
    }
  `;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  const holder = document.createElement("div");
  holder.id = "ams-pinned-preview";
  holder.setAttribute("aria-label", "Pinned photo preview");
  document.body.appendChild(holder);

  const text = el => (el?.textContent || "").trim().toLowerCase();
  const isVisible = el => !!(el && el.isConnected && el.getClientRects().length);
  const findBefore = () => [...document.querySelectorAll("button")]
    .find(b => isVisible(b) && /hold to see before/i.test(text(b)));
  function editorIsVisible() {
    const before = findBefore();
    if (!before) return false;
    // Never pin content while Chat/Gallery/More is the active screen.
    const nav = [...document.querySelectorAll("nav button, footer button, [role=tab]")];
    const selected = nav.filter(x => x.getAttribute("aria-selected") === "true" ||
      x.getAttribute("aria-current") === "page" || /active|selected/.test(x.className || ""));
    if (selected.length && selected.some(x => /^(chat|gallery|more)$/i.test(text(x)))) return false;
    return true;
  }
  function findSource() {
    const before = findBefore();
    if (!before) return null;
    // Start near the Before control; do not accidentally pin the AMS logo.
    let node = before.parentElement;
    for (let i = 0; node && i < 5; i++, node = node.parentElement) {
      const media = [...node.querySelectorAll("img,canvas")]
        .filter(el => isVisible(el) && el.getBoundingClientRect().width > 110 &&
          el.getBoundingClientRect().height > 100);
      if (media.length) return media.sort((a,b) =>
        b.getBoundingClientRect().width * b.getBoundingClientRect().height -
        a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0];
    }
    return null;
  }
  let source = null, shown = null, previousStamp = "";
  function update() {
    const active = editorIsVisible();
    const found = active ? findSource() : null;
    document.body.classList.toggle("ams-editor-pinned", !!found);
    if (!found) { source = shown = null; previousStamp = ""; holder.replaceChildren(); return; }
    const stamp = found.tagName + "|" + (found.currentSrc || found.src || "") + "|" +
      (found.getAttribute("style") || "") + "|" + (found.getAttribute("class") || "");
    if (found !== source || stamp !== previousStamp || !shown) {
      source = found; previousStamp = stamp;
      const cloned = found.cloneNode(true);
      if (found.tagName === "CANVAS") {
        try { cloned.getContext("2d").drawImage(found, 0, 0); } catch (_) {}
      }
      const computed = getComputedStyle(found);
      cloned.style.filter = computed.filter;
      cloned.style.transform = "none";
      cloned.removeAttribute("id");
      cloned.removeAttribute("onclick");
      cloned.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = "ams-preview-label";
      label.textContent = "LIVE PREVIEW";
      holder.replaceChildren(cloned, label);
      shown = cloned;
    } else if (found.tagName === "CANVAS") {
      try { shown.getContext("2d").drawImage(found, 0, 0); } catch (_) {}
    }
  }
  let pending = false;
  function queue() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; update(); });
  }
  const observer = new MutationObserver(queue);
  observer.observe(document.body, { childList: true, subtree: true,
    attributes: true, attributeFilter: ["style","class","src","aria-selected"] });
  document.addEventListener("input", queue, true);
  document.addEventListener("change", queue, true);
  document.addEventListener("click", queue, true);
  window.addEventListener("resize", queue);
  queue();
})();
