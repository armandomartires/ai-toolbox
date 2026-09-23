# TASK-0083 — Close the trailing-flag holes, split by what they actually are

## Objective

Close the three forms `TASK-0082` confirmed against `opencode 1.18.31`, using
**two** mechanisms rather than one, because they are not the same kind of
thing:

| Form | Goes to | Because |
|---|---|---|
| `git commit -m msg --amend` | **`no-force-push`**, extended | Rewriting a commit is history rewriting — squarely what that term already denies |
| `git commit -m msg --no-verify` | **`no-bypass`**, new | Skipping the mandatory commit gate is not force-pushing |
| `git add -- .` | **`no-bypass`**, new | Bulk-staging through the sanctioned `--` form is not force-pushing either |

**Human decision, 2026-09-23**, choosing the split over folding all three into
`no-force-push`.

## Minimal context

`TASK-0082` settled these against the live client rather than by simulation.
`git commit -m msg --amend` **ran and rewrote the commit**; `git add -- .`
**ran and staged 17 paths**; `--no-verify` passed the permission layer. Two
controls behaved, so the permits are discriminating.

**Why the split is the right shape and not just tidier.** `no-force-push`'s
own comment says it *"denies the whole family of git operations that destroy
work rather than adding to it."* `--amend` belongs. `--no-verify` and
`git add -- .` destroy nothing — they **defeat a control while using a
permitted form**, which is a different failure and deserves a name a role can
decline to carry.

**The hazard this task must not walk into.** Emitted glob order is
**semantic**: OpenCode resolves last-match-wins and the emitter writes `"*"`
first, then **shortest to longest**. A deny only beats an allow if it is
**longer**. `TASK-0045` already lost a boundary to exactly this — plain
alphabetical order put `git push*: ask` after `git push --force*: deny`, so a
force-push resolved to *ask*.

`git add -- .` is **12 characters and so is the allow `git add -- *`**. A tie
falls to the alphabetical tiebreak, which is not a property to rely on.
**This must be tested against the client, not reasoned about** — the whole
lesson of `TASK-0082`.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/tasks/TASK-0082-*.md` | `TASK-0082` | The three confirmations and their evidence |
| `scripts/emit-agents.py` | `TASK-0078` | Twelve-term `VOCAB`; `no-force-push`'s deny map; the length-then-alphabetical sort and its comment |
| `tests/validate.sh` | `TASK-0078` | `VOCAB` of twelve; `BASH_SHAPING`; the `no-bash` contradiction check |
| `docs/development/authoring-guide.md` | `TASK-0078` | Twelve-term table; *"Five of the twelve are enforceable in both clients"* |
| `agents/{git-ops,closer,implementer,park-steward}/agent.md` | various | The four `no-force-push` carriers |

**Verify the expected state; don't assume it.** Re-read which roles carry
`no-force-push` before claiming a blast radius — it was four at the time of
writing and nothing guarantees it still is.

## Scope

### Included

- `no-force-push` gains a deny for the `--amend` family, in the emitter's map.
- **`no-bypass`**, a thirteenth term: denies `--no-verify` and the
  bulk-staging forms. Defined in the **guide first** (`ADR-0008`), then the
  gate, then the emitter.
- Declared on the roles that stage or commit.
- **Live verification against `opencode`**, repeating `TASK-0082`'s method:
  the emitted block, a scratch repo, observed tool state — **not** a
  reimplemented matcher.
- If the `git add -- .` tie cannot be won at the glob layer, **say so and
  record the limitation** rather than shipping a deny that does not fire.

### Not included

- Claude Code. `disallowedTools` removes whole tools; there is no glob to
  escape. `no-bypass` is therefore OpenCode-only, and the roles carrying it
  are already OpenCode-only for other reasons.
- Widening any allow. Nothing here grants anything.
- `B-025`, `worktree-only`, or anything else on the carried-forward list.

## Likely files

- `docs/development/authoring-guide.md`, `tests/validate.sh`,
  `scripts/emit-agents.py`
- `agents/git-ops/`, `agents/closer/`, and whichever other carriers need it
- **Not** `docs/registry.md` — descriptions do not change

## Execution plan

1. Re-read the `no-force-push` carriers.
2. Guide: the `no-bypass` row, the `--amend` extension, the counts.
3. Gate: `no-bypass` into `VOCAB` and `BASH_SHAPING`; prove it fires.
4. Emitter: both maps.
5. Declare on the staging/committing roles; emit and read the output.
6. **Verify live**, all three forms plus controls, as `TASK-0082` did.
7. `validate.sh`, `sync-registry.sh`, diff, commit, push.

## Acceptance criteria

- [ ] All three forms resolve to **deny**, **observed against the client**,
      with the tool state recorded — or any that cannot is recorded as a
      stated limitation with its reason.
- [ ] The controls from `TASK-0082` still behave: `git commit -m msg` and
      `git add -- file` remain **allowed**; a narrowing has not become a
      blanket denial.
- [ ] `no-bypass` is defined in the guide before it is enforced anywhere.
- [ ] Pairing `no-bypass` with `no-bash` fails the gate, observed.
- [ ] Counts agree across guide, gate and emitter.
- [ ] `tests/validate.sh` passes; the registry is unchanged.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` (expect no diff)
- [ ] `git status --porcelain`

