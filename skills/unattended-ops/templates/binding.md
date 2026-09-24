---
# THIS IS A TEMPLATE, NOT A BINDING. Every value below is a placeholder in
# <ANGLE BRACKETS> and is deliberately not a legal value, so this file fails
# scripts/check-binding.sh if anyone points the checker at it. That failure is
# correct: a template is not a declaration about a run.
binding_name: <FILL: what this binding is called>
client: <FILL: opencode | claude-code | other, named>
driver_entry: <FILL: the command that starts a run, verbatim>
model: <FILL: the explicit provider/model passed, or how a default is guaranteed>
queue_source: <FILL: where the queue of settled tasks comes from>
task_file_glob: <FILL: the glob resolving a task id to exactly one file>
tracker_path: <FILL: the file whose row the closer updates, or not-applicable>
gate_map: <FILL: where the map lives — the file, not the commands>
gate_entry_point: <FILL: the one detaching entry point every long gate goes through>
long_gate_groups: <FILL: the groups batched after the cycle, or not-applicable>
watchdog_timeout: <FILL: the timeout the watchdog enforces, with units>
evidence_file: <FILL: path of the run's evidence file>
journal_file: <FILL: path of the append-only run journal>
run_id_source: <FILL: where the run identifier comes from — it is passed in>
commit_shape: <FILL: the commit message shape the closer produces>
stash_namespace: <FILL: the stash message prefix a park uses>
handover_path: <FILL: where the handover is written>
task_cap: <FILL: the maximum number of tasks this run will attempt>
roles:
  # One entry per role the driver invokes: the agent name it resolves to and
  # its mode. Every driver-invoked role is `primary` — see the note below.
  <FILL-role-name>: <FILL: agent-name, mode>
steps_declared:
  # One entry per numbered step of loops/unattended-run/loop.md, naming what
  # in this binding implements it. The checker reads the step numbers from the
  # loop file, not from a copy held here.
  <FILL-step-number>: <FILL: the function, stage or prompt that implements it>
---

# Binding — `<FILL: short description>`

## What a binding is

A binding is **one client's driver** for `loops/unattended-run/loop.md`. It
holds the control flow — the queue, the bounds, the verdict dispatch and the
gate command map — and it **carries no rule of its own** (`ADR-0022`
clause 1.2). Every rule it enforces has its source in a client-agnostic
artifact:

- the **sequence and its exit conditions** → `loops/unattended-run/loop.md`;
- the **method, the vocabulary and the why** → `skills/unattended-ops/`;
- the **roles and their permission boundaries** → `agents/`;
- the destructive-change rule, the secrets rule, the one-task-one-commit rule
  and the definition of done → the consuming repository's `AGENTS.md`.

**A binding that states a rule the loop and the skill do not is a defect**
(`ADR-0022` clause 1.4). `scripts/check-binding.sh` checks the mechanical part
of that: that every numbered step is declared, and that no normative sentence
in the body is uncited.

Copy this file to `templates/bindings/<client>/binding.md` when authoring one
for a client in this repository, or into the consuming repository beside the
driver it describes. **The OpenCode binding ships under
`templates/bindings/opencode/` (`TASK-0086`); the Claude Code one is
`TASK-0087`, and Bionic's is S10.4.**

## The one rule that makes the rest of it mean something

> **Every unfilled slot reads `unknown`, and `unknown` is a stop.**

Not a warning to note and continue past, and not something a plausible value
resolves. The legal outcomes for any slot are a real answer, an explicit
`not-applicable` **with its reason in the body**, or a stop. There is no
fourth outcome in which a default is quietly substituted for an answer nobody
has — that substitution produces a binding that *looks* complete, which is the
single failure this contract exists to prevent.

`not-applicable` is a deliberate declaration by a person. `unknown` means
nobody knows. A blank, a placeholder or an omitted slot is **missing**, never
an implicit `not-applicable` — the same distinction `skills/ansible-ops/`
draws for its change record, and it is the whole mechanism: if
`not-applicable` becomes a polite spelling of `unknown`, this contract is
decoration.

## The slots, and why a run cannot derive them

