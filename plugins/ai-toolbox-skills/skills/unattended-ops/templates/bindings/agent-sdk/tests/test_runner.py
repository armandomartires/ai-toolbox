"""Tests for runner.py, against a stub `claude_agent_sdk` and a logging `git`.

Run from anywhere:  python3 -m unittest discover -s <this dir> -v

Hermetic: a throwaway git repository per test, no network, no model, no SDK
installed (tests/stub_sdk/ is put on the path instead). They reuse the
OpenCode binding's harness and scenarios (../../opencode/tests/test_driver.py),
so the two runners are held to the same fixture. What these prove is the
runner's control flow and wiring against a MODEL of the SDK; they do not prove
the SDK behaves as modelled. NOT run from tests/validate.sh; in ai-toolbox,
CI's `bindings` job runs it (ADR-0032).

Red proof of the guard fixture: DROP_GUARD_HOOKS=1 removes the hook
callbacks (SdkDriver.hooks_for returns no hooks) and TestGuardHook must fail.
"""
import importlib.util
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
RUNNER = os.path.join(BINDING_DIR, "runner.py")
TEMPLATE = os.path.join(BINDING_DIR, "binding.md")
STUB_SDK = os.path.join(HERE, "stub_sdk")
REPO_ROOT = os.path.abspath(os.path.join(BINDING_DIR, "..", "..", "..", "..", ".."))
CHECKER = os.path.join(BINDING_DIR, "..", "..", "..", "scripts", "check-binding.sh")
FIXTURE_GUARD = os.path.join(HERE, "fixture_role_guard.py")
FIXTURE_GUARD_JSON = os.path.join(HERE, "fixture-role-guard.json")
DROP_HOOKS = os.environ.get("DROP_GUARD_HOOKS") == "1"

sys.path.insert(0, os.path.join(BINDING_DIR, "..", "opencode", "tests"))
import test_driver as oc  # noqa: E402  the OpenCode harness and scenarios

# The turn table's values (.ai/context/turn-limits.md) for the fixture
# definitions, as scripts/emit-agents.py writes them into maxTurns.
TURNS = {"preflight": 60, "task-planner": 120, "implementer": 250, "gate-runner": 60,
         "refuter": 120, "adjudicator": 60, "closer": 60, "park-steward": 40,
         "run-scribe": 60, "git-ops": 80}

FILL = dict(oc.FILL, **{
    "binding_name": "test-sdk-binding",
    "driver_entry": "python3 runner.py --binding binding.md --run-id RUN_ID",
    "model": "per-role",
    "sdk_settings": "[%s, %s]" % (
        os.path.join(REPO_ROOT, "configs", "claude-code", "settings.sandbox.json"),
        os.path.join(REPO_ROOT, "configs", "claude-code", "settings.permissions.json")),
    "otel_settings": os.path.join(REPO_ROOT, "configs", "claude-code", "settings.otel.json"),
    "role_guard": FIXTURE_GUARD,
    "role_guard_json": FIXTURE_GUARD_JSON,
})


def filled_binding(values):
    out = []
    with open(TEMPLATE, encoding="utf-8") as fh:
        for line in fh.read().split("\n"):
            m = re.match(r"^([a-z_]+): ", line)
            if m and m.group(1) in values:
                line = "%s: %s" % (m.group(1), values[m.group(1)])
            out.append(line)
    return "\n".join(out)


