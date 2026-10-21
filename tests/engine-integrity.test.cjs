// Run with: node tests/engine-integrity.test.cjs
// Static regression checks: a native AI indicator cannot silently become mock inference.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const base = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(base, name), "utf8");
const java = read("native/AmsImageEnginePlugin.java");
const js = read("patches/ams-image-engine.js");
const build = read("native/install-engine.sh");
const workflow = read(".github/workflows/build-android.yml");

for (const name of ["status", "pickModel", "pickImage", "generate", "cancel", "export"])
  assert.match(java, new RegExp("void\\s+" + name + "\\(PluginCall call\\)"),
    "Missing actual native plugin method: " + name);
assert.match(java, /new ProcessBuilder\(command\)/);
assert.match(java, /!output\.isFile\(\) \|\| output\.length\(\) < 100/);
assert.match(java, /inferenceSucceeded = true;/);
assert.match(java, /CONFIGURED_UNVERIFIED/);
assert.match(java, /getCanonicalPath\(\)/);
assert.match(java, /MediaStore\.Images\.Media\.IS_PENDING/);
assert.match(js, /"ams-ai-run"/);
assert.match(js, /runtime\(\)\.generate\(/);
assert.match(js, /r\.uri/);
assert.match(js, /"INFERENCE_VERIFIED"/);
assert.match(build, /-DANDROID_ABI=arm64-v8a/);
assert.match(build, /SD_REF="0518b34374761cb82aeda5ad3c2f0686fdad2cec"/);
assert.match(build, /libams_sd_cli\.so/);
assert.match(build, /LICENSE/);
assert.match(workflow, /bash native\/install-engine\.sh/);
assert.match(workflow, /lib\/arm64-v8a\/libams_sd_cli\.so/);
console.log("AMS native AI integrity checks passed (static only; not an inference test).");
