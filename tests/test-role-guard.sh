#!/usr/bin/env bash
# test-role-guard.sh — one fixture per term ADR-0018 clause 8.3 refused for
# Claude Code, run against configs/claude-code/hooks/role-guard.py (TASK-0271,
# ADR-0062).
#
# Each fixture feeds the guard the PreToolUse input Claude Code sends, in the
# shape of its 2.1.321 declarations (BaseHookInput: `agent_type`, `agent_id`,
# `permission_mode`; PreToolUseHookInput: `tool_name`, `tool_input`), and reads
# the decision the way the engine does: `hookSpecificOutput.permissionDecision`
# on exit 0, a block on exit 2, nothing at all = no decision (the normal
# permission flow). For each term:
#   - the forbidden call is denied or asked, the allowed call gets no decision;
#   - with no hook (the harness alone, per-agent frontmatter) the forbidden
#     call is NOT held, and with the term's rule removed from role-guard.json it
#     is not held either: the fixture fails without the guard.
# Plus the trial switch (ask before ADR-0062's date, deny from it), fail-closed
# cases, the push rules TASK-0276 owns, the emitter and the plugin wiring.
#
# WHAT IT DOES NOT PROVE: that a live Claude Code session delivers this input
# to a plugin hook for a plugin subagent. That rests on the engine's own
# declarations and on `claude plugin validate`; ADR-0062 says so.
#
# Hermetic: reads the repo, writes only under mktemp.
set -euo pipefail
cd "$(dirname "$0")/.."

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT

python3 scripts/emit-agents.py --guard-json="$T/role-guard.json"
# Python stand-ins for the launcher cases (H6): `nopy` fails the version probe
# (no working python), `crash` passes it and fails running the guard, `none`
# adds nothing (the host's own python).
STUB_ROOT="$(cd "$T" && pwd)/stub"; export STUB_ROOT
mkdir -p "$STUB_ROOT/nopy" "$STUB_ROOT/crash" "$STUB_ROOT/none"
for py in python3 python; do
  printf '#!/bin/sh\nexit 9\n' > "$STUB_ROOT/nopy/$py"
  printf '#!/bin/sh\n[ "$1" = -c ] && exit 0\nexit 1\n' > "$STUB_ROOT/crash/$py"
  chmod +x "$STUB_ROOT/nopy/$py" "$STUB_ROOT/crash/$py"
done
mkdir -p "$T/plain" "$T/guarded"
# A repository whose hooks live in core.hooksPath (second review H-C). A
# caller's GIT_DIR/GIT_WORK_TREE would aim git at another repo (TASK-0165).
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR
git init -q "$T/hookrepo" && git -C "$T/hookrepo" config core.hooksPath hookdir
printf -- '---\nname: git-ops\ndescription: stale\n---\nbody\n' > "$T/plain/git-ops.md"
python3 scripts/emit-agents.py claude-code "$T/plain" > "$T/plain.out" 2>&1; echo "$?" > "$T/plain.rc"
python3 scripts/emit-agents.py claude-code "$T/guarded" --with-guard > "$T/guarded.out" 2>&1; echo "$?" > "$T/guarded.rc"

python3 - "$T" <<'PY'
import copy, json, os, subprocess, sys

T = sys.argv[1]
# ROLE_GUARD_PY / ROLE_GUARD_JSON run the fixtures against another guard and
# rules (an older one, to show a new fixture red before its fix).
GUARD = os.environ.get("ROLE_GUARD_PY", "configs/claude-code/hooks/role-guard.py")
CFG = os.environ.get("ROLE_GUARD_JSON") or os.path.join(T, "role-guard.json")
CWD = "/work/repo"
TRIAL, SWITCH = "2026-11-25", "2026-11-26"
fail = 0


def check(name, ok, detail=""):
    global fail
    print(("PASS " if ok else "FAIL ") + name + ("" if ok or not detail else "  [%s]" % (detail,)))
    if not ok:
        fail = 1


def decide(agent, tool, inp, today=TRIAL, mode="default", cfg=CFG, guard=GUARD, raw=None, cwd=CWD, env=None):
    """The decision Claude Code would act on; 'none' = no decision."""
    if guard is None:
        # No hook rules for the role (L1): the guard runs with an empty role
        # table, so what decides is the harness and the agent file alone.
        guard, cfg = GUARD, EMPTY
    payload = {"session_id": "s", "transcript_path": "", "cwd": cwd,
               "hook_event_name": "PreToolUse", "tool_name": tool,
               "tool_input": inp, "tool_use_id": "t1", "permission_mode": mode}
    if agent and ":" not in agent and agent != "general-purpose" and not agent.startswith("bare="):
        agent = "ai-toolbox-agents:" + agent  # the plugin's own agent type (M4)
    if agent and agent.startswith("bare="):
        agent = agent[5:]
    if agent:
        payload["agent_type"] = agent
        payload["agent_id"] = "a1"
    if not os.path.isfile(guard):
        return "error: no guard at %s" % guard
    p = subprocess.run([sys.executable, guard, "--config", cfg] + (["--today", today] if today else []),
                       input=raw if raw is not None else json.dumps(payload),
                       capture_output=True, text=True, env=env)
    if p.returncode == 2:
        return "deny"
    if p.returncode != 0:
        return "error: exit %d %s" % (p.returncode, p.stderr.strip()[:200])
    if not p.stdout.strip():
        return "none"
    out = json.loads(p.stdout)["hookSpecificOutput"]
    return out["permissionDecision"]


