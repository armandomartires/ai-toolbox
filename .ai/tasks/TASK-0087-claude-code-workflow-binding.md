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

- [x] `check-binding.sh` exits 0 on a consumer-filled copy of `binding.md` and
      non-zero on the unfilled template.
- [x] ~~`node --check` (or equivalent parse) passes on the template.~~
      **`node --check` was found vacuous and is not evidence**: it exits 0 on a
      file with `export` plus top-level `return`, and on a plainly broken file
      (node 22.23.2, observed). Replaced by the "equivalent parse": the harness
      builds the body as an async function — the shape the runtime runs — with
      a control showing the same check throws `SyntaxError` on a broken body.
- [x] A grep over the template finds **none** of the source's project
      identifiers. Patterns, over non-comment lines: `S02\d`, `\bA1\d\d\b`,
      `Invoke-Gate`, `excel` (i), `workbook` (i), `\.ps1`, `PowerQuery` (i),
      `\bVBA\b`, `docs/ai/`, `ARM-`. The provenance comment names
      `arm-autopilot.js` and A119 on purpose.
- [x] Stub harness: a null, an empty and an unparseable refuter return each
      reach the adjudicator as `refuted: true`, with no retry.
- [x] Stub harness: a null or out-of-enum verdict dispatches to `park`.
- [x] Stub harness: no stage other than the closer's prompt asks for
      `git add`/`commit`; no prompt asks for `git push`.
- [x] The template refuses to run without a passed-in run id — and on any
      blank, `unknown` or `<FILL>` slot, before any agent runs.
- [x] `binding.md` states which rules Claude Code enforces and which are
      prompt-level, **and whether rule 2 is structural or instructed** here
      (*instructed*).
- [x] Each new test **fails when its behaviour is reverted** (recorded).

## Mandatory validations

- [x] `tests/validate.sh` — OK
- [x] Stub harness: `node --test skills/unattended-ops/templates/bindings/claude-code/tests/unattended-run.test.mjs` — **23 tests, 23 pass**. (Passing the *directory* to `node --test` fails with `MODULE_NOT_FOUND` on node 22; pass the file.)
- [x] `scripts/sync-registry.sh` — no diff
- [x] `git status --porcelain` clean after commit

## Risks and rollback

- **The stub harness models the Workflow runtime, not the runtime.** It proves
  control flow only. Say so; do not describe it as a run.
- **Losing a lesson in the de-domaining.** Some of the JS's prompt text encodes
  a hard-won lesson as a sentence. Each dropped sentence must be either cited
  from the skill or recorded in the log as intentionally dropped — never
  silently removed.
- Rollback: `git revert` of one commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `skills/unattended-ops/templates/bindings/claude-code/unattended-run.js` | The Workflow template: every consumer value from `args`, refusal before any agent on an unanswered slot, one function per loop step citing it, `agentType` for `task-planner` and `adjudicator` only |
| `…/claude-code/binding.md` | Client slots answered, consumer slots `<FILL>`; the `args` shape; the enforced-vs-asked table; **eight deviations**, 1–6 numbered to match the OpenCode binding |
| `…/claude-code/tests/unattended-run.test.mjs` | 23 tests against a stub runtime whose `Date`/`Math.random` throw as the real ones do |
| `skills/unattended-ops/SKILL.md` | `1.2.0`; both bindings listed |
| `templates/binding.md`, `references/five-rules.md` | "The Claude Code one is `TASK-0087`" made past tense |
| `asset-management` | **Unchanged** |

**Next task starts here**: two bindings exist, both proven against stubs
only. The Claude Code one uses the OpenCode binding's `run-gate.sh` as its
gate entry point; `TASK-0088`'s server is a possible later alternative, and
this template does not depend on it.

**Deviations from the Plan:** the `node --check` criterion was replaced (above);
the Claude Code binding *reuses* `run-gate.sh` rather than defining its own
entry point, so one gate map and one evidence format serve both bindings.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-24