## Risks and rollback

- **Shipping a deny that never fires**, because it lost the length ordering.
  The specific failure `TASK-0045` already paid for. Mitigated by observing
  the resolution rather than computing it.
- **Over-denying a legitimate path.** `git add -- .gitignore` is legitimate;
  a `git add -- .*` pattern would kill it. Patterns must target the directory
  forms only, and the control above catches it.
- **A thirteenth term nobody needs.** Mitigated by `TASK-0082`'s evidence that
  two shipped roles are defeated today.
- Rollback is `git revert` of one commit.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `scripts/emit-agents.py` | `no-force-push` denies the `--amend` family; `no-bypass` added |
| `tests/validate.sh` | `no-bypass` admitted and contradiction-checked |
| `docs/development/authoring-guide.md` | Thirteen terms; the split explained |
| The staging/committing roles | Declare `no-bypass` |

**Next task starts here**: ratifying `ADR-0023`, which is independent of this
and already decided.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Findings

**Verified against `opencode 1.18.31`, 2026-09-23**, using `TASK-0082`'s
method: the emitted `closer` permission block extracted by script into a
fixture with a controllable body, a scratch git repo outside this repo, and
the **tool state** read rather than the agent's account.

| Command | Before | After | Fires? |
|---|---|---|---|
| `git commit -m msg --amend` | allowed, rewrote history | **DENIED** | **yes** |
| `git commit -m msg --no-verify` | allowed | **DENIED** | **yes** |
| `git add -- .` | allowed, staged 17 paths | **still ALLOWED** | **NO** |
| `git add -- a.txt` | allowed | allowed | control — the narrowing did not become a blanket denial |
| `git commit -m msg` | allowed | allowed | control |

### Two closed, one cannot be closed at the glob layer

**A deny beats an allow only if it is longer.** The two that fire are:
`git commit*--amend*` (20) against `git commit -m *` (15), and
`git commit*--no-verify*` (24) against the same.

**`git add -- .` is 12 characters and so is `git add -- *`.** The deny was
emitted *after* the allow and **still lost** — an equal-length deny does not
win, whatever the emitter's sort order suggests. And any pattern long enough
to win (`git add -- .*`, 13) also matches **legitimate dotfile paths** such as
`git add -- .ai/tasks/x.md`, which is most of what these roles commit in this
repo.

**So the three `git add` denies were REMOVED after being verified**, not left
in place. A deny that does not fire is **worse** than no deny: a reader of the
emitted map would believe the boundary holds. That is precisely the
false-boundary class this sprint found four times, and shipping one while
closing three others would have been the sprint's own lesson inverted.

The rule now lives in **both roles' bodies** — `git-ops` already had it,
`closer` gained it — and each says plainly that the allowlist cannot enforce
it. Weaker than a gate, and labelled as such.

### A method note worth carrying

**The first verification run was inconclusive and I nearly took it as a
pass.** Asked for five commands, the model ran three and silently skipped the
two that mattered. Re-running them **one command per invocation** removed its
discretion and produced the real answer — including the `git add -- .`
failure, which the five-command run had simply not attempted. *An unattempted
command is not a passing one*, and a harness that reads "no denial observed"
as success would have shipped the false boundary.

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)
- Actions: guide → gate → emitter, in `ADR-0008` order; `no-bypass` declared
  on `git-ops` and `closer`; emitted and read; **verified live**; the
  non-firing denies removed and the limitation recorded in three places.
- Observations: see **Findings**. Two of three closed on evidence; the third
  is a stated limitation with its reason and its measurement.
  - **The contradiction check extends correctly:** `no-bash` beside
    `no-bypass` fails the gate, observed.
  - **Both controls held**, so the narrowing did not become a blanket denial.
  - The guide, the emitter comment and both role bodies now say the same
    thing about `git add -- .`, and none of them claims it is enforced.
- Validation:
  - `tests/validate.sh` — **OK**
  - `scripts/sync-registry.sh` — no diff
  - `git status --porcelain` — fixtures removed; `~/.config/opencode/agents/`
    and `~/.claude/agents/` carry **0** fixture files
- Result: **done.** `--amend` and `--no-verify` are closed and observed
  closed. `git add -- .` is **not closable at the glob layer** and is recorded
  as a limitation rather than papered over.
- Commit: *pending — recorded in the follow-up commit*
- Push: *pending*
