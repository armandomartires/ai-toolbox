"""A fixture role guard for the runner's tests: role-guard.py's interface
(`decide(cfg, role, data, today)` returning (verdict, reason), verdicts deny,
ask, out or pass) over role-guard.json's shape, with only the Bash deny and
ask globs modelled.

It exists because role-guard.py (configs/claude-code/hooks/, TASK-0271) is
not in every checkout; it proves the runner's WIRING (the hook callback is
called, and its deny stops the tool), not the guard's rules. The real guard
is exercised by test_runner.TestRealGuard wherever it is present.
"""
import fnmatch


def decide(cfg, role, data, today):
    spec = cfg["roles"][role]
    if data.get("tool_name") != "Bash" or "bash" not in spec:
        return "pass", ""
    command = (data.get("tool_input") or {}).get("command") or ""
    for pattern in spec["bash"].get("deny", []):
        if fnmatch.fnmatchcase(command, pattern):
            return "deny", "`%s` matches the deny rule `%s`" % (command, pattern)
    for pattern in spec["bash"].get("ask", []):
        if fnmatch.fnmatchcase(command, pattern):
            return "ask", "`%s` needs a person's confirmation" % command
    return "pass", ""
