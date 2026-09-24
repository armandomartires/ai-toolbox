#!/usr/bin/env python3
"""driver.py — the OpenCode driver for loops/unattended-run/loop.md.

Usage:
    python3 driver.py --binding <binding.md> --run-id <id> [--dry-run]

THIS IS A TEMPLATE. A consuming repository copies this directory, fills the
`<FILL: ...>` slots of binding.md, and runs this script from its repository
root. It carries NO RULE OF ITS OWN (ADR-0022 clause 1.2): the sequence and
its exit conditions are loops/unattended-run/loop.md's, the method and its
vocabulary are skills/unattended-ops/'s, and the permission boundaries are
the roles' in agents/. Every function below cites the loop step it
implements; a behaviour with no citation is a defect in this file.

What the driver holds, and nothing else (loop.md, "Steps"): the queue, the
bounds, the verdict dispatch and the gate command map. It never stages,
commits, stashes or pushes — those are `closer`'s and `park-steward`'s, under
their own boundaries — and it never puts a gate command string in a prompt
(rule 2, made structural: ADR-0022, "two things the port makes better").

Python >= 3.11, standard library only. NOT run from tests/validate.sh; its
tests live beside it under tests/, and nothing in this repository runs them
automatically.
"""
from __future__ import annotations

import argparse
import fnmatch
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import time

# --- Vocabulary owned elsewhere, cited here --------------------------------

# The five verdicts. skills/unattended-ops/SKILL.md owns the enum.
VERDICTS = ("accept", "retry", "park", "raise-adhoc", "halt-run")

# loop.md, "Exit conditions": 2 acceptance attempts; 3 mechanical retries.
ATTEMPT_BOUND = 2
MECHANICAL_BOUND = 3

# ADR-0022 clause 5.1: a subagent-mode role is silently replaced by the
# default agent. These are the stderr strings observed by TASK-0055 (F1).
FALLBACK_MARKERS = ("Falling back to default agent",
                    "is a subagent, not a primary agent")

# The slots templates/binding.md requires, plus the two this driver adds
# (extra slots are allowed and checked like every other — check-binding.sh).
REQUIRED_SLOTS = (
    "binding_name", "client", "driver_entry", "model", "queue_source",
    "task_file_glob", "tracker_path", "gate_map", "gate_entry_point",
    "long_gate_groups", "watchdog_timeout", "evidence_file", "journal_file",
    "run_id_source", "commit_shape", "stash_namespace", "handover_path",
    "task_cap", "roles", "steps_declared", "role_timeout",
)
ROLES = ("preflight", "task-planner", "implementer", "gate-runner", "refuter",
         "adjudicator", "closer", "park-steward", "run-scribe")

# A task-file log entry about the commit or the push, as the closer writes
# one: "- Commit: ...", "**Push**: ..." (B-031, TASK-0099).
LOG_ENTRY = re.compile(r"^[\s>*-]*(commit|push)\**\s*:", re.I)

GATE_LINE = re.compile(r"^GATE (?P<handle>\S+) NAME=(?P<name>\S+) "
                       r"STATE=(?P<state>[A-Z]+) EXIT=(?P<exit>-?\d+) "
                       r"ELAPSED=(?P<elapsed>\d+)s LOG=(?P<log>.*)$")


class Halt(Exception):
    """The run ends (loop.md, `halt-run` and preflight halts); step 14 runs."""


class Park(Exception):
    """This task is parked with a stated reason (loop.md, step 11)."""


class Mechanical(Exception):
    """A step failed mechanically (loop.md, "A step fails mechanically")."""


# --- Binding ---------------------------------------------------------------

def parse_frontmatter(path):
    """Read the binding's frontmatter: flat slots and one level of mapping.

    A deliberately small subset — the shape templates/binding.md uses. The
    authoritative completeness check is scripts/check-binding.sh; this parser
    only reads values, and refuses what it cannot read rather than guessing.
    """
    with open(path, encoding="utf-8") as fh:
        lines = fh.read().split("\n")
    if not lines or lines[0].strip() != "---":
        raise Halt("binding %s has no frontmatter" % path)
    end = next((i for i, l in enumerate(lines[1:], 1) if l.strip() == "---"),
               None)
    if end is None:
        raise Halt("binding %s frontmatter is not terminated" % path)
    out, current = {}, None
    for raw in lines[1:end]:
        line = re.sub(r"\s+#.*$", "", raw) if not raw.lstrip().startswith("#") else ""
        if not line.strip():
            continue
        m = re.match(r"^(\s*)([^:]+?):\s*(.*)$", line)
        if not m:
            raise Halt("binding %s: unreadable line %r" % (path, raw))
        indent, key, value = len(m.group(1)), m.group(2).strip(), m.group(3).strip()
        value = value[1:-1] if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'" else value
        if indent == 0:
            if key in out:
                raise Halt("binding %s declares %s twice" % (path, key))
            out[key] = value if value else {}
            current = key if not value else None
        elif current is not None:
            out[current][key] = value
        else:
            raise Halt("binding %s: nested line %r under a scalar" % (path, raw))
    return out


