#!/usr/bin/env python3
"""Copy the repo's mods into a Claude Code session's dev-mods folder, as files.

A session that hot-reloads mods watches its own folder,
~/.claude/dev-mods/<session id>/; a link (junction or symlink) into the repo
does not reliably make the watch see an edit behind it, so a mod loaded that
way can keep running old code. This copies each mod in as plain files and
mirrors later edits, so every save reloads at the end of the session's turn.

    python3 scripts/dev-mods.py                      # every mod, newest session folder
    python3 scripts/dev-mods.py agent-watch task-compass
    python3 scripts/dev-mods.py --session <id>       # a given session's folder
    python3 scripts/dev-mods.py --watch              # mirror on every save

Left out of the copy: tests, preview scenes, and .claude-plugin/types (the
engine writes those into the copy itself). A library copy of the same mod
still loads beside it: turn that one off while developing.
"""
import argparse
import filecmp
import os
import re
import shutil
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODS = os.path.join(ROOT, "mods")
DEV = os.path.join(os.path.expanduser("~"), ".claude", "dev-mods")


def skipped(rel):
    """Whether a path inside a mod stays out of the copy."""
    parts = rel.replace("\\", "/").split("/")
    return (
        re.search(r"\.test\.tsx?$", parts[-1]) is not None
        or parts[0] == "preview"
        or parts[:2] == [".claude-plugin", "types"]
        or any(p in ("node_modules", ".git") for p in parts)
    )


def is_link(path):
    return os.path.islink(path) or (hasattr(os.path, "isjunction") and os.path.isjunction(path))


def mirror(src, dst):
    """Makes dst hold src's files (less the skipped ones); returns how many changed."""
    if is_link(dst):
        # A link into the repo: replaced by a real folder (the link alone goes, never what it points to).
        os.unlink(dst) if os.path.islink(dst) else os.rmdir(dst)
    changed = 0
    wanted = set()
    for folder, dirs, files in os.walk(src):
        rel_dir = os.path.relpath(folder, src)
        dirs[:] = [d for d in dirs if not skipped(os.path.normpath(os.path.join(rel_dir, d)))]
        for name in files:
            rel = os.path.normpath(os.path.join(rel_dir, name))
            if skipped(rel):
                continue
            wanted.add(rel)
            target = os.path.join(dst, rel)
            if os.path.exists(target) and filecmp.cmp(os.path.join(src, rel), target, shallow=False):
                continue
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.copy2(os.path.join(src, rel), target)
            changed += 1
    # Anything else in the copy goes, tests and scenes too; the types the engine wrote stay.
    for folder, dirs, files in os.walk(dst):
        rel_dir = os.path.relpath(folder, dst)
        dirs[:] = [d for d in dirs if os.path.normpath(os.path.join(rel_dir, d)) != os.path.normpath(".claude-plugin/types")]
        for name in files:
            rel = os.path.normpath(os.path.join(rel_dir, name))
            if rel not in wanted:
                os.remove(os.path.join(dst, rel))
                changed += 1
    return changed


def session_folder(given):
    if given:
        path = os.path.join(DEV, given)
        if not os.path.isdir(path):
            sys.exit("no dev-mods folder for session %s: load the plugin-authoring skill in it first" % given)
        return path
    folders = [os.path.join(DEV, d) for d in os.listdir(DEV) if os.path.isdir(os.path.join(DEV, d))] if os.path.isdir(DEV) else []
    if not folders:
        sys.exit("no session has a dev-mods folder yet: load the plugin-authoring skill in the session first")
    return max(folders, key=os.path.getmtime)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mods", nargs="*", help="mods to copy (default: every mod in mods/ but _template)")
    parser.add_argument("--session", help="the session id whose dev-mods folder to fill (default: the newest)")
    parser.add_argument("--watch", action="store_true", help="keep mirroring every second")
    args = parser.parse_args()
    mods = args.mods or sorted(d for d in os.listdir(MODS) if not d.startswith("_") and os.path.isfile(os.path.join(MODS, d, ".claude-plugin", "plugin.json")))
    target = session_folder(args.session)
    print("dev-mods folder: %s" % target, flush=True)
    while True:
        for mod in mods:
            n = mirror(os.path.join(MODS, mod), os.path.join(target, mod))
            if n:
                print("%s: %d file(s) copied or removed" % (mod, n), flush=True)
        if not args.watch:
            return
        time.sleep(1)


if __name__ == "__main__":
    main()
