"""Committed snapshots of each preview drawing, and what changed since.

One JSON file per drawing under mods/<mod>/claude/preview/snapshots/, named
`<scene slug>.<surface>.<columns>x<rows>.json`. The tree is normalised: keys in
sorted order, and the per-run `handle` number of every `press` stripped (the
test kit hands out a fresh one on each run). Used by scripts/preview-mods.py:
`compare` annotates drawings for the page, `write` is --snapshot, `check` is --check.
"""
import json
import os
import re

HANDLE_KEYS = ("handle",)


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-") or "scene"


def _name(mod_dir):
    """The mod's name: the plugin folder is mods/<mod>/claude, so `claude` names its parent."""
    parts = os.path.normpath(mod_dir).replace(os.sep, "/").split("/")
    return parts[-2] if parts[-1] == "claude" and len(parts) > 1 else parts[-1]


def folder(mod_dir):  # mod_dir is the mod's plugin folder, mods/<mod>/claude (ADR-0054)
    return os.path.join(mod_dir, "preview", "snapshots")


def filename(d):
    return "%s.%s.%dx%d.json" % (slug(d["scene"]), d["surface"], d["columns"], d["rows"])


def normalise(node):
    """The tree without per-run values: `press.handle` dropped, keys sorted."""
    if isinstance(node, dict):
        out = {}
        for key in sorted(node):
            if key == "press" and isinstance(node[key], dict):
                out[key] = {k: normalise(v) for k, v in sorted(node[key].items()) if k not in HANDLE_KEYS}
            else:
                out[key] = normalise(node[key])
        return out
    if isinstance(node, list):
        return [normalise(v) for v in node]
    return node


def snapshot_of(d):
    """What is stored for one drawing (an errored drawing stores its error)."""
    body = {"mod": d["mod"], "scene": d["scene"], "surface": d["surface"], "columns": d["columns"], "rows": d["rows"],
            "actions": d.get("actions") or []}
    if d.get("error"):
        body["error"] = d["error"]
    else:
        body["tree"] = normalise(d.get("tree"))
    return body


def dump(body):
    return json.dumps(body, indent=1, sort_keys=True, ensure_ascii=False) + "\n"


def first_diff(a, b, path="tree"):
    """The first path at which two normalised values differ, with a short reason; None when equal."""
    if type(a) is not type(b):
        return "%s: %s -> %s" % (path, _short(a), _short(b))
    if isinstance(a, dict):
        for key in sorted(set(a) | set(b)):
            if key not in a:
                return "%s.%s: added" % (path, key)
            if key not in b:
                return "%s.%s: removed" % (path, key)
            found = first_diff(a[key], b[key], "%s.%s" % (path, key))
            if found:
                return found
        return None
    if isinstance(a, list):
        for i in range(max(len(a), len(b))):
            if i >= len(a):
                return "%s[%d]: added" % (path, i)
            if i >= len(b):
                return "%s[%d]: removed" % (path, i)
            found = first_diff(a[i], b[i], "%s[%d]" % (path, i))
            if found:
                return found
        return None
    return None if a == b else "%s: %s -> %s" % (path, _short(a), _short(b))


def _short(v):
    s = json.dumps(v, ensure_ascii=False)
    return s if len(s) <= 40 else s[:37] + "..."


def _stored(mod_dir, d):
    path = os.path.join(folder(mod_dir), filename(d))
    if not os.path.exists(path):
        return path, None
    with open(path, encoding="utf-8") as f:
        return path, json.load(f)


def _difference(mod_dir, d):
    """None when the drawing matches its snapshot, else a short text saying how it differs."""
    _, old = _stored(mod_dir, d)
    if old is None:
        return "no snapshot yet"
    new = snapshot_of(d)
    if ("error" in old) != ("error" in new):
        return "error state changed"
    return first_diff(old.get("tree", old.get("error")), new.get("tree", new.get("error")))


def compare(mod_dir, drawings):
    """Marks each drawing in place: changed true/false, and a `diff` summary when changed."""
    for d in drawings:
        why = None if not d.get("snapshot", True) else _difference(mod_dir, d)
        d["changed"] = why is not None
        if why is not None:
            d["diff"] = why
        else:
            d.pop("diff", None)


def kept(drawings):
    """The drawings that are snapshotted: not those a scene opted out of (`snapshot: false`, a live board)."""
    return [d for d in drawings if d.get("snapshot", True)]


def write(mod_dir, drawings):
    """Writes every drawing's snapshot, and removes stale snapshot files; refused while any drawing errored."""
    if any(d.get("error") for d in drawings):
        print("%s: not snapshotted, a drawing errored" % _name(mod_dir))
        return
    out = folder(mod_dir)
    os.makedirs(out, exist_ok=True)
    keep = set()
    for d in kept(drawings):
        keep.add(filename(d))
        with open(os.path.join(out, filename(d)), "w", encoding="utf-8", newline="\n") as f:
            f.write(dump(snapshot_of(d)))
    for name in os.listdir(out):
        if name.endswith(".json") and name not in keep:
            os.remove(os.path.join(out, name))
    print("%s: %d snapshot(s) written" % (_name(mod_dir), len(keep)))


def check(mod_dir, drawings):
    """Prints a line per difference; True when every drawing matches and no snapshot is orphaned."""
    mod = _name(mod_dir)
    ok = True
    for d in kept(drawings):
        why = _difference(mod_dir, d)
        if why is not None:
            ok = False
            print("%s: %s / %s %dx%d: %s" % (mod, d["scene"], d["surface"], d["columns"], d["rows"], why))
    out = folder(mod_dir)
    wanted = {filename(d) for d in kept(drawings)}
    if os.path.isdir(out):
        for name in sorted(os.listdir(out)):
            if name.endswith(".json") and name not in wanted:
                ok = False
                print("%s: snapshot %s has no drawing" % (mod, name))
    return ok