def write_definitions(directory, drop=()):
    """Emitted-definition fixtures, shaped as emit-agents.py claude-code writes them."""
    os.makedirs(directory, exist_ok=True)
    for role, turns in TURNS.items():
        lines = ["---", "name: %s" % role, "description: fixture %s" % role,
                 "disallowedTools: Agent, WebFetch, WebSearch", "model: sonnet"]
        if role not in drop:
            lines.append("maxTurns: %d" % turns)
        with open(os.path.join(directory, role + ".md"), "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines + ["---", "", "# %s" % role, "", "FIXTURE BODY %s" % role, ""]))


def load_runner():
    """runner.py in-process, with the stub SDK first on the path."""
    if STUB_SDK not in sys.path:
        sys.path.insert(0, STUB_SDK)
    spec = importlib.util.spec_from_file_location("sdk_runner_under_test", RUNNER)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if DROP_HOOKS:
        mod.SdkDriver.hooks_for = lambda self, role: {}
    return mod


def shape(journal):
    """The journal's shape: event and task per line, without the SDK runner's
    own role-result lines (binding.md, Deviations 1)."""
    return [(e["event"], e.get("task")) for e in journal if e["event"] != "role-result"]


class SdkHarness(oc.Harness):
    def setUp(self):
        super().setUp()
        self.agents_dir = os.path.join(self.tmp, "agents")
        write_definitions(self.agents_dir)

    def make_sdk_repo(self, ids=("TASK-0001",), overrides=None):
        values = dict(FILL, gate_map=os.path.join(self.tmp, "gates.json"),
                      agents_dir=self.agents_dir, **(overrides or {}))
        self.make_repo(ids=ids, binding=filled_binding(values))

    def runner_env(self, agents):
        with open(self.scenario, "w") as fh:
            json.dump({"agents": agents}, fh)
        env = dict(os.environ, PATH=self.bin + os.pathsep + os.environ["PATH"],
                   PYTHONPATH=STUB_SDK, STUB_SCENARIO=self.scenario, STUB_LOG=self.stub_log,
                   STUB_STATE=self.state, GIT_LOG=self.git_log, REAL_GIT=oc.REAL_GIT)
        env.pop("GIT_CALLER", None)
        return env

    def run_runner(self, agents, pre=None):
        argv = [sys.executable, RUNNER, "--binding", "binding.md", "--run-id", "r1"]
        if pre:
            # A monkeypatch before main(): `pre` is Python run in the runner's process.
            argv = [sys.executable, "-c", "import sys, runpy; %s; sys.argv = %r; "
                    "runpy.run_path(%r, run_name='__main__')" % (pre, argv[1:], RUNNER)]
        self.proc = subprocess.run(argv, cwd=self.repo, env=self.runner_env(agents),
                                   capture_output=True, text=True, timeout=300)
        return self.proc.returncode

    def queries(self, role=None):
        if not os.path.exists(self.stub_log):
            return []
        with open(self.stub_log) as fh:
            rows = [json.loads(l) for l in fh]
        return [r for r in rows if role is None or r["role"] == role]


class TestGolden(SdkHarness):
    """(1) The 3-task golden fixture: same journal shape as the OpenCode driver."""

    IDS = ("TASK-0001", "TASK-0002", "TASK-0003")

    def test_three_tasks_close_with_the_opencode_drivers_journal_shape(self):
        self.make_repo(ids=self.IDS)
        self.assertEqual(self.run_driver(oc.happy(self.IDS)), 0, self.proc.stderr)
        opencode_shape = shape(self.journal())
        self.tearDown()
        self.setUp()
        self.make_sdk_repo(ids=self.IDS)
        self.assertEqual(self.run_runner(oc.happy(self.IDS)), 0, self.proc.stderr)
        journal = self.journal()
        self.assertEqual(shape(journal), opencode_shape)
        self.assertEqual([e["task"] for e in self.events("close")], list(self.IDS))
        self.assertEqual(self.porcelain(), "")
        log = subprocess.run([oc.REAL_GIT, "log", "--format=%s", "-3"], cwd=self.repo,
                             capture_output=True, text=True).stdout.split("\n")
        self.assertEqual([l.split(":")[0] for l in log if l], list(reversed(self.IDS)))
        writes = [a for a in self.driver_git()
                  if a and a[0] in ("add", "commit", "push", "stash", "reset", "checkout", "clean")]
        self.assertEqual(writes, [], "the runner itself ran a git write")
        self.assertEqual(len(self.events("role-result")), len(self.queries()))

    def test_each_role_runs_with_its_definition_turns_settings_otel_and_hook(self):
        self.make_sdk_repo()
        self.assertEqual(self.run_runner(oc.happy()), 0, self.proc.stderr)
        rows = self.queries()
        self.assertEqual({r["role"] for r in rows}, set(oc.ROLES) - {"park-steward"})
        for r in rows:
            o = r["options"]
            self.assertEqual(o["max_turns"], TURNS[r["role"]], r["role"])
            self.assertIn("FIXTURE BODY %s" % r["role"], o["system_prompt"])
            self.assertEqual(o["model"], "sonnet")
            self.assertEqual(o["permission_mode"], "acceptEdits")
            self.assertEqual(o["disallowed_tools"], ["Agent", "WebFetch", "WebSearch"])
            self.assertEqual(o["hooks"], ["PreToolUse"])
            self.assertEqual(o["env"]["CLAUDE_CODE_ENABLE_TELEMETRY"], "1")
            self.assertEqual(o["env"]["OTEL_RESOURCE_ATTRIBUTES"], "run.id=r1")
        with open(rows[0]["options"]["settings"]) as fh:
            settings = json.load(fh)
        self.assertIs(settings["sandbox"]["enabled"], True)
        self.assertIn("Bash(git push --force)", settings["permissions"]["deny"])
        self.assertTrue(rows[0]["options"]["settings"].startswith(os.path.join(self.repo, ".run")))

    def test_preflight_is_handed_the_runners_own_checks(self):
        self.make_sdk_repo()
        self.assertEqual(self.run_runner(oc.happy()), 0, self.proc.stderr)
        checks = oc.Harness.prompt_inputs(self, [self.queries("preflight")[0]["prompt"]])["driver_checks"]
        self.assertIn("ClaudeAgentOptions.model", checks["model_passed_as"])
        self.assertIn("maxTurns 250", checks["agent_list"]["implementer"])
        self.assertIn("PreToolUse hook callback", checks["role_guard"])

    def test_a_role_stopped_at_its_turn_limit_is_a_mechanical_failure(self):
        self.make_sdk_repo()
        agents = oc.happy()
        agents["task-planner"] = [{"text": None, "result": {"subtype": "error_max_turns",
                                                            "is_error": True}}]
        self.assertEqual(self.run_runner(agents), 0, self.proc.stderr)
        retries = self.events("mechanical-retry")
        self.assertEqual(len(retries), 3)
        self.assertIn("stopped at its maxTurns 120", retries[0]["error"])
        self.assertEqual([p["task"] for p in self.events("park")], ["TASK-0001"])

    def test_a_definition_without_maxturns_halts_before_any_role(self):
        write_definitions(self.agents_dir, drop=("refuter",))
        self.make_sdk_repo()
        self.assertEqual(self.run_runner(oc.happy()), 1)
        self.assertIn("carries no maxTurns", self.events("halt")[0]["reason"])
        self.assertEqual(self.queries("preflight"), [])

    def test_no_sdk_installed_halts_at_step_one_naming_the_package(self):
        self.make_sdk_repo()
        self.assertEqual(self.run_runner(oc.happy(), pre="sys.modules['claude_agent_sdk'] = None"), 1)
        self.assertIn("install claude-agent-sdk", self.events("halt")[0]["reason"])
        self.assertEqual(self.queries(), [])

    def test_the_module_imports_with_no_sdk(self):
        code = ("import sys, importlib.util; sys.modules['claude_agent_sdk'] = None; "
                "s = importlib.util.spec_from_file_location('r', %r); "
                "m = importlib.util.module_from_spec(s); s.loader.exec_module(m); "
                "print(m.SdkDriver.__name__)" % RUNNER)
        got = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
        self.assertEqual(got.returncode, 0, got.stderr)
        self.assertEqual(got.stdout.strip(), "SdkDriver")


class GuardCase(SdkHarness):
    """A bare remote, and the runner in-process with the stub SDK."""

    FORCE_PUSH = "git push --force origin HEAD:refs/heads/forced"
    guard, guard_json = FIXTURE_GUARD, FIXTURE_GUARD_JSON

    def setUp(self):
        super().setUp()
        self.saved = (os.getcwd(), dict(os.environ))
        self.make_sdk_repo(overrides={"role_guard": self.guard,
                                      "role_guard_json": self.guard_json})
        self.remote = os.path.join(self.tmp, "remote.git")
        subprocess.run([oc.REAL_GIT, "init", "-q", "--bare", self.remote], check=True)
        for args in (("remote", "add", "origin", self.remote), ("push", "-q", "origin", "master")):
            subprocess.run([oc.REAL_GIT, *args], cwd=self.repo, check=True)
        os.chdir(self.repo)
        os.environ.update(STUB_LOG=self.stub_log, STUB_STATE=self.state,
                          STUB_SCENARIO=self.scenario)
        self.runner = load_runner()

    def tearDown(self):
        os.chdir(self.saved[0])
        os.environ.clear()
        os.environ.update(self.saved[1])
        super().tearDown()

    def driver_for(self, role):
        with open(self.scenario, "w") as fh:
            json.dump({"agents": {role: [{"tool_calls": [
                {"tool": "Bash", "input": {"command": self.FORCE_PUSH}}],
                "text": "```json\n{}\n```"}]}}, fh)
        d = self.runner.SdkDriver(self.runner.SdkBinding("binding.md", "r1"))
        d.check_client_ready()
        d.b.roles.setdefault(role, role)
        d.check_roles()
        return d

    def forced_ref(self):
        return subprocess.run([oc.REAL_GIT, "--git-dir", self.remote, "rev-parse", "-q",
                               "--verify", "refs/heads/forced"], capture_output=True).returncode == 0

    def push_from(self, role):
        d = self.driver_for(role)
        d.invoke(role, self.runner.base.prompt(role, "Push the branch.", {}, "{}"))
        return self.queries(role)[0]["calls"][0]


class TestGuardHook(GuardCase):
    """(2) A stubbed `git push --force` from git-ops is denied by the hook callback.
    Fails under DROP_GUARD_HOOKS=1, which removes the callbacks."""

    def test_git_ops_force_push_is_denied_by_the_hook_callback(self):
        call = self.push_from("git-ops")
        self.assertEqual(call["decision"], "deny", call)
        self.assertFalse(call["ran"], "the force push ran")
        self.assertFalse(self.forced_ref(), "the remote received the force push")
        self.assertIn("role-guard (ADR-0062)", call["reason"])
        denied = self.events("tool-denied")
        self.assertEqual([(e["role"], e["tools"]) for e in denied], [("git-ops", ["Bash"])])

    def test_an_ask_is_answered_deny_never_allow(self):
        self.FORCE_PUSH = "git push origin HEAD:refs/heads/forced"
        call = self.push_from("git-ops")
        self.assertEqual(call["decision"], "deny", call)
        self.assertIn("no person is present", call["reason"])
        self.assertFalse(self.forced_ref())

    def test_a_guard_that_raises_fails_closed(self):
        d = self.driver_for("git-ops")
        d.guard = type("Broken", (), {"decide": staticmethod(lambda *a: 1 / 0)})
        d.invoke("git-ops", self.runner.base.prompt("git-ops", "Push.", {}, "{}"))
        call = self.queries("git-ops")[0]["calls"][0]
        self.assertEqual(call["decision"], "deny")
        self.assertIn("failing closed", call["reason"])


class TestGuardHookIsWhatStopsIt(GuardCase):
    """The control for (2): with the callbacks removed the same push lands, so
    TestGuardHook passing is the hook's doing, not the stub's."""

    def test_without_the_callbacks_the_force_push_reaches_the_remote(self):
        self.runner.SdkDriver.hooks_for = lambda self, role: {}
        call = self.push_from("git-ops")
        self.assertIsNone(call["decision"])
        self.assertTrue(call["ran"])
        self.assertTrue(self.forced_ref())


def real_guard():
    """role-guard.py and a role-guard.json from this checkout, or from
    ROLE_GUARD_PY / ROLE_GUARD_JSON; (None, reason) when there is none."""
    py, js = os.environ.get("ROLE_GUARD_PY"), os.environ.get("ROLE_GUARD_JSON")
    if py and js:
        return py, js
    py = os.path.join(REPO_ROOT, "configs", "claude-code", "hooks", "role-guard.py")
    if not os.path.isfile(py):
        return None, "role-guard.py is not in this checkout (TASK-0271)"
    js = os.path.join(tempfile.mkdtemp(prefix="guard-json-"), "role-guard.json")
    got = subprocess.run([sys.executable, "scripts/emit-agents.py", "--guard-json=" + js],
                         cwd=REPO_ROOT, capture_output=True, text=True)
    if got.returncode != 0:
        return None, "emit-agents.py --guard-json= failed: " + got.stderr.strip()
    return py, js


REAL = real_guard()


@unittest.skipIf(REAL[0] is None, REAL[1])
class TestRealGuard(GuardCase):
    """(2) again, through role-guard.py's own decide() and generated rules."""

    guard, guard_json = REAL

    def test_git_ops_force_push_is_denied_by_the_real_guard(self):
        call = self.push_from("git-ops")
        self.assertEqual(call["decision"], "deny", call)
        self.assertFalse(call["ran"])
        self.assertFalse(self.forced_ref())


class TestBindingChecker(unittest.TestCase):
    """(3) check-binding.sh passes on the filled fixture and refuses the template."""

    def check(self, path):
        return subprocess.run(["bash", CHECKER, path], capture_output=True, text=True)

    def test_filled_binding_passes_and_template_fails(self):
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as fh:
            fh.write(filled_binding(dict(FILL, gate_map="/tmp/gates.json", agents_dir="/tmp/agents")))
        try:
            got = self.check(fh.name)
            self.assertEqual(got.returncode, 0, got.stdout)
            self.assertIn("BINDING OK", got.stdout)
        finally:
            os.unlink(fh.name)
        self.assertNotEqual(self.check(TEMPLATE).returncode, 0)


if __name__ == "__main__":
    unittest.main()
