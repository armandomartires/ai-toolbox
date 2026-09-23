# TASK-0063 — Author the four thinking roles

## Objective

Author `agents/preflight/`, `agents/task-planner/`, `agents/refuter/` and
`agents/adjudicator/` — the four roles that read and judge but never act.

Two of them (`task-planner`, `adjudicator`) are **portable to both clients**.
They are the only two of the nine that will be, and the reason is worth stating
where a reader will meet it: **they are the two that only think.**

## Minimal context

`ADR-0018` clause 1: the source of truth is `agents/<role>/agent.md`, a
client-agnostic role contract — never a client's native format. Clause 2's three
prohibitions are absolute: no `permission:` block, no `disallowedTools` string,
no `tools:` key, no `name:` field used as Claude Code identity. The reason is
**safety, not tidiness** — a raw `permission:` block reaching Claude Code is
silently discarded, leaving an agent with the tools its own file denies. That was
observed by fixture, not reasoned.

`bash-allowlist` is **deny-first**: what is not named is denied, never prompted.
An earlier emitter produced `bash: {"*": "ask"}` for it, which *"permits any
command subject to a prompt, where the roles it models deny everything but a
named set."*

Split from `TASK-0064` on the read-only/acting seam deliberately: every hard
boundary decision — the closer's dual rights, the staging glob, the deliberately
absent `push-requires-confirmation`, `git stash push*` rather than `git stash*` —
lives on the acting side. These four are the tractable half and should not wait
behind it.

**The adjudicator is the role to get right.** It is the one place where being
wrong is expensive in both directions: a wrong `accept` corrupts the record, a
wrong `halt-run` wastes a night. In the live runs it read the harness's own
source to judge the refuter's findings, and reproduced a demonstration rather
than arguing about it. Its body should ask for that behaviour explicitly.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `loops/unattended-run/loop.md` | `TASK-0061` | complete; the steps these four roles perform |
| `skills/unattended-ops/` | `TASK-0062` | complete; the division of labour these roles must match |
| `tests/validate.sh` | `TASK-0059` | the `delegates_to` cross-client check present and demonstrated red once |
| `docs/development/authoring-guide.md` | `TASK-0058` | the vocabulary; `worktree-only`'s Claude Code emission **settled or explicitly open** |
| `agents/_template/agent.md` | pre-existing | the schema |
| `agents/review/agent.md` | pre-existing | the closest existing shape to `refuter` — read it, because the two must be distinguishable |
| `scripts/emit-agents.py` | pre-existing | the vocabulary map and its `Refused` path |

**Verify the expected state; don't assume it.** If `TASK-0058` left
`worktree-only` open, that is inherited here — declare it and record that its
Claude Code emission is unresolved, rather than quietly choosing.

## Scope

### Included

Four role directories, each with frontmatter and a system-prompt body.

| Role | mode | capabilities | clients |
|---|---|---|---|
| `preflight` | **primary** | `read-only`, `no-delegation`, `no-webfetch`, `worktree-only`, `bash-allowlist` | opencode |
| `task-planner` | **primary** | `read-only`, `no-delegation`, `no-webfetch`, `worktree-only` | claude-code, opencode |
| `refuter` | **primary** | `read-only`, `no-delegation`, `no-webfetch`, `worktree-only`, `bash-allowlist` | opencode |
| `adjudicator` | **primary** | `read-only`, `no-delegation`, `no-webfetch`, `worktree-only` | claude-code, opencode |

> **The `mode` column read `subagent` for all four when this brief was
> written, and that was wrong.** `ADR-0022` clause 5.1 is explicit: *every*
> role a driver invokes via `opencode run --agent` must be `primary`, because
> a `subagent`-mode role is **silently replaced by the default agent**, which
> answers with well-formed output and exit 0. All four of these roles are
> invoked by the driver — `loops/unattended-run/loop.md` names the driver as
> the actor holding control flow at steps 1, 2, 5, 8 and 9, and no role in the
> run delegates to another. The loop's own step 1 makes `preflight` check this
> property of every role the run will invoke, so shipping four roles that fail
> it would have made the run's first check fail on the run's own roles.
> Corrected here rather than obeyed; `TASK-0064`'s five acting roles are
> subject to the same clause and are all driver-invoked too.

`bash_allow` for `preflight` and `refuter`: read-only git verbs only
(`git status*`, `git rev-parse*`, `git log*`, `git diff*`, plus `git show*` for
`refuter`, which must establish whether a failure predates the task).

Each body states the three things the template requires — what the role does,
what it must **not** do with the adjacent work named by owner, and the shape of
what it reports back.

Two bodies carry a specific obligation:

- **`refuter`** must name `agents/review/` and say how the two differ. `review`
  returns pass/blocked against a story's criteria with a human downstream;
  `refuter` returns three evidence lists with an **asymmetric prior** — refuted
  unless disproved — because no human sees its output before a commit lands.
- **`adjudicator`** must state that `overrides` records **every** finding
  downgraded from blocking to advisory, each with its reason, and that this is
  the audit trail for a decision nobody watched. It must also state that
  `raise-adhoc` returns a **title only**: ids are the operator's, and a wrong one
  in a committed register is worse than a note in a log.