def bash(c):
    return ("Bash", {"command": c})


def edit(path):
    return ("Edit", {"file_path": path, "old_string": "a", "new_string": "b"})


def without(cfg_obj, role, path):
    """A copy of the config with one rule removed: role -> key path."""
    c = copy.deepcopy(cfg_obj)
    if role not in c.get("roles", {}):
        return CFG  # nothing to remove; the forbidden-call check fails instead
    node = c["roles"][role]
    for k in path[:-1]:
        node = node[k]
    node.pop(path[-1]) if isinstance(node, dict) else node.clear()
    if tuple(path) == ("bash", "deny"):  # the same terms as parsed git options
        c["roles"][role]["bash"].pop("git", None)
    p = os.path.join(T, "cut-%s-%s.json" % (role, "-".join(map(str, path))))
    json.dump(c, open(p, "w"), indent=1)
    return p


cfg_obj = json.load(open(CFG))
EMPTY = os.path.join(T, "empty.json")
json.dump(dict(cfg_obj, roles={}), open(EMPTY, "w"))


def harness(role, tool):
    """L1, measured: what the agent file alone does with `tool` when no hook
    runs. Reads the role as emitted (`--with-guard`): `disallowedTools` names
    the tool, or a `tools` allowlist leaves it out -> the harness refuses it
    ('deny'); otherwise it reaches the normal permission flow ('none')."""
    f = os.path.join(T, "guarded", role + ".md")
    if not os.path.isfile(f):
        return "error: %s not emitted" % role
    fm = open(f, encoding="utf-8").read().split("---")[1]
    line = lambda k: next((l.split(":", 1)[1] for l in fm.splitlines() if l.startswith(k + ":")), None)
    dis = [t.strip() for t in (line("disallowedTools") or "").split(",")]
    tools = line("tools")
    names = [t.strip().split("(")[0] for t in tools.split(",")] if tools else None
    held = tool in dis or (names is not None and tool not in names)
    return "deny" if held else "none"

# --- the seven fixtures ------------------------------------------------------
# term: (role, forbidden call, expected, allowed call, rule to remove)
FIXTURES = {
    "test-files-only": ("qa-test", edit(CWD + "/src/app.py"), "ask",
                        edit(CWD + "/tests/test_app.py"), ("edit",)),
    "bash-allowlist": ("git-ops", bash("rm -rf build"), "ask",
                       bash("git status"), ("bash", "allowlist")),
    "test-allowlist": ("qa-test", bash("curl http://example.invalid"), "ask",
                       bash("pytest -q tests"), ("bash", "allowlist")),
    "no-force-push": ("implementer", bash("git reset --hard HEAD~1"), "deny",
                      bash("git log --oneline"), ("bash", "deny")),
    "no-bypass": ("closer", bash("git commit -m x --no-verify"), "deny",
                  bash("git commit -m x"), ("bash", "deny")),
    "push-requires-confirmation": ("git-ops", bash("git push origin HEAD"), "ask",
                                   bash("git diff"), ("bash", "ask")),
    "webfetch-requires-confirmation": ("qa-test", ("WebFetch", {"url": "https://example.invalid", "prompt": "x"}),
                                       "ask", bash("git status"), ("webfetch",)),
}
for term, (role, bad, want, good, rule) in FIXTURES.items():
    # Without the hook: the agent file alone (measured from the emitted file)
    # and the guard with no rules for the role must both leave the call alone.
    held_file = harness(role, bad[0])
    held_bare = held_file if held_file != "none" else decide(role, *bad, guard=None)
    got_bad = decide(role, *bad)
    got_good = decide(role, *good)
    cut = without(cfg_obj, role, rule)
    if rule == ("bash", "allowlist") and cut != CFG:  # an allowlist removed = a shell passed on
        c = json.load(open(cut)); c["roles"][role]["bash"]["allowlist"] = False
        json.dump(c, open(cut, "w"))
    # The fixture's full expectation: the trial's answer and the switch's. A
    # confirmation term still asks after the switch; everything else denies.
    want_both = (want, "ask" if term.endswith("requires-confirmation") else "deny")
    got_both = (got_bad, decide(role, *bad, today=SWITCH))
    cut_both = (decide(role, *bad, cfg=cut), decide(role, *bad, cfg=cut, today=SWITCH))
    check("%s: %s forbidden call -> %s, then %s from the switch" % ((term, role) + want_both),
          got_both == want_both, got_both)
    check("%s: %s allowed call -> no decision" % (term, role), got_good == "none", got_good)
    check("%s: without the hook the forbidden call is not held" % term, held_bare == "none", held_bare)
    check("%s: with its rule removed the fixture fails" % term, cut_both != want_both, cut_both)
    print("MEASURE %-31s no guard: %s (agent file: %s); guard: %s / allowed call passes -> %s"
          % (term, "not held" if held_bare == "none" else "held: " + held_bare, held_file, got_bad,
             "PASS" if got_bad == want and got_good == "none" and held_bare == "none" else "FAIL"))

# --- the edges of each mechanism ---------------------------------------------
for c, want in (("git status && rm -rf x", "deny"), ("git status; rm -rf x", "deny"),
                ("git status | sh", "deny"), ("git log > out.txt", "deny"),
                ("git log $(rm -rf x)", "deny"), ("git log `rm -rf x`", "deny"),
                ("git status\nrm -rf x", "deny"), ("git  status", "none"),
                ("git push --force origin x", "deny"), ("git push origin x --force", "deny"),
                ("git push -f origin x", "deny"), ("git commit -m y --amend", "deny")):
    role = "git-ops"
    check("bash edge (%s): %r -> %s" % (role, c, want), decide(role, *bash(c)) == want, decide(role, *bash(c)))
