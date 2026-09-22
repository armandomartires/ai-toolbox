# TASK-0070 — One worktree per agent session, and the exec bits that make a worktree work

## Objective

Stop two concurrent agent sessions from sharing one working tree and one git
index, by giving each session its own `git worktree` on its own branch — and
fix the recorded file modes that would otherwise make such a worktree unable
to run the mandatory gate.

## Minimal context

### The problem is observed, not hypothetical

On 2026-09-23 two agent sessions worked in this checkout simultaneously. It
cost real work twice, in two consecutive tasks:

- **`TASK-0068`** had to be **renumbered** from `TASK-0055`, because the
  other session's `PLAN-0006` reserved `TASK-0055`…`0067` while the closure
  task was being written.
- **`TASK-0069`** found sixteen of the other session's files **staged in the
  shared index**, mid-commit-preparation. A plain `git commit` would have
  swept its unfinished work into this task's commit. It had to be committed
  with a path-limited `git commit -- <paths>` instead, and an attempt to
  stage only its own hunk of `CURRENT_STATE.md` **failed** because the index
  already held the other session's version.

One shared index is a single mutable resource with no locking between
sessions. The failure mode is not a merge conflict — it is **one session
silently committing another's half-finished work**, which no gate in this
repo can detect.

### Worktrees force a branch, and that is the real decision

`git worktree` gives each session its own working tree **and its own index**,
sharing one object store. But git **refuses to check out the same branch in
two worktrees**, so adopting worktrees necessarily means a branch per
session. This repo is trunk-based — *"one task = one commit"*, straight onto
`master`, pushed at task end (`AGENTS.md`, Git rules).

The reconciliation, which is what `ADR-0023` records: a session works on
`agent/<name>`, and lands with **`git push origin HEAD:master`** after
rebasing. `master` stays linear and keeps receiving one commit per task, and
no worktree ever checks `master` out. The added step is a rebase, not a merge
or a PR.

### Every script in this repo is mode 644 in git, and that only works by accident

Found while probing whether a worktree can run the gate. `git ls-files -s`
reports **`100644` for every `.sh` and `.py` entry point** — `tests/validate.sh`,
`tests/smoke-mcp.sh`, `scripts/install.sh`, `scripts/sync-registry.sh` and the
rest. Only `.githooks/pre-commit` is `100755`.

It has never bitten because two things hide it:

- **`/mnt/c` is DrvFs**, which reports every file as `0777` regardless of the
  recorded mode. `core.filemode` is `false` here for the same reason.
- **The hook and CI both invoke `bash tests/validate.sh`**
  (`.githooks/pre-commit:22`, `.github/workflows/validate.yml:41`), so the
  exec bit is never consulted on the path that matters most.

On a real POSIX checkout it bites immediately. Observed in a worktree on
ext4: `tests/validate.sh` → **`Permission denied`, exit 126**, while
`.githooks/pre-commit` ran fine. **Every command `AGENTS.md`'s Commands
section documents is written as a bare path** (`tests/validate.sh`,
`scripts/install.sh`, …) and therefore fails on any Linux clone, any
container, and any worktree placed on the Linux filesystem.

This is the repo's most-repeated defect class again — **a documented claim
the artifact falsifies** — and it is in scope here because it is precisely
what decides whether a worktree is usable.

### The measurement that makes it worth fixing rather than documenting around

`tests/validate.sh` on ext4 runs in roughly **half** the time it takes on
`/mnt/c` (`REVIEW-0009`: 572 ms vs 1008 ms; `validate.sh:306-314` owns those
numbers). A session whose worktree lives on the Linux filesystem gets a
markedly faster gate — but only if the scripts are executable there. Today
they are not, so that option does not exist.

**The 2 ms reading that first surfaced this was a false measurement** — the
gate had not run at all. That is the *third* time this session has seen an
implausibly fast number turn out to be a command that never executed, after
`REVIEW-0009` finding 5. It is caught by implausibility every time and by
nothing else.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `TASK-0068` / `TASK-0069` execution logs | this session | Both record the collision; `TASK-0069` names the shared index explicitly |
| `.githooks/pre-commit` | TASK-0010 | `100755`; invokes `bash tests/validate.sh` at `:22` |
| `.github/workflows/validate.yml` | TASK-0010/0015 | `run: bash tests/validate.sh` at `:41` |
| `git ls-files -s` | — | **Every** `.sh`/`.py` entry point `100644`; only the hook `100755` |
| `core.filemode` | — | `false` (the `/mnt/c` DrvFs consequence `TASK-0014` warns about) |
| `git worktree list` | — | **One** worktree; `.claude/worktrees/` exists but is **empty** |
| `AGENTS.md:44-53` | — | Commands documented as bare paths |

**Verify the expected state; don't assume it.** All rows re-run this session,
including the worktree probes.

## Scope

### Included

- `scripts/worktree.sh` — `add` / `list` / `remove` a session worktree,
  idempotent, refusing unsafe placements.
- Worktrees as **siblings of the repo**, never nested inside it.
- **Recorded mode `100755`** for the entry points the repo documents as
  directly runnable, via `git update-index --chmod=+x` (a working-tree
  `chmod` is invisible while `core.filemode=false`).
