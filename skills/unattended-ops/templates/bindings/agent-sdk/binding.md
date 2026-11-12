---
# THE CLAUDE AGENT SDK BINDING, AS A TEMPLATE. Client-specific slots are
# answered; every slot that belongs to the consuming repository is a
# <FILL: ...> placeholder, so scripts/check-binding.sh rejects this file until
# a consumer fills it. That rejection is correct: an unfilled binding is not a
# declaration about a run.
binding_name: <FILL: what the consuming repository calls this binding>
client: claude-agent-sdk
driver_entry: <FILL: python3 <path>/runner.py --binding <path>/binding.md --run-id RUN_ID, from the repository root>
model: <FILL: per-role (each emitted definition's model) or one Claude alias or id for every role>
queue_source: <FILL: path of the queue file, written by a human before the run>
task_file_glob: <FILL: glob with {id} for the task id, e.g. .ai/tasks/{id}-*.md>
tracker_path: <FILL: the tracker file the closer updates one row of, or not-applicable (always, on a forge tracker)>
gate_map: <FILL: path of the gate map JSON, outside the repository — the runner refuses one inside>
gate_entry_point: <FILL: path of run-gate.sh (the OpenCode binding's) as copied into the repository>
long_gate_groups: <FILL: [group, ...] naming long_groups in the gate map, or not-applicable>
watchdog_timeout: <FILL: default gate timeout, e.g. 90m>
role_timeout: <FILL: the longest one role call may take, e.g. 30m>
evidence_file: <FILL: e.g. .run/unattended/<run-id>/evidence.txt — must be gitignored>
journal_file: <FILL: e.g. .run/unattended/<run-id>/journal.jsonl — must be gitignored>
run_id_source: passed in as --run-id by the operator; the runner never generates one
commit_shape: <FILL: the consuming repository's commit message shape, containing the task id>
stash_namespace: unattended/<run-id>/<task-id>
handover_path: <FILL: e.g. .run/unattended/<run-id>/handover.md — must be gitignored>
task_cap: <FILL: the most tasks one run will attempt>
agents_dir: <FILL: the directory scripts/emit-agents.py claude-code <dir> --with-guard wrote>
role_guard: <FILL: path of role-guard.py (configs/claude-code/hooks/ or the ai-toolbox-agents plugin's hooks/)>
role_guard_json: <FILL: path of role-guard.json from scripts/emit-agents.py --guard-json=>
sdk_settings: <FILL: [settings.sandbox.json, settings.permissions.json] paths, merged in order>
otel_settings: <FILL: path of settings.otel.json, or not-applicable>
permission_mode: acceptEdits
roles:
  preflight: preflight, primary
  task-planner: task-planner, primary
  implementer: implementer, primary
  gate-runner: gate-runner, primary
  refuter: refuter, primary
  adjudicator: adjudicator, primary
  closer: closer, primary
  park-steward: park-steward, primary
  run-scribe: run-scribe, primary
steps_declared:
  1: Driver.step1_preflight_repo() with SdkDriver.check_client_ready() and check_roles(), then preflight role
  2: Driver.step2_locks()
  3: Driver.step3_open()
  4: Driver.step4_deps()
  5: Driver.step5_plan()
  6: Driver.step6_implement()
  7: Driver.step7_gates() via run-gate.sh, then gate-runner role
  8: Driver.step8_refute()
  9: Driver.step9_adjudicate()
  10: Driver.step10_close()
  11: Driver.step11_park()
  12: Driver.journal(), plus a role-result line per SdkDriver.invoke()
  13: Driver.step13_long_gates()
  14: Driver.step14_handover()
---

# Binding — Claude Agent SDK runner (`runner.py`)

## What this binding is

A third driver for `loops/unattended-run/loop.md`, on the Claude Agent SDK
for Python, authored under `skills/unattended-ops/templates/bindings/agent-sdk/`
as `ADR-0022` clause 1.2 requires. It is a **trial**: `TASK-0284` adds it
beside the Claude Code Workflow binding so the two can be compared on the
golden unattended run, and a human picks one afterwards. The contract it
fills is `skills/unattended-ops/templates/binding.md`.

**It reuses the OpenCode driver rather than copying it.** `runner.py` imports
`../opencode/driver.py` (or a `driver.py` copied beside it, with its
`decision-standard.md`), and every step above is that driver's method. The
runner replaces only how a role is run, step 1's client checks, and what
preflight is handed. So the queue file, the gate map, `run-gate.sh`, the
journal's hash chain, the evidence file, the lock, the park and the handover
behave as `bindings/opencode/binding.md` describes, and its deviations are
this binding's too.

How a role is run: one `claude_agent_sdk.query()` per role call, with
`ClaudeAgentOptions` built from the role's definition as
`scripts/emit-agents.py claude-code <dir> --with-guard` emits it: the body is
the system prompt, and `model`, `tools`, `disallowedTools` and `maxTurns`
(the turn table, `.ai/context/turn-limits.md`, through the emitter) become the
options of the same names. A definition without `maxTurns` halts step 1, per
`templates/binding.md`'s rule that `unknown` is a stop.

## Reasons for every `not-applicable`

None in the template. A consumer that sets `tracker_path`,
`long_gate_groups` or `otel_settings` to `not-applicable` writes the reason
here, one line per slot, per `templates/binding.md`.

## Which rules this client enforces, and which it only asks for

| Rule (`skills/unattended-ops/`) | Enforced by | Strength |
|---|---|---|
| 1 — the tracker moves last, only the closer moves it | The role guard (`ADR-0062`) as a PreToolUse hook callback: the closer's Bash allowlist is the only one admitting `git add -- *` and `git commit -m *` | **Enforced** where `role-guard.json` covers the role; the ordering is the driver's control flow |
| 2 — gate commands from a hardcoded map | The OpenCode driver's own mechanism, reused: prompts carry handles, the map lives outside the repository | **Structural**, as on OpenCode; the disk half rests on the sandbox settings, not observed |
| 3 — long gates batched and detached | `run-gate.sh`, reused | As on OpenCode |
| 4 — nothing is invented | The OpenCode driver's evidence-line and log-line checks, reused | **Partly**, as on OpenCode |
| 5 — one writer | Step 1 refuses a dirty tree, reused | **Enforced** at start |

The guard callback calls `role-guard.py`'s own `decide()` with the role's
`agent_type` (`ai-toolbox-agents:<role>`) and `role-guard.json`, filtered and
failing closed as its `main()` does. It answers **deny** on a guard `deny`,
and also on a guard `ask`, because nobody answers a prompt in an unattended
run (`templates/binding.md`, inherited rule 2; `ADR-0062`). It never answers
`allow`, so the SDK's own permission rules, from `sdk_settings`, still decide
every call the guard passes (`ADR-0062`).

**Prompt-level on this client, stated rather than glossed** (`ADR-0022`,
"the capability asymmetry"): `task-planner` and `adjudicator` are not in
`role-guard.json`, so their read-only boundary is their `tools` list alone;
and the emitted `isolation: worktree` is not applied, because each role is a
top-level `query()` in the repository, not a subagent. Both are recorded for
the comparison note `TASK-0284` owes.

## The gate map's silent-no-op switches

As `bindings/opencode/binding.md` states them, because the map and
`run-gate.sh` are that binding's (`references/gate-map.md`). Per command:
`<FILL: one line per gate>`.

## Sandbox, permissions and telemetry

`sdk_settings` names `configs/claude-code/settings.sandbox.json` and
`settings.permissions.json` (`TASK-0276`); the runner merges them, writes the
result beside the evidence file as `sdk-settings.json`, and passes its path as
`ClaudeAgentOptions.settings` on every call. `otel_settings` names
`configs/claude-code/settings.otel.json` (`TASK-0279`): its `env`, plus
`OTEL_RESOURCE_ATTRIBUTES=run.id=<run-id>` and any `OTEL_*` the operator
exported, becomes `ClaudeAgentOptions.env`, as `tests/otel/` drives the
client. `permission_mode` is `acceptEdits`: in `default` every edit would
prompt, and per `templates/binding.md` rule 2 an unanswered prompt is a
refusal.

## The dependency

`claude-agent-sdk` (PyPI) is optional and imported lazily (`TASK-0284`, out of
scope: making it mandatory). `runner.py` imports without it and its tests run
without it, against `tests/stub_sdk/`; a run without it halts at step 1,
naming the package.

## Deviations

The OpenCode binding's seven, inherited with its control flow
(`bindings/opencode/binding.md`, *Deviations*), and one of its own:

1. **A `role-result` line per role call** in the journal (loop.md step 12
   permits the driver to write it): the SDK's result subtype, turns, cost and
   duration, the numbers `TASK-0284`'s comparison note records. A result at
   `error_max_turns` is a mechanical failure of the step (loop.md, "A step
   fails mechanically").

## What a complete binding does and does not prove

Passing `scripts/check-binding.sh` proves the slots are answered, every loop
step is declared, and no paragraph states an uncited rule — no more
(`templates/binding.md`). The tests under `tests/` prove the runner against a
**stub** SDK, which models the client rather than being it. No live model
call has run this binding; that is `TASK-0284`'s golden run, with the human's
authorization (`AGENTS.md`).