check("closer: git commit -m x --amend (trailing) -> deny",
      decide("closer", *bash("git commit -m x --amend")) == "deny")
for tool in ("PowerShell", "Monitor"):
    got = decide("git-ops", tool, {"command": "git status", "description": "x", "timeout_ms": 1})
    check("a shell-shaped role may not use %s -> deny" % tool, got == "deny", got)
for path, want in ((CWD + "/tests/../src/app.py", "ask"), ("/elsewhere/tests/x.py", "ask"),
                   (CWD + "/pkg/foo.test.ts", "none"), (CWD + "/pkg/__tests__/a.js", "none"),
                   ("C:\\work\\repo\\src\\x.py", "ask")):
    got = decide("qa-test", *edit(path))
    check("test-files-only edge: %s -> %s" % (path, want), got == want, got)
for tool, inp in (("Write", {"file_path": CWD + "/src/x.py", "content": "x"}),
                  ("NotebookEdit", {"notebook_path": CWD + "/src/x.ipynb", "new_source": "x"})):
    check("test-files-only covers %s" % tool, decide("qa-test", tool, inp) == "ask")

# --- ask for two weeks, then deny (Q10=A) -----------------------------------
check("role-guard.json records the deny date %s" % SWITCH, cfg_obj.get("deny_from") == SWITCH,
      cfg_obj.get("deny_from"))
check("trial: out-of-allowlist on %s -> ask" % TRIAL, decide("git-ops", *bash("rm -rf x"), today=TRIAL) == "ask")
check("switch: out-of-allowlist on %s -> deny" % SWITCH, decide("git-ops", *bash("rm -rf x"), today=SWITCH) == "deny")
check("switch: an edit outside tests on %s -> deny" % SWITCH, decide("qa-test", *edit(CWD + "/src/a.py"), today=SWITCH) == "deny")
check("switch: push still asks after the date (the term is confirmation)",
      decide("git-ops", *bash("git push origin x"), today=SWITCH) == "ask")
check("switch: allowed calls still pass after the date", decide("git-ops", *bash("git status"), today=SWITCH) == "none")
for mode in ("bypassPermissions", "auto", "dontAsk"):
    got = decide("git-ops", *bash("rm -rf x"), mode=mode)
    check("no person answers an ask in %s: -> deny" % mode, got == "deny", got)
check("acceptEdits keeps the ask", decide("git-ops", *bash("rm -rf x"), mode="acceptEdits") == "ask")

# --- who is guarded, and failing closed --------------------------------------
check("main thread (no agent_type) -> no decision", decide(None, *bash("rm -rf x")) == "none")
check("an unguarded agent type -> no decision", decide("general-purpose", *bash("rm -rf x")) == "none")
check("the plugin's own name (ai-toolbox-agents:git-ops) is guarded",
      decide("ai-toolbox-agents:git-ops", *bash("rm -rf x")) == "ask")
check("a bare git-ops is not ours (M4) -> no decision", decide("bare=git-ops", *bash("rm -rf x")) == "none")
# --- the risk review's bypasses, each run and now refused ---------------------
for role, c, want in (("git-ops", "git statusX", "ask"), ("git-ops", "git status # x", "ask"),
                      ("git-ops", "git -c core.pager=sh log", "deny"), ("git-ops", "git diff --output=x", "deny"),
                      ("git-ops", "git diff --ext-diff", "deny"), ("git-ops", "git log --exec-path=x", "deny"),
                      ("git-ops", "git config core.hooksPath x", "deny"), ("closer", "git commit -m x -n", "deny"),
                      ("closer", "git commit -m x --no-verif", "deny"), ("closer", "git commit -m x --amen", "deny"),
                      ("git-ops", "git status -s", "none")):
    got = decide(role, *bash(c))
    check("review bypass (%s): %r -> %s" % (role, c, want), got == want, got)
for role, path in (("qa-test", CWD + "/tests/../.git/config"), ("implementer", CWD + "/.git/hooks/pre-commit"),
                   ("implementer", CWD + "/.claude/settings.json"), ("implementer", "/home/u/.claude/plugins/cache/x.py")):
    got = decide(role, *edit(path))
    check("review M2: %s editing %s -> deny" % (role, path), got == "deny", got)
p = {"session_id": "s", "transcript_path": "", "cwd": CWD, "hook_event_name": "PreToolUse",
     "tool_name": "Bash", "tool_input": {"command": "rm -rf café"}, "tool_use_id": "t",
     "agent_type": "ai-toolbox-agents:git-ops"}
r = subprocess.run([sys.executable, GUARD, "--config", CFG, "--today", TRIAL],
                   input=json.dumps(p, ensure_ascii=False).encode("utf-8"), capture_output=True)
