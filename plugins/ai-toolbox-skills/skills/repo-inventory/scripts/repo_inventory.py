#!/usr/bin/env python3
"""Inventory every git repository under some roots, and what is not pushed.

Read-only. It runs only git read commands, with --no-optional-locks so that
even `git status` does not refresh an index, and it never fetches: fetching
writes refs. "Not on any remote" therefore means "not on any remote-tracking
ref this clone knows", and the report prints each repository's last fetch so
a stale answer is visible.

Usage:
  repo_inventory.py [--format md|json] [--max-depth N] [--prune NAME]...
                    [--risky-only] [--fail-on-risk] ROOT [ROOT...]

Exit: 0 report written; 1 with --fail-on-risk when any repository needs
attention or could not be read; 2 bad usage, missing root, or no git.

The report names paths and remote hosts. Keep it out of public repositories.
Stdlib only, Python 3.8+.
"""
import argparse
import json
import os
import re
import stat
import subprocess
import sys
from datetime import datetime, timezone

# Variables a caller (a pre-commit hook, a worktree session) may export that
# would point every `git -C <repo>` query at THEIR repository instead
# (TASK-0165 found a hook's GIT_DIR doing exactly that to a test suite).
GIT_LOCATORS = ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR",
                "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES",
                "GIT_NAMESPACE", "GIT_PREFIX")
ENV = {k: v for k, v in os.environ.items() if k not in GIT_LOCATORS}
ENV["GIT_OPTIONAL_LOCKS"] = "0"
ENV["GIT_TERMINAL_PROMPT"] = "0"
ENV["LC_ALL"] = "C"

PRUNE = {"node_modules", ".venv", "venv", "__pycache__", ".tox", ".mypy_cache",
         ".pytest_cache", ".cache", "$RECYCLE.BIN", "System Volume Information",
         ".Trash"}
CONFLICT = {"DD", "AU", "UD", "UA", "DU", "AA", "UU"}


def git(path, *args):
    """(returncode, stdout, first stderr line) of a read-only git command."""
    try:
        p = subprocess.run(["git", "-C", path, "--no-optional-locks",
                            "-c", "core.quotepath=off", *args],
                           env=ENV, stdin=subprocess.DEVNULL,
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except FileNotFoundError:
        print("repo_inventory: git is not on PATH", file=sys.stderr)
        sys.exit(2)
    err = p.stderr.decode("utf-8", "replace").strip().splitlines()
    return p.returncode, p.stdout.decode("utf-8", "replace"), (err[0] if err else "")


def is_link(entry):
    """A symlink or a Windows junction: never followed, so nothing is found
    twice and nothing outside the roots is walked."""
    try:
        if entry.is_symlink():
            return True
        st = entry.stat(follow_symlinks=False)
    except OSError:
        return True
    attrs = getattr(st, "st_file_attributes", 0)
    return bool(attrs & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400))


def find_repos(roots, max_depth, prune, errors):
    hits, stack = [], [(os.path.abspath(r), 0) for r in roots]
    while stack:
        d, depth = stack.pop()
        try:
            entries = list(os.scandir(d))
        except OSError as e:
            errors.append({"path": d, "reason": "unreadable: %s" % e.strerror})
            continue
        names = {e.name for e in entries}
        if ".git" in names:
            hits.append(d)
        elif {"HEAD", "objects", "refs", "config"} <= names:
            hits.append(d)            # a bare repository; nothing to walk inside
            continue
        if depth >= max_depth:
            continue
        for e in entries:
            if e.name == ".git" or e.name in prune or is_link(e):
                continue
            try:
                if e.is_dir(follow_symlinks=False):
                    stack.append((e.path, depth + 1))
            except OSError:
                continue
    return sorted(hits)


def redact(url):
    """Drop credentials and query strings from a remote URL."""
    url = re.sub(r"^([A-Za-z][A-Za-z0-9+.-]*://)[^/@]+@", r"\1***@", url)
    return re.sub(r"\?.*$", "?***", url)