| Slot | What it answers | Why it cannot be derived |
|------|-----------------|--------------------------|
| `binding_name` | Which binding this is | — |
| `client` | Which client's driver this is | Decides which rules are **enforced** and which are prompt-level. This harness is OpenCode-first; under other clients the boundaries are weaker by construction |
| `driver_entry` | How a run starts | — |
| `model` | The explicit `provider/model`, or how a configured default is guaranteed | **`opencode run` with no configured default model and no TTY hangs indefinitely — no output, no error, no exit** (`ADR-0022` clause 5.3, observed 2026-09-23). This is the failure a nightly run hits at 3am with nothing in the log to explain it |
| `queue_source` | Where the settled queue comes from | Nothing in the run selects its own work |
| `task_file_glob` | How a task id resolves to exactly one file | **The committed task file is the lock** (`ADR-0022` clause 3). Zero matches or several is a preflight halt |
| `tracker_path` | The one file whose row the closer updates | Project-specific, and the only other file the closer may touch |
| `gate_map` | Where the gate commands live | **Never the task file** (rule 2). `references/gate-map.md` |
| `gate_entry_point` | The one detaching entry point | Rule 3, and the single choke point a `gate-runner`'s boundary allowlists |
| `long_gate_groups` | What is batched after the cycle | `references/long-gates.md` |
| `watchdog_timeout` | When a wedged gate becomes a stated timeout | A run that does not know this discovers it by hanging |
| `evidence_file` | The only admissible source for a figure | `references/evidence.md` |
| `journal_file` | The append-only record the handover is re-derived from | Nothing is reconstructable from an agent's recollection |
| `run_id_source` | Where the run identifier comes from | It is **passed in**. `Date.now()` and `Math.random()` throw inside a Claude Code Workflow script, and rule 4 forbids inventing one anyway |
| `commit_shape` | What the closer's commit message looks like | Project-specific; `AGENTS.md`'s one-task-one-commit rule is not |
| `stash_namespace` | The prefix a park's stash message carries | The recovery instruction. `references/park-and-recover.md` |
| `handover_path` | Where the handover is written | A run whose handover nobody will read has no terminus |
| `task_cap` | The most tasks this run will attempt | Bounds the night. Not the attempt bound, which is the loop's |
| `roles` | Role → agent name and mode | **Every driver-invoked role must be `primary`.** A `subagent`-mode role is **silently replaced by the default agent**, which answers with well-formed output and exit 0 (`ADR-0022` clause 5.1). A driver reading only stdout cannot tell that the wrong agent ran |
| `steps_declared` | What implements each numbered step | The loop is authoritative for the sequence; a binding **cites** it. This is the slot `scripts/check-binding.sh` checks against the loop file itself |

## Four rules a binding inherits and may not restate differently

Stated here as the **inherited** form, with the owner named, because a binding
that paraphrases one of them becomes a second owner that drifts:

1. **Staging uses `git add -- <path>`, by name, always** (`ADR-0022`
   clause 5.4). The boundary that denies `git add -A` and `git add .` also
   denies `git add ./sub/file` for want of the `--`, so the form is part of
   the instruction rather than a preference. A role told only "stage what you
   changed" will be blocked doing the right thing and may conclude staging is
   broken.
2. **Boundaries are declared as explicit denials, never as prompts**
   (`ADR-0022` clause 4.1). Unattended, an `ask` **auto-denies** and reports
   *"The user rejected permission to use this specific tool call"* with no user
   present, so a prompt launders an automatic refusal into an apparent human
   one. `push-requires-confirmation` is meaningless in an unattended run.
3. **A null, empty or unparseable refuter return is `refuted: true`,
   synthesised by the driver** (`references/return-schemas.md`). Not the
   role's job, not a mechanical failure, not retried.
4. **An unparseable or out-of-enum verdict is `park`, never `accept`.**
   Reprompt once, journal the reprompt, then park.

## Body — the reasoning the frontmatter cannot hold

The frontmatter is the checked surface; the body is where the reasoning lives,
and it is the only place an omission goes undetected. Write it anyway.

### Reasons for every `not-applicable`

One line each, naming the slot. A `not-applicable` with no reason here is an
`unknown` in disguise. `<FILL>`

### Which rules this client **enforces**, and which it only asks for

Per-agent command boundaries exist on some clients and not others. State which
of the five rules this binding can enforce mechanically and which are
prompt-level. **Do not describe the two as equivalent.** `<FILL>`

### The gate map's silent-no-op switches

Per command: the switch without which it exits 0 having done nothing, and the
parameter without which it prompts and hangs. If one is unknown, the
`gate_map` slot reads `unknown` and this binding does not run.
`references/gate-map.md`. `<FILL>`

### Deviations

Anything this binding does differently from the loop's steps, and why. **A
deviation is a defect until a human says otherwise** — record it here rather
than resolving it in the driver. `<FILL>`

## What a complete binding does and does not prove

A binding that passes `scripts/check-binding.sh` proves that **its slots are
present, none is blank, a placeholder or `unknown`, none is declared twice,
every numbered step of the loop is declared, and no normative sentence in its
body is uncited.**

That is all. It does not prove the binding implements a step correctly, that
the gate map's commands do any work, that the roles it names exist, or that a
run driven by it would be safe. The checker validates a declaration, not a
driver. **This caveat is part of the artifact and is not to be softened.**