got = json.loads(r.stdout)["hookSpecificOutput"]["permissionDecision"] if r.stdout.strip() else "none"
check("M1 non-ASCII UTF-8 input is read and denied (third review, item 1), M3 no mode", got == "deny", got)
# --- second review round: H1 -o, H2, H4, M5, L2, L6 --------------------------
for role, c, want in (("git-ops", "git format-patch -o out HEAD~1", "deny"),
                      ("git-ops", "git push -uf origin x", "deny"), ("git-ops", "git push origin -d x", "deny"),
                      ("git-ops", "git push origin :x", "deny"), ("git-ops", "git -C . push --force", "deny"),
                      ("implementer", "git -C . status", "deny"), ("implementer", "git reset HEAD~1 --hard", "deny"),
                      ("git-ops", "git log --oneline a..b", "none"),
                      ("gate-runner", "bash skills/u/run-gate.sh status g", "none"),
                      ("gate-runner", "./run-gate.sh run g", "none"),
                      ("gate-runner", "python evil.py run-gate.sh", "ask"),
                      ("gate-runner", "bash evil.sh run-gate.sh", "ask"),
                      ("gate-runner", "bash run-gate.sh x # y", "ask"),
                      ("qa-test", "bash tests/../../evil.sh", "ask"), ("qa-test", "bash tests/a.sh", "none"),
                      # M5 round 3: -qf, and git's unique long-option prefixes
                      ("git-ops", "git push -qf origin x", "deny"), ("git-ops", "git push origin x --mirr", "deny"),
                      ("git-ops", "git push origin --del x", "deny"), ("git-ops", "git push --pru origin", "deny"),
                      ("implementer", "git reset --ha HEAD~1", "deny"), ("implementer", "git reset HEAD --me", "deny"),
                      ("implementer", "git checkout --fo x", "deny"), ("implementer", "git branch --forc x HEAD", "deny"),
                      ("review", "git diff --ext HEAD~1", "deny"), ("review", "git diff --outp=f HEAD~1", "deny"),
                      ("review", "git log --oneline -3", "none"), ("git-ops", "git push origin feature/x", "ask"),
                      # H2: the executable must BE a run-gate.sh, run directly or by bash/sh
                      ("gate-runner", "bash /opt/b/run-gate.sh status h", "none"),
                      ("gate-runner", "sh -c run-gate.sh", "ask"), ("gate-runner", "env X=1 run-gate.sh run g", "deny"),
                      ("gate-runner", "bash --rcfile evil run-gate.sh", "deny"),
                      ("gate-runner", "run-gate.sh.evil run g", "ask")):
    got = decide(role, *bash(c))
    check("review round 2 (%s): %r -> %s" % (role, c, want), got == want, got)
WITHHELD = ("Workflow", "CronCreate", "CronDelete", "SendMessage", "EnterWorktree", "ExitWorktree", "TaskStop", "RemoteTrigger", "SendFile", "ScheduleWakeup", "Skill", "SendToProject", "PublishPlugin", "Artifact", "AppifactRepl", "request_computer")
for tool in WITHHELD + ("mcp__gates__run_gate",):
    got = decide("review", tool, {})
    check("H4: a guarded role is denied %s" % tool, got == "deny", got)
# H5, recorded not closed: an agent-team teammate's agent_type is the name it
# was given, not `ai-toolbox-agents:<role>`, so the guard leaves it alone.
check("H5 (gap, recorded in ADR-0062): a teammate named git-ops is not guarded -> no decision",
      decide("bare=git-ops", *bash("rm -rf x")) == "none")
check("H4: an unguarded agent's MCP call is left alone", decide("general-purpose", "mcp__gates__run_gate", {}) == "none")
got = decide("qa-test", *edit(CWD + "/.github/workflows/a.test.yml"))
check("L6: a dot directory is not a test path -> ask", got == "ask", got)
import datetime
utc = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
want = "deny" if utc >= SWITCH else "ask"
got = decide("git-ops", *bash("rm -rf x"), today=None)
check("L2: with no --today the guard uses the UTC date (%s) -> %s" % (utc, want), got == want, got)
for path, want in (("C:\\work\\repo\\tests\\test_a.py", "none"), ("C:\\work\\repo\\src\\a.py", "ask"),
                   ("c:/WORK/repo/tests/b.py", "none")):
    got = decide("qa-test", *edit(path), cwd="C:\\work\\repo")
    check("L2: Windows cwd, %s -> %s" % (path, want), got == want, got)

