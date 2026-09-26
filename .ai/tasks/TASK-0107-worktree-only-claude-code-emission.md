# TASK-0107 — Settle `worktree-only`'s Claude Code emission (ADR-0018 clause 7)

## Objective

Answer the single question `SPRINT-CURRENT.md` says settles this item:
**does a `worktree`-isolated subagent's commit reach the real tree?** Then
either settle `worktree-only`'s Claude Code emission on the answer, or record
why the answer does not settle it. `TASK-0040` owns the leftover; this task
produces the measurement `TASK-0040` has never had.

## Minimal context

`ADR-0018`'s term table (line 134) maps `worktree-only` to OpenCode's
`external_directory: deny` and records **"no per-agent equivalent"** for
Claude Code. Clause 7 leaves the emission unsettled and clause 8.2 makes that
a **loud failure rather than a silent omission** — deliberately, because the
alternative is roles quietly emitted without worktree confinement. **All nine
roles declare the term.**

**Two prior attempts, and why neither closed it.** `TASK-0056` ran the
experiment and was **confounded**: permission denials meant it could not
distinguish *isolation* from *refusal* — a subagent that was blocked and a
subagent that was confined look identical from outside. `TASK-0058` then left
it open **explicitly**, which is the honest outcome and the reason this is
still a carried-forward item rather than a silent gap.

**What changed that makes it answerable now.** Claude Code's Agent tool takes
`isolation: "worktree"`, which runs the subagent in its own git worktree. That
is a *session-level* mechanism, not the per-agent permission `worktree-only`
asks for — so it cannot be a faithful emission of the term. The question is
narrower and empirical: does it deliver the **confinement** the term exists to
provide? If a commit made inside that worktree does not reach the real tree,
the property holds even though the expression differs.

