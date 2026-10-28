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
  6. README.md exists;
  7. its hooks/sigma.tsx, the SIGMAorbital design module (ADR-0043), is a
     byte-identical copy of mods/_template/hooks/sigma.tsx, its one owner;
     and a mod whose hooks draw (`ui.render`) carries one;
  8. a mod that reads another mod's $.state declares that part of the
     owner's contract as a MIRROR (ADR-0044): a comment
     `// MIRROR of mods/<owner>/types/index.d.ts` naming a prefix ("Each
     `<Prefix><Name>`"), each `<Prefix><Name>` alias agreeing with the
     owner's `<Name>` (a union or plain type word for word, an object type
     field by field, a subset allowed), and its `'<owner>'` PluginState
     block agreeing with the owner's, key by key. A PluginState block for
     another mod without a mirror fails too.

WHAT THIS PROVES: Claude Code can find the mod's manifest, hooks modules and
contract, and the registry can index it; every mod draws from one copy of
the design module; a mod that reads another's state agrees with that
state's owner, field by field, as text. WHAT IT DOES NOT PROVE: that the
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
SIGMA_OWNER = os.path.join("mods", "_template", "hooks", "sigma.tsx")
DRAWS = re.compile(r"""['"]ui\.render['"]""")


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
    check_sigma(mod, hooks_dir, bad)
    check_mirror(mod, bad)


def read_bytes(path):
    try:
        with open(path, "rb") as fh:
            return fh.read()
    except OSError:
        return None


def draws(hooks_dir):
    """True when a hooks module (not a test) hooks `ui.render`."""
    for root, _, files in os.walk(hooks_dir):
        for f in files:
            if f.endswith((".ts", ".tsx")) and ".test." not in f:
                text = read_bytes(os.path.join(root, f)) or b""
                if DRAWS.search(text.decode("utf-8", "replace")):
                    return True
    return False


def check_sigma(mod, hooks_dir, bad):
    copy = os.path.join(hooks_dir, "sigma.tsx")
    if os.path.normpath(copy) == os.path.normpath(SIGMA_OWNER):
        return
    owner = read_bytes(SIGMA_OWNER)
    mine = read_bytes(copy)
    if mine is None:
        if draws(hooks_dir):
            bad.append("%s: draws (ui.render) without hooks/sigma.tsx; "
                       "cp %s %s" % (mod, SIGMA_OWNER, copy))
    elif owner is None:
        bad.append("%s: has hooks/sigma.tsx but its owner %s is missing"
                   % (mod, SIGMA_OWNER))
    elif mine != owner:
        bad.append("%s: hooks/sigma.tsx differs from its owner; change the "
                   "owner, then cp %s %s" % (mod, SIGMA_OWNER, copy))


# ---- rule 8: mirrors of another mod's $.state contract ---------------------

MIRROR = re.compile(r"//\s*MIRROR of mods/([a-z0-9-]+)/types/index\.d\.ts")
PREFIX = re.compile(r"Each\s+`(\w+)<Name>`")
ALIAS = re.compile(r"^export type (\w+)\s*=\s*", re.M)
BLOCK = re.compile(r"""^\s*['"]([a-z0-9-]+)['"]\s*:\s*\{""", re.M)
FIELD = re.compile(r"^\s*([A-Za-z_]\w*)(\??)\s*:\s*(.+?)\s*$")


def strip_comments(text):
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"//[^\n]*", "", text)


def norm(text):
    text = " ".join(text.split())
    return text[1:].strip() if text.startswith("|") else text


def balanced(text, start):
    """The text from the `{` at `start` to its closing `}`, both kept."""
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return text[start:]


def fields(body):
    """`{ a: T; b?: U }` (one per line or `;`-separated) as {name: (opt, type)}."""
    inner = body.strip()[1:-1]
    out, depth, cur = {}, 0, ""
    for ch in inner + "\n":
        if ch in "{([<":
            depth += 1
        elif ch in "})]>":
            depth -= 1
        if depth == 0 and ch in ";\n":
            m = FIELD.match(cur)
            if m:
                out[m.group(1)] = (m.group(2), norm(m.group(3)))
            cur = ""
        else:
            cur += ch
    return out