# --- second Opus review: H-A, H-B, M-A, M-B (each bypass run, then refused) ---
SQ = "'"
for role, c, want in (
        # H-A: quoting, escapes and braces no longer hide an option
        ("closer", "git commit -m x " + SQ + "-n" + SQ, "deny"),
        ("closer", 'git commit -m x --n"o-verify"', "deny"),
        ("closer", "git commit -m x -{n,q}", "deny"),
        ("closer", "git commit -m x --a" + SQ + "mend" + SQ, "deny"),
        ("closer", "git commit -m x --no-verif\\y", "deny"),
        ("review", "git log -1 --o" + SQ + "utput" + SQ + "=f", "deny"),
        ("review", "git diff --output=f", "deny"),
        ("review", "git log -1 --outp=f", "deny"),
        ("closer", 'git commit -m "two words"', "none"),
        ("git-ops", "git status $HOME", "deny"), ("git-ops", "git status %PATH%", "deny"),
        ("git-ops", "git status -- *", "none"), ("git-ops", "git log -1 a*", "deny"),
        ("qa-test", "bash " + SQ + "tests/../../evil.sh" + SQ, "ask"),
        # H-B: short clusters
        ("closer", "git commit -m x -an", "deny"), ("closer", "git commit -m x -qn", "deny"),
        ("closer", "git commit -am x -n", "deny"),
        # M-A: git-ops may list remotes, not change them
        ("git-ops", "git remote -v", "none"), ("git-ops", "git remote -v add evil http://x", "ask"),
        # M-B: push clusters in any order, and wrapped forms
        ("git-ops", "git push -fu origin x", "deny"), ("git-ops", "git push -qfu origin x", "deny"),
        ("git-ops", "git push --forc origin x", "deny"), ("git-ops", "git push origin x --no-verify", "deny"),
        ("git-ops", "env git push -f origin x", "deny"), ("git-ops", "command git push --force", "deny"),
        ("git-ops", "exec git push -f", "deny"), ("git-ops", "nice -n 5 git push -f", "deny"),
        ("git-ops", "timeout 10 git push -f", "deny"), ("git-ops", "xargs git push -f", "deny"),
        ("git-ops", "sh -c " + SQ + "git push -f" + SQ, "deny"), ("git-ops", 'bash -c "git push --force"', "deny"),
        ("git-ops", "pwsh -c git push -f", "deny"), ("git-ops", "X=1 git push -f", "deny"),
        ("git-ops", "/usr/bin/git push -f", "deny"), ("git-ops", "git.exe push -f", "deny"),
        ("implementer", "env git reset --ha", "deny"), ("implementer", "git branch -fD x", "deny"),
        ("git-ops", "git commit -m x", "none"), ("git-ops", "git push origin HEAD", "ask")):
    got = decide(role, *bash(c))
    check("review 3 (%s): %r -> %s" % (role, c, want), got == want, got)
# H-C, M-C: control paths, case, Windows aliases
for role, path, want in (
        ("implementer", CWD + "/.githooks/pre-commit", "deny"), ("implementer", CWD + "/.GIT/config", "deny"),
        ("implementer", "C:\\work\\repo\\GITHOO~1\\pre-commit", "deny"),
        ("qa-test", CWD + "/tests/a.py::$DATA", "deny"), ("qa-test", CWD + "/tests/a.py:s", "deny"),
        ("implementer", CWD + "/.claude/agents/x.md", "deny"), ("implementer", CWD + "/.claude/commands/x.md", "deny"),
        ("implementer", CWD + "/.claude/skills/x/SKILL.md", "deny"), ("implementer", CWD + "/.claude/hooks/x.sh", "deny"),
        ("implementer", CWD + "/.mcp.json", "deny"), ("implementer", CWD + "/CLAUDE.md", "deny"),
        ("implementer", CWD + "/sub/claude.md", "deny"), ("implementer", "/home/u/.gitconfig", "deny"),
        ("implementer", "/home/u/.claude/hooks/x.sh", "deny"), ("implementer", CWD + "/src/a.py", "none"),
        ("qa-test", CWD + "/tests/test_ok.py", "none")):
    got = decide(role, *edit(path))
    check("review 3 path (%s): %s -> %s" % (role, path, want), got == want, got)
HR = os.path.join(T, "hookrepo").replace("\\", "/")
got = decide("implementer", *edit(HR + "/hookdir/pre-commit"), cwd=HR)
check("H-C: an edit inside the repo's core.hooksPath -> deny", got == "deny", got)
got = decide("implementer", *edit(HR + "/src/a.py"), cwd=HR)
check("H-C: an edit elsewhere in that repo -> no decision", got == "none", got)
check("low: qa-test WebSearch -> ask", decide("qa-test", "WebSearch", {"query": "x"}) == "ask")
check("low: git-ops (no webfetch term) WebSearch -> no decision", decide("git-ops", "WebSearch", {"query": "x"}) == "none")

# --- third Opus review: one parse, unmodelled = deny, indirect hooks ---------
NB, VT, FF, FS = " ", "\x0b", "\x0c", "\x1c"
for role, c, want in (
        # 1: characters bash and the guard could read differently
        ("closer", "git commit -m" + NB + " -an", "deny"), ("git-ops", "git status" + NB, "deny"),
        ("git-ops", "git status" + VT + "x", "deny"), ("git-ops", "git status" + FF, "deny"),
        ("git-ops", "git status" + FS + "x", "deny"), ("git-ops", "git status\r", "deny"),
        # 2: a `--` consumed as a value is not end-of-options; globs in git args
        ("closer", "git commit -m -- ?n", "deny"), ("closer", "git commit -m x -- ?n", "none"),
        ("closer", "git add -- *", "none"), ("closer", "git commit -m x [-]n", "deny"),
        # 3: unmodelled is a deny in every mode
        ("git-ops", 'git status "x', "deny"), ("git-ops", "git status # it" + SQ + "s", "deny"),
        ("closer", "git commit -m x $" + SQ + "\\x2dn" + SQ, "deny"), ("git-ops", "git status ${x}", "deny"),
        ("git-ops", "( git push -f )", "deny"), ("git-ops", "(git status)", "deny"),
        ("git-ops", "timeout -s KILL 5 git status", "deny"), ("git-ops", "env -u X git status", "deny"),
        ("git-ops", "sudo -u x git status", "deny"), ("git-ops", "exec -a x git status", "deny"),
        ("git-ops", "bash -lc " + SQ + "git status" + SQ, "deny"), ("git-ops", "sh -ec " + SQ + "git status" + SQ, "deny"),
        ("git-ops", "GIT_CONFIG_COUNT=1 git status", "deny"), ("git-ops", "GIT_DIR=/x git status", "deny"),
        ("git-ops", "GIT_WORK_TREE=/x git status", "deny"), ("git-ops", "GIT_EXEC_PATH=/x git status", "deny"),
        ("git-ops", "env GIT_CONFIG_PARAMETERS=x git status", "deny"), ("git-ops", "git status ~/x", "deny"),
        ("git-ops", "git commit -m " + SQ + "a;b" + SQ + " -n", "deny"),("closer", "git commit -m " + SQ + "a;b" + SQ + " -n", "deny"),
        ("git-ops", "rm -rf build", "ask"), ("git-ops", "git status | sh", "deny"),
        # 7: format values, reflog forms, plain quoting
        ("review", "git log -1 --format=%h", "none"), ("review", 'git log -1 --pretty="format:%h %s"', "none"),
        ("refuter", "git rev-parse @{u}", "none"), ("review", "git log -1 HEAD@{1}", "none"),
        ("closer", "git commit -m " + SQ + "feat(guard): one parse" + SQ, "none"),
        ("closer", "git commit -m " + SQ + "50%" + SQ, "deny"), ("closer", "git commit -m x@{a,b}", "deny")):
    got = decide(role, *bash(c))
    check("review 4 (%s): %r -> %s" % (role, c, want), got == want, got)
    if want == "deny" and got == "deny":
        got = decide(role, *bash(c), today="2026-11-12", mode="acceptEdits")
        check("review 4 (%s): %r -> deny before the switch, in acceptEdits too" % (role, c), got == "deny", got)
