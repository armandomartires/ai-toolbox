---
# THE CLAUDE CODE BINDING, AS A TEMPLATE. Client-specific slots are answered;
# every slot that belongs to the consuming repository is a <FILL: ...>
# placeholder, so scripts/check-binding.sh rejects this file until a consumer
# fills it. That rejection is correct: an unfilled binding is not a
# declaration about a run.
binding_name: <FILL: what the consuming repository calls this binding>
client: claude-code
driver_entry: "Workflow({ name: 'unattended-run', args: { runId, binding, queue, gatesByKind, longGroups, dryRun } }) — unattended-run.js copied into .claude/workflows/"
model: inherited from the Claude Code session by every agent() call; no per-agent model is set
queue_source: <FILL: who writes args.queue, and from what — a human, before the run>
task_file_glob: <FILL: glob with {id} for the task id, passed as args.binding.task_file_glob>
tracker_path: <FILL: the tracker file the closer updates one row of, or not-applicable>
gate_map: <FILL: path of the gate map JSON read by run-gate.sh, passed as args.binding.gate_map>
gate_entry_point: <FILL: path of run-gate.sh (the OpenCode binding's), passed as args.binding.gate_entry_point>
long_gate_groups: <FILL: the groups in args.longGroups, or not-applicable>
watchdog_timeout: <FILL: default gate timeout, e.g. 90m>
evidence_file: <FILL: e.g. .run/unattended/<run-id>/evidence.txt — must be gitignored>
journal_file: <FILL: e.g. .run/unattended/<run-id>/journal.jsonl — must be gitignored>
run_id_source: passed in as args.runId by the operator; Date.now() and Math.random() throw inside a workflow script
commit_shape: <FILL: the consuming repository's commit message shape, containing the task id>
stash_namespace: unattended/<run-id>/<task-id>
handover_path: <FILL: e.g. .run/unattended/<run-id>/handover.md — must be gitignored>
task_cap: <FILL: the most tasks one run will attempt>
roles:
  preflight: workflow subagent, prompt-level boundary
  task-planner: agentType task-planner, emitted definition
  implementer: workflow subagent, prompt-level boundary
  gate-runner: workflow subagent, prompt-level boundary
  refuter: workflow subagent, prompt-level boundary
  adjudicator: agentType adjudicator, emitted definition
  closer: workflow subagent, prompt-level boundary
  park-steward: workflow subagent, prompt-level boundary
  run-scribe: workflow subagent, prompt-level boundary
steps_declared:
  1: preflight() — the preflight role, read-only
  2: preflight() — the same call, lock verification
  3: journal run-start
  4: step4Deps()
  5: step5Plan()
  6: step6Implement()
  7: step7Gates() via runGates() and run-gate.sh
  8: step8Refute()
  9: step9Adjudicate()
  10: step10Close() with verifyHead() before and after
  11: step11Park()
  12: journal() — run-scribe appends each line
  13: step13LongGates()
  14: step14Handover()
---

# Binding — Claude Code Workflow (`unattended-run.js`)

## What this binding is

The Claude Code driver for `loops/unattended-run/loop.md`, authored under
`skills/unattended-ops/templates/bindings/claude-code/` as `ADR-0022`
clause 1.2 requires: a Workflow script template, de-domained from
`asset-management`'s `arm-autopilot.js` (A119), plus this declaration. The
contract it fills is `skills/unattended-ops/templates/binding.md`.

A consuming repository copies `unattended-run.js` into its own
`.claude/workflows/` and fills the slots above. A Workflow script cannot read
files, so the slots also travel in the run's `args` — the frontmatter is the
checked declaration, `args` is what the script reads, and a mismatch between
the two is the consumer's to prevent (`templates/binding.md`, "what a
complete binding does not prove").

## The `args` shape

```json
{
  "runId": "20260924-0100",
  "dryRun": false,
  "binding": {
    "task_file_glob": ".ai/tasks/{id}-*.md", "tracker_path": "TODO.md",
    "gate_map": "gates.json", "gate_entry_point": "path/to/run-gate.sh",
    "watchdog_timeout": "90m", "task_cap": "3",
    "evidence_file": ".run/unattended/<run-id>/evidence.txt",
    "journal_file": ".run/unattended/<run-id>/journal.jsonl",
    "handover_path": ".run/unattended/<run-id>/handover.md",
    "commit_shape": "TASK-ID: imperative subject",
    "stash_namespace": "unattended/<run-id>/<task-id>"
  },
  "queue": [{"id": "TASK-0001", "kind": "default", "after": []}],
  "gatesByKind": {"default": ["unit", "lint"]},
  "longGroups": {"build": {"gates": ["build"], "paths": ["src/*"]}},
  "agentTypes": {}
}
```

`gatesByKind` and `longGroups` carry gate **names** only; the commands stay in
the gate map, read by `run-gate.sh` (`references/gate-map.md`). A name the map
does not have comes back `MISSING` from the entry point and is reported
`NOT-RUN`, so a drift between the two is visible rather than silent.
`agentTypes` overrides the two agent-type names, for a consumer that emits the
roles under other names. The script refuses before any agent runs on a
missing run id or any blank, `unknown` or `<FILL>` value
(`templates/binding.md`).

## Reasons for every `not-applicable`

None in the template. A consumer that sets `tracker_path` or
`long_gate_groups` to `not-applicable` writes the reason here — a reasonless
`not-applicable` is an `unknown` in disguise (`templates/binding.md`).

`model` is answered rather than `not-applicable`: every `agent()` call
inherits the session's model, so `ADR-0022` clause 5.3's failure — an
OpenCode run with no model hanging silently — has no counterpart here.

## Which rules this client enforces, and which it only asks for

**Weaker by construction than the OpenCode binding, and not equivalent**
(`ADR-0022`, "the capability asymmetry"; `skills/unattended-ops/`,
"Division of labour"). A Workflow script has no shell and no filesystem, and
Claude Code has no per-agent command boundary (`ADR-0018` clause 8.3), so:

| Rule (`skills/unattended-ops/`) | Here | Strength |
|---|---|---|
| 1 — the tracker moves last, only the closer moves it | The ordering is the script's control flow; the closer runs only after `accept`. No other prompt asks for a git write — asserted by the tests | **Ordering enforced; the boundary is prompt-level**. The implementer has git available and is only told not to use it |
| 2 — gate commands from a hardcoded map | The script never holds a command: prompts carry gate names, handles and the entry point | **Instructed, not structural.** The gate-runner has file tools and could open the map; in the OpenCode binding it cannot see a command at all |
| 3 — long gates batched and detached | Through `run-gate.sh`, polled inside the ten-minute cap; step 13 runs groups one at a time | **Enforced by the entry point**; `ADR-0022` F7 untested |
| 4 — nothing is invented | Schema-forced returns; out-of-enum or null verdict → `park`; an evidence line whose handle does not match is `NOT-RUN` | **Partly** — the script cannot read the evidence file, so it checks the shape of a reported line, not its presence |
| 5 — one writer | Preflight's porcelain must be empty | **Reported by an agent**, not checked by the script |

**Two things are cross-checked by a second agent because the script cannot
run git**: the closer's commit (`verifyHead()` before and after, from the
preflight role) and a park's clean tree (the park-steward's reported
porcelain). A second agent is a witness, not a gate.