def status_counts(path):
    rc, out, err = git(path, "status", "--porcelain=v1", "-z", "--untracked-files=normal")
    if rc != 0:
        return None, err
    counts = {"staged": 0, "modified": 0, "untracked": 0, "conflicted": 0}
    toks = out.split("\0")
    i = 0
    while i < len(toks):
        t = toks[i]
        i += 1
        if len(t) < 3:
            continue
        xy = t[:2]
        if xy == "??":
            counts["untracked"] += 1
        elif xy in CONFLICT:
            counts["conflicted"] += 1
        else:
            if xy[0] not in " ?!":
                counts["staged"] += 1
            if xy[1] not in " ?!":
                counts["modified"] += 1
        if xy[0] in "RC":
            i += 1                    # a rename's source path follows
    return counts, ""


def worktrees(path):
    rc, out, _ = git(path, "worktree", "list", "--porcelain")
    wts, cur = [], None
    for line in out.splitlines() if rc == 0 else []:
        if line.startswith("worktree "):
            cur = {"path": line[9:], "branch": None, "head": None,
                   "bare": False, "detached": False}
            wts.append(cur)
        elif cur is None:
            continue
        elif line.startswith("HEAD "):
            cur["head"] = line[5:]
        elif line.startswith("branch "):
            cur["branch"] = line[7:].replace("refs/heads/", "", 1)
        elif line == "bare":
            cur["bare"] = True
        elif line == "detached":
            cur["detached"] = True
    return wts