# 4, 6: indirect hook files, bare git dirs, Windows trailing dots and spaces
for role, path in (("implementer", CWD + "/.husky/pre-commit"), ("implementer", CWD + "/.pre-commit-config.yaml"),
                   ("implementer", CWD + "/lefthook.yml"), ("implementer", CWD + "/.lefthook.yml"),
                   ("implementer", "/srv/repo.git/hooks/update"), ("implementer", CWD + "/sub/x.git/config"),
                   ("implementer", CWD + "/.git./config"), ("implementer", CWD + "/.git /hooks/x"),
                   ("implementer", CWD + "/.husky. /pre-push"), ("qa-test", CWD + "/tests/.git./x")):
    got = decide(role, *edit(path))
    check("review 4 path (%s): %r -> deny" % (role, path), got == "deny", got)
check("review 4: .gitignore is not a control file", decide("implementer", *edit(CWD + "/.gitignore")) == "none")
# 5: the hooks directory from `git rev-parse --git-path hooks`; no git -> deny
got = decide("implementer", *edit(HR + "/hookdir/x"), cwd=HR)
check("item 5: rev-parse --git-path hooks resolves core.hooksPath -> deny", got == "deny", got)
nogit = dict(os.environ, PATH="")
got = decide("implementer", *edit(HR + "/src/a.py"), cwd=HR, env=nogit)
check("item 5: no git to resolve hooks, an edit under the repo -> deny (fails closed)", got == "deny", got)
got = decide("implementer", *edit(HR + "/src/a.py"), cwd=HR)
check("item 5: with git, the same edit -> no decision", got == "none", got)

# --- fourth Opus review (R-0271d): each bypass run, then refused ------------
# HIGH-1: shlex joins a run of operator characters into one token, which was
# read as a word, so an allow pattern matched past it. Every operator is now a
# deny for a guarded role, before the switch and in acceptEdits too.
for role, c in (("git-ops", "git status;(git push -f origin x)>|y"),
                ("git-ops", "git log >| out.txt"), ("closer", "git status;(git commit -n -m x)>|y"),
                ("git-ops", "git status&&(git push --force)"), ("qa-test", "pytest -q tests|&sh"),
                ("git-ops", "git log <<<x"), ("git-ops", "git log <<x"), ("git-ops", "git log <>x"),
                ("implementer", "git status;;git reset --hard"), ("git-ops", "git status &"),
                ("git-ops", "git commit -m ';(' "), ("review", "git diff 2>&1")):
    for mode in ("default", "acceptEdits"):
        got = decide(role, *bash(c), mode=mode)
        check("review 4d HIGH-1 (%s, %s): %r -> deny" % (role, mode, c), got == "deny", got)
# HIGH-2: an OPTIONAL-value short option takes the rest of its cluster and
# never the next word, so `-Sm -n` is key id `m` and then `-n`.
for role, c in (("closer", "git commit -Sm -n x"), ("closer", "git commit -um -n x"),
                ("closer", "git commit -Sm --no-verify x"), ("git-ops", "git commit -uSm -n x"),
                ("git-ops", "git branch -tC -f x"), ("git-ops", "git checkout -tb -f x"),
                ("git-ops", "git switch -tc -f x")):
    got = decide(role, *bash(c))
    check("review 4d HIGH-2 (%s): %r -> deny" % (role, c), got == "deny", got)
# `-Snq` is key id `nq` to git: no -n, so only the allowlist decides (asked);
# `-m -n` is the message "-n" to git, still denied by the agent file's text
# glob `git commit* -n` (an over-match, never a bypass).
for role, c, want in (("closer", "git commit -Snq -m x", "ask"),
                      ("closer", "git commit -m -n", "deny"), ("closer", "git commit -m x -n", "deny")):
    got = decide(role, *bash(c))
    check("review 4d HIGH-2 edge (%s): %r -> %s" % (role, c, want), got == want, got)
