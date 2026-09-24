# TASK-0086 — S10.1: the OpenCode driver and its binding

## Objective

Ship the **OpenCode binding** for `loops/unattended-run/loop.md`: a driver
script plus its binding declaration, under
`skills/unattended-ops/templates/bindings/opencode/` (`ADR-0022` clause 1.2).
This is the only client that can **enforce** the harness's rules, so this is
the binding that answers S10's checkpoint question — *did the OpenCode port
actually enforce what the Claude one only asks for?*

## Minimal context

**Only the driver remains of S10.1.** The binding contract
(`skills/unattended-ops/templates/binding.md`), the completeness checker
(`skills/unattended-ops/scripts/check-binding.sh`) and both fixtures ship
already, with the red-then-green proof run, from `TASK-0062`. **Do not rebuild
them.** `TASK-0085` corrected the sprint file that said otherwise.

### What the driver must do that the original did not

`asset-management`'s `.claude/workflows/arm-autopilot.js` (A119, 700 lines) is
the harness being generalised. Two corrections to it are **normative** here,
carried from `PLAN-0006` and `ADR-0022`:

1. **Rule 2 is structural.** The *driver* invokes the gate from its own map and
   hands the agent only the evidence to read. **No prompt the driver sends to
   any role contains a gate command string.** In the JS an agent is handed the
   command and asked not to "correct" a switch.
2. **A null refuter fails closed.** A null, empty or unparseable refuter
   return is synthesised as `refuted: true` by the driver — not retried, not
   left to the role. In the JS it flows into the adjudicator as an absence of
   objections.

### What the spikes forced on the invocation (`ADR-0022` clause 5)

- Every driver-invoked role is `mode: primary`. A `subagent` role is
  **silently replaced by the default agent**, exit 0, well-formed output
  (F1, falsified). The driver must therefore **verify which agent ran**, not
  trust stdout.
- `opencode run` with no model and no configured default **hangs with no
  output**. The driver passes `-m <provider/model>` always.
- `--format json` is newline-delimited; the final message is `part.text` where
  `type == "text"`; a denied tool call is a `tool_use` with
  `part.state.status == "error"` (F2, confirmed).
- Unattended, an `ask` auto-denies and is reported as *"The user rejected
  permission"* with no user present. So boundaries are `deny`, never `ask`.

### The half of the checkpoint still open (`SPRINT-CURRENT.md`)

`git add -- .` **cannot be closed at the glob layer** (`TASK-0083`); the rule
lives as prose in `git-ops`'s and `closer`'s bodies. **A driver that stages on
a role's behalf would bypass even that.** This driver stages nothing; the
`closer` role stages, under its own boundary. That must be demonstrated, not
asserted.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `loops/unattended-run/loop.md` | `TASK-0061` | Authoritative numbered step list |
| `skills/unattended-ops/` (SKILL, references, `templates/binding.md`) | `TASK-0062` | v1.0.0; binding contract with every slot |
| `skills/unattended-ops/scripts/check-binding.sh` + `fixtures/` | `TASK-0062` | Incomplete fixture exits 1 (eleven defects), complete exits 0 |
| `agents/{preflight,task-planner,implementer,gate-runner,refuter,adjudicator,closer,park-steward,run-scribe}/` | `TASK-0063`, `TASK-0064` | Driver-invoked roles `mode: primary` |
| `scripts/emit-agents.py` | pre-existing | Emits OpenCode agent files; last-match-wins ordering |
| `opencode` CLI | pre-existing | `1.18.31` at `~/.opencode/bin/opencode` — **re-check the version**; ADR-0022 says re-verify rather than cite |
| `../asset-management/.claude/workflows/arm-autopilot.js` | A119 | Read-only reference. **Not edited** (`PLAN-0006` scope) |

**Verify the expected state; don't assume it.**

## Scope

### Included

- `skills/unattended-ops/templates/bindings/opencode/binding.md` — a filled
  binding for a **generic** consumer: every project-specific slot is a
  template placeholder the consuming repo fills, every client-specific slot is
  answered.
- `skills/unattended-ops/templates/bindings/opencode/driver.py` — Python ≥ 3.11,
  stdlib only, idempotent where re-run. Reads its project slots from the
  consumer's filled `binding.md` frontmatter; refuses to start if any slot is
  a placeholder or `unknown`.
- Hermetic tests using a **stub `opencode`** on `PATH` that replays canned
  JSON event streams — no network, no model.
- `SKILL.md`: the *"The binding templates … do not exist yet"* line and the
  table row it implies, corrected; `metadata.version` bumped (`ADR-0003`).

### Not included