def iso(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def inspect(path):
    rc, out, err = git(path, "rev-parse", "--path-format=absolute",
                       "--git-common-dir", "--is-bare-repository")
    if rc != 0:
        return None, err or "git rev-parse failed"
    common, bare = out.splitlines()[0], out.splitlines()[1] == "true"
    repo = {"path": path, "common_dir": os.path.normcase(os.path.normpath(common)),
            "bare": bare, "remotes": {}, "worktrees": [], "branches": [],
            "stash": 0, "last_commit": None, "last_fetch": None, "flags": []}

    rc, out, _ = git(path, "config", "--get-regexp", r"^remote\..*\.url$")
    for line in out.splitlines() if rc == 0 else []:
        key, _, url = line.partition(" ")
        repo["remotes"][key[len("remote."):-len(".url")]] = redact(url)

    rc, out, _ = git(path, "rev-list", "--walk-reflogs", "--count", "refs/stash")
    repo["stash"] = int(out.strip()) if rc == 0 and out.strip().isdigit() else 0

    rc, out, _ = git(path, "for-each-ref", "--format=%(refname)%09%(upstream:short)"
                     "%09%(upstream:track,nobracket)%09%(committerdate:unix)", "refs/heads")
    for line in out.splitlines() if rc == 0 else []:
        ref, upstream, track, when = (line.split("\t") + ["", "", ""])[:4]
        rc2, n, _ = git(path, "rev-list", "--count", ref, "--not", "--remotes")
        b = {"name": ref.replace("refs/heads/", "", 1), "upstream": upstream or None,
             "track": track or None,
             "not_on_remote": int(n.strip()) if rc2 == 0 and n.strip().isdigit() else None,
             "last_commit": int(when) if when.isdigit() else None}
        repo["branches"].append(b)
        if b["last_commit"] and (repo["last_commit"] or 0) < b["last_commit"]:
            repo["last_commit"] = b["last_commit"]

    fetch_head = os.path.join(common, "FETCH_HEAD")
    if os.path.isfile(fetch_head):
        repo["last_fetch"] = int(os.path.getmtime(fetch_head))

    for wt in worktrees(path):
        if wt["bare"]:
            continue
        entry = {"path": wt["path"], "branch": wt["branch"],
                 "detached": wt["detached"], "exists": os.path.isdir(wt["path"])}
        if entry["exists"]:
            counts, werr = status_counts(wt["path"])
            entry.update(counts or {})
            if counts is None:
                entry["error"] = werr
            if wt["detached"] and wt["head"]:
                rc2, n, _ = git(path, "rev-list", "--count", wt["head"],
                                "--not", "--branches", "--remotes", "--tags")
                entry["detached_unique"] = int(n.strip()) if rc2 == 0 and n.strip().isdigit() else 0
        repo["worktrees"].append(entry)

    # git lists the main working tree first; report the repository there even
    # when the walk reached a linked worktree first.
    if repo["worktrees"] and repo["worktrees"][0]["exists"]:
        repo["path"] = repo["worktrees"][0]["path"]
    # One spelling per path: on Windows the walk can yield 8.3 short names.
    repo["path"] = os.path.realpath(repo["path"])

    f = repo["flags"]
    if not repo["remotes"]:
        f.append("no remote")
    for wt in repo["worktrees"]:
        # The main working tree is the repository's own line; a linked one
        # is named.
        name = "" if wt is repo["worktrees"][0] else " " + wt["path"]
        if not wt["exists"]:
            continue
        if wt.get("error"):
            f.append("status failed%s: %s" % (name, wt["error"]))
            continue
        parts = ["%d %s" % (wt[k], k) for k in ("conflicted", "staged", "modified", "untracked") if wt.get(k)]
        if parts:
            f.append("uncommitted%s: %s" % (name, ", ".join(parts)))
        if wt.get("detached_unique"):
            f.append("detached HEAD%s: %d commit(s) on no branch or remote" % (name, wt["detached_unique"]))
    if repo["stash"]:
        f.append("stash: %d" % repo["stash"])
    for b in repo["branches"]:
        if b["track"] == "gone":
            f.append("%s: upstream gone" % b["name"])
        if b["not_on_remote"]:
            f.append("%s: %d commit(s) on no remote" % (b["name"], b["not_on_remote"]))
    return repo, ""


def render_md(roots, repos, errors, risky_only, now):
    out = ["# Repository inventory", "",
           "Generated %s over %s. Remote state is as of each repository's last fetch; "
           "this tool never fetches." % (iso(now), ", ".join("`%s`" % r for r in roots)), ""]
    risky = [r for r in repos if r["flags"]]
    out.append("%d repositories; %d need attention; %d could not be read."
               % (len(repos), len(risky), len(errors)))
    out.append("")
    shown = risky if risky_only else repos
    if shown:
        out += ["| Repository | Branch | Remotes | Last commit | Last fetch | Attention |",
                "|---|---|---|---|---|---|"]
        for r in shown:
            main = r["worktrees"][0] if r["worktrees"] else {}
            branch = "(bare)" if r["bare"] else (main.get("branch") or "(detached)")
            fetch = iso(r["last_fetch"]) if r["last_fetch"] else ("never" if r["remotes"] else "-")
            out.append("| `%s` | %s | %s | %s | %s | %s |" % (
                r["path"], branch, ", ".join(sorted(r["remotes"])) or "-",
                iso(r["last_commit"]) if r["last_commit"] else "-", fetch,
                "; ".join(r["flags"]) or "-"))
        out.append("")
    if errors:
        out += ["## Could not be read", ""]
        out += ["- `%s`: %s" % (e["path"], e["reason"]) for e in errors]
        out.append("")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("roots", nargs="+")
    ap.add_argument("--format", choices=("md", "json"), default="md")
    ap.add_argument("--max-depth", type=int, default=6)
    ap.add_argument("--prune", action="append", default=[],
                    help="another directory name never to descend into")
    ap.add_argument("--risky-only", action="store_true")
    ap.add_argument("--fail-on-risk", action="store_true")
    a = ap.parse_args()
    for r in a.roots:
        if not os.path.isdir(r):
            print("repo_inventory: not a directory: %s" % r, file=sys.stderr)
            return 2
    now = int(datetime.now(timezone.utc).timestamp())
    errors, repos, by_common = [], [], {}
    for path in find_repos(a.roots, a.max_depth, PRUNE | set(a.prune), errors):
        repo, err = inspect(path)
        if repo is None:
            errors.append({"path": os.path.realpath(path), "reason": err})
        elif repo["common_dir"] not in by_common:     # a linked worktree's main
            by_common[repo["common_dir"]] = repo       # was already reported
            repos.append(repo)
    if a.format == "json":
        print(json.dumps({"generated": now, "roots": a.roots, "repositories": repos,
                          "errors": errors}, indent=2))
    else:
        print(render_md(a.roots, repos, errors, a.risky_only, now))
    if a.fail_on_risk and (errors or any(r["flags"] for r in repos)):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