def aliases(text):
    """Every `export type Name = ...` as {name: text}; an object type as its `{...}`."""
    text = strip_comments(text)
    out = {}
    for m in ALIAS.finditer(text):
        start = m.end()
        if text[start:start + 1] == "{":
            out[m.group(1)] = balanced(text, start)
            continue
        end = len(text)
        for stop in (ALIAS, re.compile(r"^declare module", re.M), re.compile(r"\n\s*\n")):
            nxt = stop.search(text, start)
            if nxt and nxt.start() < end:
                end = nxt.start()
        out[m.group(1)] = norm(text[start:end])
    return out


def state_block(text, plugin):
    text = strip_comments(text)
    for m in BLOCK.finditer(text):
        if m.group(1) == plugin:
            return fields(balanced(text, m.end() - 1))
    return None


def check_mirror(mod, bad):
    path = os.path.join(mod, "types", "index.d.ts")
    try:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    except OSError:
        return
    me = os.path.basename(mod)
    mirrors = {m.group(1) for m in MIRROR.finditer(text)}
    for m in BLOCK.finditer(strip_comments(text)):
        other = m.group(1)
        if other != me and os.path.isdir(os.path.join("mods", other)) and other not in mirrors:
            bad.append("%s: declares mods/%s's $.state without a MIRROR comment "
                       "naming its owner (rule 8)" % (path, other))
    for owner in sorted(mirrors):
        owner_path = os.path.join("mods", owner, "types", "index.d.ts")
        try:
            with open(owner_path, encoding="utf-8") as fh:
                owner_text = fh.read()
        except OSError:
            bad.append("%s: mirrors %s, which is missing" % (path, owner_path))
            continue
        prefix = PREFIX.search(text[text.index("MIRROR of mods/%s" % owner):])
        if not prefix:
            bad.append("%s: its MIRROR of %s names no \"Each `<Prefix><Name>`\""
                       % (path, owner))
            continue
        pre = prefix.group(1)
        unprefix = lambda t: re.sub(r"\b%s([A-Z]\w*)" % pre, r"\1", t)
        theirs = aliases(owner_text)
        for name, body in aliases(text).items():
            if not name.startswith(pre) or name == pre:
                continue
            base = name[len(pre):]
            if base not in theirs:
                bad.append("%s: %s mirrors %s, which %s does not declare"
                           % (path, name, base, owner_path))
            elif body.startswith("{"):
                have = fields(theirs[base]) if theirs[base].startswith("{") else {}
                for field, (opt, typ) in fields(body).items():
                    if field not in have:
                        bad.append("%s: %s.%s is not a field of %s's %s"
                                   % (path, name, field, owner, base))
                    elif have[field] != (opt, unprefix(typ)):
                        bad.append("%s: %s.%s is %r, %s's %s.%s is %r"
                                   % (path, name, field, opt + ": " + typ, owner,
                                      base, field, "".join(have[field][0]) + ": " + have[field][1]))
            elif unprefix(body) != theirs[base]:
                bad.append("%s: %s is %r, %s's %s is %r"
                           % (path, name, body, owner, base, theirs[base]))
        mine, owned = state_block(text, owner), state_block(owner_text, owner)
        if mine is None:
            continue
        if owned is None:
            bad.append("%s: mirrors %s's $.state, which %s does not declare"
                       % (path, owner, owner_path))
            continue
        for key, (opt, typ) in mine.items():
            if key not in owned:
                bad.append("%s: reads $.state '%s'.%s, which %s does not declare"
                           % (path, owner, key, owner_path))
            elif owned[key] != (opt, unprefix(typ)):
                bad.append("%s: reads $.state '%s'.%s as %r, its owner declares %r"
                           % (path, owner, key, typ, owned[key][1]))


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
