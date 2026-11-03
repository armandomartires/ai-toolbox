#!/usr/bin/env python3
"""Preview a mod's panes in a browser, from the trees the test kit draws.

Each mod may hold preview scenes in `preview/*.scene.tsx`: kit tests that mount
a pane at some sizes and surfaces and hand back what `ui.drawn()` returned. The
kit has no files and swallows console output, so a scene ends by throwing its
trees, URI-encoded between @@PREVIEW@@ and @@END@@; this script reads them out
of the failure message. The scenes run in a scratch copy of the mod (its hooks,
types and manifest, no tests), so they never slow or fail the mod's suite.

    python3 scripts/preview-mods.py                  # build every mod with scenes
    python3 scripts/preview-mods.py agent-watch      # one mod
    python3 scripts/preview-mods.py --serve 8765     # build, serve, rebuild on save

Output: build/preview/index.html (open it, or the served URL). task-compass's
scenes read this repo's own .ai/GOALS.md, copied in as preview/goals.fixture.ts.
"""
import argparse
import http.server
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODS = os.path.join(ROOT, "mods")
OUT = os.path.join(ROOT, "build", "preview")
PAGE = os.path.join(ROOT, "scripts", "preview", "index.html")
GOALS = os.path.join(ROOT, ".ai", "GOALS.md")
SCRATCH = os.path.join(tempfile.gettempdir(), "mods-preview")
MARK = re.compile(r"@@PREVIEW@@(.*?)@@END@@", re.S)


def mods_with_scenes():
    return sorted(
        name for name in os.listdir(MODS)
        if os.path.isdir(os.path.join(MODS, name, "preview"))
        and any(f.endswith(".scene.tsx") for f in os.listdir(os.path.join(MODS, name, "preview")))
    )


def scratch_copy(mod):
    """The mod without its tests or generated types, its scenes renamed as tests."""
    src, dst = os.path.join(MODS, mod), os.path.join(SCRATCH, mod)
    shutil.rmtree(dst, ignore_errors=True)

    def ignore(folder, names):
        skip = {n for n in names if re.search(r"\.test\.tsx?$", n) or n in ("node_modules", ".git")}
        if os.path.basename(folder) == ".claude-plugin":
            skip.add("types")
        return skip

    shutil.copytree(src, dst, ignore=ignore)
    preview = os.path.join(dst, "preview")
    for name in os.listdir(preview):
        if name.endswith(".scene.tsx"):
            os.replace(os.path.join(preview, name), os.path.join(preview, name[: -len(".scene.tsx")] + ".test.tsx"))
    if os.path.exists(os.path.join(preview, "goals.fixture.ts")) and os.path.exists(GOALS):
        with open(GOALS, encoding="utf-8") as f:
            text = f.read().replace("\r\n", "\n")
        with open(os.path.join(preview, "goals.fixture.ts"), "w", encoding="utf-8") as f:
            f.write("// Written by scripts/preview-mods.py from the repo's .ai/GOALS.md.\nexport const GOALS = %s\n" % json.dumps(text))
    return dst


def build(mod):
    """(scenes, errors) for one mod."""
    dst = scratch_copy(mod)
    run = subprocess.run(["claude", "plugin", "test", dst], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=600)
    text = run.stdout + run.stderr
    scenes = []
    for chunk in MARK.findall(text):
        scenes.extend(json.loads(urllib.parse.unquote(chunk)))
    errors = []
    if not scenes:
        errors.append("%s: no scene came back; the kit said:\n%s" % (mod, text[-4000:]))
    return scenes, errors


def write(built):
    """Keeps each mod's last build, so building one mod leaves the others' scenes on the page."""
    store = os.path.join(OUT, "mods")
    os.makedirs(store, exist_ok=True)
    for mod, (scenes, errors) in built.items():
        with open(os.path.join(store, mod + ".json"), "w", encoding="utf-8") as f:
            json.dump({"scenes": scenes, "errors": errors}, f)
    all_scenes, errors = [], []
    for name in sorted(os.listdir(store)):
        if name.endswith(".json") and os.path.isdir(os.path.join(MODS, name[:-5])):
            with open(os.path.join(store, name), encoding="utf-8") as f:
                one = json.load(f)
            all_scenes += one["scenes"]
            errors += one["errors"]
    stamp = str(time.time())
    with open(os.path.join(OUT, "scenes.js"), "w", encoding="utf-8") as f:
        f.write("window.PREVIEW = %s;\n" % json.dumps({"scenes": all_scenes, "errors": errors, "stamp": stamp}))
    shutil.copyfile(PAGE, os.path.join(OUT, "index.html"))
    with open(os.path.join(OUT, "version.txt"), "w") as f:
        f.write(stamp)


def build_all(mods):
    built = {}
    for mod in mods:
        started = time.time()
        built[mod] = build(mod)
        got, bad = built[mod]
        print("%s: %d scene(s) in %.1fs%s" % (mod, len(got), time.time() - started, " (failed)" if bad else ""), flush=True)
        for one in bad:
            print(one, file=sys.stderr)
    write(built)
    return not any(bad for _, bad in built.values())


def snapshot(mods):
    """The newest mtime under each watched place."""
    seen = {}
    for place in [os.path.join(MODS, m) for m in mods] + [GOALS, PAGE]:
        newest = 0.0
        for folder, dirs, files in os.walk(place) if os.path.isdir(place) else [("", [], [place])]:
            dirs[:] = [d for d in dirs if d not in ("types", "node_modules", ".git")]
            for name in files:
                try:
                    newest = max(newest, os.path.getmtime(os.path.join(folder, name)))
                except OSError:
                    pass
        seen[place] = newest
    return seen


class Fresh(http.server.SimpleHTTPRequestHandler):
    """Never cached, so the page's reload after a rebuild reads the new scenes."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


def serve(port):
    handler = lambda *a, **k: Fresh(*a, directory=OUT, **k)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print("preview: http://127.0.0.1:%d/" % port, flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mods", nargs="*", help="mods to build (default: every mod with preview scenes)")
    parser.add_argument("--serve", type=int, metavar="PORT", help="serve build/preview and rebuild on every save")
    args = parser.parse_args()
    mods = args.mods or mods_with_scenes()
    if not mods:
        sys.exit("no mod has preview/*.scene.tsx")
    ok = build_all(mods)
    if not args.serve:
        print("open %s" % os.path.join(OUT, "index.html"))
        sys.exit(0 if ok else 1)
    serve(args.serve)
    last = snapshot(mods)
    while True:
        time.sleep(1)
        # A mod that gains scenes while serving joins without a restart.
        mods = args.mods or mods_with_scenes()
        now = snapshot(mods)
        if now != last:
            changed = [m for m in mods if now.get(os.path.join(MODS, m)) != last.get(os.path.join(MODS, m))]
            # The board or the page itself changed: every mod again.
            last = now
            build_all(changed or mods)


if __name__ == "__main__":
    main()