def bad_value(v):
    """Blank, `unknown` or a `<FILL: ...>` placeholder: not an answer."""
    if isinstance(v, dict):
        return not v
    s = v.strip()
    return s == "" or s.lower() == "unknown" or (s.startswith("<") and s.endswith(">"))


def duration(text):
    """`90m`, `600s`, `2h` -> seconds. Anything else is unreadable: a stop."""
    m = re.fullmatch(r"\s*(\d+)\s*([smh])\s*", text or "")
    if not m:
        raise Halt("unreadable duration %r (expected e.g. 90m)" % text)
    return int(m.group(1)) * {"s": 1, "m": 60, "h": 3600}[m.group(2)]


class Binding:
    def __init__(self, path, run_id):
        self.path = os.path.abspath(path)
        fm = parse_frontmatter(path)
        missing = [s for s in REQUIRED_SLOTS if s not in fm]
        bad = [s for s in REQUIRED_SLOTS if s in fm and bad_value(fm[s])]
        for sub in ("roles", "steps_declared"):
            if isinstance(fm.get(sub), dict):
                bad += ["%s.%s" % (sub, k) for k, v in fm[sub].items() if bad_value(v)]
        if missing or bad:
            # templates/binding.md: every unfilled slot reads unknown, and
            # unknown is a stop.
            raise Halt("binding not usable — missing: %s; unanswered: %s"
                       % (", ".join(missing) or "none", ", ".join(bad) or "none"))
        if fm["client"] != "opencode":
            raise Halt("binding client is %r; this driver is the OpenCode one"
                       % fm["client"])
        if not re.fullmatch(r"[^/\s]+/\S+", fm["model"]):
            # ADR-0022 clause 5.3: no explicit model -> opencode run hangs.
            raise Halt("model %r is not provider/model" % fm["model"])
        self.fm = fm
        self.run_id = run_id
        sub = lambda v: v.replace("<run-id>", run_id)
        self.model = fm["model"]
        self.queue_file = fm["queue_source"]
        self.task_glob = fm["task_file_glob"]
        self.tracker = fm["tracker_path"]
        self.gate_map_path = os.path.abspath(fm["gate_map"])
        self.entry = os.path.abspath(fm["gate_entry_point"])
        self.watchdog = duration(fm["watchdog_timeout"])
        self.role_timeout = duration(fm["role_timeout"])
        self.evidence = os.path.abspath(sub(fm["evidence_file"]))
        self.journal_path = os.path.abspath(sub(fm["journal_file"]))
        self.handover = os.path.abspath(sub(fm["handover_path"]))
        self.commit_shape = fm["commit_shape"]
        self.stash_namespace = fm["stash_namespace"]
        self.task_cap = int(fm["task_cap"])
        groups = fm["long_gate_groups"]
        self.long_groups = ([] if groups == "not-applicable" else
                            [g.strip() for g in groups.strip("[]").split(",") if g.strip()])
        self.roles = {}
        for role in ROLES:
            spec = fm["roles"].get(role)
            if not spec:
                raise Halt("binding names no agent for role %s" % role)
            name, _, mode = (p.strip() for p in spec.partition(","))
            if mode != "primary":
                # ADR-0022 clause 5.1.
                raise Halt("role %s is declared %r, not primary" % (role, mode))
            self.roles[role] = name
        repo = os.path.realpath(os.getcwd())
        if os.path.commonpath([os.path.realpath(self.gate_map_path), repo]) == repo:
            # Rule 2 against the filesystem, not only the prompts (B-030,
            # TASK-0098): a role with `read` opened a map inside the worktree
            # (TASK-0092 finding 10). Every role declares worktree-only, so a
            # map outside the repository is one no role can read.
            raise Halt("gate map %s is inside the repository, where any role with "
                       "`read` can open its commands; keep it outside" % self.gate_map_path)
        with open(self.gate_map_path, encoding="utf-8") as fh:
            self.gate_map = json.load(fh)


# --- The driver ------------------------------------------------------------

