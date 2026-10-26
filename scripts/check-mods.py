#!/usr/bin/env python3
"""Check the shape of every mod under <root>/mods/ (ADR-0040, TASK-0177).

The rules are the authoring guide's *Mods* table; this only checks them. For
each directory mods/<dir>/:

  1. .claude-plugin/plugin.json parses as a JSON object;
  2. its `name` is lowercase kebab-case and equals <dir>, except in a
     `_template*` directory, which cannot match its own name;
  3. its `description` is a non-empty single line (the registry renders it
     into one cell);
  4. a `types` path it declares exists inside the mod;
  5. hooks/hooks.json parses, and its `modules` is a non-empty list of files
     that exist inside the mod's hooks/ folder;
  6. README.md exists.

WHAT THIS PROVES: Claude Code can find the mod's manifest, hooks modules and
contract, and the registry can index it. WHAT IT DOES NOT PROVE: that the
modules load, type-check or pass their tests. That needs a `claude` that
supports mods, which the gate must not require: tests/test-mods.sh runs
`claude plugin validate` and `claude plugin test`.

Usage: check-mods.py [root]   (root defaults to this script's repository)
"""
import json
import os
import re
import sys

NAME = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def load(path, bad, what):
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        bad.append("%s: missing %s" % (path, what))
        return None
    except ValueError as exc:
        bad.append("%s: not valid JSON (%s)" % (path, exc))
        return None
    if not isinstance(data, dict):
        bad.append("%s: must be a JSON object" % path)
        return None
    return data


def inside(base, rel):
    full = os.path.realpath(os.path.join(base, rel))
    return full.startswith(os.path.realpath(base) + os.sep) and os.path.isfile(full)


def check(mod, bad):
    base = os.path.basename(mod)
    manifest = load(os.path.join(mod, ".claude-plugin", "plugin.json"), bad,
                    "manifest")
    if manifest is not None:
        name = manifest.get("name")
        if not isinstance(name, str) or not NAME.match(name):
            bad.append("%s: plugin.json name %r is not lowercase kebab-case"
                       % (mod, name))
        elif not base.startswith("_template") and name != base:
            bad.append("%s: plugin.json declares '%s' but the directory is "
                       "'%s'" % (mod, name, base))
        desc = manifest.get("description")
        if not isinstance(desc, str) or not desc.strip():
            bad.append("%s: plugin.json description is missing or empty" % mod)
        elif "\n" in desc:
            bad.append("%s: plugin.json description must be one line, so the "
                       "registry renders it into one cell" % mod)
        types = manifest.get("types")
        if types is not None and not (isinstance(types, str)
                                      and inside(mod, types)):
            bad.append("%s: plugin.json types %r is not a file in the mod"
                       % (mod, types))
    hooks_dir = os.path.join(mod, "hooks")
    hooks = load(os.path.join(hooks_dir, "hooks.json"), bad, "hooks.json")
    if hooks is not None:
        modules = hooks.get("modules")
        if not isinstance(modules, list) or not modules:
            bad.append("%s: hooks.json modules must be a non-empty list" % mod)
        else:
            for m in modules:
                if not (isinstance(m, str) and inside(hooks_dir, m)):
                    bad.append("%s: hooks.json module %r is not a file in "
                               "hooks/" % (mod, m))
    if not os.path.isfile(os.path.join(mod, "README.md")):
        bad.append("%s: missing README.md" % mod)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..")
    # Relative paths from here on, so every message names mods/<dir>/...
    os.chdir(root)
    mods = sorted(os.path.join("mods", d) for d in os.listdir("mods")
                  if os.path.isdir(os.path.join("mods", d))) \
        if os.path.isdir("mods") else []
    bad = []
    for mod in mods:
        check(mod, bad)
    for msg in bad:
        print("MOD SHAPE: %s" % msg)
    if bad:
        return 1
    print("OK (%d mods)" % len(mods))
    return 0


if __name__ == "__main__":
    sys.exit(main())
