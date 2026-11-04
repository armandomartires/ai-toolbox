#!/usr/bin/env python3
"""Add external MCP servers to a CycloneDX SBOM (issue #12).

syft finds what lockfiles declare (mcp-servers/gates/uv.lock, the pinned
GitHub Actions). External MCP servers (mcp-servers/*/server.json) are not
in any lockfile: they are launched by `npx -y <package>@<version>`, so this
adds one component per manifest with its npm purl and declared license.

Usage: sbom-add-external.py SBOM.json   (rewrites the file in place)
       sbom-add-external.py --self-test
"""
import glob
import json
import os
import sys
import tempfile


def external_components(root="."):
    out = []
    for path in sorted(glob.glob(os.path.join(root, "mcp-servers", "*", "server.json"))):
        if os.path.basename(os.path.dirname(path)).startswith("_template"):
            continue
        with open(path, encoding="utf-8") as fh:
            up = json.load(fh).get("upstream", {})
        if up.get("registry") != "npm" or not up.get("package") or not up.get("version"):
            continue
        name, ver = up["package"], up["version"]
        purl_name = name.replace("@", "%40", 1) if name.startswith("@") else name
        comp = {
            "type": "application",
            "bom-ref": f"pkg:npm/{purl_name}@{ver}",
            "name": name,
            "version": ver,
            "purl": f"pkg:npm/{purl_name}@{ver}",
            "properties": [{"name": "ai-toolbox:manifest", "value": os.path.relpath(path, root)}],
        }
        if up.get("license"):
            comp["licenses"] = [{"license": {"id": up["license"]}}]
        out.append(comp)
    return out


def add(sbom_path, root="."):
    with open(sbom_path, encoding="utf-8") as fh:
        bom = json.load(fh)
    comps = bom.setdefault("components", [])
    have = {c.get("bom-ref") for c in comps}
    new = [c for c in external_components(root) if c["bom-ref"] not in have]
    comps.extend(new)
    with open(sbom_path, "w", encoding="utf-8") as fh:
        json.dump(bom, fh, indent=2)
    return new


def self_test():
    with tempfile.TemporaryDirectory() as d:
        os.makedirs(os.path.join(d, "mcp-servers", "x"))
        os.makedirs(os.path.join(d, "mcp-servers", "_template-external"))
        for sub in ("x", "_template-external"):
            with open(os.path.join(d, "mcp-servers", sub, "server.json"), "w") as fh:
                json.dump({"upstream": {"registry": "npm", "package": "@s/p", "version": "1.2.3", "license": "MIT"}}, fh)
        sb = os.path.join(d, "bom.json")
        with open(sb, "w") as fh:
            json.dump({"bomFormat": "CycloneDX", "components": []}, fh)
        n1, n2 = add(sb, d), add(sb, d)
        ok = len(n1) == 1 and n1[0]["purl"] == "pkg:npm/%40s/p@1.2.3" and not n2
        if not ok:
            print("self-test failed:", n1, n2)
        return 0 if ok else 1


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        sys.exit(self_test())
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    for c in add(sys.argv[1]):
        print("added", c["purl"])