class Driver:
    def __init__(self, binding, dry_run=False):
        self.b = binding
        self.dry_run = dry_run
        self.repo = os.getcwd()
        self.opencode = shutil.which("opencode")
        self.closed, self.parked, self.adhoc, self.overrides = [], [], [], []
        self.halted = None
        self.agent_lines = {}
        self.start_head = None
        self.upstream = None

    # -- plumbing -----------------------------------------------------------

    def sh(self, argv, timeout=120, env=None):
        """Run a read-only helper command. Never a git write (see module doc)."""
        return subprocess.run(argv, cwd=self.repo, capture_output=True,
                              text=True, timeout=timeout, env=env)

    def git(self, *args):
        return self.sh(["git", *args]).stdout.strip()

    def porcelain(self):
        return self.sh(["git", "status", "--porcelain"]).stdout

    def journal(self, event, **fields):
        """Step 12 — one appended line per event, never truncated."""
        os.makedirs(os.path.dirname(self.b.journal_path), exist_ok=True)
        rec = {"run": self.b.run_id, "t": int(time.time()), "event": event, **fields}
        with open(self.b.journal_path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec, sort_keys=True) + "\n")

    def invoke(self, role, prompt):
        """Run one role via `opencode run`, returning its final message text.

        Extraction per references/return-schemas.md (F2): newline-delimited
        JSON, final message at part.text where type == "text", raw stdout as
        the fallback. The agent-identity check is ADR-0022 clause 5.1.
        """
        if not self.opencode:
            raise Mechanical("opencode is not on PATH")
        argv = [self.opencode, "run", "--agent", self.b.roles[role],
                "-m", self.b.model, "--format", "json", prompt]
        try:
            proc = subprocess.run(argv, cwd=self.repo, capture_output=True,
                                  text=True, timeout=self.b.role_timeout)
        except subprocess.TimeoutExpired:
            raise Mechanical("%s did not return within %ss" % (role, self.b.role_timeout))
        if any(m in proc.stderr for m in FALLBACK_MARKERS):
            # Not retried: the wrong agent will answer every time.
            raise Halt("role %s was not run as agent %r — OpenCode fell back to "
                       "the default agent (ADR-0022 clause 5.1)" % (role, self.b.roles[role]))
        if proc.returncode != 0:
            raise Mechanical("%s exited %d: %s" % (role, proc.returncode, proc.stderr.strip()[:200]))
        texts, denied, parsed_any = [], [], False
        for line in proc.stdout.splitlines():
            try:
                ev = json.loads(line)
            except ValueError:
                continue
            parsed_any = True
            part = ev.get("part") or {}
            if ev.get("type") == "text" and isinstance(part.get("text"), str):
                texts.append(part["text"])
            if ev.get("type") == "tool_use" and (part.get("state") or {}).get("status") == "error":
                denied.append(part.get("tool", "?"))
        if denied:
            self.journal("tool-denied", role=role, tools=denied)
        return "\n".join(texts) if parsed_any else proc.stdout

    def ask(self, role, prompt, validate=None):
        """invoke() under the mechanical bound, returning the parsed object or None.

        `validate`, when given, raises Mechanical on a return the step cannot
        use; that counts against the same bound (loop.md, "A step fails
        mechanically"). Roles whose missing return has a defined safe value —
        preflight, refuter, adjudicator — pass none.
        """
        last = None
        for attempt in range(1, MECHANICAL_BOUND + 1):
            try:
                got = extract_json(self.invoke(role, prompt))
                if validate:
                    validate(got)
                return got
            except Mechanical as exc:
                last = exc
                self.journal("mechanical-retry", role=role, attempt=attempt, error=str(exc))
        raise Mechanical("%s failed %d times: %s" % (role, MECHANICAL_BOUND, last))

    # -- steps 1-3 ------------------------------------------------------------

    def step1_preflight_repo(self):
        """Step 1 — one writer, an explicit model, every role primary."""
        dirty = self.porcelain()
        if dirty:
            # Rule 5; loop.md step 1: any dirty path is a halt naming it.
            raise Halt("working tree is dirty:\n" + dirty)
        if not self.opencode:
            raise Halt("opencode is not on PATH")
        for p in (self.b.evidence, self.b.journal_path, self.b.handover):
            rel = os.path.relpath(p, self.repo)
            if not rel.startswith("..") and self.sh(["git", "check-ignore", "-q", rel]).returncode != 0:
                # Otherwise the run's own record dirties the tree the closer
                # re-checks (loop.md step 10) and every close refuses.
                raise Halt("run file %s is inside the repository and not ignored" % rel)
        listing = self.sh([self.opencode, "agent", "list"]).stdout
        modes = dict(re.findall(r"^(\S+) \((\w+)\)\s*$", listing, re.M))
        for role, name in self.b.roles.items():
            if modes.get(name) != "primary":
                raise Halt("agent %r for role %s is %s in `opencode agent list`, not "
                           "primary (ADR-0022 clause 5.1)" % (name, role, modes.get(name, "absent")))
            # Kept verbatim for preflight: an absent check is not a passed
            # check, so the role is handed the evidence (TASK-0096).
            self.agent_lines[role] = "%s (%s)" % (name, modes[name])
        self.start_head = self.git("rev-parse", "--short", "HEAD")
        up = self.sh(["git", "rev-parse", "--verify", "-q", "@{upstream}"])
        self.upstream = up.stdout.strip() if up.returncode == 0 else None

    def read_queue(self):
        queue = []
        with open(self.b.queue_file, encoding="utf-8") as fh:
            for raw in fh:
                line = raw.split("#", 1)[0].strip()
                if not line:
                    continue
                parts = line.split()
                task = {"id": parts[0], "kind": "default", "after": []}
                for p in parts[1:]:
                    k, _, v = p.partition("=")
                    if k == "kind":
                        task["kind"] = v
                    elif k == "after":
                        task["after"] = [x for x in v.split(",") if x]
                    else:
                        raise Halt("queue line %r: unknown field %r" % (line, p))
                queue.append(task)
        return queue[: self.b.task_cap]

    def step2_locks(self, queue):
        """Step 2 — exactly one committed task file per task (ADR-0022 clause 3)."""
        for task in queue:
            hits = glob.glob(self.b.task_glob.replace("{id}", task["id"]))
            if len(hits) != 1:
                raise Halt("task %s: task_file_glob matches %d files" % (task["id"], len(hits)))
            if self.sh(["git", "ls-files", "--error-unmatch", hits[0]]).returncode != 0:
                raise Halt("task %s: %s is not committed — the commit is the lock" % (task["id"], hits[0]))
            if task["kind"] not in self.b.gate_map.get("kinds", {}):
                raise Halt("task %s: kind %r has no entry in the gate map" % (task["id"], task["kind"]))
            task["file"] = hits[0]
        verdict = self.ask("preflight", prompt(
            "preflight", "Steps 1 and 2 of loops/unattended-run/loop.md. Establish one "
            "writer and verify the lock on every queued task. The driver has already "
            "resolved each task's file to exactly one committed match: read each at its "
            "given path, and report whether its acceptance criteria are present and its "
            "status, read verbatim from both the task file and the tracker.",
            {"tasks": [{"id": t["id"], "file": t["file"]} for t in queue],
             "tracker": self.b.tracker,
             # Step 1's structural checks, run by the driver before this call
             # (ADR-0022 clauses 5.1, 5.3), handed over as evidence (TASK-0096).
             "driver_checks": {
                 "model": self.b.model,
                 "model_passed_as": "-m on every opencode run call this run makes",
                 "agent_list": self.agent_lines,
                 "agent_list_source": "`opencode agent list`, read by the driver at step 1"}},
            '{"verdict": "proceed" | "halt", "branch": "...", "head": "...", '
            '"porcelain": "<verbatim>", "tasks": [{"id": "...", "criteria_present": true, '
            '"status_task_file": "<verbatim>", "status_tracker": "<verbatim>", '
            '"sources_agree": true}], "reason": "..."}'))
        # return-schemas.md: a missing or unparseable preflight is `halt`,
        # never retried.
        if not isinstance(verdict, dict) or verdict.get("verdict") != "proceed":
            raise Halt("preflight did not return proceed: %r" % (verdict,))
        for t in verdict.get("tasks") or []:
            if t.get("criteria_present") is not True or t.get("sources_agree") is not True:
                # Step 2's disagreement threshold, set to zero in binding.md.
                raise Halt("preflight: task %s lock not verified: %r" % (t.get("id"), t))
        if {t.get("id") for t in verdict.get("tasks") or []} != {t["id"] for t in queue}:
            raise Halt("preflight did not report every queued task")

    def step3_open(self, queue):
        """Step 3 — one journal line before any task is touched."""
        self.journal("run-start", start_head=self.start_head, dry_run=self.dry_run,
                     queue=[t["id"] for t in queue])

    # -- the per-task cycle, steps 4-11 --------------------------------------

    def step4_deps(self, task):
        """Step 4 — a dependency named with after= must have closed in this run."""
        closed = {c["id"] for c in self.closed}
        blockers = [d for d in task["after"] if d not in closed]
        if blockers:
            raise Park("dependency not satisfied: " + ", ".join(blockers))

    def step5_plan(self, task, guidance):
        """Step 5 — task-planner, read-only."""
        plan = self.ask("task-planner", prompt(
            "task-planner", "Step 5. Plan task %s from its task file, which is the "
            "specification. Scope comes from the task file." % task["id"],
            {"task_file": task["file"], "retry_guidance": guidance},
            '{"files": ["..."], "reused": ["..."], "order": ["..."], "verification": ["..."]}'),
            validate=lambda got: None if isinstance(got, dict) and got.get("files")
            else fail("task-planner returned no usable plan"))
        return plan

    def step6_implement(self, task, plan):
        """Step 6 — implementer. A missing return is `blocked` (return-schemas.md)."""
        report = self.ask("implementer", prompt(
            "implementer", "Step 6. Implement task %s against the plan. Leave the change "
            "in the working tree." % task["id"],
            {"task_file": task["file"], "plan": plan},
            '{"status": "done" | "blocked", "files_changed": ["..."], '
            '"unsatisfied_criteria": ["..."], "reason": "..."}'))
        if not isinstance(report, dict) or report.get("status") != "done":
            raise Park("implementer blocked: %s" % (
                report.get("reason") if isinstance(report, dict) else "no parseable return"))
        return report

    def run_gate(self, handle, gate):
        """Invoke the one entry point and poll it (references/long-gates.md).

        The driver, not an agent, runs this — rule 2 is structural. The gate's
        own evidence line must then be in the evidence file, or it did not run
        (references/evidence.md).
        """
        env = dict(os.environ, GATE_MAP=self.b.gate_map_path, GATE_REPO_ROOT=self.repo,
                   GATE_RUN_ROOT=os.path.dirname(self.b.evidence),
                   EVIDENCE_FILE=self.b.evidence,
                   GATE_TIMEOUT_SECONDS=str(self.b.watchdog))
        os.makedirs(os.path.dirname(self.b.evidence), exist_ok=True)
        self.sh([self.b.entry, "start", handle, gate], env=env)
        deadline = time.time() + self.b.watchdog + 120
        while True:
            proc = self.sh([self.b.entry, "wait", handle, "60"], timeout=180, env=env)
            if proc.returncode != 2 or time.time() > deadline:
                break
        line = proc.stdout.strip().splitlines()[-1] if proc.stdout.strip() else ""
        m = GATE_LINE.match(line)
        state = m.group("state") if m else "MISSING"
        try:
            with open(self.b.evidence, encoding="utf-8") as fh:
                recorded = any(l.startswith("GATE %s " % handle) for l in fh)
        except OSError:
            recorded = False
        self.journal("gate", handle=handle, gate=gate, state=state, recorded=recorded)
        return {"handle": handle, "gate": gate, "state": state if recorded else "NOT-RUN"}

    def step7_gates(self, task, attempt):
        """Step 7 — the map's gates for this task's kind, then gate-runner reads them."""
        results = [self.run_gate("%s.a%d.%s" % (task["id"], attempt, g), g)
                   for g in self.b.gate_map["kinds"][task["kind"]]]
        report = self.gate_report(results, task["file"])
        return {"results": results, "report": report}

    def gate_report(self, results, task_file):
        """gate-runner reports from the evidence file; it is handed no command."""
        def check(report):
            with open(self.b.evidence, encoding="utf-8") as fh:
                evidence = fh.read().splitlines()
            rows = report.get("gates") if isinstance(report, dict) else None
            if not isinstance(rows, list) or len(rows) != len(results):
                fail("gate-runner did not report every gate")
            for row in rows:
                # evidence.md: a line not in the evidence file is not evidence.
                if not isinstance(row, dict) or row.get("evidence_line") not in evidence:
                    fail("gate-runner reported a line not in the evidence file: %r" % (row,))
        report = self.ask("gate-runner", prompt(
            "gate-runner", "Steps 7/13. Report each gate below from the run's evidence file. "
            "You are a runner, not a judge. Quote every line and figure verbatim.",
            {"evidence_file": self.b.evidence, "gates": [r["handle"] for r in results],
             "task_file": task_file},
            '{"gates": [{"handle": "...", "state": "...", "exit": 0, "elapsed": "...", '
            '"evidence_line": "<verbatim>", "figures": ["<verbatim>"]}]}'), validate=check)
        return report["gates"]

    def step8_refute(self, task, impl, gates):
        """Step 8 — a null, empty or unparseable return is refuted: true."""
        try:
            got = self.ask("refuter", prompt(
                "refuter", "Step 8. Try to refute the claim that task %s is complete. "
                "Uncertain means refuted: true." % task["id"],
                {"task_file": task["file"], "diff_base": self.git("rev-parse", "--short", "HEAD"),
                 "implementer_report": impl, "evidence_file": self.b.evidence,
                 "gate_reports": gates["report"]},
                '{"refuted": true | false, "unevidenced_criteria": [], '
                '"undeclared_changes": [], "breached_invariants": []}'))
        except Mechanical as exc:
            got = None
            self.journal("refuter-mechanical", task=task["id"], error=str(exc))
        lists = ("unevidenced_criteria", "undeclared_changes", "breached_invariants")
        if not isinstance(got, dict) or not isinstance(got.get("refuted"), bool):
            # references/return-schemas.md, "The null refuter": synthesised by
            # the driver, not retried, and carried into adjudication.
            self.journal("refuter-synthesised", task=task["id"], raw=repr(got)[:300])
            return {"refuted": True, "synthesised": True,
                    "reason": "no parseable refutation was returned",
                    **{k: [] for k in lists}}
        if any(got.get(k) for k in lists):
            got["refuted"] = True   # loop.md step 8: true when any list is non-empty
        return got

    def step9_adjudicate(self, task, attempt, impl, gates, refutation):
        """Step 9 — exactly one verdict; unparseable or out-of-enum -> park."""
        body = prompt(
            "adjudicator", "Step 9. Decide what happens to task %s, attempt %d of %d. "
            "retry is available on attempt 1 only." % (task["id"], attempt, ATTEMPT_BOUND),
            {"task_file": task["file"], "implementer_report": impl,
             "gate_reports": gates["report"], "refutation": refutation},
            '{"verdict": "accept" | "retry" | "park" | "raise-adhoc" | "halt-run", '
            '"reasoning": "...", "overrides": [{"finding": "...", "reason": "..."}], '
            '"adhoc_titles": ["<title only, no identifier>"], "guidance": "..."}')
        for ask_no in (1, 2):
            try:
                got = self.ask("adjudicator", body)
            except Mechanical:
                got = None
            if isinstance(got, dict) and got.get("verdict") in VERDICTS:
                break
            self.journal("verdict-unparseable", task=task["id"], ask=ask_no, raw=repr(got)[:300])
            got = None
            if ask_no == 1:
                self.journal("verdict-reprompt", task=task["id"])
        if got is None:
            return {"verdict": "park", "reason": "no verdict within the five after one reprompt"}
        overrides = got.get("overrides") or []
        self.overrides += [{"task": task["id"], **o} for o in overrides if isinstance(o, dict)]
        self.adhoc += [t for t in got.get("adhoc_titles") or [] if isinstance(t, str)]
        self.journal("adjudication", task=task["id"], attempt=attempt,
                     verdict=got["verdict"], overrides=overrides)
        if got["verdict"] == "accept" and refutation.get("refuted") and not overrides:
            # references/verdicts.md: accept requires every objection answered
            # or explicitly overridden; an unnamed override is no override.
            return {"verdict": "park", "reason": "accept over a refutation with no overrides listed"}
        if got["verdict"] == "retry" and attempt >= ATTEMPT_BOUND:
            return {"verdict": "park", "reason": "retry is not available on attempt %d" % attempt}
        return got

    def step10_close(self, task, impl):
        """Step 10 — closer stages, commits and reports; the driver verifies."""
        before = self.git("rev-parse", "HEAD")
        declared = sorted(set(impl.get("files_changed", []) + [task["file"]] + (
            [] if self.b.tracker == "not-applicable" else [self.b.tracker])))
        got = self.ask("closer", prompt(
            "closer", "Step 10. Close task %s: re-check the porcelain against the declared "
            "paths, update the task file and the tracker row from the evidence file, stage "
            "each path with `git add -- <path>`, commit, report the hash. Push nothing. The "
            "task file's Commit and Push entries are log_lines, written verbatim: a commit "
            "cannot contain its own hash, and landing records it." % task["id"],
            {"task_file": task["file"], "tracker": self.b.tracker,
             "declared_paths": declared, "log_lines": self.log_lines(),
             "evidence_file": self.b.evidence, "commit_shape": self.b.commit_shape},
            '{"commit": "<hash>"} or {"refused": "<what was found>"}'))
        after = self.git("rev-parse", "HEAD")
        if isinstance(got, dict) and got.get("refused"):
            # loop.md: a refusal is the boundary working — park, never retry.
            if after != before:
                raise Halt("closer refused but HEAD moved %s -> %s" % (before, after))
            raise Park("closer refused: %s" % got["refused"])
        if after == before:
            raise Park("closer returned %r and made no commit" % (got,))
        claimed = got.get("commit") if isinstance(got, dict) else None
        resolved = self.sh(["git", "rev-parse", "--verify", "-q",
                            "%s^{commit}" % claimed]).stdout.strip() if claimed else ""
        parent = self.git("rev-parse", "HEAD~1")
        if (resolved != after or parent != before or self.porcelain()
                or task["id"] not in self.git("log", "-1", "--format=%B")):
            # The commit exists but does not verify: the state is unknown and
            # a human is needed (loop.md, "Never treat as authorization").
            # The task id in the message is what loop.md step 12's
            # `git log --grep <task id>` resume guard reads.
            raise Halt("closer's commit for %s does not verify (claimed %r, HEAD %s)"
                       % (task["id"], claimed, after))
        files = [f for f in self.git("show", "--name-only", "--format=", "HEAD").split("\n") if f]
        undeclared = sorted(set(files) - set(declared))
        if undeclared:
            # The closer's glob boundary admits `git add -- .` (TASK-0092
            # finding 18; TASK-0083), so the commit's contents are checked
            # here. The commit exists, and undoing it is a history rewrite,
            # which is the human's (loop.md, "Escalate without retrying").
            raise Halt("closer's commit for %s contains undeclared paths: %s"
                       % (task["id"], ", ".join(undeclared)))
        added = [l[1:] for l in self.git("show", "--format=", "--unified=0", "HEAD", "--",
                                         task["file"]).split("\n")
                 if l.startswith("+") and not l.startswith("+++")]
        entries = [l.strip().lstrip("-*> ").strip() for l in added if LOG_ENTRY.match(l)]
        unexpected = [e for e in entries if e not in self.log_lines()]
        unwritten = [e for e in self.log_lines() if entries.count(e) != 1]
        if unexpected or unwritten:
            # The closer's word about its own commit is checked, not trusted
            # (TASK-0092 finding 17: it claimed a follow-up commit it never
            # made). Halt, not park: the commit already exists.
            raise Halt("closer's log entries in %s do not verify — unexpected: %s; "
                       "placeholder not written exactly once: %s"
                       % (task["file"], unexpected or "none", unwritten or "none"))
        self.closed.append({"id": task["id"], "commit": after[:12], "files": files})
        self.journal("close", task=task["id"], commit=after[:12])

    def log_lines(self):
        """The closer's Commit and Push entries, fixed (B-031, TASK-0099).

        The hash is landing's: a commit cannot hold its own, and a rebase at
        landing changes it anyway (TASK-0092: d80d843 landed as 57dbd49).
        """
        return ["Commit: pending \u2014 recorded at landing (run %s)" % self.b.run_id,
                "Push: not taken \u2014 the run pushes nothing"]

    def step11_park(self, task, reason):
        """Step 11 — park-steward stashes; the driver checks the tree is clean."""
        self.parked.append({"id": task["id"], "reason": reason})
        message = (self.b.stash_namespace.replace("<run-id>", self.b.run_id)
                   .replace("<task-id>", task["id"]) + " " + reason)
        if not self.porcelain():
            self.journal("park", task=task["id"], reason=reason, stash=None)
            return
        try:
            got = self.ask("park-steward", prompt(
                "park-steward", "Step 11. Stash every uncommitted change, untracked files "
                "included (`git stash push -u -m <message>`). Never discard anything.",
                {"stash_message": message}, '{"porcelain": "<verbatim, empty>", '
                '"stash_entry": "...", "paths": ["..."]}'))
        except Mechanical as exc:
            got = {"error": str(exc)}
        if self.porcelain() or message not in self.git("stash", "list"):
            # return-schemas.md: if the tree cannot be made clean the run
            # cannot safely continue.
            raise Halt("park of %s did not leave a clean tree behind a named stash: %r"
                       % (task["id"], got))
        self.journal("park", task=task["id"], reason=reason, stash=message,
                     paths=got.get("paths") if isinstance(got, dict) else None)

    def cycle(self, task):
        """Steps 4-11 for one task. Returns normally, or raises Halt."""
        try:
            self.step4_deps(task)
            guidance = None
            for attempt in range(1, ATTEMPT_BOUND + 1):
                plan = self.step5_plan(task, guidance)
                if self.dry_run:
                    gates = self.step7_gates(task, attempt)
                    self.journal("dry-run", task=task["id"], plan=plan,
                                 gates=[g["state"] for g in gates["results"]])
                    return
                impl = self.step6_implement(task, plan)
                gates = self.step7_gates(task, attempt)
                refutation = self.step8_refute(task, impl, gates)
                verdict = self.step9_adjudicate(task, attempt, impl, gates, refutation)
                v = verdict["verdict"]
                if v == "accept":
                    self.step10_close(task, impl)
                    return
                if v == "halt-run":
                    self.halted = "adjudicator halt-run on %s: %s" % (task["id"], verdict.get("reasoning"))
                    self.step11_park(task, "halt-run")
                    raise Halt(self.halted)
                if v == "retry":
                    guidance = verdict.get("guidance") or verdict.get("reasoning")
                    self.journal("retry", task=task["id"], attempt=attempt)
                    continue
                if v == "raise-adhoc":
                    # verdicts.md: orthogonal to done/not done; the task is not
                    # closed on it, so it parks with the titles recorded.
                    raise Park("raise-adhoc: " + "; ".join(verdict.get("adhoc_titles") or []))
                raise Park(verdict.get("reason") or verdict.get("reasoning") or "park")
            raise Park("attempt bound %d reached" % ATTEMPT_BOUND)
        except Park as exc:
            self.step11_park(task, str(exc))
        except Mechanical as exc:
            self.step11_park(task, "mechanical failure: %s" % exc)

    # -- steps 13-14 ----------------------------------------------------------

    def step13_long_gates(self):
        """Step 13 — once per touched group, one at a time, one timeout retry."""
        groups = self.b.gate_map.get("long_groups", {})
        files = [f for c in self.closed for f in c["files"]]
        for name in self.b.long_groups:
            group = groups.get(name)
            if group is None:
                self.journal("long-gate-missing", group=name)
                continue
            if not any(fnmatch.fnmatch(f, pat) for f in files for pat in group.get("paths", [])):
                continue
            for gate in group.get("gates", []):
                result = self.run_gate("%s.long.%s" % (self.b.run_id, gate), gate)
                if result["state"] == "TIMEOUT":
                    result = self.run_gate("%s.long.%s.retry" % (self.b.run_id, gate), gate)
                try:
                    self.gate_report([result], None)
                except Mechanical as exc:
                    self.journal("long-gate-report-failed", gate=gate, error=str(exc))

    def step14_handover(self):
        """Step 14 — run-scribe re-derives the handover; runs even on a halt."""
        os.makedirs(os.path.dirname(self.b.handover), exist_ok=True)
        facts = {"journal_file": self.b.journal_path, "evidence_file": self.b.evidence,
                 "handover_path": self.b.handover, "start_head": self.start_head,
                 "halted": self.halted}
        try:
            self.ask("run-scribe", prompt(
                "run-scribe", "Step 14. Re-derive the handover from the journal and the "
                "evidence file — not from this message — and write it to handover_path.",
                facts, '{"written": "<path>"}'))
        except Mechanical as exc:
            self.journal("handover-mechanical", error=str(exc))
        if not (os.path.exists(self.b.handover) and os.path.getsize(self.b.handover)):
            # A halted run with no handover is indistinguishable from a
            # crashed one (loop.md step 14). The fallback is labelled as such.
            with open(self.b.handover, "w", encoding="utf-8") as fh:
                fh.write("# Handover (MECHANICAL FALLBACK — run-scribe did not write one)\n\n")
                fh.write("git status --porcelain:\n```\n%s```\n\n" % self.porcelain())
                if self.start_head:
                    fh.write("git log since start:\n```\n%s\n```\n\n" % self.git(
                        "log", "--oneline", "%s..HEAD" % self.start_head))
                fh.write("Closed: %s\n\nParked: %s\n\nHalted: %s\n\n" % (
                    json.dumps(self.closed), json.dumps(self.parked), self.halted))
                fh.write("Push: NOT TAKEN — merge and push are the human's.\n")

    def run(self):
        try:
            self.step1_preflight_repo()
            queue = self.read_queue()
            self.step2_locks(queue)
            self.step3_open(queue)
            for task in queue:
                self.cycle(task)
            if not self.dry_run:
                self.step13_long_gates()
        except Halt as exc:
            self.halted = self.halted or str(exc)
            self.journal("halt", reason=self.halted)
        finally:
            if self.upstream is not None:
                up = self.sh(["git", "rev-parse", "--verify", "-q", "@{upstream}"]).stdout.strip()
                if up != self.upstream:
                    self.halted = (self.halted or "") + " | upstream moved during the run"
                    self.journal("upstream-moved", before=self.upstream, after=up)
            self.journal("run-end", closed=[c["id"] for c in self.closed],
                         parked=[p["id"] for p in self.parked], halted=self.halted,
                         adhoc_titles=self.adhoc, overrides=self.overrides, pushed=False)
            self.step14_handover()
        return 1 if self.halted else 0


