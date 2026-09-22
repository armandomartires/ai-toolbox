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
