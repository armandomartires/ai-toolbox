"""Tests for driver.py, against a stub `opencode` and a logging `git`.

Run from anywhere:  python3 -m unittest discover -s <this dir> -v

Hermetic: a throwaway git repository per test, no network, no model. What
these prove is the driver's control flow against a MODEL of OpenCode
(stub_opencode.py). They do not prove OpenCode behaves as modelled — that is
the pilot's (SPRINT-CURRENT.md, S10.7). NOT run from tests/validate.sh.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
BINDING_DIR = os.path.dirname(HERE)
DRIVER = os.path.join(BINDING_DIR, "driver.py")
RUN_GATE = os.path.join(BINDING_DIR, "run-gate.sh")
TEMPLATE = os.path.join(BINDING_DIR, "binding.md")
REAL_GIT = shutil.which("git")

ROLES = ("preflight", "task-planner", "implementer", "gate-runner", "refuter",
         "adjudicator", "closer", "park-steward", "run-scribe")

# Strings that appear only inside the gate map's argv. If any reaches a
# prompt, rule 2 is broken.
SENTINELS = ("SENTINEL-UNIT-SWITCH", "SENTINEL-BUILD-SWITCH")

FILL = {
    "binding_name": "test-binding",
    "driver_entry": "python3 driver.py --binding binding.md --run-id RUN_ID",
    "model": "stub/model-1",
    "queue_source": "queue.txt",
    "task_file_glob": ".ai/tasks/{id}-*.md",
    "tracker_path": "TODO.md",
    "gate_map": "gates.json",
    "gate_entry_point": RUN_GATE,
    "long_gate_groups": "[build]",
    "watchdog_timeout": "60s",
    "role_timeout": "60s",
    "evidence_file": ".run/<run-id>/evidence.txt",
    "journal_file": ".run/<run-id>/journal.jsonl",
    "commit_shape": "TASK-ID: imperative subject",
    "handover_path": ".run/<run-id>/handover.md",
    "task_cap": "5",
}


def fence(obj):
    return "```json\n%s\n```" % json.dumps(obj)


def filled_binding(overrides=None):
    values = dict(FILL, **(overrides or {}))
    out = []
    with open(TEMPLATE, encoding="utf-8") as fh:
        template = fh.read()
    for line in template.split("\n"):
        m = re.match(r"^([a-z_]+): ", line)
        if m and m.group(1) in values:
            line = "%s: %s" % (m.group(1), values[m.group(1)])
        out.append(line)
    return "\n".join(out)


def preflight_ok(ids):
    return [{"text": fence({"verdict": "proceed", "branch": "master", "head": "x",
                            "porcelain": "", "tasks": [
                                {"id": i, "criteria_present": True, "sources_agree": True,
                                 "status_task_file": "planned", "status_tracker": "planned"}
                                for i in ids]})}]


def happy(ids=("TASK-0001",)):
    return {
        "preflight": preflight_ok(ids),
        "task-planner": [{"text": fence({"files": ["src/a.txt"], "reused": [],
                                         "order": ["edit"], "verification": ["unit"]})}],
        "implementer": [{"sh": ["echo change >> src/a.txt"],
                         "text": fence({"status": "done", "files_changed": ["src/a.txt"],
                                        "unsatisfied_criteria": []})}],
        "gate-runner": [{"auto": "gate-runner"}],
        "refuter": [{"text": fence({"refuted": False, "unevidenced_criteria": [],
                                    "undeclared_changes": [], "breached_invariants": []})}],
        "adjudicator": [{"text": fence({"verdict": "accept", "reasoning": "evidenced",
                                        "overrides": [], "adhoc_titles": []})}],
        "closer": [{"sh": ["git add -- src/a.txt", "git commit -q -m '{TASK}: change a'"],
                    "text": fence({"commit": "{HEAD}"})}],
        "park-steward": [{"auto": "stash"}],
        "run-scribe": [{"sh": ["mkdir -p .run/r1 && printf '# handover\\n' > .run/r1/handover.md"],
                        "text": fence({"written": ".run/r1/handover.md"})}],
    }


class Harness(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="driver-test-")
        self.repo = os.path.join(self.tmp, "repo")
        self.bin = os.path.join(self.tmp, "bin")
        self.state = os.path.join(self.tmp, "state")
        for d in (self.repo, self.bin, self.state):
            os.makedirs(d)
        for name, target in (("opencode", "stub_opencode.py"), ("git", "git_wrapper.py")):
            path = os.path.join(self.bin, name)
            with open(path, "w") as fh:
                fh.write('#!/bin/sh\nexec python3 "%s" "$@"\n' % os.path.join(HERE, target))
            os.chmod(path, 0o755)
        self.stub_log = os.path.join(self.tmp, "stub.jsonl")
        self.git_log = os.path.join(self.tmp, "git.jsonl")
        self.scenario = os.path.join(self.tmp, "scenario.json")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def make_repo(self, ids=("TASK-0001",), queue=None, binding=None, gates=None):
        r = lambda *a: subprocess.run([REAL_GIT, *a], cwd=self.repo, check=True,
                                      capture_output=True)
        r("init", "-q", "-b", "master")
        r("config", "user.email", "t@example.invalid")
        r("config", "user.name", "Test")
        files = {
            ".gitignore": ".run/\n",
            "src/a.txt": "original\n",
            "TODO.md": "".join("- [ ] %s\n" % i for i in ids),
            "queue.txt": queue if queue is not None else "".join("%s\n" % i for i in ids),
            "binding.md": binding if binding is not None else filled_binding(),
            "gates.json": json.dumps(gates or {
                "gates": {
                    "unit": {"argv": ["sh", "-c", "echo SENTINEL-UNIT-SWITCH 3 passed, 0 failed"]},
                    "build": {"argv": ["sh", "-c", "echo SENTINEL-BUILD-SWITCH built"]},
                },
                "kinds": {"default": ["unit"]},
                "long_groups": {"build": {"gates": ["build"], "paths": ["src/*"]}},
            }),
        }
        for i in ids:
            files[".ai/tasks/%s-demo.md" % i] = (
                "# %s\n\n## Acceptance criteria\n- [ ] a.txt changes\n" % i)
        for rel, body in files.items():
            path = os.path.join(self.repo, rel)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as fh:
                fh.write(body)
        r("add", "-A")
        r("commit", "-q", "-m", "fixture")

    def run_driver(self, agents, agent_list=None, extra=(), run_id="r1"):
        if agent_list is None:
            agent_list = "".join("%s (primary)\n  []\n" % r for r in ROLES)
        with open(self.scenario, "w") as fh:
            json.dump({"agent_list": agent_list, "agents": agents}, fh)
        env = dict(os.environ, PATH=self.bin + os.pathsep + os.environ["PATH"],
                   STUB_SCENARIO=self.scenario, STUB_LOG=self.stub_log,
                   STUB_STATE=self.state, GIT_LOG=self.git_log, REAL_GIT=REAL_GIT)
        env.pop("GIT_CALLER", None)
        self.proc = subprocess.run(
            [sys.executable, DRIVER, "--binding", "binding.md", "--run-id", run_id, *extra],
            cwd=self.repo, env=env, capture_output=True, text=True, timeout=300)
        return self.proc.returncode

    # -- readers --------------------------------------------------------------

    def invocations(self, role=None):
        if not os.path.exists(self.stub_log):
            return []
        with open(self.stub_log) as fh:
            rows = [json.loads(l)["argv"] for l in fh]
        rows = [a for a in rows if a[:1] == ["run"]]
        return [a for a in rows if role is None or a[a.index("--agent") + 1] == role]

    def prompt_inputs(self, argv):
        m = re.search(r"Inputs:\n```json\n(.*?)\n```", argv[-1], re.S)
        return json.loads(m.group(1))

    def journal(self, run_id="r1"):
        path = os.path.join(self.repo, ".run", run_id, "journal.jsonl")
        if not os.path.exists(path):
            return []
        with open(path) as fh:
            return [json.loads(l) for l in fh]

    def events(self, name):
        return [e for e in self.journal() if e["event"] == name]

    def driver_git(self):
        if not os.path.exists(self.git_log):
            return []
        with open(self.git_log) as fh:
            rows = [json.loads(l) for l in fh]
        return [r["argv"] for r in rows if r["caller"] == "driver"]

    def porcelain(self):
        return subprocess.run([REAL_GIT, "status", "--porcelain"], cwd=self.repo,
                              capture_output=True, text=True).stdout


class TestHappyPath(Harness):
    def test_closes_and_the_driver_issues_no_git_write(self):
        self.make_repo()
        self.assertEqual(self.run_driver(happy()), 0, self.proc.stderr)
        self.assertEqual(len(self.events("close")), 1)
        self.assertEqual(self.porcelain(), "")
        writes = [a for a in self.driver_git()
                  if a and a[0] in ("add", "commit", "push", "stash", "reset", "checkout", "clean")]
        self.assertEqual(writes, [], "the driver itself ran a git write")

    def test_no_prompt_contains_a_gate_command(self):
        self.make_repo()
        self.run_driver(happy())
        self.assertTrue(self.invocations())
        for argv in self.invocations():
            for s in SENTINELS:
                self.assertNotIn(s, argv[-1], "a gate command reached a prompt")

    def test_roles_are_told_to_read_resolved_paths_never_glob(self):
        # TASK-0092 finding 1: OpenCode's glob tool does not see dot-directories,
        # so a role that globs for .ai/tasks/ finds nothing (TASK-0095).
        self.make_repo()
        self.run_driver(happy())
        for argv in self.invocations():
            self.assertIn("never glob", argv[-1])
        pre = self.invocations("preflight")[0]
        self.assertIn(".ai/tasks/TASK-0001-demo.md", pre[-1])
        self.assertIn("already resolved", pre[-1])

    def test_every_invocation_carries_the_model(self):
        self.make_repo()
        self.run_driver(happy())
        for argv in self.invocations():
            i = argv.index("-m")
            self.assertEqual(argv[i + 1], "stub/model-1")

    def test_long_gate_runs_for_the_touched_group(self):
        self.make_repo()
        self.run_driver(happy())
        with open(os.path.join(self.repo, ".run/r1/evidence.txt")) as fh:
            evidence = fh.read()
        self.assertIn("GATE r1.long.build NAME=build STATE=PASSED", evidence)


class TestRefuterFailsClosed(Harness):
    def test_null_empty_and_unparseable_returns_are_refuted(self):
        for label, resp in (("null", {"text": None}), ("empty", {"text": ""}),
                            ("unparseable", {"text": "looks fine to me"})):
            with self.subTest(label):
                self.tearDown()
                self.setUp()
                self.make_repo()
                agents = happy()
                agents["refuter"] = [resp]
                self.run_driver(agents)
                self.assertEqual(len(self.invocations("refuter")), 1, "refuter was retried")
                adj = self.invocations("adjudicator")
                self.assertTrue(adj, "adjudication did not run")
                refutation = self.prompt_inputs(adj[0])["refutation"]
                self.assertIs(refutation["refuted"], True)
                self.assertIs(refutation.get("synthesised"), True)


class TestVerdictDispatch(Harness):
    def test_out_of_enum_verdict_is_reprompted_once_then_parked(self):
        for label, resp in (("out-of-enum", {"text": fence({"verdict": "ship-it"})}),
                            ("unparseable", {"text": "I think it is done"})):
            with self.subTest(label):
                self.tearDown()
                self.setUp()
                self.make_repo()
                agents = happy()
                agents["adjudicator"] = [resp]
                self.run_driver(agents)
                self.assertEqual(len(self.invocations("adjudicator")), 2)
                self.assertEqual(len(self.events("verdict-reprompt")), 1)
                self.assertEqual(self.events("close"), [])
                self.assertEqual(len(self.events("park")), 1)
                self.assertEqual(self.porcelain(), "", "park left a dirty tree")

    def test_retry_on_attempt_two_parks(self):
        self.make_repo()
        agents = happy()
        agents["adjudicator"] = [{"text": fence({"verdict": "retry", "reasoning": "fix it",
                                                 "overrides": [], "guidance": "fix it"})}]
        self.run_driver(agents)
        self.assertEqual(len(self.invocations("implementer")), 2)
        self.assertEqual(self.events("close"), [])
        self.assertIn("attempt 2", self.events("park")[0]["reason"])

    def test_accept_over_a_refutation_without_overrides_parks(self):
        self.make_repo()
        agents = happy()
        agents["refuter"] = [{"text": fence({"refuted": True, "unevidenced_criteria": ["a"],
                                             "undeclared_changes": [], "breached_invariants": []})}]
        self.run_driver(agents)
        self.assertEqual(self.events("close"), [])
        self.assertIn("no overrides", self.events("park")[0]["reason"])

    def test_closer_refusal_parks_and_is_not_retried(self):
        self.make_repo()
        agents = happy()
        agents["closer"] = [{"text": fence({"refused": "undeclared path x"})}]
        self.run_driver(agents)
        self.assertEqual(len(self.invocations("closer")), 1)
        self.assertIn("closer refused", self.events("park")[0]["reason"])


class TestIdentityAndPreconditions(Harness):
    FALLBACK = "Agent task-planner is a subagent, not a primary agent. Falling back to default agent"

    def test_default_agent_fallback_halts_the_run(self):
        self.make_repo()
        agents = happy()
        agents["task-planner"] = [dict(agents["task-planner"][0], stderr=self.FALLBACK)]
        self.assertEqual(self.run_driver(agents), 1)
        self.assertEqual(self.invocations("implementer"), [])
        self.assertTrue(self.events("halt"))
        self.assertTrue(os.path.exists(os.path.join(self.repo, ".run/r1/handover.md")))

    def test_subagent_in_the_agent_list_halts_before_preflight(self):
        self.make_repo()
        listing = "".join("%s (%s)\n" % (r, "subagent" if r == "refuter" else "primary")
                          for r in ROLES)
        self.assertEqual(self.run_driver(happy(), agent_list=listing), 1)
        self.assertEqual(self.invocations("preflight"), [])

    def test_dirty_tree_is_refused_before_any_role_but_the_handover(self):
        self.make_repo()
        with open(os.path.join(self.repo, "stray.txt"), "w") as fh:
            fh.write("someone else's work\n")
        self.assertEqual(self.run_driver(happy()), 1)
        roles = {a[a.index("--agent") + 1] for a in self.invocations()}
        self.assertLessEqual(roles, {"run-scribe"})
        self.assertIn("dirty", self.events("halt")[0]["reason"])

    def test_a_binding_without_a_usable_model_is_refused(self):
        for model in ("unknown", "<FILL: provider/model>", "sonnet"):
            with self.subTest(model):
                self.tearDown()
                self.setUp()
                self.make_repo(binding=filled_binding({"model": model}))
                self.assertEqual(self.run_driver(happy()), 2)
                self.assertEqual(self.invocations(), [])


class TestQueue(Harness):
    def test_unsatisfied_dependency_parks_and_skips_forward(self):
        ids = ("TASK-0001", "TASK-0002")
        self.make_repo(ids=ids, queue="TASK-0001 after=TASK-0002\nTASK-0002\n")
        self.run_driver(happy(ids))
        self.assertEqual([e["task"] for e in self.events("park")], ["TASK-0001"])
        self.assertEqual([e["task"] for e in self.events("close")], ["TASK-0002"])

    def test_gate_runner_line_not_in_evidence_is_mechanical_then_park(self):
        self.make_repo()
        agents = happy()
        agents["gate-runner"] = [{"text": fence({"gates": [
            {"handle": "TASK-0001.a1.unit", "evidence_line": "GATE made up"}]})}]
        self.run_driver(agents)
        self.assertEqual(len(self.invocations("gate-runner")), 3)
        self.assertIn("mechanical", self.events("park")[0]["reason"])

    def test_dry_run_plans_and_gates_but_never_implements(self):
        self.make_repo()
        self.assertEqual(self.run_driver(happy(), extra=("--dry-run",)), 0, self.proc.stderr)
        self.assertEqual(self.invocations("implementer"), [])
        self.assertEqual(self.invocations("closer"), [])
        self.assertEqual(len(self.events("dry-run")), 1)


class TestBindingChecker(unittest.TestCase):
    CHECKER = os.path.join(BINDING_DIR, "..", "..", "..", "scripts", "check-binding.sh")

    def check(self, path):
        return subprocess.run(["bash", self.CHECKER, path], capture_output=True, text=True)

    def test_filled_binding_passes_and_template_fails(self):
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as fh:
            fh.write(filled_binding())
        try:
            got = self.check(fh.name)
            self.assertEqual(got.returncode, 0, got.stdout)
        finally:
            os.unlink(fh.name)
        self.assertNotEqual(self.check(TEMPLATE).returncode, 0)


if __name__ == "__main__":
    unittest.main()
