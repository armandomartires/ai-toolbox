# TASK-0055 — Spike: can OpenCode host an unattended driver, and can its permissions hold it?

## Objective

Settle three falsifiable claims about the installed OpenCode against the client
itself, so `ADR-0022` is ratified on evidence rather than on a reading of
vendor documentation. **Findings, not components.** No component file changes.

## Minimal context

`PLAN-0006` proposes an external driver script that calls
`opencode run --agent <role> --format json` once per stage. Three properties it
depends on cannot be settled from documentation, and one of them decides this
repo's agent **schema**:

- **F1** decides every role's `mode:` field. If `opencode run --agent` cannot
  select a `subagent`-mode role, every role becomes `primary` — or `all`, which
  `tests/validate.sh`'s `MODES = {"primary", "subagent"}` does not admit, so the
  authoring guide and the gate both change. Authoring nine roles before knowing
  this would mean authoring them twice.
- **F4** decides whether the closer's staging boundary exists at all. The
  harness forbids `git add -A`; `agents/git-ops/agent.md` currently allows bare
  `git *`, so **`git add -A` is permitted today** by the repo's own guarded git
  owner. Whether a narrower glob can express the distinction is a property of
  OpenCode's matcher, not of this repo.
- **F2** decides how a stage's structured return is extracted. The Claude
  Workflow runtime forces a schema; OpenCode has no equivalent, so the driver
  must parse.

`ADR-0018`'s closing warning governs the method here: three of its twelve
mapping rows **changed in four days**, and its instruction to a later reader is
to *re-verify rather than cite*. This spike verifies.

`ADR-0020`'s clause 6 governs the evidence standard: *"Directory-name inference
is not evidence — in either direction."* A claim is settled by a marker from a
run, or it is recorded as unsettled.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `opencode` binary | pre-existing | `1.18.31` at `~/.opencode/bin/opencode` — **re-check the version first**; the surface moved three times in four days during `TASK-0036` |
| `~/.config/opencode/agents/` | `scripts/emit-agents.py`, pre-existing | six emitted roles present, `git-ops.md` among them |
| `scripts/emit-agents.py` | pre-existing | the `VOCAB` table and its glob-ordering comments — the repo's existing knowledge of what a `permission` block means |
| `docs/development/authoring-guide.md` | pre-existing | the ten-term vocabulary and its per-client coverage table |
| `.ai/decisions/0018-*.md` | pre-existing | `Accepted`; clause 8 and its mapping table |
| A scratch project directory | this task | **outside** this repo and outside `asset-management` |

**Verify the expected state; don't assume it.** In particular re-read the
`opencode` version before trusting any row of ADR-0018's table.

## Scope

### Included

- **F1** — can `opencode run --agent <name>` select a role whose `mode:` is
  `subagent`? Test all three of `subagent`, `primary` and `all`. A silent
  fallback to the default agent is a *failure*, not a pass, so the fixture must
  make the acting agent identify itself.
- **F2** — what does `--format json` emit, and is the final assistant message
  extractable without parsing prose? Record the actual event shape.
- **F4** — does an allow-glob of the form `git add -- *` match
  `git add -- <path>` while `git add -A` and `git add .` fall through to
  `"*": deny`? Test the negative cases explicitly.
- Two secondary observations, cheap once the harness is up: whether
  `opencode run` accepts a prompt on stdin or only as an argument/`-f`, and what
  an `ask` permission does in a headless `run` **without** `--auto` (hang, or
  auto-deny). Both change the driver's failure handling.
- **A negative control for every claim.** A fixture proved able to *fail* before
  any passing result from it is trusted — the method `TASK-0036` used on
  `claude plugin validate`.

### Not included

- Writing the driver. Writing any role. Editing any component.
- Anything in `asset-management`.
- Claude Code's surface — that is `TASK-0056`, deliberately parallel.
- Changing `agents/git-ops/agent.md`, even though this spike is expected to
  confirm a real gap in it. Record it; `TASK-0064` fixes it.

## Likely files

Nothing in the component layer. Expect to touch only this task file and a
scratch directory outside the repo. If a component file changes, that is a
finding worth recording and probably a mistake.

## Execution plan

1. Re-read the `opencode` version and record it verbatim.
2. Create a scratch project outside both repos. Confine every fixture to it —
   `TASK-0036`'s fixtures were confined this way and the repo verified
   afterwards that no global agent directory had been polluted.
3. **F1**: three fixture agents differing only in `mode:`, each instructed to
   print its own name. Run each via `opencode run --agent`. Record which ran.
4. **F2**: capture raw `--format json` stdout for one trivial run. Record the
   event envelope verbatim, and identify the field carrying the final text.
5. **F4**: one fixture agent with the candidate `bash` map. Attempt
   `git add -- file`, `git add -A`, `git add .`, and `git add ./sub/file`.
   Record allow/deny for each. **`git add ./sub/file` is the case that decides
   whether a `git add .*` deny glob would swallow a legitimate explicit path.**
6. The two secondary observations.
7. Remove every fixture; verify the scratch directory and the real agent
   directories are as they were.
8. Write findings into this file with a per-claim marker.

## Acceptance criteria

- [ ] The `opencode` version is recorded verbatim, with the date.
- [ ] F1, F2 and F4 each carry a verdict of **confirmed / falsified /
      unsettled**, each with the command run and the observed output.
- [ ] Every claim has a negative control, and the control is shown to fail.
- [ ] Both secondary observations are recorded, or explicitly marked not reached.
- [ ] No component file changed; `git status --porcelain` shows only this task
      file.
- [ ] Fixtures removed and their removal verified, not assumed.
- [ ] Anything that could not be settled is recorded as **unsettled**, never as
      a reasoned conclusion.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `git status --porcelain` — this task file only

## Risks and rollback

- **Fixtures leaking into the real agent directories.** Confine to scratch;
  verify afterwards. This is the specific hazard `TASK-0036` named.
- **A malformed fixture emptying the agent list.** ADR-0018 records that one bad
  file made `opencode agent list` return **nothing at all**. If that happens,
  the fixture is the cause; remove it and re-check.
- **Concluding from silence.** `TASK-0048` records the control that saved it: a
  pre-existing working plugin logged nothing either, so silence was
  uninformative rather than a negative result. Apply the same test here.
- Rollback is deletion of the scratch directory. Nothing else is touched.

## Outputs / handover

*Forecast until verified — this section describes an intention until the
execution log below records otherwise.*

| Artifact | End state |
|----------|-----------|
| This task file | Carries F1, F2 and F4 verdicts with commands and observed output; the `opencode` version; both secondary observations; and anything unsettled, named as such |
| Component layer | **Unchanged**, deliberately |
| `agents/git-ops/agent.md` | **Unchanged**, even if the spike confirms `git add -A` is permitted. Recorded, not fixed |

**Next task starts here**: `TASK-0057` authors `ADR-0022` from this file and
`TASK-0056`, and cannot begin until both carry verdicts. If F1 is falsified,
`TASK-0058` gains a `mode`-row change and `TASK-0059` gains a `MODES` change —
say so here explicitly rather than leaving it to be inferred.

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
