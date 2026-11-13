#!/usr/bin/env python3
"""Move a project-migration repository onto the one planning convention.

ADR-0066 (ai-toolbox): project-workflow's numbered `.ai/` layout, sprint-prefixed
task ids (`S###.T###`), `ADR-NNNN-title.md` decision files. This tool computes
the old-to-new map from the repository's own `.ai/tasks/TODO.md` sprint
headings, prints it, and, only with `--write`, performs it.

  migrate-layout.py [--repo DIR]            dry run: print the map, change nothing
  migrate-layout.py [--repo DIR] --write    git mv every file, write
                                            .ai/id-map.tsv, rewrite PATH references

What --write does, and does not do (ADR-0066 clause 5, history is not rewritten):
  * moves with `git mv`, content unchanged, so `git log --follow` keeps working;
  * rewrites path references only: markdown links, backticked paths and bare
    `.ai/...md` paths that point at a moved file. A task id (`TASK-0042`)
    written in prose is never touched; it resolves through `.ai/id-map.tsv`;
  * removes the retired `tasks/TODO.md` and `templates/`;
  * leaves the live files' CONTENT (roadmap table, ad-hoc entries from backlog
    rows, GOALS.md ids) to a follow-up; the dry run lists what is left.

Refusals (exit 2, nothing changed): a dirty working tree, a destination that
already exists, a brief that no TODO.md heading assigns to a sprint (never
guessed; `--skip-unassigned` leaves those briefs where they are).

Python 3.10+, standard library only. Idempotent: a repository already on the
new layout maps to nothing.
"""
from __future__ import annotations

import argparse
import os
import posixpath
import re
import subprocess
import sys
from collections import defaultdict

AI = ".ai"

STATIC = {
    f"{AI}/README.md": f"{AI}/00.CONVENTIONS.md",
    f"{AI}/planning/SPRINT-CURRENT.md": f"{AI}/20.PLAN.md",
    f"{AI}/planning/ROADMAP.md": f"{AI}/30.ROADMAP.md",
    f"{AI}/planning/BACKLOG.md": f"{AI}/35.AD_HOC_TASKS.md",
    f"{AI}/context/CURRENT_STATE.md": f"{AI}/10.CURRENT_STATE.md",
    f"{AI}/context/risk-register.md": f"{AI}/40.RISK_REGISTER.md",
    f"{AI}/context/PROJECT_MAP.md": "docs/project-map.md",
    f"{AI}/context/GLOSSARY.md": "docs/glossary.md",
    f"{AI}/context/model-tiers.md": "docs/development/model-tiers.md",
    f"{AI}/context/turn-limits.md": "docs/development/turn-limits.md",
}
# Paths that already belong to the new layout or stay as they are.
STAY_PREFIXES = (f"{AI}/sessions/", f"{AI}/archive/", f"{AI}/reference/")
STAY_FILES = {f"{AI}/GOALS.md", f"{AI}/id-map.tsv"}
STAY_RE = re.compile(rf"^{re.escape(AI)}/\d\d\.[A-Z_]+\.md$|^{re.escape(AI)}/00\.CONVENTIONS\.md$")


class Fail(Exception):
    pass


