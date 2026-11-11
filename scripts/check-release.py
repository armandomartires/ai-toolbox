#!/usr/bin/env python3
"""Check the plugin version and tag rule (TASK-0283, P2.4). See docs/operations/releases.md.

The rule, in one place (scripts/plugin-versions.json is the only owner):
  - each plugin has its own semver version and its own tag <plugin>--v<version>
    (for example ai-toolbox-skills--v0.1.0); one repo tag never releases two
  - plugins/<p>/.claude-plugin/plugin.json and the marketplace entry for <p>
    carry exactly that version (scripts/build-plugin.py writes both)
  - a plugin that depends on another names a range (^, ~, >=, or exact), the
    same range in plugin.json and in the marketplace, and the dependency's
    current version must satisfy it; so bumping a dependency past its range
    fails here until the dependent is released with a new range

Usage:
  check-release.py [--root DIR]          check the files agree
  check-release.py [--root DIR] --tag T  also check that tag T names a plugin
                                         at its current version
"""
import json
import os
import re
import sys

SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
TAG = re.compile(r"^(ai-toolbox-[a-z]+)--v(.+)$")


def parse(v):
    m = SEMVER.match(v) if isinstance(v, str) else None
    return tuple(int(x) for x in m.groups()) if m else None


def satisfies(version, rng):
    """version and range as strings; ranges: X.Y.Z, ^X.Y.Z, ~X.Y.Z, >=X.Y.Z."""
    v = parse(version)
    if v is None:
        return False
    for op in (">=", "^", "~"):
        if rng.startswith(op):
            base = parse(rng[len(op):])
            if base is None:
                return False
            if op == ">=":
                return v >= base
            if v < base:
                return False
            if op == "~":
                return v[:2] == base[:2]
            if base[0] > 0:
                return v[0] == base[0]
            if base[1] > 0:
                return v[:2] == base[:2]
            return v == base
    base = parse(rng)
    return base is not None and v == base


def load(path, errs):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError) as e:
        errs.append("cannot read %s: %s" % (path, e))
        return None


def dep_map(deps):
    """{name: range or None} from a list of names or {name, version} objects."""
    out = {}
    for d in deps or []:
        if isinstance(d, str):
            out[d] = None
        elif isinstance(d, dict) and "name" in d:
            out[d["name"]] = d.get("version")
    return out


def check(root, tag=None):
    errs = []
    rule = load(os.path.join(root, "scripts", "plugin-versions.json"), errs)
    market = load(os.path.join(root, ".claude-plugin", "marketplace.json"), errs)
    if errs:
        return errs
    plugins = rule.get("plugins") if isinstance(rule, dict) else None
    if not isinstance(plugins, dict):
        return ["scripts/plugin-versions.json: \"plugins\" is not an object"]
    mplugins = market.get("plugins") if isinstance(market, dict) else None
    entries = {p.get("name"): p for p in mplugins if isinstance(p, dict)} if isinstance(mplugins, list) else {}
    if not plugins:
        errs.append("scripts/plugin-versions.json lists no plugin")
    for name, spec in sorted(plugins.items()):
        if not isinstance(spec, dict):
            errs.append("%s: its entry in plugin-versions.json is not an object" % name)
            continue
        ver = spec.get("version")
        if parse(ver) is None:
            errs.append("%s: version %r is not X.Y.Z semver" % (name, ver))
            continue
        want = spec.get("dependencies", {})
        if not isinstance(want, dict):
            errs.append("%s: dependencies in plugin-versions.json is not an object" % name)
            continue
        for dep, rng in want.items():
            dspec = plugins.get(dep)
            if not isinstance(dspec, dict):
                errs.append("%s: depends on %s, which is not a plugin here" % (name, dep))
            elif not isinstance(rng, str) or not satisfies(dspec.get("version"), rng):
                errs.append("%s: needs %s %s but it is at %s; release %s with a new range"
                            % (name, dep, rng, dspec.get("version"), name))
        pj = load(os.path.join(root, "plugins", name, ".claude-plugin", "plugin.json"), errs)
        e = entries.get(name)
        if e is None:
            errs.append("%s: no marketplace entry" % name)
        for label, doc in (("plugin.json", pj), ("marketplace entry", e)):
            if doc is None:
                continue
            if doc.get("version") != ver:
                errs.append("%s: %s version is %r, the rule says %s" % (name, label, doc.get("version"), ver))
            if not isinstance(doc.get("dependencies", []), list) or dep_map(doc.get("dependencies")) != want:
                errs.append("%s: %s dependencies are %r, the rule says %r"
                            % (name, label, dep_map(doc.get("dependencies")), want))
    if tag is not None:
        m = TAG.match(tag)
        if not m:
            errs.append("tag %r is not <plugin>--v<version>" % tag)
        elif m.group(1) not in plugins:
            errs.append("tag %r names no plugin (%s)" % (tag, ", ".join(sorted(plugins))))
        elif not isinstance(plugins[m.group(1)], dict) or plugins[m.group(1)].get("version") != m.group(2):
            errs.append("tag %r does not match the version of %s" % (tag, m.group(1)))
    return errs


def main(argv):
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tag = None
    args = list(argv)
    while args:
        a = args.pop(0)
        if a == "--root" and args:
            root = os.path.abspath(args.pop(0))
        elif a == "--tag" and args:
            tag = args.pop(0)
        else:
            print(__doc__, file=sys.stderr)
            return 2
    errs = check(root, tag)
    for e in errs:
        print("FAIL " + e, file=sys.stderr)
    if not errs:
        print("release rule holds" + (" for tag %s" % tag if tag else ""))
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
