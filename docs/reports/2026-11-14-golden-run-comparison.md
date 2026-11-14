# Golden unattended run: Agent SDK runner vs the Claude Code Workflow binding

S011.T026, 2026-11-14. The first live runs of both Claude-side bindings of
`loops/unattended-run/`, on the same fixture, with the human's authorization
and a $10 cap on API spend. The pick between them is the human's (decision D5=B
asked for evidence, not a switch); this note is the evidence.

## The fixture

A throwaway repository, never pushed: a tiny `calc.py` with unit tests and
three queued tasks, `S001.T001` multiply, `S001.T002` divide (zero divisor
raises), `S001.T003` power (negative exponent raises), each depending on the
one before. Gate map: `unit` per task, `compile` as the long group. One copy per
binding, each reset to its clean commit before a run. Model `claude-sonnet-5-5`
for every role.

## Results

| | Agent SDK runner (r3) | Workflow binding (w2) |
|---|---|---|
| Result | **3 of 3 closed**, every gate PASSED, long gate PASSED | **3 of 3 closed**, every gate PASSED |
| Parks, halts | none | none |
| Duration | about 6.4 min (21 role calls) | about 13.3 min (44 agents) |
| Cost | **$0.88**, from each `role-result` line's `cost_usd` (API key) | **3.55M subagent tokens**, the session's billing; no dollar figure |
| Interventions | none | none |
| Adjudicator overrides | none | 4, all advisory: two "the implementer could not show the gate" items the driver's gate run closed, one note on unspecified non-integer exponents, one line-ending warning |
| Guard denials | shell operators and a few out-of-allowlist reads, by the role guard hook; none blocked progress | not applicable: 7 of 9 roles run as default subagents with their boundary in the prompt |

## Earlier attempts and the defects they found

| Run | Binding | Outcome | Defect, and its fix |
|---|---|---|---|
| r1 | SDK | halted at preflight, $0.14 | Claude Code's sandbox shows placeholder paths (`.bashrc`, `.gitconfig`, `.mcp.json`, `.claude/`, …) in the working directory while a role runs, so the tree reads dirty. The consuming repository ignores them; `binding.md` says so |
| r2 | SDK | task 1 accepted, then halted at the park, $0.39 | Under `acceptEdits` every Bash command no rule allows needs approval, so the closer's commit and the park's stash were refused. `options()` now pre-approves each role's guard allowlist as `Bash(<pattern>)`; the guard hook stays the boundary (`d3a8223`) |
| w1 | Workflow | 1 of 3 closed, then halted (2.33M tokens, 8.4 min) | With `repoRoot` set, an implementer answered absolute paths and the commit check took git's repo-relative files for undeclared ones. `declared` is now repo-relative (`ff6f579`) |

Total API spend: $1.41 of the $10 cap.

## What differs beyond the numbers

- **Enforcement.** The SDK runner applies the role guard to all nine roles as
  a PreToolUse hook callback, plus Claude Code's sandbox and permission
  settings; removing the callbacks fails its guard fixture. The Workflow binding
  enforces nothing for seven roles: their boundaries are prompt text
  (`binding.md`, "which rules this client enforces").
- **Record.** The SDK runner's journal and evidence are written by code, with a
  `role-result` line per call carrying turns, cost and duration. The Workflow
  binding has no filesystem, so every journal line and git read goes through an
  agent; that is part of why it needs twice the agents.
- **Host.** Both ran on Windows only through WSL Ubuntu: the SDK runner as a
  whole (the driver needs `setsid` and `SIGHUP`), the Workflow binding for its
  gate entry point (`run-gate.sh` through a small WSL wrapper in the fixture).
- **Cost model.** The SDK runner spends API dollars a run can be capped on; the
  Workflow binding spends the session's tokens.

## Recommendation

Keep the **Agent SDK runner** as the Claude-side unattended binding: same
result, half the time, a dollar cost the run itself records, and the guard and
sandbox enforced rather than asked for. Keep the Workflow binding as the option
for a host where only a Claude Code session is available, documented as weaker.

To decide by the S011 checkpoint: pick one, or keep both with the Workflow
binding marked secondary.

## Not covered

- Runs were local, not a CI job (the brief's "in CI"). A CI job would need the
  WSL-free Linux runner and the same key and workspace variables as `evals-live`.
- One fixture, one model, one run each after the fixes: no variance measured.
