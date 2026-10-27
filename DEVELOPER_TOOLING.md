# AMS Developer Tooling and Source Reuse

| Tool | Purpose | Existing or next |
|---|---|---|
| GitHub Actions | Reproducible APK build and artifact | Existing |
| Android Gradle Plugin / Gradle | Java and native packaging compile checks | Existing |
| Android SDK / NDK / CMake / Ninja | Native stable-diffusion.cpp compilation | Existing |
| Node.js --check | Catch JavaScript syntax errors before APK | Existing |
| Android Studio | Run emulator/device tests, inspect Logcat, Android Profiler | Optional local developer tool |
| Android Lint | Static checks for Android code and manifest | Add CI |
| Robolectric | JVM-based native Android unit tests | Evaluate |
| JUnit | Unit tests for catalog selection and SHA-256 validation | Add |
| JADX | Inspect APK bytecode to confirm plugins packaged | Evaluate |
| apktool / aapt | APK resources and manifest inspection | Evaluate |
| GitHub CodeQL | Automated security checks for Java/JS | Evaluate |
| ripgrep | Search existing source before edits | Developer utility |
| Android WorkManager | Persistent download jobs and retry | Needed before production |
| OkHttp | Resumable HTTPS download, redirects and retries | Evaluate instead of custom network code |

Reuse official upstream implementations and verify compatible license/version before copying. Do not introduce another Android framework, a second editor, or a second APK build pipeline.