**What is stronger here than in OpenCode:** a `schema` forces the return
shape (`references/return-schemas.md`), so an unparseable return reaches the
script only as `null`, and the reprompt rate `ADR-0022` F3 asks about should
be lower.

## Deviations

Each is recorded here because `templates/binding.md` says a deviation is a
defect until a human says otherwise. Numbers 1–6 match the OpenCode binding's
(`templates/bindings/opencode/binding.md`) so the two can be read side by
side.

1. **The gate-runner invokes the entry point**, as loop.md step 7 and
   `agents/gate-runner/` say — the *opposite* of the OpenCode binding, which
   follows `ADR-0022`'s "the driver invokes it". A Workflow script has no
   shell, so there is no driver to do it. The three-way disagreement is
   recorded in `TASK-0086` as a finding for the human.
2. **Journal lines are appended by `run-scribe`**, one call per event
   (loop.md step 12), because the script has no filesystem.
3. **Step 2's tracker-disagreement threshold is zero**, the strictest
   reading of loop.md step 2.
4. **`raise-adhoc` as the sole verdict parks the task**, titles recorded
   (`references/verdicts.md`).
5. **`accept` over `refuted: true` with no overrides is `park`**
   (`references/verdicts.md`).
6. **A `halt-run` skips step 13**; loop.md step 14 still runs.
7. **Dry run** (`args.dryRun`) runs steps 1–5 and 7, then 14.
8. **An `agent()` that throws halts the run.** An unresolvable `agentType` is
   the likely cause, and it fails the same way on every retry — the Claude
   Code analogue of `ADR-0022` clause 5.1's silent fallback, made loud.

## What a complete binding does and does not prove

Passing `scripts/check-binding.sh` proves the slots are answered, every loop
step is declared, and no paragraph states an uncited rule — no more
(`templates/binding.md`). The tests under `tests/` prove the script's control
flow against a **stub** Workflow runtime. Neither is a Workflow run.
