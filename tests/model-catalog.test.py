#!/usr/bin/env python3
"""Fail-closed static verification of the bundled AMS model catalog."""
import json, pathlib, re, sys
p=pathlib.Path("native/ams-model-catalog.json")
catalog=json.loads(p.read_text())
assert catalog["schemaVersion"]==1
ids=set()
for m in catalog["models"]:
    assert m["id"] not in ids
    ids.add(m["id"])
    if m["installable"]:
        assert m["runtime"]=="stable-diffusion.cpp"
        assert m["url"].startswith("https://huggingface.co/")
        assert re.fullmatch(r"[a-f0-9]{64}",m["sha256"])
        assert m["sizeBytes"]>1000000
        assert m["requiredFreeBytes"]>m["sizeBytes"]
        assert m["license"]
    else:
        assert m["status"].startswith("blocked-")
assert "sd15-emaonly" in ids
assert "smollm2-135m-q4" in ids
print("PASS: pinned model catalog schema, allowlist, checksums and blocked runtimes")