# MEDIUM: the user's ~/.claude.json and the session-loaded .claude paths.
for path in ("/home/u/.claude.json", "C:/Users/u/.claude.json", "/home/u/.CLAUDE.JSON",
             "/home/u/.claude.json. ", CWD + "/.claude/rules/x.md", "/home/u/.claude/rules/x.md",
             CWD + "/.claude/output-styles/x.md", CWD + "/.claude/workflows/x.js"):
    for role in ("implementer", "qa-test"):
        got = decide(role, *edit(path))
        check("review 4d MEDIUM (%s): %s -> deny" % (role, path), got == "deny", got)
check("review 4d: a .claude/worktrees/ checkout is still editable",
      decide("implementer", *edit("/r/.claude/worktrees/w/src/a.py"), cwd="/r/.claude/worktrees/w") == "none")

# --- fifth Opus review (R-0271e): each bypass run, then refused -------------
# HIGH-1/2: a long option taking its value as the next word takes `--` too,
# and git reads on as options (checked live with git 2.53: the hook skipped,
# the hook file written). Words after `--` are still options to the guard.
for role, c in (("closer", "git commit -m x --template -- -an"),
                ("closer", "git commit -m z --trailer -- -qn"),
                ("git-ops", "git commit -m x --template -- -an"),
                ("closer", "git log --decorate-refs -- --output=.git/hooks/pre-commit -1"),
                ("review", "git log --decorate-refs-exclude -- --output=x"),
                ("implementer", "git show --decorate-refs -- --output=x"),
                ("refuter", "git diff --no-index --src-prefix -- --output=x d1 d2"),
                ("run-scribe", "git log -L -- --output=out3.txt"),
                ("git-ops", "git push origin -- +HEAD:main")):
    got = decide(role, *bash(c))
    check("review 5e HIGH (%s): %r -> deny" % (role, c), got == "deny", got)
check("review 5e: a plain pathspec after -- still passes",
      decide("review", *bash("git log -- src/app.py")) == "none")
# LOW: `!` and `eval` run the rest; a shell or eval string with an operator.
for role, c in (("git-ops", "! git push --force origin HEAD"), ("git-ops", "eval git push -f"),
                ("git-ops", "eval 'git status;git push -f'"), ("git-ops", "sh -c 'git status;git push -f'")):
    for today in (TRIAL, SWITCH):
        got = decide(role, *bash(c), today=today)
        check("review 5e LOW (%s, %s): %r -> deny" % (role, today, c), got == "deny", got)
# MEDIUM: the guard's own rules, a plugin's manifest and hooks, the secret
# scan's config.
for path in (CWD + "/plugins/ai-toolbox-agents/hooks/role-guard.json",
             CWD + "/configs/claude-code/hooks/role-guard.py", CWD + "/plugins/p/hooks/hooks.json",
             CWD + "/plugins/p/.claude-plugin/plugin.json", CWD + "/.gitleaks.toml",
             CWD + "/tests/role-guard.sh"):
    for role in ("implementer", "qa-test"):
        got = decide(role, *edit(path))
        check("review 5e MEDIUM (%s): %s -> deny" % (role, path), got == "deny", got)

# --- H6: the launcher fails closed only for the guarded agents ---------------
LAUNCH = "configs/claude-code/hooks/role-guard.sh"


def launch(agent, stub, command="rm -rf x"):
    payload = {"session_id": "s", "transcript_path": "", "cwd": CWD, "hook_event_name": "PreToolUse",
               "tool_name": "Bash", "tool_input": {"command": command}, "tool_use_id": "t",
               "permission_mode": "default"}
    if agent:
        payload["agent_type"] = agent
    env = dict(os.environ, STUBDIR=os.environ["STUB_ROOT"] + "/" + stub)
    # Git Bash hands a native program a Windows path; turn it back for PATH.
    p = subprocess.run(["bash", "-c", 'd="$STUBDIR"; command -v cygpath >/dev/null 2>&1 && d=$(cygpath -u "$d"); '
                        'PATH="$d:$PATH" bash "$0" "$@"', LAUNCH,
                        "--config", CFG, "--today", TRIAL],
                       input=json.dumps(payload), capture_output=True, text=True, env=env)
    if p.returncode != 0:
        return "exit %d" % p.returncode
    return json.loads(p.stdout)["hookSpecificOutput"]["permissionDecision"] if p.stdout.strip() else "none"


for stub, label in (("nopy", "no working python"), ("crash", "a guard that crashes")):
    check("H6 %s: the main session -> no decision, exit 0" % label, launch(None, stub) == "none", launch(None, stub))
    check("H6 %s: an unguarded agent -> no decision" % label, launch("general-purpose", stub) == "none")
    check("H6 %s: a guarded agent -> deny" % label, launch("ai-toolbox-agents:git-ops", stub) == "deny",
          launch("ai-toolbox-agents:git-ops", stub))
check("H6 a working python: the launcher returns the guard's decision",
      launch("ai-toolbox-agents:git-ops", "none") == "ask", launch("ai-toolbox-agents:git-ops", "none"))
check("L2 the launcher passes non-ASCII input through to the guard, which denies it",
      launch("ai-toolbox-agents:git-ops", "none", "rm -rf café 日本") == "deny")
check("L2 non-ASCII input with no python: a guarded agent -> deny",
      launch("ai-toolbox-agents:git-ops", "nopy", "rm -rf café") == "deny")
check("H6 a working python: an allowed call passes", launch("ai-toolbox-agents:git-ops", "none", "git status") == "none")
check("another plugin's git-ops is not ours -> no decision",
      decide("someone-else:git-ops", *bash("rm -rf x")) == "none")