## Execution log
### Attempt 1
- Date: 2026-09-24
- Agent: Claude Opus 5.5 (1M context)
- Actions: read `arm-autopilot.js` end to end (700 lines) and tabulated it as
  the brief asked — domain → `args` slot (`WORKLIST`, `CMD`, `STATIC_GATES`,
  `STAGE_GATES`, `GATE`, `RUN_ROOT`, `HOUSE_RULES`, the commit shape), rule →
  citation (the five-rules comment block, `GATE_HOWTO`), control flow → kept.
  Re-read the Workflow runtime reference for the current API. Wrote the
  template, the binding and the stub harness; ran 18 revert proofs.
- Observations:
  1. **`agentType` changes what "portable" buys.** The runtime can run a
     workflow agent *as* a custom subagent definition, so `task-planner` and
     `adjudicator` — the two roles with a Claude Code emission — run under
     their own bodies and tool boundaries here, not as paraphrases. The other
     seven run as default subagents with prompt-level boundaries. **Untested
     against a real session:** neither role is emitted to `~/.claude/agents/`
     yet (S10.5), and what `agent()` does with an unknown `agentType` is not
     documented; the template treats a throw as a halt (deviation 8).
  2. **Deviation 1 is the mirror image of the OpenCode binding's.** A Workflow
     script has no shell, so the *gate-runner* invokes `run-gate.sh`, as
     loop.md step 7 says — where the OpenCode driver invokes it, as `ADR-0022`
     says. The same three-way disagreement recorded in `TASK-0086`, now
     resolved in opposite directions by the two bindings for a reason each
     states. It still needs a human decision.
  3. **Dropped from the source, intentionally, each for a stated reason:**
     `HOUSE_RULES` (the consumer's `AGENTS.md`, not the harness's); the Excel
     process and lock-file report (domain); `operatorGated` (a consumer
     encodes that as a task whose criteria need a human, which parks); the
     stage-close bookkeeping in the closer prompt (tracker-specific);
     `STATUS.md` in the handover (the loop asks for one handover); and
     `model: 'sonnet'` per agent (inherited). Kept as citations rather than
     text: the five rules, the gate how-to, the evidence rule.
  4. **Two corrections to the source**, both from `ADR-0022`: the null
     refuter fails closed (in the source it reached the adjudicator as
     `JSON.stringify(null)`), and `accept` over a refutation needs a named
     override. Plus one the source could not have: the closer's commit is
     cross-checked by a second agent before and after (`verifyHead()`).
  5. **`node --check` cannot fail on this file shape** — see the struck
     criterion. Found by pointing it at a deliberately broken file, which is
     the check every validation should get before it is trusted.
- Validation:
  - Harness: **23/23 pass**.
  - **Fails-when-reverted, 18 behaviours, all red**, each run alone via
    `--test-name-pattern` (one test selected, one failing): null-refuter
    synthesis; findings force `refuted`; unparseable verdict → park; no retry
    on attempt 2; accept over refutation needs overrides; refusal before any
    agent; `agentType` for the two thinking roles; a thrown `agent()` halts;
    closer refusal not retried; commit verification; a dirty park halts; dirty
    tree at preflight; unreported gate → `NOT-RUN`; dependency check; dry run;
    `halt-run` ends the run; long gates for the touched group; git writes only
    in the closer's prompt. Template restored and `cmp`-verified.
  - `check-binding.sh`: the template fails on its consumer placeholders only;
    a filled copy passes (a test asserts both).
  - `tests/validate.sh`: OK. `scripts/sync-registry.sh`: no diff.
  - **Not validated, and not claimed:** any real Workflow run.
- Result: **done** — against a stub.
- Commit: `3ad2ead`. Pre-commit hook ran `tests/validate.sh`: OK. Full
  suite re-run after the commit: `# tests 23`, `# pass 23`, `# fail 0`.
- Push: **confirmed** — `origin/master` `485c48c..3ad2ead`.
