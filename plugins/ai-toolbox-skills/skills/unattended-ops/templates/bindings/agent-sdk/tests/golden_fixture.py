#!/usr/bin/env python3
"""The golden unattended-run fixture, built and (optionally) driven.

  golden_fixture.py build DIR [--agents DIR --guard PATH --guard-json PATH]
      A throwaway repository under DIR/repo: calc.py with unit tests and three
      dependent queued tasks, S001.T001 multiply, S001.T002 divide (raises on a
      zero divisor), S001.T003 power (raises on a negative exponent). The gate
      map (DIR/gates.json, outside the repository) has one gate per task, `unit`,
      and `compile` as the long group. Prints the repo path. With no --agents
      the test fixtures stand in for the emitted role definitions and guard.
  golden_fixture.py dry-run DIR
      `build`, then runner.py against tests/stub_sdk/ (no SDK, no key, no
      network) with a scripted scenario that does what each task asks. Exit 0
      only when all three tasks close and the tree is clean.

The scenario is a MODEL of a run; only `build` is used for the live job.
Run from anywhere; python3 >= 3.8 and git are the only needs (and a POSIX
`bash` for run-gate.sh).
"""
import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import test_runner as tr  # noqa: E402  (also puts the OpenCode harness on the path)

oc = tr.oc
IDS = ("S001.T001", "S001.T002", "S001.T003")
CODE = {
    "S001.T001": ("def multiply(a, b):\n    return a * b\n",
                  "assertEqual(calc.multiply(3, 4), 12)"),
    "S001.T002": ("def divide(a, b):\n    if b == 0:\n        raise ValueError('zero divisor')\n"
                  "    return a / b\n",
                  "assertRaises(ValueError, calc.divide, 1, 0)"),
    "S001.T003": ("def power(a, b):\n    if b < 0:\n        raise ValueError('negative exponent')\n"
                  "    return a ** b\n",
                  "assertRaises(ValueError, calc.power, 2, -1)"),
}
GATES = {"gates": {"unit": {"argv": [sys.executable, "-m", "unittest", "-q"]},
                   "compile": {"argv": [sys.executable, "-m", "compileall", "-q", "."]}},
         "kinds": {"default": ["unit"]},
         "long_groups": {"compile": {"gates": ["compile"], "paths": ["*.py"]}}}


def git(repo, *args):
    subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True)


def build(root, agents=None, guard=None, guard_json=None):
    os.makedirs(root, exist_ok=True)
    repo = os.path.join(root, "repo")
    os.makedirs(os.path.join(repo, ".ai", "tasks"), exist_ok=True)
    agents = agents or os.path.join(root, "agents")
    if not os.path.isdir(agents):
        tr.write_definitions(agents)
    gates = os.path.join(root, "gates.json")
    with open(gates, "w") as fh:
        json.dump(GATES, fh)
    values = dict(tr.FILL, gate_map=gates, agents_dir=agents, task_file_glob=".ai/tasks/{id}_*.md",
                  long_gate_groups="[compile]", role_timeout="30m", watchdog_timeout="10m",
                  role_guard=guard or tr.FIXTURE_GUARD, role_guard_json=guard_json or tr.FIXTURE_GUARD_JSON)
    files = {".gitignore": ".run/\n__pycache__/\n",
             "calc.py": '"""Calculator."""\n\n\ndef add(a, b):\n    return a + b\n',
             "test_calc.py": ("import unittest\nimport calc\n\n\nclass T(unittest.TestCase):\n"
                              "    def test_add(self):\n        self.assertEqual(calc.add(1, 2), 3)\n"),
             "queue.txt": "S001.T001\nS001.T002 after=S001.T001\nS001.T003 after=S001.T002\n",
             "TODO.md": "".join("- [ ] %s\n" % i for i in IDS),
             "binding.md": tr.filled_binding(values)}
    for i in IDS:
        files[".ai/tasks/%s_demo.md" % i] = "# %s\n\n## Acceptance criteria\n- [ ] %s\n" % (
            i, CODE[i][1].split("(")[0] + " is implemented")
    for rel, body in files.items():
        with open(os.path.join(repo, rel), "w") as fh:
            fh.write(body)
    git(repo, "init", "-q", "-b", "master")
    git(repo, "config", "user.email", "golden@example.invalid")
    git(repo, "config", "user.name", "Golden fixture")
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", "fixture")
    return repo


def scenario():
    agents = oc.happy(IDS)
    agents["task-planner"] = [{"text": oc.fence({"files": ["calc.py", "test_calc.py"], "reused": [],
                                                  "order": ["edit"], "verification": ["unit"]})}]
    agents["implementer"] = []
    for i in IDS:
        func, check = CODE[i]
        name = func.split("(")[0][4:]
        sh = ["printf '%%b' %s >> calc.py" % json.dumps("\n\n" + func),
              "printf '%%b' %s >> test_calc.py" % json.dumps(
                  "\n    def test_%s(self):\n        self.%s\n" % (name, check))]
        agents["implementer"].append({"sh": sh, "text": oc.fence({
            "status": "done", "files_changed": ["calc.py", "test_calc.py"], "unsatisfied_criteria": []})})
    agents["closer"] = [oc.closer_sh(oc.LOG_LINES, sep="_",
                                     add="git add -- calc.py test_calc.py .ai/tasks/{TASK}_demo.md")]
    return {"agents": agents}


def dry_run(root):
    repo = build(root)
    stub_state = os.path.join(root, "stub-state")
    os.makedirs(stub_state, exist_ok=True)
    scen = os.path.join(root, "scenario.json")
    with open(scen, "w") as fh:
        json.dump(scenario(), fh)
    env = dict(os.environ, PYTHONPATH=tr.STUB_SDK, STUB_SCENARIO=scen, STUB_STATE=stub_state,
               STUB_LOG=os.path.join(root, "stub.jsonl"))
    env.pop("GIT_CALLER", None)
    proc = subprocess.run([sys.executable, tr.RUNNER, "--binding", "binding.md", "--run-id", "r1",
                           "--max-cost-usd", "10"], cwd=repo, env=env, capture_output=True, text=True)
    sys.stdout.write(proc.stdout)
    sys.stderr.write(proc.stderr)
    with open(os.path.join(repo, ".run", "r1", "journal.jsonl")) as fh:
        closed = [e["task"] for e in map(json.loads, fh) if e["event"] == "close"]
    porcelain = subprocess.run(["git", "status", "--porcelain"], cwd=repo, capture_output=True,
                               text=True).stdout.strip()
    tests = subprocess.run([sys.executable, "-m", "unittest", "-q"], cwd=repo, capture_output=True, text=True)
    ok = proc.returncode == 0 and closed == list(IDS) and not porcelain and tests.returncode == 0
    print("golden dry-run: %s (closed %s, runner exit %d, dirty %r, calc tests %d)"
          % ("PASS" if ok else "FAIL", closed, proc.returncode, porcelain, tests.returncode))
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("mode", choices=("build", "dry-run"))
    ap.add_argument("dir")
    ap.add_argument("--agents")
    ap.add_argument("--guard")
    ap.add_argument("--guard-json")
    a = ap.parse_args()
    if a.mode == "build":
        print(build(a.dir, a.agents, a.guard, a.guard_json))
        return 0
    return dry_run(a.dir)


if __name__ == "__main__":
    sys.exit(main())
