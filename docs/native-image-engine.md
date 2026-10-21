# AMS Android — Native image engine integration contract

## Selected runtime
Upstream: https://github.com/xororz/local-dream
Runtime: Snapdragon 8 Elite / Android 16, offline after installation.
Start with SD 1.5 image-to-image; only enable SDXL after measuring performance.
Do not label FLUX connected: Local Dream does not establish FLUX compatibility.

## Architecture and acceptance criteria
1. Use one native engine adapter with an explicit lifecycle:
   UNAVAILABLE -> INSTALLING -> MODEL_MISSING -> LOADING -> READY -> PROCESSING -> READY/ERROR.
2. A `READY` status must require successfully loading the selected model on the device,
   not merely detecting a JS bridge, installation or ZIP.
3. Native module owns inference, model storage, cancellation, errors and bounded job queue.
   The Capacitor web UI calls the native adapter; it must not simulate results.
4. Input is a URI for a user-chosen image with retained permission plus edit prompt,
   strength and unique job ID. Work on a copy; never overwrite the original.
5. Output is a new accessible image URI and metadata: model ID, inference duration, dimensions.
   The Editor and Chat display the output and permit Before/After.
6. Progress conveys the completed pipeline stage; no invented percentages or ETAs.
7. Initial tests: permissions; model unavailable; model load failure; job cancellation;
   image-to-image inference; image URI load; exporting; restart and persisted job result;
   airplane mode; rotation and app background; thermal or out-of-memory failure.
8. Validate licensing before bundling upstream code or weights. Track and preserve licenses,
   notices and commercial/noncommercial restrictions independently.

## Build integration
Current AMS workflow extracts `AMS_AI_Studio_Android_v0.1.0.zip` and builds a
Capacitor Android project. Native engine source must be copied/registered AFTER
Capacitor's `android` project has been generated and BEFORE `assembleDebug`.
The current package is not evidence that native inference binaries are present.
Never publish an APK as engine-enabled until its .so/.aar artifacts, model loading and
on-device img2img output are verified.

## Next engineering dependency
Map the current Local Dream JNI/backend boundaries, Native Android build requirements
(QNN SDK licensing, NDK, Rust, CMake), and select an embeddable adapter.
Do not guess a localhost API endpoint or put an untested bridge in production.
