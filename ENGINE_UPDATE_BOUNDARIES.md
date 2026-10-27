# AMS G0–G3 Engine Registry and Native Update Boundary

## Bundled catalog
- native/ams-model-catalog.json is the single allowlisted manifest packaged into the APK.
- sd15-emaonly: source Comfy-Org SD1.5 archive, SHA-256 from original model's Git LFS object, candidate only. Requires native SD.cpp and at least 5.5GB free space. Downloaded/verified does NOT mean inference works.
- SmolLM2-135M-Instruct GGUF: catalog reference only; llama.cpp Android runtime not installed, no pinned weight hash. NOT installable.
- Vision and FLUX: blocked pending verified device profile, runtime and weight hashes.

## Components that cannot be delivered by a model-only update
1. New Android native libraries (.so), Java/Kotlin plugins and their registration: requires signed APK upgrade.
2. Android permissions and foreground service declarations: requires APK upgrade.
3. New Android ABI/NDK builds: requires APK upgrade.
4. Capacitor or web app bundle code changes: use signed APK upgrade under current architecture.
5. Device GPU drivers: provided by Android OEM/system, not installed by this app.
6. llama.cpp Android JNI/native runtime: requires APK upgrade before GGUF chat models can run.
7. Voice, vision and image runtime adapters: requires APK upgrade unless the relevant executor already ships in APK.

## Existing sources and code to reuse
- Capacitor Android: https://github.com/ionic-team/capacitor
- llama.cpp Android example: https://github.com/ggml-org/llama.cpp/tree/master/examples/llama.android
- stable-diffusion.cpp: https://github.com/leejet/stable-diffusion.cpp (already built into AMS)
- Android WorkManager: https://developer.android.com/topic/libraries/architecture/workmanager
- ONNX Runtime Android: https://onnxruntime.ai/docs/get-started/with-java.html
- OpenCV Android: https://docs.opencv.org/4.x/d5/df8/tutorial_dev_with_OCV_on_Android.html

## Known limitations and next verification
- HTTPS downloader runs inside a Capacitor plugin worker, NOT WorkManager. Android process termination interrupts download; resume is NOT implemented.
- Native inference smoke test on real phone is NOT RUN.
- SHA-256 source is the LFS hash of original SD1.5 EMA-only checkpoint; archive claims hash-identical copy; actual download will be rejected on mismatch.
- Download size is ~4.27GB; user must explicitly confirm before starting.
- Current installer only handles one pinned image checkpoint, not chat, vision, FLUX or drivers.
- Production needs WorkManager/foreground service, cancellation/resume, verified native inference, model rollback, UI storage warnings and licensing review.
- Do not mark G1 complete based only on compilation.
