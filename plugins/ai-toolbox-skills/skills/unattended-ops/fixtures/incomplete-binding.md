---
# FIXTURE — a binding declaration carrying one instance of each defect
# scripts/check-binding.sh is claimed to catch. Evidence that the checker
# fails for the RIGHT REASON, named, rather than merely exiting non-zero.
# Every defect below is deliberate. Do not "fix" this file.
#
#   - `model: unknown`                  -> UNKNOWN SLOT
#   - `tracker_path:` left blank        -> EMPTY SLOT
#   - `stash_namespace` placeholder     -> PLACEHOLDER SLOT
#   - `commit_shape` in angle brackets  -> PLACEHOLDER SLOT (a second one,
#     because a value that merely LOOKS like a template is one: an unreplaced
#     `<...>` is the absence of an answer however plausible it reads)
#   - `task_cap` declared twice         -> DUPLICATE SLOT
#   - `handover_path` omitted entirely  -> MISSING SLOT
#   - steps 12, 13 and 14 not declared  -> UNDECLARED STEP
#   - step 15 declared                  -> PHANTOM STEP
#   - an uncited rule in the body       -> UNCITED RULE
binding_name: example-broken-driver
client: opencode
driver_entry: ./bin/unattended-run.sh
model: unknown
queue_source: queue.txt
task_file_glob: .ai/tasks/TASK-*.md
tracker_path:
gate_map: bin/gates.map
gate_entry_point: bin/invoke-gate.sh
long_gate_groups: [build]
watchdog_timeout: 90m
evidence_file: .run/evidence.md
journal_file: .run/journal.log
run_id_source: passed in as --run-id
commit_shape: "<imperative subject>"
stash_namespace: <FILL: the stash message prefix a park uses>
task_cap: 6
task_cap: 8
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
  15: tidy_up()
---

# Binding — example broken driver (fixture)

## What this is

A fixture carrying one instance of every defect the checker is claimed to
catch. It exists so the checker has been observed failing, by name, before it
was trusted to pass anything.

## An uncited rule, deliberately

The driver must always retry a refused close until it succeeds, and a gate
that times out is never reported to the operator.

Both sentences above are wrong as well as uncited, which is the point: a
binding that states its own rules can state rules that contradict the ones it
was supposed to implement, and nothing about its prose makes that visible.
