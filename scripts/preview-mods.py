#!/usr/bin/env python3
"""Preview a mod's panes in a browser, from the trees the test kit draws.

Each mod may hold preview scenes in `claude/preview/*.scene.tsx`, built on the scene
kit (`scripts/preview/scene-kit.ts`, copied into the mod's claude/preview/ folder as
`scene-kit.ts`): a scene seeds the mod's state as its tests do, and the kit
mounts the pane at each size and surface asked for, applies presses, and hands
the drawn tree out. The test kit has no files and swallows console output, so
a scene ends by throwing its drawing, URI-encoded between @@PREVIEW@@ and
@@END@@; this script reads it out of the failure message. The scenes run in a
scratch copy of the mod (its hooks, types and manifest, no tests), so they
never slow or fail the mod's suite.

    python3 scripts/preview-mods.py                  # build every mod with scenes
    python3 scripts/preview-mods.py agent-watch      # one mod
    python3 scripts/preview-mods.py --serve 8765     # build, serve, rebuild on save

Served, the page can also ask for one drawing at another size, or after a press
(POST /run with a scene request); the server runs that scene alone and answers
with its tree. Output: build/preview/index.html (open it, or the served URL).
task-compass's scenes read this repo's own .ai/GOALS.md, copied in as
claude/preview/goals.fixture.ts.
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

try:
    import preview_snapshots  # scripts/preview_snapshots.py: committed snapshots of each drawing, and what changed
except ImportError:
    preview_snapshots = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODS = os.path.join(ROOT, "mods")
# A mod's Claude Code plugin is mods/<name>/claude (ADR-0054): its hooks, types, manifest and preview/.
OUT = os.path.join(ROOT, "build", "preview")
PAGE_DIR = os.path.join(ROOT, "scripts", "preview")
PAGE_FILES = ("index.html", "style.css", "render.js", "app.js", "snapshot.js")
SCENE_KIT = os.path.join(PAGE_DIR, "scene-kit.ts")
GOALS = os.path.join(ROOT, ".ai", "GOALS.md")
# One scratch folder per process: a served watcher and a command-line build may run at once.
SCRATCH = os.path.join(tempfile.gettempdir(), "mods-preview", str(os.getpid()))
MARK = re.compile(r"@@PREVIEW@@(.*?)@@END@@", re.S)
KIT_BANNER = "// Copied by scripts/preview-mods.py from scripts/preview/scene-kit.ts: edit that file, never this copy.\n"


def plugin_dir(mod):
    return os.path.join(MODS, mod, "claude")


def mods_with_scenes():
    return sorted(
        name for name in os.listdir(MODS)
        if os.path.isdir(os.path.join(plugin_dir(name), "preview"))
        and any(f.endswith(".scene.tsx") for f in os.listdir(os.path.join(plugin_dir(name), "preview")))
    )


def refresh_kit(mod):
    """The mod's preview/scene-kit.ts is the shared one, banner first."""
    with open(SCENE_KIT, encoding="utf-8") as f:
        wanted = KIT_BANNER + f.read().replace("\r\n", "\n")
    path = os.path.join(plugin_dir(mod), "preview", "scene-kit.ts")
    current = open(path, encoding="utf-8").read().replace("\r\n", "\n") if os.path.exists(path) else None
    if current != wanted:
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(wanted)


