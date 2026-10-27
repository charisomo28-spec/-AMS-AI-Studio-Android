# AMS G0 → G3 rebuild — verified baseline

Status: G0 STARTED, not APK built. This is a separate branch; main is unchanged.

## Purpose
Rebuild the existing black/gold/white AMS G3 Android app with a testable, autonomous on-device engine manager. Do not treat standalone downloader source, an APK build, or a UI status indicator as evidence of real AI inference.

## Verified inputs (2026-10-27)
- User-supplied app-debug.apk exists in the active conversation, ~21 MB.
- Extracted web assets from that APK: assets/public/index.html, app.js, style.css, ams-mobile-chat.js, ams-image-engine.js, ams-g3-chat-bridge.js, ams-ai-system-status.js.
- Existing repository package.json declares Capacitor 7.4; capacitor.config.json declares appId com.amsphotography.aistudio, webDir www.
- Existing independent Engine Manager v7 is source-only: native install disabled, catalog empty, no Android inference proven.
- No validated complete Android source tree for the APK has been established in this repository.

## G0: source-of-truth and reproducible baseline (IN PROGRESS)
1. Preserve existing APK, SHA-256 and extracted assets; preserve original UI.
2. Reconstruct an Android/Capacitor project from audited assets, without pretending recovered source is original.
3. Set up CI to build an installable debug APK; verify install and launch on Android.
Gate: real APK artifact, build logs, manifest/package checks, launch evidence.

## G1: working local execution foundation (PENDING)
Device compatibility checks, storage permissions, persistent engine registry, verified catalog, HTTPS-only downloads, checksum, pause/resume/cancel, safe failure/recovery.
Gate: test model download, persistence after restart, rejection of bad hashes, actual device logs.

## G2: real intelligence and photo editing (PENDING)
Real local chat model inference, photo analysis, and identity-preserving photo editing with original/edited comparison; no fake success state.
Gate: captured real text inference and real edited output, tested on device.

## G3: integrated autonomous updates and delivery (PENDING)
Single Update button in existing UI, install only supported signed/verified model packages, capability detection and truthful status, regression tests, reproducible signed APK workflow.
Gate: install APK, tap Update, install model, run chat/photo end-to-end, verify exported image.

## Non-negotiable
Do not overwrite main or claim PASS without executed tests. No unverified large model downloads. Existing design remains unchanged unless approved. Native engine upgrades require a new APK; compatible model weights can be installed inside an existing capable APK.