check("unreadable input -> deny", decide("git-ops", "Bash", {}, raw="{not json") == "deny")
check("a guarded agent with no role-guard.json -> deny",
      decide("git-ops", *bash("git status"), cfg=os.path.join(T, "missing.json")) == "deny")
check("main thread with no role-guard.json -> no decision",
      decide(None, *bash("git status"), cfg=os.path.join(T, "missing.json")) == "none")
check("a Bash call with no command for a guarded role -> deny",
      decide("git-ops", "Bash", {}) == "deny")

# --- the push rules TASK-0276 owns: asserted, not copied ---------------------
perms = json.load(open("configs/claude-code/settings.permissions.json"))["permissions"]
check("settings.permissions.json denies Bash(git push --force *)", "Bash(git push --force *)" in perms["deny"])
check("settings.permissions.json asks Bash(git push*)", "Bash(git push*)" in perms["ask"])
check("settings.permissions.json asks WebFetch", "WebFetch" in perms["ask"])
check("the role guard adds no permission rule of its own",
      not any("role-guard" in r for r in perms.get("deny", []) + perms.get("ask", [])))

# --- the emitter --------------------------------------------------------------
GUARDED = {"closer", "gate-runner", "git-ops", "implementer", "park-steward", "preflight",
           "qa-test", "refuter", "review", "run-scribe"}
check("role-guard.json lists the ten guarded roles", set(cfg_obj["roles"]) == GUARDED,
      sorted(cfg_obj["roles"]))
plain_out = open(os.path.join(T, "plain.out")).read()
check("a plain emission exits 0", open(os.path.join(T, "plain.rc")).read().strip() == "0", plain_out[-300:])
check("a plain emission writes no guarded role",
      not any(os.path.exists(os.path.join(T, "plain", r + ".md")) for r in GUARDED),
      sorted(os.listdir(os.path.join(T, "plain"))))
check("a plain emission prunes a stale unguarded copy and says so",
      "agent pruned: git-ops -> claude-code" in plain_out, plain_out[-300:])
check("--with-guard exits 0", open(os.path.join(T, "guarded.rc")).read().strip() == "0",
      open(os.path.join(T, "guarded.out")).read()[-300:])
emitted = {f[:-3] for f in os.listdir(os.path.join(T, "guarded"))}
check("--with-guard emits all 14 claude-code roles", len(emitted) == 14 and GUARDED <= emitted, sorted(emitted))
for r in sorted(GUARDED):
    f = os.path.join(T, "guarded", r + ".md")
    txt = open(f, encoding="utf-8").read() if os.path.isfile(f) else ""
    if "bash" in cfg_obj["roles"].get(r, {"bash": 1}):
        check("%s withholds PowerShell and Monitor" % r,
              "PowerShell" in txt and "Monitor" in txt)
for r in ("adjudicator", "task-planner"):
    txt = open(os.path.join(T, "guarded", r + ".md"), encoding="utf-8").read()
    check("no-bash role %s withholds Bash, PowerShell and Monitor" % r,
          "disallowedTools:" in txt and all(t in txt for t in ("Bash", "PowerShell", "Monitor")))

# --- the plugin carries the guard ---------------------------------------------
P = "plugins/ai-toolbox-agents"
hj = os.path.join(P, "hooks", "hooks.json")
check("the agents plugin ships hooks/hooks.json", os.path.isfile(hj))
if os.path.isfile(hj):
    groups = json.load(open(hj))["hooks"]["PreToolUse"]
    matcher = groups[0]["matcher"]
    cmd = groups[0]["hooks"][0]["command"]
    for tool in ("Bash", "PowerShell", "Monitor", "Edit", "Write", "NotebookEdit", "WebFetch",
                 "MultiEdit", "WebSearch") + WITHHELD + (
                 "mcp__.*",):
        check("the hook matcher covers %s" % tool, tool in matcher.split("|"), matcher)
    check("the hook runs the plugin's launcher, not python3 || exit 2 (H6)",
          cmd == 'bash "${CLAUDE_PLUGIN_ROOT}/hooks/role-guard.sh"', cmd)
for name, src in (("role-guard.py", GUARD), ("role-guard.sh", LAUNCH)):
    f = os.path.join(P, "hooks", name)
    check("the plugin's %s is the source's" % name, os.path.isfile(f) and
          open(f, "rb").read().replace(b"\r\n", b"\n") == open(src, "rb").read().replace(b"\r\n", b"\n"))
for r in sorted(GUARDED):
    f = os.path.join(T, "guarded", r + ".md")
    txt = open(f, encoding="utf-8").read() if os.path.isfile(f) else ""
    dis = next((l for l in txt.splitlines() if l.startswith("disallowedTools:")), "")
    check("%s withholds Workflow, CronCreate, SendMessage, EnterWorktree, ExitWorktree, TaskStop (H4)" % r,
          all(t in [x.strip() for x in dis.split(":", 1)[-1].split(",")] for t in WITHHELD), dis)
pj = os.path.join(P, "hooks", "role-guard.json")
check("the plugin's role-guard.json is a fresh generation",
      os.path.isfile(pj) and json.load(open(pj)) == cfg_obj)
for r in sorted(GUARDED):
    check("the plugin carries %s" % r, os.path.isfile(os.path.join(P, "agents", r + ".md")))

print("test-role-guard.sh: " + ("OK" if not fail else "FAILED"))
sys.exit(fail)
PY
