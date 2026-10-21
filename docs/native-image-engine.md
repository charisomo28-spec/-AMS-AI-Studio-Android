# AMS Native Offline Image Engine — Implementation

## Current implementation
- Native inference implementation: MIT-licensed https://github.com/leejet/stable-diffusion.cpp
- Pinned upstream source revision: `0518b34374761cb82aeda5ad3c2f0686fdad2cec`
- Native Android target: arm64-v8a (Android 16 / Snapdragon 8 Elite); CPU-only initial fallback.
- Native Java plugin: `native/AmsImageEnginePlugin.java`, registered in Capacitor MainActivity.
- UI: `patches/ams-image-engine.js` injected from the Android GitHub Actions workflow.
- Build and distribution: `native/install-engine.sh`, bundled as `lib/arm64-v8a/libams_sd_cli.so`.
- No bundled weights. The user chooses an appropriately licensed SD 1.5 model and imports via Android document picker.
- License: sd.cpp is MIT. Preserve its notices. Model licenses must be checked separately.
- **Do not embed code from xororz/local-dream**: its CC BY-NC 4.0 license excludes unlicensed commercial use.
- FLUX is NOT connected. This SD.cpp build is CPU-only and its current model picker is for SD 1.5.

## How to run once the APK builds
1. Open **Editor**, load a photo in AMS.
2. Tap **LOCAL AI EDIT**; import an SD 1.5 weights file from Android storage (e.g. `.safetensors`).
3. Tap **Choose photo** to grant scoped access through Android's system file picker.
4. Enter your image-edit prompt; start at strength 0.30 and select **Run local AI edit**.
5. Watch real stage messages. The app must return a new output PNG, not the input photo.
6. Use **Save edited PNG to Photos / AMS**. The original image is not overwritten.

The model picker copies the selected weights file to the app's private storage. Large models require available storage and time; do not imply an immediate download or preload.

## Status truth table
- BINARY_MISSING: native executable was not packed/extracted.
- MODEL_MISSING: no model has been imported.
- CONFIGURED_UNVERIFIED: binary and model exist, inference has **not** succeeded.
- PROCESSING: a real child process has started.
- INFERENCE_VERIFIED: a completed job produced a nonempty PNG **in the current app process**.
- ERROR: the actual runtime failed; report its error, never fake an output.

## Current limits and acceptance tests
- Build-time JS source syntax checks and APK contents checks are added to CI.
- Real arm64 C++ compile and Android Gradle compile must pass GitHub Actions.
- On-device verification must test successful model loading, img2img result validity, cancellation,
  gallery export, offline operation and acceptable performance/thermal usage.
- No CPU performance claim is made before measuring on the Xiaomi 15 Ultra.
- Fine control of skin, realistic retouch and identity preservation cannot be guaranteed by SD1.5;
  assess actual output against the original and reject unsuitable edits.
- This is a native editor workflow, not yet an autonomous chat-to-engine tool bridge.
- NPU/OpenCL/Vulkan acceleration is *not* present in this initial build. It must be built and
  tested separately; do not equate Snapdragon compatibility with NPU support.
- This implementation has **not** been tested on device yet.