- A runbook section: create, work, land, remove; and what not to do.
- `ADR-0023`, **`Proposed`** — branch-per-session is a change to a stated
  workflow rule, which is the human's call, not the agent's.
- Proof that the gate **fires and refuses** inside a worktree, and that the
  newly-executable scripts run on a POSIX filesystem.

### Not included

- **Moving either live session.** Creating a worktree is safe; relocating a
  running session is the human's call, and the other session is mid-flight.
- **Deleting or rewriting anything in the main checkout.** It stays on
  `master` as the integration tree.
- **A PR or review workflow.** `ADR-0007` keeps this repo trunk-based; this
  adds isolation, not ceremony.
- **`chmod +x` on every script in the repo.** Only documented entry points.
  Skill-internal scripts are invoked by their skill and are out of scope.
- **Any `validate.sh` check enforcing worktree placement.** Nothing can
  verify where a human put a directory, and a check that cannot fail is this
  repo's most-repeated lesson.
- `.claude/` — untracked, tool-managed, and not this repo's to govern.

## Likely files

Forecast, written before the work:

- `scripts/worktree.sh` (new)
- `docs/operations/runbook.md` (new section)
- `.ai/decisions/0023-*.md` (new, `Proposed`)
- Mode-only changes: `tests/validate.sh`, `tests/smoke-mcp.sh`,
  `tests/gather-subset-guard.sh`, `scripts/install.sh`,
  `scripts/sync-registry.sh`
- `AGENTS.md` only if its Commands section needs a note
- `.ai/tasks/TASK-0070-*.md`, `.ai/context/CURRENT_STATE.md`

No component is added; `docs/registry.md` is not expected to change.

## Execution plan

1. Write `scripts/worktree.sh`; keep it idempotent and make it refuse a path
   inside the repo.
2. Set `100755` on the documented entry points with
   `git update-index --chmod=+x`, and confirm with `git ls-files -s` rather
   than `ls`, since `ls` on `/mnt/c` cannot show the truth.
3. Create two worktrees with the script.
4. **Prove the gate fires in a worktree**: commit something deliberately
   invalid and confirm it is refused and `HEAD` does not move.
5. **Prove the mode fix works where it matters**: run `tests/validate.sh` as
   a bare path in a worktree on the Linux filesystem, which returns 126
   today.
6. Runbook section and `ADR-0023`.
7. `tests/validate.sh`; `scripts/sync-registry.sh` as a control.

## Acceptance criteria

- [ ] `scripts/worktree.sh` creates, lists and removes a worktree, is
      idempotent, and refuses a path inside the repo.
- [ ] Worktrees are siblings of the repo, and the main checkout still holds
      `master`.
- [ ] `git ls-files -s` reports `100755` for each documented entry point.
- [ ] `tests/validate.sh` runs **as a bare path** in a worktree on a POSIX
      filesystem — the case that returns 126 today.
- [ ] The pre-commit gate was **observed refusing** an invalid commit inside
      a worktree, with `HEAD` unmoved.
- [ ] The runbook documents create / work / land / remove, including the
      `git push origin HEAD:master` landing step.
- [ ] `ADR-0023` exists and is `Proposed`, not `Accepted`.
- [ ] Neither live session's work was moved, reverted or committed.
- [ ] `tests/validate.sh` passes.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh — expected not required; run as a control.
- [ ] A deliberate gate failure inside a worktree, observed.

## Risks and rollback

- **Disturbing the concurrent session.** The worst outcome available.
  Mitigation: create only; never move, revert or stage another session's
  files; stage by explicit path.
- **A worktree where the gate silently does not run.** Strictly worse than
  no worktree. Mitigation: acceptance criteria require the gate observed
  *refusing*, not merely passing.
- **Mode changes looking like content changes.** A `100644 → 100755` diff is
  easy to misread. Mitigation: they are their own reviewable set, and
  verified with `git ls-files -s`, not `ls`.
- **Branch-per-session drifting into long-lived branches.** The value is
  isolation, not parallel development. Mitigation: the runbook says land and
  remove; `ADR-0023` states short-lived as a condition.
- Rollback: `git worktree remove` each tree, `git update-index --chmod=-x`
  to restore modes, revert the commit. No history is rewritten and nothing
  outside the repo and its sibling directory changes.

## Outputs / handover

*Intended* end state — this section is completed after the work.

| Artifact | End state |
|----------|-----------|
| `scripts/worktree.sh` | New; add/list/remove, idempotent, refuses nesting |
| Entry-point scripts | Recorded `100755`; runnable as bare paths on POSIX |
| `docs/operations/runbook.md` | Worktree section: create, work, land, remove |
| `.ai/decisions/0023-*.md` | New, **`Proposed`** — branch-per-session and the landing rule |
| Main checkout | **Unchanged**, still on `master`, still the integration tree |
| The other session's work | **Untouched** |

**Next task starts here**: worktrees exist and are documented, but **nothing
enforces their use** — two sessions can still be pointed at the main tree.
Whether that needs anything beyond documentation is a judgment call, and
`ADR-0023` is `Proposed` until a human settles the branch-per-session change.

## Status

- Status: in_progress
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log

### Attempt 1

- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
