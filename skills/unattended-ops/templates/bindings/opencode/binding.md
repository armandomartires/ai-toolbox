---
# THE OPENCODE BINDING, AS A TEMPLATE. Client-specific slots are answered;
# every slot that belongs to the consuming repository is a <FILL: ...>
# placeholder, so scripts/check-binding.sh rejects this file until a consumer
# fills it. That rejection is correct: an unfilled binding is not a
# declaration about a run.
binding_name: <FILL: what the consuming repository calls this binding>
client: opencode
driver_entry: <FILL: python3 <path>/driver.py --binding <path>/binding.md --run-id RUN_ID, from the repository root>
model: <FILL: provider/model, passed as -m on every opencode run>
queue_source: <FILL: path of the queue file, written by a human before the run>
task_file_glob: <FILL: glob with {id} for the task id, e.g. .ai/tasks/{id}-*.md>
tracker_path: <FILL: the tracker file the closer updates one row of, or not-applicable>
gate_map: <FILL: path of the gate map JSON>
gate_entry_point: <FILL: path of run-gate.sh as copied into the repository>
long_gate_groups: <FILL: [group, ...] naming long_groups in the gate map, or not-applicable>
watchdog_timeout: <FILL: default gate timeout, e.g. 90m>
role_timeout: <FILL: the longest one role call may take, e.g. 30m>
evidence_file: <FILL: e.g. .run/unattended/<run-id>/evidence.txt — must be gitignored>
journal_file: <FILL: e.g. .run/unattended/<run-id>/journal.jsonl — must be gitignored>
run_id_source: passed in as --run-id by the operator; the driver never generates one
commit_shape: <FILL: the consuming repository's commit message shape, containing the task id>
stash_namespace: unattended/<run-id>/<task-id>
handover_path: <FILL: e.g. .run/unattended/<run-id>/handover.md — must be gitignored>
task_cap: <FILL: the most tasks one run will attempt>
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
  1: Driver.step1_preflight_repo() then preflight role
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
  12: Driver.journal()
  13: Driver.step13_long_gates()
  14: Driver.step14_handover()
---

# Binding — OpenCode driver (`driver.py` + `run-gate.sh`)

## What this binding is

The OpenCode driver for `loops/unattended-run/loop.md`. It is authored under
`skills/unattended-ops/templates/bindings/opencode/` as `ADR-0022` clause 1.2
requires, and a consuming repository copies the directory and fills the
placeholders above. The template contract it fills is
`skills/unattended-ops/templates/binding.md`.

Three files: `driver.py` holds the control flow; `run-gate.sh` is the
detaching gate entry point (`references/long-gates.md`); `tests/` exercises
both against a stub `opencode`. The driver reads this file's frontmatter and
refuses to start on any slot that is blank, `unknown` or a placeholder, per
`templates/binding.md`.

## Reasons for every `not-applicable`

None in the template. A consumer that sets `tracker_path` or
`long_gate_groups` to `not-applicable` writes the reason here, one line per
slot — `templates/binding.md` treats a reasonless `not-applicable` as an
`unknown` in disguise.

## Which rules this client enforces, and which it only asks for

OpenCode is the one client with per-agent command boundaries (`ADR-0022`,
"the capability asymmetry"). What is enforced, and by what:

| Rule (`skills/unattended-ops/`) | Enforced by | Strength |
|---|---|---|
| 1 — the tracker moves last, only the closer moves it | The closer is the only role whose allowlist admits `git add -- *` and `git commit -m *` (`agents/closer/`); the driver issues no git write | **Enforced** at the role boundary; the ordering itself is the driver's control flow |
| 2 — gate commands from a hardcoded map | The driver invokes `run-gate.sh`; prompts carry gate handles and the evidence path, never a command | **Structural** — no agent is handed a command string |
| 3 — long gates batched and detached | `run-gate.sh` detaches behind a watchdog; step 13 runs groups one at a time | **Enforced** by construction; `ADR-0022` F7 untested |
| 4 — nothing is invented | Evidence-line cross-check in `Driver.gate_report()`; out-of-enum verdict → `park` | **Partly** — a figure copied into a task file by the closer is prompt-level |
| 5 — one writer | `Driver.step1_preflight_repo()` refuses a dirty tree before any role runs | **Enforced** at start; a peer session arriving mid-run is not detected |

**Still prompt-level on this client, stated rather than glossed:**
`git add -- .` cannot be closed at the glob layer (`TASK-0083`) and lives as
prose in `agents/closer/`; this driver does not stage on the closer's behalf,
so it adds no bypass, but it does not close the hole either.

## The gate map's format, and its silent-no-op switches

The map is JSON, the consumer's, and it is read by the driver and by
`run-gate.sh` only — `references/gate-map.md` owns why no agent reads it:

```json
{
  "gates": {
    "<gate>": {"argv": ["cmd", "--switch-that-makes-it-do-work"],
               "cwd": ".", "timeout_seconds": 600, "skip_exit": 77}
  },
  "kinds": {"default": ["<gate>", "..."]},
  "long_groups": {"<group>": {"gates": ["<gate>"], "paths": ["src/*"]}}
}
```

`argv` is executed without a shell. `skip_exit`, when given, is the exit code
that means SKIP rather than FAIL, keeping the three outcomes of
`references/gate-map.md` rule D distinct.

Per command, the switch without which it exits 0 having done nothing and the
parameter without which it prompts and hangs: `<FILL: one line per gate>`.
An unknown switch makes `gate_map` `unknown` (`references/gate-map.md`,
rule E), and the run does not start.

## The queue file

One task per line: `<task-id> [kind=<kind>] [after=<id>,<id>]`, `#` starts a
comment. `kind` selects an entry of the map's `kinds` and defaults to
`default`; `after` names tasks in the same queue whose close this one waits
for (loop.md step 4). A dependency closed before the run is not listed.

## Deviations

Each is recorded here because `templates/binding.md` says a deviation is a
defect until a human says otherwise.

1. **The driver invokes the gate entry point; `gate-runner` reads and
   reports.** loop.md step 7 names `gate-runner` as the actor, and
   `agents/gate-runner/` says it runs the entry point. `ADR-0022` ("two things
   the port makes better") and `references/gate-map.md` say the driver
   invokes it. loop.md says the ADR wins where they disagree, so this binding
   follows `ADR-0022`. The disagreement between the three sources is a finding
   for the human, not resolved here.
2. **The driver writes the journal itself** (loop.md step 12 permits "the
   driver where it has filesystem access"); `run-scribe` writes only the
   handover.
3. **Step 2's tracker-disagreement threshold is zero**: any disagreement
   halts, the strictest reading of loop.md step 2.
4. **`raise-adhoc` as the sole verdict parks the task** with the titles
   recorded, because `references/verdicts.md` makes it orthogonal to done and
   the task's own criteria are therefore not accepted.
5. **An `accept` over `refuted: true` with an empty overrides list is read as
   `park`**, from `references/verdicts.md`'s definition of `accept`.
6. **A `halt-run` skips step 13.** loop.md says step 14 runs on a halt and is
   silent on step 13.
7. **Dry run** (`--dry-run`) runs steps 1–5 and 7 on the untouched tree, then
   step 14 — the "dry-run first" of the pilot (`SPRINT-CURRENT.md`, S10.7).

## What a complete binding does and does not prove

Passing `scripts/check-binding.sh` proves the slots are answered, every loop
step is declared, and no paragraph states an uncited rule — no more
(`templates/binding.md`). It does not prove the driver implements a step
correctly; the tests under `tests/` prove it against a **stub** `opencode`,
which models the client rather than being it. A real run is the pilot's.
