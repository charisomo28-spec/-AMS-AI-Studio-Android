// AMS native image-to-image control panel. It never simulates model inference.
(() => {
  "use strict";
  const tag = document.createElement("style");
  tag.textContent = `
    #ams-ai-open { border:1px solid #47659a; color:white; background:#24385e; border-radius:12px;
      padding:8px 13px; font:600 13px system-ui; margin:8px; cursor:pointer; }
    #ams-ai-panel { position:fixed; inset:0; z-index:4000; display:none; color:#e7efff;
      background:#080f1cfa; font:14px system-ui; overflow:auto; padding:12px;
      padding-top:calc(15px + env(safe-area-inset-top,0px));
      padding-bottom:calc(18px + env(safe-area-inset-bottom,0px)); box-sizing:border-box; }
    #ams-ai-panel.ams-ai-visible { display:block; }
    #ams-ai-panel * { box-sizing:border-box; }
    #ams-ai-panel .ams-ai-card { max-width:640px; margin:auto; padding:15px; background:#152139;
      border:1px solid #2b3d5e; border-radius:18px; display:grid; gap:12px; }
    #ams-ai-panel .ams-ai-title { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    #ams-ai-panel h2 { margin:0; font-size:20px; }
    #ams-ai-panel .ams-ai-muted { font-size:12px; color:#bac6d9; }
    #ams-ai-panel button { padding:11px 12px; border-radius:10px; border:1px solid #5570a0;
      background:#27416f; color:white; font:600 14px system-ui; }
    #ams-ai-panel button[disabled] { opacity:.45; }
    #ams-ai-panel button.ams-ai-close { background:transparent; font-size:20px; padding:4px 12px; }
    #ams-ai-panel textarea { width:100%; resize:vertical; min-height:75px; border:1px solid #465b7d;
      background:#081426; color:#fff; border-radius:10px; padding:10px; font:14px system-ui; }
    #ams-ai-panel input[type=range] { width:100%; accent-color:#7eacff; }
    #ams-ai-panel .ams-ai-row { display:flex; gap:9px; align-items:center; flex-wrap:wrap; }
    #ams-ai-panel .ams-ai-image { width:100%; display:block; max-height:35dvh; object-fit:contain;
      background:#0c1422; border-radius:10px; }
    #ams-ai-panel .ams-ai-error { color:#ff9b9b; overflow-wrap:anywhere; }
    #ams-ai-panel .ams-ai-status { white-space:pre-wrap; overflow-wrap:anywhere; color:#c6dafd; }
  `;
  document.head.appendChild(tag);
  const open = document.createElement("button");
  open.type="button"; open.id="ams-ai-open"; open.textContent="LOCAL AI EDIT";
  open.style.display="none";
  const panel = document.createElement("section");
  panel.id="ams-ai-panel";
  panel.setAttribute("role","dialog");
  panel.setAttribute("aria-modal","true");
  panel.setAttribute("aria-label","AMS local image editor");
  panel.innerHTML = `
    <div class="ams-ai-card">
      <div class="ams-ai-title"><h2>AMS — Local AI Edit</h2><button type="button" class="ams-ai-close" id="ams-ai-close" aria-label="Close">×</button></div>
      <div class="ams-ai-muted">Offline Stable Diffusion img2img. CPU first; FLUX is not connected. No external server.</div>
      <div id="ams-ai-state" class="ams-ai-status" aria-live="polite">Checking the native engine…</div>
      <div class="ams-ai-row"><button id="ams-ai-model" type="button">Import SD1.5 model</button><span id="ams-ai-model-name" class="ams-ai-muted"></span></div>
      <div class="ams-ai-row"><button id="ams-ai-photo" type="button">Choose photo</button><span id="ams-ai-photo-name" class="ams-ai-muted"></span></div>
      <img id="ams-ai-before" class="ams-ai-image" alt="Photo to edit" hidden />
      <label for="ams-ai-prompt">Editing instructions</label>
      <textarea id="ams-ai-prompt">Natural professional portrait retouch. Preserve the person's identity, natural skin texture, hair, clothing and pose. Balanced highlights, realistic colors and gentle contrast.</textarea>
      <label for="ams-ai-strength">AI edit strength <span id="ams-ai-strength-value">0.30</span></label>
      <input id="ams-ai-strength" type="range" min="0.1" max="0.75" step="0.05" value="0.30"/>
      <div class="ams-ai-row"><button id="ams-ai-run" type="button">Run local AI edit</button><button id="ams-ai-cancel" type="button" disabled>Cancel</button></div>
      <div id="ams-ai-progress" class="ams-ai-status" role="status"></div>
      <div id="ams-ai-error" class="ams-ai-error" role="alert"></div>
      <img id="ams-ai-after" class="ams-ai-image" alt="Edited image" hidden />
      <button id="ams-ai-export" type="button" hidden>Save edited PNG to Photos / AMS</button>
      <div class="ams-ai-muted">A model must be imported once using the Android file picker. Import may require several GB of free storage. Original photographs are never overwritten.</div>
    </div>`;
  document.body.append(open,panel);
  const $ = id=>document.getElementById(id);
  const runtime = () => window.Capacitor?.Plugins?.AmsImageEngine;
  const viewUri = uri => window.Capacitor?.convertFileSrc ? window.Capacitor.convertFileSrc(uri) : uri;
  let inputUri = null, outputUri = null, busy = false;
  const msg=(id,s)=> { $(id).textContent=s; };
  const error = e => msg("ams-ai-error",String(e?.message || e));
  async function refresh() {
    const api=runtime();
    if(!api){msg("ams-ai-state","Native AI module unavailable in this build");return;}
    try {
      const s=await api.status();
      const engineState = s.state === "INFERENCE_VERIFIED" ? "Inference verified on this device" :
        s.state === "PROCESSING" ? "Processing locally" :
        s.state === "CONFIGURED_UNVERIFIED" ? "Model imported; no successful inference yet" :
        s.state === "MODEL_MISSING" ? "Import an SD 1.5 model to start" :
        "Native inference binary unavailable";
      msg("ams-ai-state",engineState);
      msg("ams-ai-model-name",s.modelName || "");
      $("ams-ai-run").disabled=busy || !inputUri || !s.modelSelected || !s.binaryInstalled;
    } catch(e) { error(e); }
  }
  open.addEventListener("click",()=> {panel.classList.add("ams-ai-visible");refresh();});
  $("ams-ai-close").addEventListener("click",()=> panel.classList.remove("ams-ai-visible"));
  $("ams-ai-strength").addEventListener("input",e=>msg("ams-ai-strength-value",Number(e.target.value).toFixed(2)));
  $("ams-ai-model").addEventListener("click",async()=>{
    try {if(!runtime())throw Error("Native module unavailable");
      msg("ams-ai-progress","Importing model into app storage…");
      const r=await runtime().pickModel();
      msg("ams-ai-progress","Model imported. First inference test still required.");
      msg("ams-ai-model-name",r.modelName); await refresh();
    }catch(e){error(e);}
  });
  $("ams-ai-photo").addEventListener("click",async()=>{
    try {if(!runtime())throw Error("Native module unavailable");
      const r=await runtime().pickImage(); inputUri=r.uri;
      $("ams-ai-before").src=viewUri(inputUri);$("ams-ai-before").hidden=false;
      msg("ams-ai-photo-name",r.width+" × "+r.height);
      outputUri=null; $("ams-ai-after").hidden=true; $("ams-ai-export").hidden=true;
      await refresh();
    }catch(e){error(e);}
  });
  $("ams-ai-run").addEventListener("click",async()=>{
    if (busy) return;
    try {
      if(!runtime())throw Error("Native module unavailable");
      busy=true; $("ams-ai-run").disabled=true; $("ams-ai-cancel").disabled=false;
      msg("ams-ai-error",""); msg("ams-ai-progress","Starting real on-device inference…");
      const r=await runtime().generate({
        imageUri:inputUri,
        prompt:$("ams-ai-prompt").value,
        strength:Number($("ams-ai-strength").value),
        steps:12
      });
      outputUri=r.uri;
      $("ams-ai-after").src=viewUri(outputUri);$("ams-ai-after").hidden=false;
      $("ams-ai-export").hidden=false;
      msg("ams-ai-progress","Image-to-image inference completed. Edited PNG ready.");
    }catch(e){error(e);msg("ams-ai-progress","Inference did not complete.");}
    finally {busy=false;$("ams-ai-cancel").disabled=true;await refresh();}
  });
  $("ams-ai-cancel").addEventListener("click",async()=>{
    try {await runtime()?.cancel(); msg("ams-ai-progress","Cancellation requested");}
    catch(e){error(e);}
  });
  $("ams-ai-export").addEventListener("click",async()=>{
    if(!outputUri)return;
    try {await runtime().export({imageUri:outputUri});msg("ams-ai-progress","Saved to Photos / AMS");}
    catch(e){error(e);}
  });
  async function connect() {
    try {
      const api=runtime(); if(!api)return;
      await api.addListener("status",s=>{
        if(s?.message) msg("ams-ai-progress",s.message);
      });
    } catch(e) {error(e);}
  }
  function position() {
    const button=[...document.querySelectorAll("button")].find(b=>
      b!==open && b.getClientRects().length && /hold to see before/i.test(b.textContent||""));
    if(!button) { if(open.style.display!=="none") open.style.display="none"; return; }
    const slot=button.parentElement;
    if(!slot)return;
    if(open.parentElement!==slot)slot.appendChild(open);
    if(open.style.display!=="inline-flex") open.style.display="inline-flex";
  }
  // DOM changes only drive button placement; they do not trigger any AI inference.
  let queued=false;
  new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;position();});}})
    .observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["class","style"]});
  position(); connect();
})();