# --- Prompt and return helpers ---------------------------------------------

def fail(message):
    raise Mechanical(message)


def prompt(role, instruction, inputs, shape):
    """The one prompt shape. Inputs are paths and reports — never a gate command."""
    # Paths are read, never globbed for: OpenCode's glob tool does not see
    # dot-directories such as .ai/, so a globbed task file reads as absent
    # (TASK-0092 finding 1, TASK-0095).
    return ("You are the %s role of an unattended run (loops/unattended-run/loop.md; "
            "your boundary and duties are in your agent definition). %s\n\n"
            "Every path in the inputs below is exact: read it directly, and never glob "
            "or list a directory to find it — the glob tool does not see directories "
            "whose names start with a dot, such as .ai/.\n\n"
            "Inputs:\n```json\n%s\n```\n\n"
            "End your reply with exactly one JSON object in a ```json fenced block, shaped:\n%s\n"
            % (role, instruction, json.dumps(inputs, indent=2, sort_keys=True), shape))


def extract_json(text):
    """The last parseable JSON object in a role's final message, or None."""
    if not text or not text.strip():
        return None
    for block in reversed(re.findall(r"```(?:json)?\s*\n(.*?)```", text, re.S)):
        try:
            got = json.loads(block)
            if isinstance(got, dict):
                return got
        except ValueError:
            pass
    try:
        got = json.loads(text.strip())
        return got if isinstance(got, dict) else None
    except ValueError:
        return None


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--binding", required=True)
    ap.add_argument("--run-id", required=True)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    if not re.fullmatch(r"[A-Za-z0-9._-]+", args.run_id):
        print("REFUSED: run id %r is not [A-Za-z0-9._-]+" % args.run_id, file=sys.stderr)
        return 2
    try:
        binding = Binding(args.binding, args.run_id)
    except (Halt, OSError, ValueError) as exc:
        print("REFUSED: %s" % exc, file=sys.stderr)
        return 2
    code = Driver(binding, dry_run=args.dry_run).run()
    print("handover: %s" % binding.handover)
    return code


if __name__ == "__main__":
    sys.exit(main())
