---
# FIXTURE — a binding declaration with every slot answered. Evidence that
# scripts/check-binding.sh accepts a complete declaration, produced by hand
# alongside fixtures/incomplete-binding.md, which it rejects. Neither is a
# real binding and neither drives anything.
binding_name: example-opencode-driver
client: opencode
driver_entry: ./bin/unattended-run.sh --queue queue.txt
model: anthropic/claude-sonnet-4-5
queue_source: queue.txt, one task id per line, written by a human before the run
task_file_glob: .ai/tasks/TASK-*.md
tracker_path: .ai/tasks/TODO.md
gate_map: bin/gates.map — one entry per task kind, role-blind
gate_entry_point: bin/invoke-gate.sh
long_gate_groups: [build, integration]
watchdog_timeout: 90m
evidence_file: .run/<run-id>/evidence.md
journal_file: .run/<run-id>/journal.log
run_id_source: passed in as --run-id by the operator's shell
commit_shape: imperative subject of 72 characters or fewer, one logical change
stash_namespace: "unattended/<run-id>/<task-id>"
handover_path: .run/<run-id>/handover.md
task_cap: 6
roles:
  preflight: example-preflight, primary
  task-planner: example-task-planner, primary
  implementer: example-implementer, primary
  gate-runner: example-gate-runner, primary
  refuter: example-refuter, primary
  adjudicator: example-adjudicator, primary
  closer: example-closer, primary
  park-steward: example-park-steward, primary
  run-scribe: example-run-scribe, primary
steps_declared:
  1: preflight_repo_state()
  2: preflight_task_locks()
  3: open_run()
  4: select_next_task()
  5: plan_task()
  6: implement()
  7: run_gates()
  8: refute()
  9: adjudicate()
  10: close()
  11: park_cleanup()
  12: journal()
  13: batched_long_gates()
  14: write_handover()
---

# Binding — example OpenCode driver (fixture)

## What this is

A fixture. It exists so `scripts/check-binding.sh` has been observed
accepting a complete declaration, immediately after being observed rejecting
`fixtures/incomplete-binding.md`. A checker nobody has watched fail is a
checker nobody should trust.

Nothing here is a real driver: the paths are invented, the agent names are
invented, and no run has ever used it.

## Reasons for every `not-applicable`

None. Every slot in this fixture carries a value, which is the point of it.

## Which rules this client enforces, and which it only asks for

OpenCode expresses per-agent command boundaries, so rules 1, 2 and 5 are
enforced by the role permission maps in `agents/`; rules 3 and 4 are
prompt-level here as everywhere. `skills/unattended-ops/references/five-rules.md`
owns what each rule is; this section only records which of them this client
can hold.

## The gate map's silent-no-op switches

`bin/gates.map` records, per command, the switch without which it exits 0
having done nothing and the parameter without which it prompts and hangs —
see `skills/unattended-ops/references/gate-map.md`, whose rule E is the one
this section answers.

## Deviations

None. Every numbered step of `loops/unattended-run/loop.md` is declared above.