- The Claude Code binding (`TASK-0087`) and the gate server (`TASK-0088`).
  If the gate server lands first, the binding may name it as its
  `gate_entry_point`; the driver must not depend on it.
- Any live run against a real repository — that is S10.7, the pilot.
- Any change to `agents/` role boundaries. If a role turns out to be wrong,
  that is a finding and a separate task.
- `configs/opencode/` wiring — S10.5.

## Likely files

- `skills/unattended-ops/templates/bindings/opencode/{binding.md,driver.py}`
- `skills/unattended-ops/templates/bindings/opencode/tests/` (stub + tests)
- `skills/unattended-ops/SKILL.md`, `templates/binding.md` (the stale
  "do not exist yet" sentence)
- `docs/registry.md` (regenerated), `.ai/context/CURRENT_STATE.md`

## Execution plan

1. Re-read `loop.md`'s step list and the binding contract; re-check
   `opencode --version`.
2. Write `binding.md` for OpenCode; run `check-binding.sh` against it
   (expect failure only on the consumer-owned placeholders — record which).
3. Write the driver: one function per loop step, each citing its step number;
   verdict dispatch; the two bounds (attempt bound 2, `task_cap`); JSON event
   extraction with raw stdout as fallback; agent-identity check.
4. Write the stub `opencode` and the tests below. Watch each fail first.
5. Run the full suite, `tests/validate.sh`, `scripts/sync-registry.sh`.

## Acceptance criteria

- [x] `check-binding.sh` exits 0 on a copy of `binding.md` with the consumer
      slots filled by a test fixture, and non-zero on the unfilled template.
      *(`TestBindingChecker`; the unfilled template fails on exactly the 16
      consumer placeholders and no uncited rule.)*
- [x] **No prompt the driver sends contains any command string from the gate
      map** — asserted by a test that captures every prompt the stub receives.
- [x] A null, empty and unparseable refuter return each produce
      `refuted: true` in the adjudicator's input; none is retried.
- [x] An out-of-enum or unparseable verdict is reprompted once, journalled,
      then treated as `park` — **never** `accept`.
- [x] A stub stream showing the default agent answered instead of the named
      role is detected and parks/halts rather than proceeding. *(Halts.)*
- [x] Every `opencode run` invocation carries `-m`; the driver refuses to
      start without a model slot. *(`unknown`, a placeholder and a bare
      `sonnet` are each refused, exit 2, with no invocation.)*
- [x] **The driver issues no `git add`, `git commit` or `git push`** — asserted
      by a test over every subprocess it spawns; only the `closer` role stages.
      *(A logging `git` on `PATH`; `stash`, `reset`, `checkout`, `clean` also
      asserted absent.)*
- [x] Driver refuses to start on a dirty tree (rule 5).
- [x] Each new test **fails when its behaviour is reverted** (recorded).
- [x] `SKILL.md` no longer says the binding templates do not exist; version bumped.

## Mandatory validations

- [x] `tests/validate.sh` — `validate.sh: OK`
- [x] The driver's own tests: `cd skills/unattended-ops/templates/bindings/opencode && python3 -m unittest discover -s tests` — **23 tests, OK**
- [x] `scripts/sync-registry.sh` — no diff
- [x] `git status --porcelain` clean after commit

## Risks and rollback

- **The stub proves the driver against a model of OpenCode, not OpenCode.**
  Hermetic tests cannot catch a changed event shape. Criterion 3 of Phase 10
  (*"demonstrated against an emitted file and a real run"*) is **not** closed
  by this task; it is closed by the pilot. Say so in the task log.
- **The driver becoming a second owner of a rule.** Every rule it applies must
  cite its source; `check-binding.sh` checks the body, not the Python — so
  review the Python for uncited rules by hand.
- Rollback: `git revert` of one commit; nothing outside `skills/unattended-ops/`
  and generated docs changes.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `skills/unattended-ops/templates/bindings/opencode/driver.py` | The driver: one method per loop step, each citing it; verdict dispatch; attempt bound 2, mechanical bound 3; JSON event extraction with raw-stdout fallback; agent-identity check (`opencode agent list` at start, the F1 stderr marker per call) |
| `…/opencode/run-gate.sh` | **Not forecast.** The detaching entry point: `start`/`wait`/`status`/`kill`, watchdog, process-group kill, argv without a shell, one evidence line per finished gate. Added because `agents/gate-runner/` allowlists `*run-gate.sh*` and the driver needs a real one to call |
| `…/opencode/binding.md` | Client slots answered, 16 consumer slots `<FILL>`; body states enforced-vs-asked per rule and **seven deviations** |
| `…/opencode/tests/` | 17 driver tests + 6 gate tests, stub `opencode`, logging `git` |
| `skills/unattended-ops/SKILL.md` | `1.1.0`; the binding is listed; the "roles do not exist yet" sentence (also stale) removed |
| `templates/binding.md`, `references/five-rules.md` | "Binding templates do not exist yet" corrected |
| `agents/`, `loop.md`, `ADR-0022` | **Unchanged**, deliberately — see finding 1 |