### Not included

- The five acting roles. `TASK-0064`.
- Any client-native syntax anywhere in a role file.
- A `model:` field. No tier resolver exists in this repo.
- Any new vocabulary term.
- Emission itself — `install.sh` does that; this task only proves it works.

## Likely files

- `agents/{preflight,task-planner,refuter,adjudicator}/agent.md`
- `docs/registry.md` (generated)
- This task file

## Execution plan

1. Confirm the loop and the skill are complete, and read the division of labour.
2. Read `agents/review/agent.md` before writing `refuter`.
3. Write the four files. Frontmatter first, then bodies.
4. **Prove the refusal before trusting a pass**: temporarily widen `preflight`'s
   `clients` to include `claude-code` and confirm `emit-agents.py` **exits
   non-zero** naming `bash-allowlist`. Revert. Record the output verbatim.
5. Run `emit-agents.py` for both clients into a scratch directory; confirm four
   roles for opencode, two for claude-code.
6. Inspect the emitted OpenCode files: `"*": deny` must appear **first** in each
   `bash` map — the globs are last-match-wins and reordering inverts meaning.
7. `scripts/sync-registry.sh`; confirm the Clients column shows the split.
8. `tests/validate.sh`; review the diff; commit.

## Acceptance criteria

- [x] Four role directories exist, each `name` matching its directory.
- [x] Every capability term is from the closed vocabulary; no client-native key
      appears in any file.
- [x] `task-planner` and `adjudicator` emit for **both** clients; `preflight` and
      `refuter` for **opencode only**.
- [x] **The emitter was observed refusing** a deliberately widened role, and the
      output is recorded verbatim in this file.
- [x] Emitted OpenCode `bash` maps begin with `"*": deny`.
- [x] `refuter`'s body names `review` and states the difference.
- [x] `adjudicator`'s body states the `overrides` obligation and the
      title-only rule for `raise-adhoc`.
- [x] No role's description claims a capability its `capabilities` list does not
      permit — the `B-021` test, applied before shipping rather than after.
- [x] The registry shows the client split.

## Mandatory validations

- [x] `tests/validate.sh`
- [x] `scripts/sync-registry.sh` then `git diff --exit-code docs/registry.md`
- [x] `python3 scripts/emit-agents.py` for both clients into a scratch directory

## Risks and rollback

- **`B-021` repeated.** A description promising more than the allowlist permits.
  The named acceptance criterion is the control.
- **Trusting a green emitter.** `ADR-0018` clause 8.2's whole point is the
  refusal path; a pass proves nothing about it. Prove the red first.
- **Glob order.** `emit-agents.py`'s own comments record a force-push silently
  resolving to `ask` because of alphabetical sorting. Inspect, do not assume.
- **Declaring `worktree-only` while its Claude Code emission is unsettled.** If
  `TASK-0058` left it open, say so here rather than letting two portable roles
  imply it was resolved.
- Rollback: delete the four directories, regenerate the registry, re-run
  `install.sh`. Note that nothing prunes stale emitted files (`ADR-0018`
  clause 4), so a rollback must remove them by hand.

## Outputs / handover

*Verified, 2026-09-23 — see the execution log.*

| Artifact | End state |
|----------|-----------|
| `agents/{preflight,task-planner,refuter,adjudicator}/agent.md` | Authored; two portable, two OpenCode-only |
| `docs/registry.md` | Four new Agents rows with client coverage |
| This task file | The emitter's verbatim refusal output |
| `~/.claude/agents/`, `~/.config/opencode/agents/` | **Not updated.** `install.sh` was not run; emission was proved into a scratch directory only, so both targets are stale for these four roles and nothing here can detect that (`ADR-0018` clause 4) |

**Next task starts here**: `TASK-0064` authors the five acting roles, where every
hard boundary decision lives. Record here whether `worktree-only` was settled or
inherited open, and the exact emitter refusal message — `TASK-0064` will need to
recognise it.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5, in worktree `ai-toolbox-worktrees/t0063` on `agent/t0063`
  (ADR-0023).
- Actions:
  - Authored `agents/{preflight,task-planner,refuter,adjudicator}/agent.md`
    from `agents/_template/`, capabilities and `clients` exactly as the Scope
    table specifies, `mode: primary` for all four (see the correction above).
  - Ran `scripts/emit-agents.py` for both clients into a scratch directory and
    read the emitted frontmatter rather than assuming it.
  - Proved the refusal path on a scratch **copy** of `agents/` before trusting
    the pass, per `ADR-0018` clause 8.2.
  - `scripts/sync-registry.sh`; four new Agents rows with the client split.

