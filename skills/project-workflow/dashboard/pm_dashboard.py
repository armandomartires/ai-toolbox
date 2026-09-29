#!/usr/bin/env python3
"""
pm_dashboard.py — generate the self-contained HTML5 agile dashboard
(S027.T001_BuildAgileDashboard).

## What this module IS

The CLI. It calls `pm_collect.collect()`, hands the record to
`pm_metrics.compute()`, and writes two files:

    <out>/dashboard-data.json   the payload, for anything else that wants it
    <out>/index.html            everything inlined - CSS, JS and data

## Why everything is inlined, and why there is no CDN

The generated file has to open by double-clicking it, on a machine with no
server and no network. That is exactly the situation in which someone most
wants to know where a project stands: reviewing offline, on a laptop, without
standing anything up. A `<script src="https://cdn...">` makes the dashboard
fail closed in precisely that case, and `fetch("dashboard-data.json")` is
blocked by the `file://` origin policy in every current browser. So the data
goes in a `<script type="application/json">` block and the code goes in a
`<script>` block, and the whole thing is one file that works anywhere.

The one external reference is a sibling `dashboard.custom.css`, linked last.
A `<link>` to a same-directory file *does* resolve over `file://` (unlike
`fetch`), and its absence is not an error - which is what makes it a usable
customisation hook rather than a required build input.

## Why the output is not committed

`index.html` embeds the whole payload, including `generated_at` and every
commit count, so it changes on every regeneration whether or not the corpus
did. Committing it would put a large, wholly-derived, always-dirty artifact in
every diff - the same reason `.gitignore` already excludes `EXTRACTED/` and
`__pycache__`. `--install-hook` writes a **post-commit** hook instead, so a
fresh dashboard is always sitting in the working tree without any of it
entering history.

Post-commit, not pre-commit, for two independent reasons. The commit being made
does not exist in `git log` when pre-commit runs, so a pre-commit dashboard
would permanently lag by one commit - and would systematically miss the commit
that closes a task, which is the single most important event it tracks. And a
pre-commit hook can *fail* a commit: `AGENTS.md` Section 0 forbids
`--no-verify`, so a bug in a reporting tool would block all work in the repo.
A post-commit hook can do neither.

Read-only against the corpus. Stdlib only, Python-only per ADR-0003.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPTS_DIR.parents[1]


def _locate_assets():
    """Find `template.html`, `css/` and `js/`, wherever this tool is installed.

    Two layouts exist and both must work from the same source, because the
    skill ships a vendored copy of exactly these files (ADR-0029):

    - **vendored**: the modules and the assets sit in one directory together,
      so the assets are beside this script;
    - **this vault**: the modules are in `.ai/scripts/` and the assets in
      `.ai/dashboard/`, a sibling.

    Resolved by looking for the template rather than by testing which repository
    this is, so a third arrangement needs no code change. Falling back to the
    vault layout keeps the error message pointing somewhere real when the assets
    are genuinely missing.
    """
    for candidate in (
        SCRIPTS_DIR,                        # vendored: one flat directory
        SCRIPTS_DIR.parent / "dashboard",   # this vault: .ai/scripts -> .ai/dashboard
        SCRIPTS_DIR.parent,                 # vendored: scripts/ beside the assets
    ):
        if (candidate / "template.html").is_file():
            return candidate
    return SCRIPTS_DIR.parent / "dashboard"


ASSET_DIR = _locate_assets()
DEFAULT_OUT = ASSET_DIR / "build"

if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import pm_collect  # noqa: E402
import pm_metrics  # noqa: E402

PLACEHOLDERS = ("<!--{{META}}-->", "/*{{STYLES}}*/", "/*{{DATA}}*/", "/*{{SCRIPT}}*/")

HOOK_MARKER = "# pm_dashboard.py post-commit hook (S027.T001)"
HOOK_BODY = """#!/bin/sh
%s
#
# Regenerates the agile dashboard after every commit. Deliberately post-commit:
# the commit exists by now (a pre-commit run would always lag by one, and would
# miss the very commit that closes a task), and this hook cannot fail a commit
# no matter what the generator does. Remove it with:
#   python .ai/scripts/pm_dashboard.py --uninstall-hook
python -B .ai/scripts/pm_dashboard.py --quiet --if-stale >/dev/null 2>&1 || true
exit 0
""" % HOOK_MARKER


# ---------------------------------------------------------------------------
# asset assembly
# ---------------------------------------------------------------------------


def _concat(directory, suffix):
    """Concatenate every matching file in filename order, with a banner each.

    Filename order *is* the dependency order (SCHEMA.md section 5); the numeric
    prefixes exist for exactly this. The banner is not decoration - when a
    browser reports an error on line 2,914 of one inlined <script>, the banner
    is the only way to find out which source file that is.
    """
    directory = Path(directory)
    if not directory.is_dir():
        return "", []
    parts, names = [], []
    for path in sorted(directory.glob("*" + suffix)):
        text = path.read_text(encoding="utf-8")
        parts.append(
            "/* ===== %s ===== */\n%s" % (path.name, text.rstrip() + "\n")
        )
        names.append(path.name)
    return "\n".join(parts), names


def _json_for_html(payload):
    """Serialise the payload so it cannot break out of its <script> block.

    A `<script type="application/json">` element's content is raw text that ends
    at the first `</script`, so any `</` inside a string would truncate the
    payload and silently blank the dashboard. `\\/` is a legal JSON escape for
    `/`, so rewriting `</` costs nothing and closes the hole. `<!--` is
    neutralised for the same reason.

    `allow_nan=False` is the other half: Python happily emits `NaN` and
    `Infinity`, which are not JSON and which `JSON.parse` rejects outright. A
    metric that went non-finite should fail here, loudly, rather than produce a
    file that renders as a blank page.
    """
    text = json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return text.replace("</", "<\\/").replace("<!--", "<\\u0021--")


def _strip_nonfinite(value, path="", found=None):
    """Replace every non-finite float with None, recording where it was.

    Returns (cleaned, findings). A NaN reaching the browser is worse than a
    missing value: `JSON.parse` throws and the whole page is blank, with the
    real cause buried in a console nobody opened.
    """
    if found is None:
        found = []
    if isinstance(value, float) and not math.isfinite(value):
        found.append(path or "(root)")
        return None, found
    if isinstance(value, dict):
        out = {}
        for key in value:
            out[key], _ = _strip_nonfinite(value[key], "%s.%s" % (path, key), found)
        return out, found
    if isinstance(value, list):
        out = []
        for i, item in enumerate(value):
            cleaned, _ = _strip_nonfinite(item, "%s[%d]" % (path, i), found)
            out.append(cleaned)
        return out, found
    return value, found


def build_payload(root=None, today=None, trials=pm_metrics.MONTE_CARLO_TRIALS,
                  seed=None, use_git=True):
    record = pm_collect.collect(root, today, use_git)
    metrics = pm_metrics.compute(record, trials, seed)

    ready = record.pop("_queue_ready", [])
    _ = ready  # already carried into metrics.dependencies.ready

    payload = dict(record)
    payload["generated_at"] = _utc_now()
    payload["metrics"] = metrics

    cleaned, nonfinite = _strip_nonfinite(payload)
    if nonfinite:
        cleaned["defects"] = list(cleaned.get("defects") or []) + [
            "generator: %d non-finite number%s replaced with null at %s"
            % (
                len(nonfinite), "" if len(nonfinite) == 1 else "s",
                ", ".join(nonfinite[:5]),
            )
        ]
    return cleaned


def _utc_now():
    import datetime

    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def render_html(payload, asset_dir=ASSET_DIR):
    asset_dir = Path(asset_dir)
    template_path = asset_dir / "template.html"
    if not template_path.is_file():
        raise SystemExit("pm_dashboard: missing template at %s" % template_path)

    template = template_path.read_text(encoding="utf-8")
    missing = [p for p in PLACEHOLDERS if p not in template]
    if missing:
        raise SystemExit(
            "pm_dashboard: template is missing placeholder(s): %s" % ", ".join(missing)
        )

    styles, css_names = _concat(asset_dir / "css", ".css")
    script, js_names = _concat(asset_dir / "js", ".js")
    if not css_names:
        raise SystemExit("pm_dashboard: no stylesheets found in %s" % (asset_dir / "css"))
    if not js_names:
        raise SystemExit("pm_dashboard: no scripts found in %s" % (asset_dir / "js"))
    if "</script" in script.lower():
        raise SystemExit(
            "pm_dashboard: a js source contains '</script', which would end the "
            "inlined block early. Split the literal."
        )

    project = payload["project"]["name"]
    meta = "\n".join([
        "<title>%s — project dashboard</title>" % _escape(project),
        '<meta name="generator" content="pm_dashboard.py %s">'
        % _escape(payload["generator"]["version"]),
        '<meta name="description" content="Generated agile dashboard for %s, '
        'as of %s.">' % (_escape(project), _escape(payload["project"]["today"])),
    ])

    html = template
    html = html.replace("<!--{{META}}-->", meta)
    html = html.replace("/*{{STYLES}}*/", styles)
    html = html.replace("/*{{DATA}}*/", _json_for_html(payload))
    html = html.replace("/*{{SCRIPT}}*/", script)
    return html, css_names, js_names


def _escape(text):
    return (
        str(text)
        .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        .replace('"', "&quot;")
    )


# ---------------------------------------------------------------------------
# staleness
# ---------------------------------------------------------------------------


def _newest_input_mtime(root):
    """The most recent mtime across everything the dashboard reads.

    Git history is deliberately included via `.git/HEAD` and the ref files:
    a commit changes the payload (commit counts, volume, last-touch dates)
    without touching any corpus file, and `--if-stale` has to notice.
    """
    root = Path(root)
    workflow = pm_collect.locate_corpus(root)
    newest = 0.0
    candidates = [
        workflow / "20.PLAN.md",
        workflow / "30.ROADMAP.md",
        workflow / "35.AD_HOC_TASKS.md",
        root / ".git" / "HEAD",
        root / ".git" / "index",
        ASSET_DIR / "template.html",
    ]
    log_path = pm_collect.locate_log(root)
    if log_path:
        candidates.append(log_path)
    for directory in (workflow / "tasks", workflow / "decisions", workflow / "reviews",
                      ASSET_DIR / "css", ASSET_DIR / "js", SCRIPTS_DIR):
            if directory.is_dir():
                for path in directory.rglob("*"):
                    if path.is_file() and path.suffix in (".md", ".css", ".js", ".py"):
                        candidates.append(path)
    for path in candidates:
        try:
            newest = max(newest, path.stat().st_mtime)
        except OSError:
            continue
    return newest


def is_stale(out_dir, root, html_name="index.html"):
    html = Path(out_dir) / html_name
    if not html.is_file():
        return True, "no dashboard has been generated yet"
    try:
        built = html.stat().st_mtime
    except OSError:
        return True, "the existing dashboard could not be read"
    newest = _newest_input_mtime(root)
    if newest > built:
        return True, "an input changed after the last build"
    return False, "the dashboard is newer than every input"


# ---------------------------------------------------------------------------
# validation (--check)
# ---------------------------------------------------------------------------

REQUIRED_TOP = (
    "schema_version", "generated_at", "generator", "project", "units", "tasks",
    "sprints", "adhoc", "backlog", "phases", "decisions", "reviews", "log",
    "commits", "metrics", "provenance", "defects", "advisories",
)
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
VALID_SOURCES = (
    "header_date", "status_line", "log_md", "filename", "body_found_during",
    "git_added", "git_last", "roadmap_sprint", "file_mtime", "unknown",
    # Added in schema v2 for the numbered-task layout, which records dates its
    # own way: a `- Created:`/`- Updated:` header field, and a closure date
    # derived from a commit hash the brief itself names.
    "created_field", "updated_field", "commit_hash",
)
VALID_STATES = ("done", "pending", "cancelled", "unparseable")


def validate(payload):
    """Structural defects in the emitted payload. Empty list means clean."""
    problems = []

    for key in REQUIRED_TOP:
        if key not in payload:
            problems.append("payload: missing top-level key %r" % key)
    if payload.get("schema_version") != pm_collect.SCHEMA_VERSION:
        problems.append(
            "payload: schema_version is %r, expected %d"
            % (payload.get("schema_version"), pm_collect.SCHEMA_VERSION)
        )

    for task in payload.get("tasks") or []:
        for prefix in ("created_at", "closed_at"):
            value = task.get(prefix)
            source = task.get(prefix + "_source")
            if value is not None and not DATE_RE.match(str(value)):
                problems.append(
                    "%s: %s is %r, which is not YYYY-MM-DD"
                    % (task.get("id"), prefix, value)
                )
            if source not in VALID_SOURCES:
                problems.append(
                    "%s: %s_source is %r, which is not in the schema's closed set"
                    % (task.get("id"), prefix, source)
                )
            if value is None and source != "unknown":
                problems.append(
                    "%s: %s is null but its source claims %r"
                    % (task.get("id"), prefix, source)
                )
        if task.get("state") not in VALID_STATES:
            problems.append("%s: state %r is not a schema value"
                            % (task.get("id"), task.get("state")))

    metrics = payload.get("metrics") or {}
    for name in ("burnup", "burndown", "cfd"):
        series = metrics.get(name) or []
        dates = [point.get("date") for point in series]
        if dates != sorted(dates):
            problems.append("metrics.%s: series is not ascending by date" % name)

    forecast = metrics.get("forecast") or {}
    if forecast.get("usable"):
        histogram = forecast.get("histogram") or []
        if histogram and abs(histogram[-1].get("cumulative_pct", 0) - 100.0) > 0.5:
            problems.append(
                "metrics.forecast: cumulative_pct ends at %r, not ~100"
                % histogram[-1].get("cumulative_pct")
            )
        for key in ("p50", "p85", "p95"):
            value = (forecast.get("percentiles") or {}).get(key)
            if value is not None and not DATE_RE.match(str(value)):
                problems.append("metrics.forecast.percentiles.%s is %r" % (key, value))

    # A cycle is a real corpus defect, not a generator one, but --check is the
    # place a caller finds out about it.
    for cycle in (metrics.get("dependencies") or {}).get("cycles") or []:
        problems.append(
            "dependency cycle declared between %s - one of these declarations "
            "is wrong, and none of them can ever become ready" % " -> ".join(cycle)
        )

    try:
        json.dumps(payload, allow_nan=False)
    except ValueError as exc:
        problems.append("payload: not serialisable as strict JSON (%s)" % exc)

    return problems


# ---------------------------------------------------------------------------
# hook install
# ---------------------------------------------------------------------------


def hook_path(root):
    hooks = Path(root) / ".git" / "hooks"
    return hooks / "post-commit"


def install_hook(root, force=False):
    path = hook_path(root)
    if not path.parent.is_dir():
        return 1, "no .git/hooks directory at %s - is this a git repository?" % root
    if path.is_file():
        existing = path.read_text(encoding="utf-8", errors="replace")
        if HOOK_MARKER in existing:
            path.write_text(HOOK_BODY, encoding="utf-8")
            _make_executable(path)
            return 0, "refreshed the existing pm_dashboard post-commit hook"
        if not force:
            return 1, (
                "a post-commit hook already exists and was not written by this "
                "tool; refusing to overwrite it. Inspect %s, then re-run with "
                "--force if replacing it is what you want." % path
            )
    path.write_text(HOOK_BODY, encoding="utf-8")
    _make_executable(path)
    return 0, "installed the post-commit hook at %s" % path


def uninstall_hook(root):
    path = hook_path(root)
    if not path.is_file():
        return 0, "no post-commit hook is installed"
    existing = path.read_text(encoding="utf-8", errors="replace")
    if HOOK_MARKER not in existing:
        return 1, (
            "the post-commit hook at %s was not written by this tool; leaving it "
            "alone." % path
        )
    path.unlink()
    return 0, "removed the post-commit hook"


def _make_executable(path):
    try:
        mode = os.stat(path).st_mode
        os.chmod(path, mode | 0o111)
    except OSError:
        # Windows has no executable bit and git runs hooks through sh anyway.
        pass


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main(argv=None):
    ap = argparse.ArgumentParser(
        description=(
            "Generate a self-contained HTML5 agile dashboard from the "
            "project-workflow corpus. Read-only against the corpus."
        ),
        epilog=(
            "The output is derived and should stay out of git; --install-hook "
            "keeps it fresh in the working tree instead."
        ),
    )
    ap.add_argument("--out", default=None,
                    help="output directory (default: .ai/dashboard/build)")
    ap.add_argument("--root", default=None, help="repository root to read")
    ap.add_argument("--today", default=None, help="override today's date (YYYY-MM-DD)")
    ap.add_argument("--trials", type=int, default=pm_metrics.MONTE_CARLO_TRIALS,
                    help="Monte Carlo trials (default: %d)" % pm_metrics.MONTE_CARLO_TRIALS)
    ap.add_argument("--seed", type=int, default=None,
                    help="forecast RNG seed (default: derived from the data, so "
                         "repeated runs on an unchanged corpus agree)")
    ap.add_argument("--no-git", dest="use_git", action="store_false",
                    help="do not read git. Dates then come from hand-recorded "
                         "sources only and the activity series are empty — the "
                         "behaviour in a directory that was copied rather than "
                         "cloned. The degradation is stated in the payload's "
                         "provenance notes, never silent.")
    ap.add_argument("--json-only", action="store_true", help="write only the JSON")
    ap.add_argument("--html-only", action="store_true", help="write only the HTML")
    ap.add_argument("--if-stale", action="store_true",
                    help="skip the build when the output is newer than every input")
    ap.add_argument("--check", action="store_true",
                    help="validate the corpus and the payload; exit 1 on any defect, "
                         "writing nothing")
    ap.add_argument("--open", dest="open_after", action="store_true",
                    help="open the generated dashboard in the default browser")
    ap.add_argument("--quiet", action="store_true", help="print nothing on success")
    ap.add_argument("--install-hook", action="store_true",
                    help="install a post-commit hook that regenerates on every commit")
    ap.add_argument("--uninstall-hook", action="store_true",
                    help="remove the post-commit hook this tool installed")
    ap.add_argument("--force", action="store_true",
                    help="with --install-hook, replace a foreign post-commit hook")
    args = ap.parse_args(argv)

    root = Path(args.root or REPO_ROOT)

    if args.install_hook:
        code, message = install_hook(root, args.force)
        print("pm_dashboard: " + message)
        return code
    if args.uninstall_hook:
        code, message = uninstall_hook(root)
        print("pm_dashboard: " + message)
        return code

    # `--out` takes a directory, or a path ending in `.html` naming the page
    # itself. The second form exists because a publisher that wants the file at
    # an exact path (`_site/index.html`) should not have to generate into a
    # directory and then move it — and a caller that passes one should not
    # silently get a directory of that name instead.
    out_dir = Path(args.out) if args.out else DEFAULT_OUT
    html_name = "index.html"
    if args.out and out_dir.suffix.lower() in (".html", ".htm"):
        html_name = out_dir.name
        out_dir = out_dir.parent or Path(".")

    if args.if_stale and not args.check:
        stale, reason = is_stale(out_dir, root, html_name)
        if not stale:
            if not args.quiet:
                print("pm_dashboard: up to date (%s); nothing written." % reason)
            return 0

    payload = build_payload(root, args.today, args.trials, args.seed, args.use_git)
    problems = validate(payload)
    corpus_defects = list(payload.get("defects") or [])

    advisories = list(payload.get("advisories") or [])

    if args.check:
        for defect in corpus_defects:
            print("[corpus]   %s" % defect)
        for problem in problems:
            print("[payload]  %s" % problem)
        # Advisories print and never gate. They are findings about the corpus
        # this tool cannot act on - an audit-log gap, say - and a gate that goes
        # red over one of those is a gate people learn to skip past.
        for advisory in advisories:
            print("[advisory] %s" % advisory)
        total = len(corpus_defects) + len(problems)
        if total:
            print("\nFAIL: %d defect(s), %d advisory(s). Nothing was written."
                  % (total, len(advisories)))
            return 1
        print("\nOK: corpus and payload are clean; %d advisory(s), none gating. "
              "Nothing was written." % len(advisories))
        return 0

    if problems:
        # A structural problem means the payload is wrong, and writing a wrong
        # dashboard is worse than writing none: it would be read as fact.
        for problem in problems:
            print("pm_dashboard: [payload] %s" % problem, file=sys.stderr)
        print(
            "pm_dashboard: refusing to write a dashboard from a payload that "
            "fails its own schema. Run --check for the full list.",
            file=sys.stderr,
        )
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)
    written = []

    if not args.html_only:
        json_path = out_dir / "dashboard-data.json"
        json_path.write_text(
            json.dumps(payload, indent=2, sort_keys=True, allow_nan=False),
            encoding="utf-8",
        )
        written.append(json_path)

    html_path = out_dir / html_name
    if not args.json_only:
        html, css_names, js_names = render_html(payload, ASSET_DIR)
        html_path.write_text(html, encoding="utf-8")
        written.append(html_path)
    else:
        css_names = js_names = []

    if args.open_after and html_path.is_file():
        import webbrowser

        webbrowser.open(html_path.resolve().as_uri())

    if not args.quiet:
        totals = payload["metrics"]["totals"]
        print("pm_dashboard: %s" % payload["project"]["name"])
        print(
            "  %d task(s): %d done, %d pending (%.1f%% complete) across %d sprint(s)"
            % (
                totals["tasks"], totals["done"], totals["pending"],
                totals["completion_pct"], totals["sprints"],
            )
        )
        forecast = payload["metrics"]["forecast"]
        if forecast.get("usable"):
            print(
                "  forecast: 50%% by %s, 85%% by %s, 95%% by %s"
                % (
                    forecast["percentiles"]["p50"], forecast["percentiles"]["p85"],
                    forecast["percentiles"]["p95"],
                )
            )
        else:
            print("  forecast: not usable (%s)" % forecast.get("note", ""))
        if css_names or js_names:
            print("  inlined %d stylesheet(s), %d script(s)"
                  % (len(css_names), len(js_names)))
        for path in written:
            size = path.stat().st_size
            print("  wrote %s (%.0f KB)" % (_rel_out(path), size / 1024.0))
        if corpus_defects or advisories:
            print("  %d corpus defect(s), %d advisory(s) reported in the "
                  "Debt & risk tab" % (len(corpus_defects), len(advisories)))

    return 0


def _rel_out(path):
    try:
        return str(Path(path).resolve().relative_to(REPO_ROOT)).replace("\\", "/")
    except ValueError:
        return str(path)


if __name__ == "__main__":
    sys.exit(main())
