# TASK-0064 — Author the five acting roles, and fix `git-ops`' staging gap

## Objective

Author `agents/implementer/`, `agents/gate-runner/`, `agents/closer/`,
`agents/park-steward/` and `agents/run-scribe/` — the five roles that write,
run commands or touch git. All five are **OpenCode-only**.

Also fix a gap this work exposes in an existing role: `agents/git-ops/`
allowlists bare `git *`, so **`git add -A` is permitted today** by this repo's
one guarded git owner.

## Minimal context

Every hard decision in the nine-role set is here, and each needs its reason on
the record or a later reader will "simplify" it.

**The closer cannot be `git-ops`, and cannot delegate to it.** `git-ops`
declares `read-only`, which emits `edit: deny` / `write: deny` — it cannot touch
a task file or a tracker. And a subagent cannot spawn one: OpenCode's
`subagent_depth` defaults to 1. So the closer holds edit rights and git rights
**together**, which is exactly why it must be designed carefully. Its
compensating control is **temporal, not permissive**: it runs only after an
`accept`, which is rule 1.

**`push-requires-confirmation` is deliberately absent from the closer.**
`git-ops` carries it, and a reader who knows `git-ops` will assume an oversight.
In an unattended run an `ask` has no addressee: it hangs, or under an
auto-approve flag it becomes an approval. Omitting `git push` from the allowlist
makes it **denied**, which is the guide's own rule — *"A boundary that degrades
to a prompt is not the boundary that was declared."* State this in the body.

**`park-steward` allowlists `git stash push*` and `git stash list*`, never
`git stash*`.** `git stash*` would permit `drop` and `clear`, and stash-never-drop
is the entire point of the step: a parked task's code is sound work that merely
could not be proven, and the operator will often want it.

**`park-steward` is `read-only` and still stashes.** Coherent: `read-only` gates
the edit and write *tools*, while the stash happens through an allowed command.
Say so, because it reads as a contradiction.

**The staging glob is the one place the vocabulary may be short.** There is no
term for "no bulk stage". `TASK-0055`'s **F4** settles whether a glob can express
it. If F4 is falsified, the two honest options are a stated prompt-only rule, or
a new vocabulary term defined in the guide first — definition → enforcement →
emission. **Do not widen `bash_allow` to make it work.** A third option, better
if available: the driver stages the named paths and the closer keeps only
`git commit`. That is S10.1's to implement, but the choice is recorded here.

**`gate-runner` is `B-021`'s shape with a better answer.** B-021 is a *false
self-claim*, not a missing mechanism. `gate-runner` allowlists **one choke
point** — the binding's gate entry point — and nothing else. The individual
parameter-complete commands live in the binding's map, which the role is
*handed*, not *permitted*. Adding a gate then never widens a permission
boundary, and it is the only shape compatible with rule 3. Its description must
claim only what its allowlist permits. **This does not close B-021.**

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `agents/{preflight,task-planner,refuter,adjudicator}/` | `TASK-0063` | authored; the emitter's refusal message recorded |
| `scripts/sync-registry.sh` | `TASK-0060` | Agents section emits a Clients column. **This must already be true** |
| `.ai/tasks/TASK-0055-*.md` | `TASK-0055` | **F4's verdict** — decides the closer's staging boundary |
| `loops/unattended-run/loop.md` | `TASK-0061` | the steps these roles perform |
| `skills/unattended-ops/` | `TASK-0062` | the division of labour |
| `agents/git-ops/agent.md` | pre-existing | `bash_allow: 'git *'` — the gap to fix |
| `scripts/emit-agents.py` | pre-existing | glob ordering: `(g != "*", len(g), g)`; the force-push bug its comments record |

**Verify the expected state; don't assume it.** `TASK-0060` must have landed:
adding five OpenCode-only roles to a registry that cannot say so would advertise
them as universal.

## Scope

### Included

| Role | mode | capabilities | clients |
|---|---|---|---|
| `implementer` | subagent | `no-delegation`, `no-webfetch`, `worktree-only`, `bash-allowlist`, `no-force-push` | opencode |
| `gate-runner` | subagent | `read-only`, `no-delegation`, `no-webfetch`, `worktree-only`, `bash-allowlist` | opencode |
| `closer` | subagent | `no-delegation`, `no-webfetch`, `worktree-only`, `bash-allowlist`, `no-force-push` | opencode |
| `park-steward` | subagent | `read-only`, `no-delegation`, `no-webfetch`, `worktree-only`, `bash-allowlist`, `no-force-push` | opencode |
| `run-scribe` | subagent | `no-delegation`, `no-webfetch`, `worktree-only`, `bash-allowlist` | opencode |