def scratch_copy(mod, request):
    """The mod without its tests or generated types, its scenes renamed as tests, the request written beside them."""
    refresh_kit(mod)
    src, dst = plugin_dir(mod), os.path.join(SCRATCH, mod)
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
    with open(os.path.join(preview, "request.ts"), "w", encoding="utf-8", newline="\n") as f:
        f.write("// Written by scripts/preview-mods.py: the drawings asked for, or null for every scene's own matrix.\n")
        f.write("import type { Request } from './scene-kit'\nexport const REQUEST: Request[] | null = %s\n" % json.dumps(request))
    # The live board goes into goals.live.ts only (the committed one is a stub): a scene that reads it is shown, never snapshotted.
    if os.path.exists(os.path.join(preview, "goals.live.ts")) and os.path.exists(GOALS):
        with open(GOALS, encoding="utf-8") as f:
            text = f.read().replace("\r\n", "\n")
        with open(os.path.join(preview, "goals.live.ts"), "w", encoding="utf-8", newline="\n") as f:
            f.write("// Written by scripts/preview-mods.py from the repo's .ai/GOALS.md; the committed file is a stub.\nexport const GOALS_LIVE = %s\n" % json.dumps(text))
    return dst


def build(mod, request=None):
    """(drawings, errors) for one mod; `request` narrows it to the drawings asked for."""
    dst = scratch_copy(mod, request)
    run = subprocess.run(["claude", "plugin", "test", dst], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=600)
    text = run.stdout + run.stderr
    drawings = []
    for chunk in MARK.findall(text):
        drawings.extend(json.loads(urllib.parse.unquote(chunk)))
    errors = [("%s: %s · %s: %s" % (mod, one["scene"], one["surface"], one["error"])) for one in drawings if one.get("error")]
    if preview_snapshots is not None and request is None:
        preview_snapshots.compare(plugin_dir(mod), drawings)
    if not drawings:
        errors.append("%s: no drawing came back; the kit said:\n%s" % (mod, text[-4000:]))
    return drawings, errors


def atomic_write(path, text):
    """Whole or not at all: a served watcher and a command-line build may write the same file at once."""
    tmp = "%s.%d.tmp" % (path, os.getpid())
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)


def read_json(path, tries=3):
    """A store file another process is replacing right now is read again a moment later."""
    for attempt in range(tries):
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except (ValueError, OSError):
            if attempt == tries - 1:
                return None
            time.sleep(0.2)


def write(built):
    """Keeps each mod's last build, so building one mod leaves the others' drawings on the page."""
    store = os.path.join(OUT, "mods")
    os.makedirs(store, exist_ok=True)
    for mod, (drawings, errors) in built.items():
        atomic_write(os.path.join(store, mod + ".json"), json.dumps({"scenes": drawings, "errors": errors}))
    all_scenes, errors = [], []
    for name in sorted(os.listdir(store)):
        if name.endswith(".json") and os.path.isdir(os.path.join(MODS, name[:-5])):
            one = read_json(os.path.join(store, name))
            if one is None:
                errors.append("%s: its last build could not be read; build it again" % name[:-5])
                continue
            all_scenes += one["scenes"]
            errors += one["errors"]
    stamp = str(time.time())
    atomic_write(os.path.join(OUT, "scenes.js"), "window.PREVIEW = %s;\n" % json.dumps({"scenes": all_scenes, "errors": errors, "stamp": stamp}))
    for name in PAGE_FILES:
        with open(os.path.join(PAGE_DIR, name), encoding="utf-8") as f:
            atomic_write(os.path.join(OUT, name), f.read())
    atomic_write(os.path.join(OUT, "version.txt"), stamp)


def build_all(mods):
    built = {}
    for mod in mods:
        started = time.time()
        built[mod] = build(mod)
        got, bad = built[mod]
        print("%s: %d drawing(s) in %.1fs%s" % (mod, len(got), time.time() - started, " (failed)" if bad else ""), flush=True)
        for one in bad:
            print(one, file=sys.stderr)
    write(built)
    return not any(bad for _, bad in built.values())


def snapshot(mods):
    """The newest mtime under each watched place."""
    seen = {}
    for place in [plugin_dir(m) for m in mods] + [GOALS, PAGE_DIR]:
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