**This is a measurement, not a design.** The task records what happens. If
the result is "isolation does not confine", that is a finding, not a failure.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/decisions/0018-...emission.md` | `TASK-0039` | Clause 7 open; term table line 134 records "no per-agent equivalent"; clause 8.2 requires a loud failure |
| `.ai/tasks/TASK-0056-*.md` | `TASK-0056` | The confounded run — read for *how* it was confounded, so this one is not confounded the same way |
| `.ai/tasks/TASK-0058-*.md` | `TASK-0058` | Left the item open explicitly |
| Claude Code Agent tool, `isolation: "worktree"` | vendor | The mechanism under test |
| A clean tree at the task's start | `TASK-0106` | `git status` clean; `TASK-0106` committed first so a stray commit is unambiguous |

## Scope

### Included
- One experiment: a worktree-isolated subagent creates a marked scratch file
  and commits it. Then: is that commit in the main checkout's history? Is the
  file in the main working tree? Is the branch visible from the main checkout?
- The answer recorded with its date and the observed commands.
- `ADR-0018` clause 7 updated with the finding, and `worktree-only`'s Claude
  Code emission settled **or** recorded as still-unsettled with the reason.

### Not included
- **No change to any emitted role file** unless the result settles the term.
  Emitting a confinement that was not measured is the defect clause 8.2 exists
  to prevent.
- Not the Claude Code binding's decision-standard gap (`TASK-0106`, Not
  included) — that is a separate consequence of the same answer and is
  recorded there, to be picked up once this answer exists.

## Likely files

- `.ai/decisions/0018-agent-portability-one-source-per-client-emission.md`
- `.ai/tasks/TASK-0107-...md` (the record of the run)
- `.ai/context/CURRENT_STATE.md`
- possibly `agents/*/` — only if the result settles the emission

## Execution plan

1. Start from a clean tree and record `git rev-parse HEAD`, the worktree list,
   and the branch list. Without the before-state the after-state proves nothing.
2. Spawn **one** subagent with `isolation: "worktree"`, instructed to: report
   its `pwd` and `git rev-parse --show-toplevel`; create
   `.worktree-probe-TASK-0107.txt`; commit it with a marked message; report the
   resulting commit hash and any command that was **denied**.
3. **Distinguish isolation from refusal** — the trap that confounded
   `TASK-0056`. If the subagent reports a denial, the run proves nothing about
   confinement and the task says so rather than reading the denial as
   confinement. The subagent is asked to report denials explicitly for this
   reason.
4. From the main checkout, check: does the commit hash exist? Is the file
   present? Did `HEAD` move? Is the branch listed?
5. Record the answer, with the commands and their output, in this file.
6. Update `ADR-0018` clause 7. Clean up: remove the probe worktree/branch and
   any stray commit.

## Acceptance criteria

1. The experiment ran, or the task records precisely why it could not.
2. The result distinguishes **confinement** from **refusal**; a run showing
   only denials is reported as confounded, as `TASK-0056` was.
3. Before-state and after-state are both recorded, with actual hashes.
4. `ADR-0018` clause 7 reflects the finding.
5. The tree is clean at the end; the probe leaves nothing behind.
6. `tests/validate.sh: OK`.

## Mandatory validations

- `bash tests/validate.sh`
- `git status` clean; `git worktree list` back to one entry; no probe branch.

## Risks and rollback

- **A stray commit reaching `master` is the risk the experiment is testing
  for.** Mitigated by starting clean, by using a uniquely named scratch file,
  and by recording `HEAD` first so an unexpected move is detectable and
  revertible. If a commit does reach the real tree, removing it is a
  history change on an unpushed local commit only — **if it has been pushed,
  stop and ask** (`AGENTS.md`: history rewrites need authorization).
- **Confounding, again.** The explicit denial-reporting instruction in step 2
  exists because this already happened once.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| This file | Carries the measurement: before-state, subagent report, after-state, and the answer |
| `ADR-0018` clause 7 | Records the finding |
| Emitted roles | Changed **only** if the result settles the term; otherwise deliberately untouched |

**Next task starts here**: `worktree-only`'s Claude Code status is either
settled or explicitly still-open with a measured reason, and the Claude Code
binding's decision-standard gap (`TASK-0106`) can be picked up on that answer.

## Status
- Status: **done** — the measurement was taken; the emission is **still open**,
  with a measured reason rather than a guessed one
- Owner: agent
- Created: 2026-09-26
- Completed: 2026-09-26
- Commit: recorded in the follow-up commit (`TASK-0093` form)

## Execution log

### Attempt 1

**Before-state**, recorded from the main checkout before the probe ran:
`HEAD` and `master` both `5d51e2db3ef3e3d5e024ab867d77f4c54f657857`, pushed
and confirmed; one worktree; one local branch `master`; `git status` clean.

**The probe.** One subagent, Claude Code `isolation: "worktree"`, instructed
to report `pwd`, toplevel, `HEAD`, branch and worktree list, then create and
commit `.worktree-probe-TASK-0107.txt`, and — the instruction that separates
this run from `TASK-0056`'s — to **report every denial explicitly and never
work around one silently**.

**`DENIALS: NONE`.** Every command was allowed and succeeded; the pre-commit
hook ran, reported `validate.sh: OK`, and permitted the commit. `--no-verify`
was offered as an authorized exception and was **not needed**. So the run
distinguishes confinement from refusal, which is acceptance criterion 2.

**Result, verified from the main checkout rather than from the probe's own
report:**

| Check | Result |
|---|---|
| `git rev-parse master` | `5d51e2d` — **unmoved** |
| `git merge-base --is-ancestor 0c12686 master` | false — **not on master** |
| `.worktree-probe-TASK-0107.txt` in main tree | **absent** |
| `git cat-file -t 0c12686` in main checkout | `commit` — **object is shared** |
| `git branch` in main checkout | listed `worktree-agent-<id>` — **ref is shared** |
| Probe's toplevel | `.claude/worktrees/agent-<id>/` — **inside the repository** |

**Answer: no, a worktree-isolated subagent's commit does not reach the real
tree.** The object database and ref namespace are shared, but the working
tree and the branch tip are not.

**Why that does not settle the emission** — the finding this task exists to
avoid getting wrong. `worktree-only` is an **access-denial** term; OpenCode's
`external_directory: deny` stops a role reading or writing outside its
worktree. What was measured is **effect-isolation**: where a commit lands.
The probe's worktree sat *inside* the main repository, so nothing stopped it
reaching the main checkout by absolute path — untested, and not assumed.
Isolation confines the accidental and says nothing about the deliberate.
`ADR-0018` clause 8.2 therefore still applies unchanged, and the term table's
line 134 still reads "no per-agent equivalent".

**A second finding, not asked for.** The worktree is created inside the
repository, which `docs/operations/runbook.md` forbids for this repo's own
`worktree.sh`. Both stated consequences were checked and neither bit: the
component globs are one level deep (`validate.sh: OK`; `sync-registry.sh`
regenerated byte-identical), and `git status` stayed clean — but **only
because `TASK-0106` had gitignored `.claude/` hours earlier**. That is luck.
`Driver.step1_preflight_repo()` refuses a dirty tree, so on a checkout
without that ignore, an unattended run using worktree-isolated subagents
would refuse to start.

**Cleanup.** Probe worktree removed, branch `worktree-agent-<id>` deleted
(`was 0c12686`), `git worktree list` back to one entry, `git status` clean,
`validate.sh: OK`. The probe commit is unreferenced and was never pushed.

**Acceptance criteria:** 1 met; 2 met (`DENIALS: NONE`); 3 met; 4 met —
`ADR-0018` carries the finding; 5 met; 6 met. No role file was changed,
per Scope / Not included: the result does not settle the term.
