# TASK-0087 — S10.2: the Claude Code Workflow binding

## Objective

Ship the **Claude Code binding** for `loops/unattended-run/loop.md`: a
Workflow-script template, de-domained from `asset-management`'s
`arm-autopilot.js`, plus its binding declaration, under
`skills/unattended-ops/templates/bindings/claude-code/` (`ADR-0022`
clause 1.2). The template **carries no rule of its own**: every rule it
applies cites the loop or the skill.

## Minimal context

### What "de-domained" means here, concretely

`arm-autopilot.js` (A119, 700 lines, read 2026-09-23) mixes three things that
must be separated:

| In the JS today | Where it goes |
|---|---|
| `WORKLIST` (S024–S028 task list), `CMD` / `STATIC_GATES` / `STAGE_GATES` (the PowerShell gate map), `GATE = Invoke-Gate.ps1`, `RUN_ROOT = build/logs/autopilot/…`, `HOUSE_RULES` | **The consuming repo**, via the binding's slots (`queue_source`, `gate_map`, `gate_entry_point`, `long_gate_groups`, `evidence_file`, …) passed in as Workflow `args` |
| The five rules, stated in a comment block and re-stated inside prompts | **Cited, not restated** — `skills/unattended-ops/` owns them. A prompt may quote a rule only with its citation |
| Control flow: preflight → plan → implement → gate → refute → adjudicate → close → batched gates → handover; schemas; verdict dispatch | **The template**, one stage per numbered loop step, each citing its step number |

### Corrections the template must make, not inherit

1. **A null refuter fails closed.** In the JS a refuter returning nothing
   flows into the adjudicator as an absence of objections. The template
   synthesises `refuted: true` on a null, empty or unparseable return, and
   does not retry it.
2. **An out-of-enum or unparseable verdict is `park`, never `accept`.** The
   Workflow runtime forces a return shape where a `schema` is given, which is
   stronger than OpenCode — but a null return from a failed agent is still
   possible and must dispatch to `park`.

### What this binding cannot do, which must be stated rather than glossed

- **Seven of nine roles are OpenCode-only** (`ADR-0022` Consequences). Under
  Claude Code the acting roles' boundaries are **prompt-level, weaker by
  construction**. The binding's *"which rules this client enforces"* section
  says so plainly and does not describe the two clients as equivalent.
- **Rule 2 is only asked for, not structural,** unless the gate-runner reaches
  gates by *name* through the gate server (`TASK-0088`). A Workflow script has
  no shell of its own; if gate commands are passed to an agent, rule 2 is an
  instruction. Record which of the two the template does; **do not make the
  template depend on `TASK-0088`**, which may land later.
- The run id is **passed in** — `Date.now()` and `Math.random()` throw inside a
  Workflow script (`ADR-0022`, re-verified).

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `loops/unattended-run/loop.md` | `TASK-0061` | Authoritative numbered step list |
| `skills/unattended-ops/` incl. `templates/binding.md`, `scripts/check-binding.sh` | `TASK-0062` | v1.0.0; checker proven red-then-green |
| `agents/task-planner/`, `agents/adjudicator/` | `TASK-0063` | The two roles that port to Claude Code |
| `../asset-management/.claude/workflows/arm-autopilot.js` | A119 | 700 lines. **Read-only reference, not edited** (`PLAN-0006`) |
| Claude Code Workflow runtime | pre-existing | `claude` CLI present; `agent()`, `args`, `meta`, `schema` as used by the JS |
| `node` | pre-existing | v22 — for a syntax check and the stub harness below |

**Verify the expected state; don't assume it.**

## Scope

### Included

- `skills/unattended-ops/templates/bindings/claude-code/binding.md` — filled
  for the client; consumer slots left as placeholders.
- `skills/unattended-ops/templates/bindings/claude-code/unattended-run.js` —
  the template; **no project identifier** from the source (no `S024`, `A1nn`,
  `Invoke-Gate`, `Excel`, `workbook`, PowerShell path).
- A **stub harness** (`node`, no network) that evaluates the template with
  fake `agent()` / `args` / `meta` globals and asserts control flow.
- `SKILL.md` / `templates/binding.md` sentences that say the binding templates
  do not exist, corrected (coordinate with `TASK-0086` — whichever lands second
  finishes the sentence); version bump.

### Not included

- Registering the template as a saved workflow in this repo's `.claude/` — a
  consuming repo copies it into its own `.claude/workflows/`. **This repo gets
  no `workflows/` category** (`ADR-0016`, `ADR-0022` clause 1.1).
- The OpenCode driver (`TASK-0086`), the gate server (`TASK-0088`).
- Any edit to `asset-management`.
- A live Workflow run — the pilot (S10.7) is OpenCode-driven.

## Likely files

- `skills/unattended-ops/templates/bindings/claude-code/{binding.md,unattended-run.js}`
- `skills/unattended-ops/templates/bindings/claude-code/tests/`
- `skills/unattended-ops/SKILL.md`, `templates/binding.md`
- `docs/registry.md` (regenerated), `.ai/context/CURRENT_STATE.md`

## Execution plan

1. Re-read `arm-autopilot.js` end to end; tabulate every constant and prompt
   sentence as *domain → slot*, *rule → citation*, or *control flow → keep*.
2. Write the template; every stage carries a `// loop step N` citation.
3. Write `binding.md`; run `check-binding.sh` against a consumer-filled copy.
4. Write the stub harness and its tests; watch each fail first.
5. `tests/validate.sh`, `scripts/sync-registry.sh`.

## Acceptance criteria

- [ ] `check-binding.sh` exits 0 on a consumer-filled copy of `binding.md` and
      non-zero on the unfilled template.
- [ ] `node --check` (or equivalent parse) passes on the template.
- [ ] A grep over the template finds **none** of the source's project
      identifiers (list the patterns in the log).
- [ ] Stub harness: a null, an empty and an unparseable refuter return each
      reach the adjudicator as `refuted: true`, with no retry.
- [ ] Stub harness: a null or out-of-enum verdict dispatches to `park`.
- [ ] Stub harness: no stage other than the closer's prompt asks for
      `git add`/`commit`; no prompt asks for `git push`.
- [ ] The template refuses to run without a passed-in run id.
- [ ] `binding.md` states which rules Claude Code enforces and which are
      prompt-level, **and whether rule 2 is structural or instructed** here.
- [ ] Each new test **fails when its behaviour is reverted** (recorded).

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] The stub harness (record the exact command)
- [ ] `scripts/sync-registry.sh` (commit any diff)
- [ ] `git status --porcelain` clean after commit

## Risks and rollback

- **The stub harness models the Workflow runtime, not the runtime.** It proves
  control flow only. Say so; do not describe it as a run.
- **Losing a lesson in the de-domaining.** Some of the JS's prompt text encodes
  a hard-won lesson as a sentence. Each dropped sentence must be either cited
  from the skill or recorded in the log as intentionally dropped — never
  silently removed.
- Rollback: `git revert` of one commit.

## Outputs / handover

*Not yet written — forecast until verified.*

| Artifact | End state |
|----------|-----------|
|          |           |

**Next task starts here**: —

## Status
- Status: planned
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
