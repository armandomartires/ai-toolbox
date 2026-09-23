# TASK-0079 — Narrow `git-ops` to the commands it actually needs

## Objective

Replace `agents/git-ops/agent.md`'s `bash_allow: ['git *']` with an explicit
list, so the repo's guarded git owner can no longer bulk-stage, discard
uncommitted work, drop a stash, delete a branch or redirect a remote.

## Minimal context

**Found during the S9 spikes, not here.** `TASK-0055` resolved `git-ops`'s
emitted permission map and recorded that **`git add -A` is permitted today**,
deliberately not fixing it — *"Record it; `TASK-0064` fixes it."* `TASK-0064`
then prepared a replacement block and was **refused by the permission layer**
when it tried to apply it, correctly did not work around the refusal, and
handed the item back.

**It is not being applied because a subagent asked.** A denied agent asking
another agent to finish its action is permission laundering, and was refused
on those grounds. **Human authorization given 2026-09-23**, choosing the
*tightened* variant over the one `TASK-0064` drafted.

### What `git *` actually allows

Under OpenCode's last-match-wins resolution, `bash_allow: ['git *']` emits
`"git *": allow` with only eight narrower deny/ask patterns beside it
(`git push*` ask; `rebase`, `push -f`, `clean -f`, `push --force`,
`reset --hard`, `filter-branch`, `push --force-with-lease` deny). **Everything
else git-prefixed is allowed**, including:

| Command | Effect |
|---|---|
| `git add -A`, `git add .` | Bulk-stages everything, including another session's work — the failure `ADR-0023` exists for |
| `git checkout -- <path>`, `git restore <path>` | Discards uncommitted changes, unrecoverably |
| `git stash drop`, `git stash clear` | Destroys stashed work |
| `git rm -r <path>` | Deletes tracked files |
| `git branch -D` | Deletes a branch |
| `git remote set-url` | Redirects where a push goes |

**`no-force-push` is the misleading part.** It reads as *destructive git is
handled*, and it is — for **push**. The non-push destructive verbs were never
covered. That is a role whose declared safety posture overstates what it
enforces: the same class as `B-021` (`qa-test` claiming to run tests),
`B-028` (`designer-manager` naming a delegate that does not exist) and
`TASK-0078` (`read-only` not stopping a shell). This sprint has now found it
four times.

**Why it matters more after `TASK-0064`.** The new `closer` does the same job
for the unattended loop and is deny-first with explicit allows only. So the
repo ships **two git-owning roles with materially different boundaries, and
the weaker one is the one the two *attended* loops use** — the supervised
path is looser than the unattended one, which is backwards.

### The risk is asymmetric, and that shaped the decision

This change only ever **narrows**: nothing currently denied becomes allowed.
So the failure mode is *"a loop run is blocked doing something legitimate"* —
loud, immediate, recoverable — not *"something unsafe slips through"*. The one
concrete way it can bite is `TASK-0055`'s F4 finding: an allowlist admitting
`git add -- *` **also denies `git add ./sub/file`**, because that lacks the
`--`. Neither shipped loop states a staging form.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `agents/git-ops/agent.md` | `TASK-0045` | `bash_allow: ['git *']`; `read-only`, `no-force-push`, `push-requires-confirmation`; `mode: subagent`; `clients: [opencode]` |
| `.ai/tasks/TASK-0064-acting-roles.md` | `TASK-0064` | Observation 9 — the drafted replacement and the loop re-check |
| `loops/design-brief/loop.md` | `TASK-0041` | Step 7 delegates the lock commit to `git-ops` |
| `loops/project-build/loop.md` | `TASK-0044` | Step 7 delegates the commit to `git-ops` |
| `agents/closer/agent.md` | `TASK-0064` | The deny-first comparison |

**Verify the expected state; don't assume it.** Resolve the emitted map by
running the emitter, not by reading `bash_allow` — the whole defect is that
the declared list and the resolved map say different things to a reader.

## Scope

### Included

- `agents/git-ops/agent.md`: the explicit `bash_allow` list.
- **Tightened beyond `TASK-0064`'s draft**, which is the human's choice: its
  `git branch*` and `git remote*` entries would still have permitted
  `git branch -D` and `git remote set-url`. Replaced with read-only forms.
- Re-resolving the emitted map and checking both shipped loops' step 7.
- A body note telling the role the `--` staging form is mandatory.

### Not included

- **`agents/closer/agent.md`.** It has the same `git commit -m *` shape and
  therefore, by reasoning, the same trailing-flag question (below). It was
  authored hours ago by a task with its own acceptance criteria, and editing
  it here would put a change outside any task that planned for it. **Recorded,
  not fixed.**
- The two loops' bodies. Neither states a staging form, so neither is falsified
  by this change. If a run is ever blocked, that is the trigger to add a
  sentence, not this task.
- `push-requires-confirmation`. Untouched: `"git push*": ask` is longer than
  `"*"` and wins, so push behaves exactly as it does today.

## Execution plan

