"""Tests for run-gate.sh: the states, the watchdog, the kill scope, and
argv without a shell. Hermetic; each test uses a throwaway directory.
NOT run from tests/validate.sh."""
import json
import os
import shutil
import subprocess
import tempfile
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
RUN_GATE = os.path.join(os.path.dirname(HERE), "run-gate.sh")

GATES = {
    "ok": {"argv": ["sh", "-c", "echo 241 passed, 0 failed"]},
    "bad": {"argv": ["false"]},
    "skip": {"argv": ["sh", "-c", "exit 77"], "skip_exit": 77},
    "slow": {"argv": ["sleep", "30"], "timeout_seconds": 2},
    "long": {"argv": ["sleep", "60"]},
    "literal": {"argv": ["printf", "%s\\n", "a b; echo INJECTED"]},
}


class RunGate(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="run-gate-test-")
        self.map = os.path.join(self.tmp, "map.json")
        with open(self.map, "w") as fh:
            json.dump({"gates": GATES}, fh)
        self.evidence = os.path.join(self.tmp, "evidence.txt")
        self.env = dict(os.environ, GATE_MAP=self.map, GATE_REPO_ROOT=self.tmp,
                        GATE_RUN_ROOT=os.path.join(self.tmp, "run"),
                        EVIDENCE_FILE=self.evidence, GATE_TIMEOUT_SECONDS="600")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def gate(self, *args):
        return subprocess.run([RUN_GATE, *args], env=self.env, capture_output=True,
                              text=True, timeout=60)

    def finish(self, handle, gate):
        self.assertEqual(self.gate("start", handle, gate).returncode, 2)
        return self.gate("wait", handle, "30")

    def evidence_lines(self):
        with open(self.evidence) as fh:
            return fh.read().splitlines()

    def test_three_outcomes_stay_distinct(self):
        for gate, state, code in (("ok", "PASSED", 0), ("bad", "FAILED", 1),
                                  ("skip", "SKIPPED", 1)):
            with self.subTest(gate):
                got = self.finish("h-" + gate, gate)
                self.assertEqual(got.returncode, code)
                self.assertIn("STATE=%s" % state, got.stdout)
        self.assertEqual(len(self.evidence_lines()), 3)

    def test_watchdog_times_out_a_wedged_gate(self):
        got = self.finish("h-slow", "slow")
        self.assertIn("STATE=TIMEOUT", got.stdout)
        self.assertTrue(any("h-slow" in l and "TIMEOUT" in l for l in self.evidence_lines()))

    def test_missing_gate_is_exit_3_and_not_evidence(self):
        got = self.gate("start", "h-none", "nosuch")
        self.assertEqual(got.returncode, 3)
        self.assertFalse(os.path.exists(self.evidence))

    def test_wait_is_bounded_while_the_gate_runs(self):
        self.gate("start", "h-long", "long")
        t0 = time.time()
        got = self.gate("wait", "h-long", "2")
        self.assertEqual(got.returncode, 2)
        self.assertLess(time.time() - t0, 10)
        self.gate("kill", "h-long")

    def test_kill_stops_only_its_own_group(self):
        sibling = subprocess.Popen(["sleep", "60"])
        try:
            self.gate("start", "h-long", "long")
            got = self.gate("kill", "h-long")
            self.assertIn("STATE=KILLED", got.stdout)
            self.assertIsNone(sibling.poll(), "a process the gate did not start was killed")
        finally:
            sibling.kill()
            sibling.wait()

    def test_argv_is_not_passed_through_a_shell(self):
        self.finish("h-literal", "literal")
        with open(os.path.join(self.tmp, "run", "gates", "h-literal", "log")) as fh:
            self.assertEqual(fh.read(), "a b; echo INJECTED\n")


if __name__ == "__main__":
    unittest.main()