> **The `mode` column read `subagent` for all five when this brief was
> written, and that was wrong — the same correction `TASK-0063` made to its
> own table.** `ADR-0022` clause 5.1: every role a driver invokes via
> `opencode run --agent` must be `primary`, because a `subagent`-mode role is
> **silently replaced by the default agent**, which answers with well-formed
> stdout and exit 0 (`TASK-0055` F1). All five of these roles are
> driver-invoked — `loops/unattended-run/loop.md` names the driver as the
> actor holding control flow, and **no role in this run delegates to another**
> (all nine carry `no-delegation`). Shipped as **`primary`**.
>
> This removes the premise of one sentence in **Minimal context** above: *"a
> subagent cannot spawn one: OpenCode's `subagent_depth` defaults to 1"*. The
> conclusion survives on two independent grounds that do not depend on mode —
> `git-ops` declares `read-only`, so it **cannot** edit a task file or a
> tracker whoever calls it; and the closer is invoked by the driver, not by a
> peer role, so there is no delegation edge to use.

- Fix `agents/git-ops/agent.md`: narrow or supplement `git *` so `git add -A`,
  `git add .`, `git checkout --`, `git clean` and `git stash drop` are denied.
  **This is a behaviour change to a role two shipped loops already use** — treat
  it as such, verify both loops' steps still work, and record it.
- Each body states what the role does, what it must not do with the owner named,
  and what it reports back.
- The four reasons above, each written in the body of the role it concerns.

### Not included

- **Closing `B-021`.** `qa-test` is untouched.
- Any binding, driver or gate command string.
- A new vocabulary term unless F4 forced one — and then in the guide first, as
  its own task, never improvised here.
- `bash: allow` as a way round a boundary. Explicitly forbidden by B-021's entry.

## Likely files

- `agents/{implementer,gate-runner,closer,park-steward,run-scribe}/agent.md`
- `agents/git-ops/agent.md`
- `docs/registry.md` (generated)
- This task file

## Execution plan

1. Confirm `TASK-0060` landed and `TASK-0055`'s F4 has a verdict.
2. Write the five roles. Apply F4's outcome to the closer's `bash_allow`; if F4
   was falsified, apply the chosen fallback and **record which**.
3. Fix `git-ops`; re-read both loops' step 7 to confirm nothing they need is now
   denied.
4. Emit for opencode into a scratch directory. **Inspect every `bash` map**:
   `"*": deny` first; each narrowing deny **after** the allow it narrows.
5. **Verify by reading, not by trusting the sort**: confirm `git add -A` resolves
   to `deny` and `git push` resolves to `deny` in the emitted closer, and that
   `git stash drop` resolves to `deny` in the emitted `park-steward`. Record each
   resolution.
6. Confirm `emit-agents.py` refuses `claude-code` for all five.
7. `scripts/sync-registry.sh`; `tests/validate.sh`; review the diff; commit.

## Acceptance criteria

- [ ] Five role directories exist; all five emit for opencode only, and the
      emitter **refuses** `claude-code` for each.
- [ ] Each emitted `bash` map begins with `"*": deny`, and every narrowing deny
      follows the allow it narrows.
- [ ] `git add -A`, `git add .` and `git push` each resolve to **deny** in the
      emitted closer, **verified by reading the emitted file**, with the
      resolution recorded here.
- [ ] `git stash drop` and `git stash clear` resolve to deny in `park-steward`.
- [ ] The closer's body states why `push-requires-confirmation` is absent.
- [ ] `park-steward`'s body explains why `read-only` and stashing are compatible.
- [ ] `gate-runner`'s description claims only what its allowlist permits, and
      this file states plainly that **B-021 is not closed**.
- [ ] `git-ops` no longer permits `git add -A`, and both existing loops still
      work with the narrowed allowlist.