def git(repo: str, *args: str, check: bool = True) -> str:
    env = {k: v for k, v in os.environ.items()
           if k not in ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE")}
    p = subprocess.run(["git", "-C", repo, *args], capture_output=True, env=env)
    if check and p.returncode != 0:
        raise Fail(f"git {' '.join(args)} failed: {p.stderr.decode('utf8', 'replace').strip()}")
    return p.stdout.decode("utf8", "replace")


def tracked(repo: str) -> list[str]:
    out = git(repo, "ls-files", "-z")
    return [p for p in out.split("\0") if p]


def read(repo: str, rel: str) -> str:
    with open(os.path.join(repo, rel), encoding="utf8", errors="replace", newline="") as f:
        return f.read()


def pascal(slug: str) -> str:
    parts = [p for p in re.split(r"[^A-Za-z0-9]+", slug) if p]
    name = "".join(p[0].upper() + p[1:] for p in parts)
    return name or "Task"


# ---------------------------------------------------------------- TODO.md ---

class Todo:
    """What TODO.md says: task -> bucket, review -> sprint, sprint kinds."""

    def __init__(self, text: str, known_sprints: set[int]):
        self.sprints: dict[int, str] = {}      # N -> heading text
        self.buckets: dict[str, list[str]] = defaultdict(list)  # 'Post-S4' -> tasks
        self.task_head: dict[str, str] = {}    # TASK-NNNN -> 'S2' | 'Post-S4' | ''
        self.task_done: set[str] = set()       # marker [x]
        self.closes: dict[str, int] = {}       # REVIEW-NNNN -> sprint (heading)
        self.title_closes: dict[str, int] = {} # REVIEW-NNNN -> sprint (item title)
        cur = None
        first_heading_seen = False
        preamble: list[str] = []
        for line in text.splitlines():
            m = re.match(r"^##\s+(?:Sprint\s+)?S(\d+)\b", line)
            pm = re.match(r"^##\s+Post-S(\d+)\b", line)
            if pm:
                cur = f"Post-S{int(pm.group(1))}"
                first_heading_seen = True
                continue
            if m:
                n = int(m.group(1))
                self.sprints[n] = line
                cur = f"S{n}"
                first_heading_seen = True
                cm = re.search(r"by (REVIEW-\d{4})", line)
                if cm:
                    self.closes[cm.group(1)] = n
                continue
            if line.startswith("## "):
                cur = ""        # an unknown heading: its tasks have no sprint
                first_heading_seen = True
                continue
            im = re.match(r"^\s*- \[(.)\]\s+(TASK-\d{4})\b", line)
            if im:
                t = im.group(2)
                if im.group(1) == "x":
                    self.task_done.add(t)
                if not first_heading_seen:
                    preamble.append(t)
                    continue
                self.task_head.setdefault(t, cur or "")
                if cur and cur.startswith("Post-") and t in self.task_done:
                    self.buckets[cur].append(t)
                continue
            rm = re.match(r"^\s*- \[.\]\s+(REVIEW-\d{4})\b.*?\bSprint S(\d+)", line)
            if rm:
                self.title_closes.setdefault(rm.group(1), int(rm.group(2)))
        # Items before any heading belong to the sprint just below the first
        # numbered one, but only when the repository itself records that sprint.
        self.preamble_sprint = None
        if preamble and self.sprints:
            n = min(self.sprints) - 1
            if n >= 1 and n in known_sprints:
                self.preamble_sprint = n
                for t in preamble:
                    self.task_head.setdefault(t, f"S{n}")
        self.preamble = preamble


def known_sprint_numbers(repo: str, files: list[str]) -> set[int]:
    found: set[int] = set()
    for f in files:
        m = re.match(rf"^{re.escape(AI)}/(?:planning|archive)/sprints/SPRINT-S(\d+)\b", f)
        if m:
            found.add(int(m.group(1)))
    goals = os.path.join(repo, AI, "GOALS.md")
    if os.path.exists(goals):
        for line in read(repo, f"{AI}/GOALS.md").splitlines():
            m = re.match(r"^##\s+S(\d+)\b", line)
            if m:
                found.add(int(m.group(1)))
    return found


# ------------------------------------------------------------------ plan ---

class Row:
    def __init__(self, kind, old_id, new_id, old_path, new_path):
        self.kind, self.old_id, self.new_id = kind, old_id, new_id
        self.old_path, self.new_path = old_path, new_path


def first_date(text: str) -> str | None:
    for line in text.splitlines()[:25]:
        m = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", line)
        if m:
            return m.group(1)
    return None


def created(text: str) -> str | None:
    m = re.search(r"(?im)^\s*(?:[-*]\s*)?\**Created\**\s*:\**\s*(\d{4}-\d{2}-\d{2})", text)
    return m.group(1) if m else None


def build_plan(repo: str):
    files = tracked(repo)
    rows: list[Row] = []
    retired: list[str] = []
    unmapped: list[str] = []
    unassigned: list[str] = []
    notes: list[str] = []

    todo_path = f"{AI}/tasks/TODO.md"
    todo_text = read(repo, todo_path) if todo_path in files else ""
    todo = Todo(todo_text, known_sprint_numbers(repo, files))

    real_sprints = {n: h for n, h in todo.sprints.items()
                    if not (re.search(r"planned", h, re.I) and "OPEN" not in h)}
    planned = sorted(set(todo.sprints) - set(real_sprints))
    open_n = max(real_sprints) if real_sprints else (todo.preamble_sprint or 0)
    if todo.preamble_sprint and not real_sprints:
        open_n = todo.preamble_sprint
    # A planned sprint above the open one is a future sprint: it keeps its own
    # tasks together and is numbered after the Post buckets. A planned sprint
    # at or below the open one has nothing to wait for: it folds into it.
    future = [n for n in planned if n > open_n]
    folded = [n for n in planned if n <= open_n]
    if folded:
        notes.append("planned sprint(s) " + ", ".join(f"S{n}" for n in folded)
                     + f" are not above the open sprint: their tasks join S{open_n:03d}")

    # --- briefs
    briefs = {}
    for f in files:
        m = re.match(rf"^{re.escape(AI)}/tasks/(TASK-(\d{{4}}))-([^/]+)\.md$", f)
        if m:
            briefs[m.group(1)] = (f, m.group(3))
    bucket_date: dict[str, tuple[str, int]] = {}
    for b, tasks in todo.buckets.items():
        dated = []
        for t in tasks:
            if t in briefs:
                d = created(read(repo, briefs[t][0]))
                if d:
                    dated.append((d, int(t[5:])))
        if dated:
            bucket_date[b] = min(dated)
        else:
            notes.append(f"bucket {b}: no task of it has a Created date; its tasks are unassigned")
    ordered_buckets = sorted(bucket_date, key=lambda b: bucket_date[b])
    bucket_sprint = {b: open_n + 1 + i for i, b in enumerate(ordered_buckets)}
    future_sprint = {n: open_n + 1 + len(ordered_buckets) + i for i, n in enumerate(future)}

    sprint_of: dict[str, int] = {}
    for t in sorted(briefs):
        head = todo.task_head.get(t)
        if head is None:
            unassigned.append(f"{briefs[t][0]}: not listed in {todo_path}")
            continue
        if head.startswith("Post-"):
            if t not in todo.task_done:
                sprint_of[t] = open_n       # open work joins the open sprint
            elif head in bucket_sprint:
                sprint_of[t] = bucket_sprint[head]
            else:
                unassigned.append(f"{briefs[t][0]}: bucket {head} has no dated task")
        elif head.startswith("S"):
            n = int(head[1:])
            sprint_of[t] = future_sprint.get(n, open_n if n in planned else n)
        else:
            unassigned.append(f"{briefs[t][0]}: listed under a heading that is no sprint")
    per_sprint: dict[int, list[str]] = defaultdict(list)
    for t, n in sprint_of.items():
        per_sprint[n].append(t)
    for n, ts in per_sprint.items():
        for i, t in enumerate(sorted(ts), 1):
            f, slug = briefs[t]
            nid = f"S{n:03d}.T{i:03d}"
            rows.append(Row("task", t, nid, f, f"{AI}/tasks/{nid}_{pascal(slug)}.md"))
    if ordered_buckets:
        notes.append("Post buckets -> " + ", ".join(
            f"{b}=S{bucket_sprint[b]:03d} (first task {bucket_date[b][0]})" for b in ordered_buckets))

    if future_sprint:
        notes.append("future sprint(s) " + ", ".join(f"S{n}=S{v:03d}" for n, v in future_sprint.items())
                     + " (planned above the open sprint; numbered after the Post buckets)")

    # --- ADRs
    for f in files:
        m = re.match(rf"^{re.escape(AI)}/decisions/(\d{{4}})-(.+\.md)$", f)
        if m:
            rows.append(Row("adr", f"ADR-{m.group(1)}", f"ADR-{m.group(1)}", f,
                            f"{AI}/decisions/ADR-{m.group(1)}-{m.group(2)}"))

    # --- reviews
    taken: set[str] = set()
    for f in sorted(files):
        m = re.match(rf"^{re.escape(AI)}/reviews/(REVIEW-\d{{4}})-(.+)\.md$", f)
        if not m:
            continue
        rid, slug = m.group(1), m.group(2)
        n = todo.closes.get(rid) or todo.title_closes.get(rid)
        if n is None:
            sm = re.match(r"sprint-s(\d+)\b", slug)
            n = int(sm.group(1)) if sm else None
        new = None
        if n is not None and 1 <= n <= open_n:
            cand = f"S{n:03d}-checkpoint"
            if cand not in taken:
                new = cand
        if new is None:
            d = first_date(read(repo, f))
            if d:
                new = f"{d}-{slug}"
        if new is None:
            unassigned.append(f"{f}: closes no named sprint and carries no date")
            continue
        taken.add(new)
        rows.append(Row("review", rid, new, f, f"{AI}/reviews/{new}.md"))

    # --- the rest of .ai/
    done = {r.old_path for r in rows}
    for f in files:
        if f in done or not f.startswith(AI + "/"):
            continue
        if posixpath.basename(f) == ".gitkeep":
            continue
        if re.match(rf"^{re.escape(AI)}/tasks/TASK-\d{{4}}-[^/]+\.md$", f):
            continue                    # a brief no sprint heading assigns: already reported
        if f in STATIC:
            stem = lambda p: posixpath.splitext(posixpath.basename(p))[0]
            rows.append(Row("file", stem(f), stem(STATIC[f]), f, STATIC[f]))
            continue
        m = re.match(rf"^{re.escape(AI)}/planning/(plans|sprints)/(.+)$", f)
        if m:
            nm = m.group(2)
            ident = posixpath.splitext(nm)[0]
            ident = re.match(r"(PLAN-\d+|SPRINT-S\d+|[^/]+)", ident).group(1)
            rows.append(Row(m.group(1)[:-1], ident, ident, f, f"{AI}/archive/{m.group(1)}/{nm}"))
            continue
        if f == todo_path or f.startswith(f"{AI}/templates/"):
            retired.append(f)
            continue
        if f in STAY_FILES or f.startswith(STAY_PREFIXES) or STAY_RE.match(f):
            continue
        if posixpath.basename(f) == ".gitkeep":
            continue
        if re.match(rf"^{re.escape(AI)}/decisions/ADR-", f):
            continue
        if f in done:
            continue
        unmapped.append(f)

    # --- collisions
    fileset = set(files)
    seen: dict[str, str] = {}
    conflicts = []
    for r in rows:
        if r.new_path in seen:
            conflicts.append(f"{r.new_path}: wanted by {seen[r.new_path]} and {r.old_path}")
        seen[r.new_path] = r.old_path
        if r.new_path in fileset and r.new_path != r.old_path:
            conflicts.append(f"{r.new_path}: already exists (wanted by {r.old_path})")
    order = {"task": 0, "adr": 1, "review": 2}
    rows.sort(key=lambda r: (order.get(r.kind, 3), r.new_id if r.kind == "task" else r.old_path))
    return dict(rows=rows, retired=sorted(retired), unmapped=sorted(unmapped),
                unassigned=unassigned, notes=notes, conflicts=conflicts,
                files=files, open_n=open_n)


# ------------------------------------------------------------ references ---

LINK_RE = re.compile(r"(\]\()(<?)([^)\s>]+)(>?)((?:\s+\"[^\"]*\")?\))")
TICK_RE = re.compile(r"`([^`\n]+)`")
BARE_RE = re.compile(rf"(?<![\w/.\-]){re.escape(AI)}/[\w\-./]*\.md(?![\w\-])")
SUFFIX_RE = re.compile(r"(?:#[^\s]*|:\d+(?:-\d+)?)$")
URL_RE = re.compile(r"^[A-Za-z][A-Za-z0-9+.\-]*:")


def rewrite_text(text: str, old_rel: str, new_rel: str, mapping: dict[str, str]):
    """Return (new_text, count). Only path references to moved files change."""
    count = 0
    old_dir, new_dir = posixpath.dirname(old_rel), posixpath.dirname(new_rel)

    def rel_target(tok: str, relative_ok: bool):
        if not tok or tok.startswith(("#", "/")) or URL_RE.match(tok):
            return None
        sm = SUFFIX_RE.search(tok)
        suffix = sm.group(0) if sm else ""
        path = tok[: len(tok) - len(suffix)]
        if not path or not (relative_ok or path.startswith(("./", "../"))):
            return None
        cand = posixpath.normpath(posixpath.join(old_dir, path))
        if cand not in mapping:
            return None
        out = posixpath.relpath(mapping[cand], new_dir or ".")
        if path.startswith("./") and not out.startswith("."):
            out = "./" + out
        return out + suffix

    def link(m):
        nonlocal count
        new = rel_target(m.group(3), True)
        if new is None:
            return m.group(0)
        count += 1
        return m.group(1) + m.group(2) + new + m.group(4) + m.group(5)

    def tick(m):
        nonlocal count
        new = rel_target(m.group(1), False)
        if new is None:
            return m.group(0)
        count += 1
        return "`" + new + "`"

    def bare(m):
        nonlocal count
        new = mapping.get(m.group(0))
        if new is None:
            return m.group(0)
        count += 1
        return new

    text = LINK_RE.sub(link, text)
    text = TICK_RE.sub(tick, text)
    text = BARE_RE.sub(bare, text)
    return text, count


def plan_rewrites(repo: str, plan: dict, moved: bool):
    mapping = {r.old_path: r.new_path for r in plan["rows"]}
    retired = set(plan["retired"])
    rev = {v: k for k, v in mapping.items()}
    out = []
    for cur in (tracked(repo) if moved else plan["files"]):
        if cur == f"{AI}/id-map.tsv":
            continue
        old = rev.get(cur, cur) if moved else cur
        if old in retired:
            continue
        new = mapping.get(old, old)
        try:
            with open(os.path.join(repo, cur), "rb") as f:
                raw = f.read()
            text = raw.decode("utf8")
        except (UnicodeDecodeError, OSError):
            continue
        new_text, n = rewrite_text(text, old, new, mapping)
        if n:
            out.append((cur if moved else new, new_text, n))
    return out


# ---------------------------------------------------------------- output ---

def id_map_text(plan: dict) -> str:
    lines = ["old_id\tnew_id\told_path\tnew_path"]
    for r in plan["rows"]:
        lines.append(f"{r.old_id}\t{r.new_id}\t{r.old_path}\t{r.new_path}")
    return "\n".join(lines) + "\n"


def report(plan: dict, rewrites, write: bool) -> None:
    print("# kind\told_id\tnew_id\told_path\tnew_path")
    for r in plan["rows"]:
        print(f"{r.kind}\t{r.old_id}\t{r.new_id}\t{r.old_path}\t{r.new_path}")
    kinds: dict[str, int] = defaultdict(int)
    for r in plan["rows"]:
        kinds[r.kind] += 1
    print()
    print("# summary" + (" (written)" if write else " (DRY RUN: nothing was changed)"))
    for k in ("task", "adr", "review", "file", "plan", "sprint"):
        if kinds.get(k):
            print(f"moved {k}: {kinds[k]}")
    print(f"moved total: {len(plan['rows'])}")
    print(f"retired (removed under --write): {len(plan['retired'])}")
    for p in plan["retired"][:10]:
        print(f"  retired\t{p}")
    if len(plan["retired"]) > 10:
        print(f"  ... {len(plan['retired']) - 10} more under {AI}/templates/")
    print(f"path references rewritten: {sum(n for _, _, n in rewrites)} in {len(rewrites)} files")
    print(f"unassigned (reported, never guessed): {len(plan['unassigned'])}")
    for u in plan["unassigned"]:
        print(f"  unassigned\t{u}")
    print(f"unmapped files under {AI}/ (left in place): {len(plan['unmapped'])}")
    for u in plan["unmapped"]:
        print(f"  unmapped\t{u}")
    print(f"conflicts: {len(plan['conflicts'])}")
    for c in plan["conflicts"]:
        print(f"  conflict\t{c}")
    for n in plan["notes"]:
        print(f"note: {n}")
    print("follow-up (TASK-0299, not done here): convert live file content "
          "(roadmap table, ad-hoc entries from backlog rows, GOALS.md ids, "
          "directory and glob references); ids in prose resolve via the id map.")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--repo", default=".", help="repository root (default: .)")
    ap.add_argument("--write", action="store_true", help="perform the migration (default: dry run)")
    ap.add_argument("--skip-unassigned", action="store_true",
                    help="with --write: leave briefs no sprint heading assigns where they are")
    ap.add_argument("--allow-dirty", action="store_true", help="with --write: allow a dirty working tree")
    a = ap.parse_args(argv)
    repo = os.path.abspath(a.repo)
    try:
        top = git(repo, "rev-parse", "--show-toplevel").strip()
        if os.path.normcase(os.path.realpath(top)) != os.path.normcase(os.path.realpath(repo)):
            raise Fail(f"--repo must be the repository root ({top})")
        plan = build_plan(repo)
        if not a.write:
            report(plan, plan_rewrites(repo, plan, moved=False), write=False)
            return 0
        if plan["conflicts"]:
            raise Fail("destination conflicts; nothing changed:\n  " + "\n  ".join(plan["conflicts"]))
        if plan["unassigned"] and not a.skip_unassigned:
            raise Fail("unassigned items; nothing changed (fix TODO.md or pass --skip-unassigned):\n  "
                       + "\n  ".join(plan["unassigned"]))
        if not a.allow_dirty and git(repo, "status", "--porcelain").strip():
            raise Fail("working tree is not clean; commit or stash first (or --allow-dirty)")
        for r in plan["rows"]:
            dest = os.path.join(repo, r.new_path)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            git(repo, "mv", "--", r.old_path, r.new_path)
        for p in plan["retired"]:
            git(repo, "rm", "-q", "-f", "--", p)
        rewrites = plan_rewrites(repo, plan, moved=True)
        for rel, text, _ in rewrites:
            with open(os.path.join(repo, rel), "w", encoding="utf8", newline="") as f:
                f.write(text)
            git(repo, "add", "--", rel)
        with open(os.path.join(repo, AI, "id-map.tsv"), "w", encoding="utf8", newline="") as f:
            f.write(id_map_text(plan))
        git(repo, "add", "--", f"{AI}/id-map.tsv")
        report(plan, rewrites, write=True)
        return 0
    except Fail as e:
        print(f"migrate-layout: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