1. Resolve `git-ops`'s current emitted map and record it verbatim.
2. Apply the tightened list.
3. Re-resolve and confirm each intended denial **by reading the map**.
4. Re-check both loops' step 7 against the new list.
5. `tests/validate.sh`, `sync-registry.sh`, diff, commit, push.

## Acceptance criteria

- [ ] `git add -A`, `git add .`, `git checkout -- *`, `git restore *`,
      `git rm *`, `git stash drop`, `git branch -D`, `git remote set-url`
      all resolve to **deny**.
- [ ] `git add -- <path>` and `git commit -m <msg>` resolve to **allow**.
- [ ] `git push` still resolves to **ask**, unchanged.
- [ ] Both shipped loops' step 7 needs nothing outside the list.
- [ ] The role's body states the mandatory `--` staging form.
- [ ] `tests/validate.sh` passes; the registry row is unchanged.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` (expect no diff — description unchanged)
- [ ] `git status --porcelain`

## Risks and rollback

- **Blocking a legitimate loop run.** The asymmetry above makes this the only
  real risk, and it is visible rather than silent. Mitigated by re-checking
  both loops and by the body note about `--`.
- **Believing the emitted map without reading it.** The defect being fixed is
  precisely a gap between a declared list and a resolved map.
- Rollback is `git revert` of one commit; the role returns to a wider
  boundary, which is safe to do and unsafe to leave.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `agents/git-ops/agent.md` | Explicit `bash_allow`; destructive verbs denied; `--` form stated |
| `agents/closer/agent.md` | **Unchanged**, with the trailing-flag question recorded |
| Both loops | **Unchanged** |

**Next task starts here**: `REVIEW-0011`, S9's checkpoint — the last item.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)
- Actions: resolved the emitted map before and after; applied the tightened
  list; re-resolved and checked every intended verdict by simulating
  OpenCode's last-match-wins against the emitted rules; added the staging
  rule to the body and renumbered.
- Observations:
  - **Every intended denial resolves to deny, verified against the emitted
    map rather than the declared list** — which is the point, since the defect
    was a gap between the two:

    | command | before | after |
    |---|---|---|
    | `git add -A` / `git add .` | allow | **deny** |
    | `git add ./sub/file` | allow | **deny** (no `--`) |
    | `git checkout -- a.txt` / `git restore a.txt` | allow | **deny** |
    | `git rm -r dir` | allow | **deny** |
    | `git stash drop` | allow | **deny** |
    | `git branch -D feat` | allow | **deny** |
    | `git remote set-url origin x` | allow | **deny** |
    | `git add -- sub/file` | allow | allow |
    | `git commit -m msg` | allow | allow |
    | `git push origin master` | **ask** | **ask** — unchanged |

  - **Tightened beyond `TASK-0064`'s draft, which was the human's call and was
    right.** That draft kept `git branch*` and `git remote*`; both are now
    read-only forms (`git branch --show-current*`, `git remote -v*`), so
    `git branch -D` and `git remote set-url` are denied where the draft would
    have allowed them.
  - **THREE HOLES FOUND THAT THIS TASK DID NOT CLOSE, and they affect the
    `closer` identically.** A prefix glob ending in `*` cannot constrain what
    follows, so a trailing flag slips past:

    | form | git-ops | closer |
    |---|---|---|
    | `git commit --amend -m msg` | deny | deny |
    | **`git commit -m msg --amend`** | **allow** | **allow** |
    | **`git commit -m msg --no-verify`** | **allow** | **allow** |
    | **`git add -- .`** | **allow** | **allow** |

    `git add -- .` is the serious one: it **bulk-stages through the very
    pattern meant to prevent bulk staging**. `--no-verify` bypasses the
    mandatory commit gate, which `AGENTS.md` forbids without explicit human
    request. `--amend` rewrites a commit `no-force-push` is supposed to guard.
  - **Not fixed here, deliberately, and it is not a small fix.** `bash_allow`
    emits *allows* only; the denies come from `no-force-push`'s fixed map in
    `scripts/emit-agents.py`. Closing these means editing that map, which
    changes the emitted boundary of **every** role carrying the term —
    `git-ops`, `implementer`, `closer`, `park-steward`. That is a
    vocabulary-behaviour decision affecting four roles, not a tweak to one,
    and it belongs to whoever decides it rather than to a task authorised to
    narrow a single allowlist. **Surfaced to the human; body text warns the
    role in the meantime, which is weaker than a gate and says so.**
- Validation:
  - `tests/validate.sh` — **OK**
  - `scripts/sync-registry.sh` — no diff (description unchanged)
  - Both shipped loops' step 7 re-checked: `design-brief` and `project-build`
    need `git status`, `git diff --stat`, `git log --oneline -1`, explicit
    staging and one `git commit -m` — all present in the new list.
- Result: **done.** The authorised narrowing is applied and verified. Three
  trailing-flag holes are recorded, affecting two roles, needing a decision
  this task was not authorised to make.
- Commit: *pending — recorded in the follow-up commit*
- Push: *pending*