- [ ] If F4 was falsified, the fallback chosen is named with its reason.
- [ ] Registry regenerated with client coverage.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` then `git diff --exit-code docs/registry.md`
- [ ] `python3 scripts/emit-agents.py` for both clients; the refusal captured

## Risks and rollback

- **Changing `git-ops` under two live loops.** The highest-risk edit here. Verify
  both loops' commit steps against the narrowed allowlist before committing.
- **Glob ordering silently inverting a boundary.** Already happened once in this
  repo, to a force-push rule. Read the emitted file; do not trust the sort key.
- **Widening `bash_allow` to make the closer work.** The failure B-021's entry
  forbids by name.
- **A description promising more than the boundary permits.** B-021's defect.
- **Stale emitted files after a rollback.** Nothing prunes them (`ADR-0018`
  clause 4); remove by hand.
- Rollback: delete the five directories, revert `git-ops`, regenerate, re-emit.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `agents/{implementer,gate-runner,closer,park-steward,run-scribe}/agent.md` | Authored, OpenCode-only, refusal verified |
| `agents/git-ops/agent.md` | Narrowed so `git add -A` is denied; both loops re-checked |
| `docs/registry.md` | Fifteen agent rows; eight showing opencode only |
| This task file | The verbatim resolution of each critical glob, and F4's applied outcome |

**Next task starts here**: `REVIEW-0011` checkpoints S9 against its
pre-committed question. S10 (S10) then binds these roles to each client.
Record here anything the bindings must know: F4's outcome, whether the closer
stages or the driver does, and whether `worktree-only` is still open.

## Status
- Status: done, with one carried-over item — see **`git-ops` was not fixed**
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context), in worktree `ai-toolbox-worktrees/t0064`
  on `agent/t0064` (`ADR-0023`).
- Actions:
  - Authored `agents/{implementer,gate-runner,closer,park-steward,run-scribe}/agent.md`
    with the capability profiles this Scope table specifies, **`mode: primary`
    for all five** (see the correction above), `clients: opencode` for all
    five.
  - Emitted for **both** clients into a scratch directory and read every
    emitted `bash` map rather than trusting the sort key.
  - Proved the refusal path on a scratch **copy** of `agents/`.
  - `scripts/sync-registry.sh`; five new Agents rows, all showing `opencode`.
  - **Attempted and failed** to narrow `agents/git-ops/agent.md` — recorded
    below.

- Observations:

  **1. F4 was CONFIRMED (with a constraint), so the closer stages itself.**
  `TASK-0055` measured, against `opencode 1.18.31`, that under
  `{"*": deny, "git add -- *": allow}`: `git add -- a.txt` is **permitted**
  and `git add -A`, `git add .` **and `git add ./sub/b.txt`** are all
  **denied**. The third fallback in **Minimal context** — the driver stages
  and the closer keeps only `git commit` — is therefore **not needed**, and
  no new vocabulary term was required. The mandatory `--` form is written
  into the closer's body as an instruction, per `ADR-0022` clause 5.4.

  **2. Every critical glob resolution, read out of the emitted OpenCode files
  and re-resolved under last-match-wins** (`fnmatch`, in emission order):

  | Role | Command | Resolves to |
  |---|---|---|
  | `closer` | `git add -A` | **deny** (matches `"*"` only) |
  | `closer` | `git add .` | **deny** (matches `"*"` only) |
  | `closer` | `git add ./sub/f.txt` | **deny** — the F4 constraint, by design |
  | `closer` | `git add -- sub/f.txt` | allow |
  | `closer` | `git push` / `git push origin master` | **deny** (matches `"*"` only — **not** `ask`) |
  | `closer` | `git commit -m "x"` | allow |
  | `closer` | `git commit -am "x"` | **deny** |
  | `closer` | `git commit --amend` | **deny** |
  | `park-steward` | `git stash drop` | **deny** |
  | `park-steward` | `git stash clear` | **deny** |
  | `park-steward` | `git stash push -m …` | allow |
  | `park-steward` | `git checkout -- a.txt` / `git clean -fd` / `git reset --hard` | **deny** |
  | `implementer` | `git add -- a`, `git commit -m "x"`, `pytest` | **deny** (read-only git verbs only) |
  | `gate-runner` | `pytest`, `tests/validate.sh` | **deny**; only the entry point is allowed |
  | `run-scribe` | `git commit -m "x"` | **deny** |

  Every emitted `bash` map **begins `"*": deny`**, and every narrowing deny
  falls **after** the allow it narrows — verified by reading, not assumed.
  Two allow patterns the emitter's length ordering places *after* a deny were
  checked specifically (`git commit -m *` at 15 chars vs `git clean -f*` at
  13): they match disjoint commands, so no deny is inverted.

  **3. `git commit -m *`, not `git commit*`, in both the closer and the
  intended `git-ops` fix.** `git commit*` would admit `git commit -am`, which
  stages every tracked modification and walks straight around the `git add`
  boundary — the same hole in a different verb. `--amend` falls out denied
  too, which is correct: amending is a history rewrite and `AGENTS.md`
  requires authorization in the task file. Narrowing an allowlist is not the
  widening `B-021`'s entry forbids.

  **4. The `gate-runner`'s one choke point needed a name, and naming it is a
  constraint on every binding.** The binding slot is `gate_entry_point`
  (`skills/unattended-ops/templates/binding.md`), filled per project, so the
  role cannot know the path; but `bash_allow` must be a concrete pattern. The
  role allowlists **`'*run-gate.sh*'`** and its body states the convention:
  the binding's `gate_entry_point` must invoke a script named `run-gate.sh`,
  and **status polling goes through the same script**, so the boundary stays
  one line. **S10.1 must satisfy this or change the role's allowlist here, at
  authoring time, with a reason** — never widen it to fit a binding. A
  leading-wildcard pattern was chosen over an anchored one only because the
  path is unknowable at authoring time; it is in the class the authoring
  guide blesses (`*pytest*`), and the ceiling is the guide's own: the term
  bounds what the agent may type, not what the script executes.

  **5. `gate-runner` is `read-only` and still owns step 7 — the same shape as
  `park-steward`.** `read-only` gates the **edit and write tools**; the
  evidence file is written by the entry point as the gate runs
  (`references/long-gates.md`: *"Evidence written by the gate, read by the
  agent"*), and the role reads and reports it. Its body states the one
  consequence that matters: **if a gate's result did not reach the evidence
  file, the remedy is re-running the gate, never transcribing it.** This is a
  second constraint S10.1's bindings inherit.

  **6. `park-steward`'s journal line is `run-scribe`'s to write.** Loop step
  11 expects *"one journal line"*; step 12 gives the journal one owner. The
  role therefore **reports** the stash message and the captured paths and does
  not write them, which is what makes `read-only` coherent rather than a
  contradiction to work around.

  **7. `closer` versus `git-ops`: they overlap on the git verbs and nothing
  else, and neither should be retired.** `git-ops` is `read-only` (`edit:
  deny`, `write: deny`) so it **cannot** do the task-file and tracker half of
  a close; its `git push` is `ask`, which is right with a human present and
  **auto-denies with a false human attribution** without one; and it is a
  `subagent` serving two interactive loops. The closer is `primary`,
  driver-invoked on an `accept` only, holds edit rights, and has `git push`
  **absent from its allowlist and therefore denied** — stated in its body so
  the absence of `push-requires-confirmation` does not read as an oversight.

  **8. `B-021` is not closed by this task — and it was already closed by
  `TASK-0071`.** The brief's acceptance criterion asks this file to *"state
  plainly that B-021 is not closed"*; the accurate statement is that
  `gate-runner`'s one-choke-point shape **routes around** the defect class
  (`references/long-gates.md` says so in those words) and closes nothing,
  while `B-021` itself — `qa-test`'s description overstating its boundary —
  was closed by `TASK-0071`'s `test-allowlist` term, per `TODO.md`. `qa-test`
  is untouched here.

  **9. `git-ops` was NOT fixed. The edit was refused by the session's
  permission layer, twice, as *"Modify Shared Resources"*.** Nothing about
  the fix changed; the file is byte-identical to `master`. So **`git add -A`,
  `git add .`, `git checkout -- <path>` and `git stash drop` remain permitted
  for `git-ops` today**, exactly as `TASK-0055` recorded them. Confirmed by
  re-resolving its emitted map: `git add -A` → **allow**, `git stash drop` →
  **allow**, `git checkout -- a.txt` → **allow**, `git clean -fd` → deny,
  `git push` → ask.

  The intended replacement, ready to apply verbatim, is:

  ```yaml
  bash_allow:
    - 'git status*'
    - 'git diff*'
    - 'git log*'
    - 'git show*'
    - 'git branch*'
    - 'git remote*'
    - 'git rev-parse*'
    - 'git add -- *'
    - 'git commit -m *'
  ```

  **Both shipped loops were re-checked against it and still work.**
  `loops/project-build/` step 7 and `loops/design-brief/` step 7 need
  `git status`, `git diff --stat`, `git log --oneline -1`, explicit staging
  and one `git commit -m …` — all present. `git push*` is deliberately
  **not** in the list: `push-requires-confirmation` emits `"git push*": ask`,
  which is longer than `"*"` and wins under last-match-wins, so push keeps
  asking exactly as it does today. The two loops' bodies would need one
  sentence each only if they ever relied on `git add <path>` without `--`,
  and neither states a staging form.

  **Carried over as an acceptance criterion that is NOT met.** This is a
  behaviour change to a role two shipped loops use, so it wants a human's
  hand on it in any case; it should not be smuggled into a later task's diff.

  **10. Stale or wrong things found, not edited (out of scope).**
  - This brief's **Outputs** table forecasts *"Fifteen agent rows; eight
    showing opencode only"*. Fifteen rows is right; the opencode-only count
    is **eleven** (`closer`, `designer-manager`, `gate-runner`, `git-ops`,
    `implementer`, `park-steward`, `preflight`, `qa-test`, `refuter`,
    `review`, `run-scribe`). Eight was never reachable — six roles were
    already OpenCode-only before this task. The **seven of nine** claim in
    `loops/unattended-run/loop.md` is the one that matters, and it is now
    **true**: `task-planner` and `adjudicator` are the two portable ones.
  - This brief's **Minimal context** sentence about `subagent_depth`, whose
    premise the `mode` correction removes — annotated above rather than
    deleted.
  - Nothing in `loops/unattended-run/loop.md` or `skills/unattended-ops/` was
    found wrong.

- Validation:
  - `tests/validate.sh` → `validate.sh: OK`.
  - `python3 scripts/emit-agents.py opencode <scratch>` → exit **0**, fifteen
    roles emitted.
  - `python3 scripts/emit-agents.py claude-code <scratch>` → exit **0**, four
    emitted (`adjudicator`, `critic`, `ideator`, `task-planner`), eleven
    reported `agent skipped: … (not in its clients list)`.
  - **Refusal proof.** On a scratch **copy** of `agents/`, all five roles'
    `clients` widened to include `claude-code`, then
    `python3 scripts/emit-agents.py claude-code out` → exit **1**, five
    refusals on stderr, and **no file written for any of the five** (`out/`
    held only `adjudicator.md`, `critic.md`, `ideator.md`,
    `task-planner.md`). Verbatim, for `closer`:

    > `  EMISSION REFUSED: role 'closer' declares 'bash-allowlist', which
    > Claude Code cannot enforce per-agent (tools/disallowedTools gate whole
    > tools and have no 'ask' state). Narrow its 'clients' list to opencode,
    > or see ADR-0018 clause 8.4 before adding a workaround.`

    Identical for `gate-runner`, `implementer`, `park-steward` and
    `run-scribe`, only the role name changing. `bash-allowlist` is the term
    that fires first for all five, so `no-force-push` is never reached — the
    refusal is per-role, not per-term.
  - `scripts/sync-registry.sh` then re-run → `docs/registry.md` idempotent;
    five new rows, all `opencode`.
  - Not run: `scripts/install.sh`. Nothing was emitted to `~/.claude/agents/`
    or `~/.config/opencode/agents/`, so those targets are **stale** with
    respect to this commit and nothing in this repo can detect that
    (`ADR-0018` clause 4).

- Result: all acceptance criteria met **except** the `git-ops` one, which is
  blocked on a permission refusal rather than on a decision — see observation
  9, which carries the exact replacement and the re-check of both loops.
- Commit: recorded by a follow-up commit, since a commit cannot contain its
  own hash.
- Push: not attempted. This work is in a per-session worktree and is landed on
  `master` by the human operator (`ADR-0023`); pushing is theirs.

### What the bindings must know (for `REVIEW-0011` and S10)

- **F4 confirmed**: the closer stages itself with `git add -- <path>`; the
  driver does **not** stage. No new vocabulary term was needed.
- **`gate_entry_point` must invoke a script named `run-gate.sh`**, and the
  poll must go through the same script. This is the only convention these five
  roles impose on a binding.
- **The gate entry point writes the evidence file**; the `gate-runner` reads
  it and never hand-writes a result.
- **`worktree-only` is still open** (`TASK-0040`). It costs nothing here —
  all five roles are `opencode`, where the term is `external_directory: deny`
  and unambiguous. It would bite immediately if any of them were ever widened
  to `claude-code`, because `isolation: worktree` gives an isolated **copy**,
  which is the wrong confinement for a role whose output the next role must
  see and whose commit must reach the real tree.
- **`git-ops` still permits `git add -A`.** Unfixed here; see observation 9.
