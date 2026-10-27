#!/usr/bin/env bash
set -euo pipefail

# Build the real offline SD.cpp image-to-image executable for arm64 Android.
# No image model is bundled: users import properly licensed weights on-device.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:?ANDROID SDK missing}}"
NDK_VERSION="27.2.12479018"
NDK="$SDK_ROOT/ndk/$NDK_VERSION"
SD_REF="0518b34374761cb82aeda5ad3c2f0686fdad2cec"

test -f "$ROOT/native/AmsImageEnginePlugin.java"
test -f "$ROOT/android/app/build.gradle"
test -f "$NDK/build/cmake/android.toolchain.cmake"
command -v cmake >/dev/null
command -v ninja >/dev/null

SRC="$ROOT/.native-build/stable-diffusion.cpp"
if [ ! -d "$SRC/.git" ]; then
  mkdir -p "$(dirname "$SRC")"
  git clone --recursive --depth 1 --shallow-submodules https://github.com/leejet/stable-diffusion.cpp.git "$SRC"
fi
cd "$SRC"
git fetch --depth 1 origin "$SD_REF"
git checkout --detach "$SD_REF"
git submodule update --init --recursive --depth 1
grep -q 'MIT License' LICENSE

BUILD="$ROOT/.native-build/sd-arm64"
cmake -S "$SRC" -B "$BUILD" -G Ninja \
  -DCMAKE_TOOLCHAIN_FILE="$NDK/build/cmake/android.toolchain.cmake" \
  -DANDROID_ABI=arm64-v8a -DANDROID_PLATFORM=android-28 \
  -DCMAKE_BUILD_TYPE=Release -DGGML_OPENMP=OFF \
  -DSD_WEBP=OFF -DSD_WEBM=OFF -DSD_OPENCL=OFF -DSD_VULKAN=OFF \
  -DSD_BUILD_EXAMPLES=ON -DSD_BUILD_SHARED_LIBS=OFF \
  -DCMAKE_EXE_LINKER_FLAGS="-Wl,-z,max-page-size=16384"
cmake --build "$BUILD" --target sd-cli --parallel 2
test -s "$BUILD/bin/sd-cli"

ABI_DIR="$ROOT/android/app/src/main/jniLibs/arm64-v8a"
mkdir -p "$ABI_DIR"
cp "$BUILD/bin/sd-cli" "$ABI_DIR/libams_sd_cli.so"
"$NDK/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-strip" --strip-unneeded "$ABI_DIR/libams_sd_cli.so"
test -s "$ABI_DIR/libams_sd_cli.so"
file "$ABI_DIR/libams_sd_cli.so" | grep -q 'ARM aarch64'

ASSETS="$ROOT/android/app/src/main/assets"
mkdir -p "$ASSETS"
cp "$SRC/LICENSE" "$ASSETS/ams-sdcpp-MIT-LICENSE.txt"
echo "$SD_REF" > "$ASSETS/ams-sdcpp-commit.txt"

# Capacitor generated MainActivity must register the plugin before the bridge starts.
export AMS_ROOT="$ROOT"
python3 - <<'PY'
from pathlib import Path
import os
root = Path(os.environ["AMS_ROOT"])
candidates = list((root/"android/app/src/main/java").rglob("MainActivity.java"))
if len(candidates) != 1:
    raise SystemExit(f"Expected exactly one generated MainActivity.java; found: {candidates}")
target = candidates[0]
src = target.read_text()
if "extends BridgeActivity" not in src:
    raise SystemExit("Unrecognized Capacitor MainActivity: refusing to overwrite")
if "registerPlugin(AmsImageEnginePlugin.class)" not in src:
    src = src.replace("public class MainActivity extends BridgeActivity {",
    """public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AmsImageEnginePlugin.class);\n        registerPlugin(AmsPhotoSavePlugin.class);
        super.onCreate(savedInstanceState);
    }
""", 1)
target.write_text(src)
plugin_src = root/"native/AmsImageEnginePlugin.java"
(target.parent/"AmsImageEnginePlugin.java").write_bytes(plugin_src.read_bytes())\n(target.parent/"AmsPhotoSavePlugin.java").write_bytes((root/"native/AmsPhotoSavePlugin.java").read_bytes())
gradle = root/"android/app/build.gradle"
content = gradle.read_text()
if "useLegacyPackaging true" not in content:
    content += """
// Ensure executable SD.cpp ELF gets extracted to nativeLibraryDir.
android {
    packaging {
        jniLibs {
            useLegacyPackaging true
        }
    }
}
"""
    gradle.write_text(content)
print("SD.cpp engine registered in:", target)
PY