**Next task starts here**: the OpenCode binding exists and is proven against a
stub only. The nine roles are not yet emitted to `~/.config/opencode/agents/`
(S10.5), and the pilot (S10.7) needs both that and a consumer-filled copy of
`binding.md`.

**Deviations from the Plan:** `run-gate.sh` was not forecast (above). Plan step
2 expected `check-binding.sh` to fail "only on the consumer-owned
placeholders" — confirmed: 16 of them, no other defect.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-24

## Execution log
### Attempt 1
- Date: 2026-09-24
- Agent: Claude Opus 5.5 (1M context)
- Actions: re-read `loop.md`'s 14 steps, the binding contract, the checker,
  `return-schemas.md`, `gate-map.md`, `evidence.md`, `verdicts.md`,
  `park-and-recover.md` and all nine role definitions; re-checked
  `opencode --version` (**1.18.31**, unchanged) and `opencode agent list`'s
  format (`name (mode)` lines). Wrote `run-gate.sh`, `driver.py`,
  `binding.md`, the stub and the tests; corrected three stale sentences.
- Observations:
  1. **Three sources disagree on who invokes the gate — a finding for the
     human.** loop step 7 and `agents/gate-runner/` ("You may run one command:
     the binding's gate entry point") make the gate-runner the invoker;
     `ADR-0022` ("the *driver* can invoke the gate from its own map") and
     `references/gate-map.md` make the driver the invoker — and `gate-map.md`
     also says the gate-runner *writes* the evidence file, which
     `agents/gate-runner/` explicitly denies. The loop says the ADR wins, so the
     binding follows it (deviation 1). **Not reconciled here**: it changes
     normative text in three places and is not this task's scope.
  2. **The first run of the suite passed 16 of 17**, which made the revert
     proofs more important, not less. The one failure was real: a gate-runner
     return that failed validation parked after **one** call, where the loop's
     mechanical bound is 3. Fixed by letting `ask()` take a validator.
  3. **One revert proof was wrong the first time.** Mutating the closer's
     refusal from `Park` to `Mechanical` still passed, because that exception
     is raised outside the retry loop — the mutation modelled no retry. Redone
     with a validator that retries a refusal: the test then fails
     `3 != 1`. A revert that does not change the behaviour proves nothing.
  4. **`run-gate.sh` had a race**: `kill` issued straight after `start` found
     no process-group file yet and silently did nothing. Found by smoke test
     before any test existed; `kill` now waits for the group to be recorded.
  5. **Two stale claims beyond the brief's**: `SKILL.md` still said the nine
     roles "do not exist yet", and `.ai/context/CURRENT_STATE.md`'s header
     still says no sprint is open. The first is fixed (same file, same
     change); the second is **left** — rewriting that header is not this
     task's, and its date was deliberately not bumped so it does not look
     current.
  6. **The driver adds one slot, `role_timeout`**, because a role call with
     no bound can hang the run exactly like a missing model; extra slots are
     allowed and checked (`check-binding.sh`).
- Validation:
  - Suite: `python3 -m unittest discover -s tests` — **Ran 23 tests, OK**
    (17 driver, ~66 s; 6 gate, ~18 s).
  - **Fails-when-reverted, 18 behaviours, all red**: null-refuter synthesis;
    gate command kept out of prompts; unparseable verdict → park; fallback
    detection; `-m` on every call; no driver git write; dirty tree refused;
    `provider/model` check; agent-list primary check; no retry on attempt 2;
    accept over refutation needs overrides; evidence-line cross-check;
    dependency check; dry run skips implement; closer refusal not retried
    (second attempt, see observation 3); kill by own group only; watchdog
    timeout; SKIP distinct from FAIL. Each mutation applied, its test run,
    the file restored and `cmp`-verified.
  - `check-binding.sh` on the unfilled template: exit 1, 16
    `PLACEHOLDER SLOT` lines, nothing else.
  - `tests/validate.sh`: OK. `scripts/sync-registry.sh`: no diff.
  - **Not validated, and not claimed:** any behaviour of real OpenCode. Phase
    10 criterion 3 stays open until the pilot.
- Result: **done** — against a stub.
- Commit: *(recorded in the follow-up commit)*
- Push: *(recorded in the follow-up commit)*