class Handler(http.server.SimpleHTTPRequestHandler):
    """The built page, never cached; POST /run draws one scene as asked."""

    lock = threading.Lock()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass

    def answer(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/run":
            self.answer(404, {"scenes": [], "errors": ["no such route"]})
            return
        # JSON only: a browser preflights a cross-origin JSON POST, so a foreign page cannot start kit runs here.
        if not self.headers.get("Content-Type", "").startswith("application/json"):
            self.answer(415, {"scenes": [], "errors": ["send application/json"]})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 1_000_000:
                raise ValueError("a request is between 1 byte and 1 MB")
            body = json.loads(self.rfile.read(length))
            request = body if isinstance(body, list) else [body]
            if not request or len(request) > 20:
                raise ValueError("1 to 20 drawings per request")
            known = mods_with_scenes()
            for one in request:
                if not isinstance(one, dict):
                    raise ValueError("each drawing is an object")
                if one.get("mod") not in known:
                    raise ValueError("unknown mod %r" % one.get("mod"))
                if one.get("surface") not in ("desktop", "terminal"):
                    raise ValueError("surface is desktop or terminal")
                if not isinstance(one.get("scene"), str) or not 0 < len(one["scene"]) <= 200:
                    raise ValueError("scene is the scene's name")
                one["columns"] = max(20, min(400, int(one.get("columns", 80))))
                one["rows"] = max(8, min(200, int(one.get("rows", 40))))
                actions = []
                for a in (one.get("actions") or [])[:50]:
                    if not isinstance(a, dict) or "press" not in a:
                        continue
                    press = {"press": str(a["press"])[:200]}
                    if re.fullmatch(r"[a-z0-9_-]+", str(a.get("plugin", ""))):
                        press["plugin"] = str(a["plugin"])
                    actions.append(press)
                one["actions"] = actions
        except (ValueError, KeyError, TypeError) as error:
            self.answer(400, {"scenes": [], "errors": [str(error)]})
            return
        with self.lock:
            drawings, errors = [], []
            for mod in sorted({one["mod"] for one in request}):
                try:
                    got, bad = build(mod, [one for one in request if one["mod"] == mod])
                except subprocess.TimeoutExpired:
                    got, bad = [], ["%s: the kit did not answer within 10 minutes" % mod]
                drawings += got
                errors += bad
        self.answer(200, {"scenes": drawings, "errors": errors})


def serve(port):
    handler = lambda *a, **k: Handler(*a, directory=OUT, **k)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print("preview: http://127.0.0.1:%d/" % port, flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mods", nargs="*", help="mods to build (default: every mod with preview scenes)")
    parser.add_argument("--serve", type=int, metavar="PORT", help="serve build/preview, draw on request, rebuild on every save")
    parser.add_argument("--snapshot", action="store_true", help="write each drawing as the mod's committed snapshot (preview/snapshots/)")
    parser.add_argument("--check", action="store_true", help="exit 1 when a drawing differs from its snapshot")
    args = parser.parse_args()
    mods = args.mods or mods_with_scenes()
    if not mods:
        sys.exit("no mod has claude/preview/*.scene.tsx")
    ok = build_all(mods)
    if args.snapshot or args.check:
        if preview_snapshots is None:
            sys.exit("scripts/preview_snapshots.py is missing")
        store = os.path.join(OUT, "mods")
        for mod in mods:
            drawings = (read_json(os.path.join(store, mod + ".json")) or {"scenes": []})["scenes"]
            # A failed build writes no snapshot and removes none: an errored or empty run would poison or wipe them.
            if args.snapshot and ok:
                preview_snapshots.write(plugin_dir(mod), drawings)
            elif args.snapshot:
                print("%s: not snapshotted, the build failed" % mod, file=sys.stderr)
            elif not preview_snapshots.check(plugin_dir(mod), drawings):
                ok = False
        sys.exit(0 if ok else 1)
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
            changed = [m for m in mods if now.get(plugin_dir(m)) != last.get(plugin_dir(m))]
            # The board or the page itself changed: every mod again.
            last = now
            with Handler.lock:
                build_all(changed or mods)


if __name__ == "__main__":
    main()
