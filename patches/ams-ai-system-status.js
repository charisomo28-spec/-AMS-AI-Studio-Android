// AMS System diagnostics: report the *real* native SD engine state.
// Separate from FLUX and the still-uninstalled conversational language model.
(() => {
  "use strict";
  const more = document.getElementById("morePage");
  if (!more || document.getElementById("ams-sd-system")) return;
  const rows = more.querySelector(".panel");
  if (!rows) return;
  const row = document.createElement("div");
  row.id = "ams-sd-system";
  row.className = "kv";
  const title = document.createElement("span");
  title.textContent = "Stable Diffusion image engine";
  const value = document.createElement("strong");
  value.id = "ams-sd-status";
  value.setAttribute("aria-live","polite");
  value.textContent = "CHECKING";
  row.append(title, value);
  const externalPC = Array.from(rows.querySelectorAll(".kv")).find(el =>
    /External PC server/i.test(el.textContent || ""));
  rows.insertBefore(row, externalPC || null);
  const configure = document.createElement("button");
  configure.type = "button";
  configure.id = "ams-sd-configure";
  configure.textContent = "Set up local AI image editing";
  configure.style.margin = "10px 0 0";
  rows.append(configure);
  configure.addEventListener("click", () => {
    const launcher = document.getElementById("ams-ai-open");
    if (launcher) launcher.click();
    else value.textContent = "AI image editor UI missing";
  });

  const status = async () => {
    const api = window.Capacitor?.Plugins?.AmsImageEngine;
    if (!api?.status) {
      value.textContent = "NATIVE BRIDGE NOT AVAILABLE";
      value.className = "warn";
      return "Native bridge unavailable";
    }
    try {
      const info = await api.status();
      const states = {
        BINARY_MISSING:"BINARY MISSING",
        MODEL_MISSING:"MODEL NOT IMPORTED",
        CONFIGURED_UNVERIFIED:"MODEL IMPORTED — NOT TESTED",
        PROCESSING:"PROCESSING IMAGE",
        INFERENCE_VERIFIED:"INFERENCE VERIFIED"
      };
      value.textContent = states[info.state] || ("UNKNOWN: " + (info.state || "no status"));
      const ready = info.state === "INFERENCE_VERIFIED";
      value.className = ready ? "good" : "warn";
      return JSON.stringify({
        state:info.state,
        binaryInstalled:!!info.binaryInstalled,
        modelSelected:!!info.modelSelected,
        verifiedInference:!!info.verifiedInference,
        engine:"stable-diffusion.cpp"
      });
    } catch (e) {
      value.textContent = "BRIDGE ERROR";
      value.className = "warn";
      return "Native bridge error: " + (e?.message || String(e));
    }
  };
  const firstMessage=document.querySelector("#chatlog .bubble.ai");
  if (firstMessage && /AI chat and FLUX are not installed yet/i.test(firstMessage.textContent||"")) {
    firstMessage.textContent =
      "AMS supports offline photo management and manual adjustments. " +
      "The chat language model and FLUX are not installed. " +
      "For the separate Stable Diffusion image engine, open More → System → Set up local AI image editing.";
  }

  const checkButton = document.getElementById("diagnosticsBtn");
  if (checkButton) checkButton.addEventListener("click", async () => {
    const report = await status();
    const diagnostics=document.getElementById("diagnostics");
    if (diagnostics) diagnostics.textContent += "\nSD image engine: " + report;
  });
  document.querySelectorAll('nav button[data-page="more"]').forEach(el =>
    el.addEventListener("click", status));
  document.getElementById("settingsBtn")?.addEventListener("click", status);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && more.classList.contains("active")) status();
  });
  status();
})();