- Observations:

  **1. The emitter's refusal, verbatim.** `preflight`'s `clients` widened to
  include `claude-code` in a scratch copy of `agents/`, then
  `python3 scripts/emit-agents.py claude-code <scratch>`:

  > `  EMISSION REFUSED: role 'preflight' declares 'bash-allowlist', which
  > Claude Code cannot enforce per-agent (tools/disallowedTools gate whole
  > tools and have no 'ask' state). Narrow its 'clients' list to opencode, or
  > see ADR-0018 clause 8.4 before adding a workaround.`

  Exit code **1**. The refusal is on **stderr**; the emitter **continues** to
  the remaining roles and no `preflight.md` is written — so the signal is the
  exit code plus the stderr line, not the absence of later output.
  `TASK-0064` will meet this exact string for `no-force-push`,
  `push-requires-confirmation` and `test-files-only` as well as
  `bash-allowlist` — only the quoted term changes.

  **2. Emission, both clients.** OpenCode: all four emitted, exit 0.
  Claude Code: `task-planner` and `adjudicator` emitted, `preflight` and
  `refuter` reported `agent skipped: … (not in its clients list)`, exit 0.
  Every emitted OpenCode `bash` map begins with `"*": deny`, then the git
  verbs in length order — verified by reading the files, not assumed.

  **3. `task-planner` and `adjudicator` really are portable — and the price
  is that they carry no command boundary at all.** Their emitted OpenCode
  frontmatter has `edit`, `write`, `task`, `webfetch`, `websearch` and
  `external_directory` denied and **no `bash` key**; their Claude Code
  frontmatter has `disallowedTools: Write, Edit, NotebookEdit, Agent,
  WebFetch, WebSearch` and no `tools` restriction. So `read-only` binds at the
  **tool** layer only: neither role is prevented from writing a file through a
  shell. That is not a defect in this task's profiles — it is the trade
  `ADR-0022`'s "the two that only think" claim rests on, since adding
  `bash-allowlist` to either would make it OpenCode-only and falsify the
  claim. Recorded so the next reader does not discover it as a surprise:
  **their read-only-ness is instructed in the body, not enforced against
  bash.** `TASK-0064`'s acting roles do not have this option and must not
  copy the shape.

  **4. `preflight` cannot perform half of loop step 1 itself, and its body
  says so.** Step 1 asks it to confirm the driver resolves an explicit model
  and that every role is selectable as a *primary* agent. Neither is a git
  command, and the emitted role files live outside the worktree, so
  `bash-allowlist` (git verbs only) and `worktree-only` both exclude it. The
  body resolves this the way `skills/unattended-ops/` rule 2 resolves gate
  commands — **the driver runs the check and hands `preflight` the output to
  read** — and states that output not being supplied is itself a `halt`. This
  is a constraint on the binding, and `TASK-0065`'s binding templates should
  carry it.

  **5. `worktree-only` is inherited OPEN, not settled.** `TASK-0058` left it
  open and the authoring guide says so in the present tense as of 2026-09-23:
  `emit-agents.py` emits `isolation: worktree` for Claude Code and flags the
  mapping `partial`, which is *behaviour persisting in code*, not a decision.
  Both portable roles here carry it, so both carry the unresolved mapping —
  confirmed in their emitted Claude Code files (`isolation: worktree`). The
  guide's own caveat — *do not declare `worktree-only` on a Claude Code role
  whose job is to commit* — does **not** bite here, because neither role
  commits; it will bite `TASK-0064`'s `closer`. Owner remains `TASK-0040`.

  **6. Two documentation discrepancies found, not edited (out of scope).**
  - `scripts/emit-agents.py`'s module docstring says *"Six of the eleven
    capability terms cannot be enforced per-agent in Claude Code"*, while the
    authoring guide says *"The other seven are enforceable in OpenCode only"*.
    Both are true and neither is wrong: the **refusal set** is six (the terms
    whose `claude_code` entry is `None`); the seventh, `worktree-only`, is
    OpenCode-only in *enforcement* but emits a partial Claude Code mapping
    instead of refusing. A reader taking either number as the refusal count
    gets `worktree-only` wrong in one direction or the other. Worth one
    clarifying clause in the guide's "Four of the eleven" paragraph.
  - This brief's Scope table, corrected above. Nothing in the loop or in
    `skills/unattended-ops/` was found wrong.

- Validation:
  - `tests/validate.sh` → `validate.sh: OK`.
  - `scripts/sync-registry.sh` → four Agents rows added; `preflight` and
    `refuter` show `opencode`, `task-planner` and `adjudicator` show
    `claude-code, opencode`.
  - `python3 scripts/emit-agents.py opencode <scratch>` → exit 0, four roles.
  - `python3 scripts/emit-agents.py claude-code <scratch>` → exit 0, two
    roles, two skipped.
  - Refusal path → exit 1, message quoted above.
  - Not run: `scripts/install.sh`. Nothing was emitted to `~/.claude/agents/`
    or `~/.config/opencode/agents/`, so those targets are **stale** with
    respect to this commit and nothing in this repo can detect that
    (`ADR-0018` clause 4).

- Result: acceptance criteria met, with the `mode` correction recorded above.
- Commit: `02c1cb2` on `agent/t0063` (recorded by a follow-up commit, the
  same shape as `229d65c`, because a commit cannot contain its own hash).
- Push: not attempted. This work was done in a per-session worktree and is
  landed on `master` by the human operator (`ADR-0023`); pushing is theirs.
