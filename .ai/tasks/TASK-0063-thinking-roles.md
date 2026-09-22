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
| `preflight` | subagent | `read-only`, `no-delegation`, `no-webfetch`, `worktree-only`, `bash-allowlist` | opencode |
| `task-planner` | subagent | `read-only`, `no-delegation`, `no-webfetch`, `worktree-only` | claude-code, opencode |
| `refuter` | subagent | `read-only`, `no-delegation`, `no-webfetch`, `worktree-only`, `bash-allowlist` | opencode |
| `adjudicator` | subagent | `read-only`, `no-delegation`, `no-webfetch`, `worktree-only` | claude-code, opencode |

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

- [ ] Four role directories exist, each `name` matching its directory.
- [ ] Every capability term is from the closed vocabulary; no client-native key
      appears in any file.
- [ ] `task-planner` and `adjudicator` emit for **both** clients; `preflight` and
      `refuter` for **opencode only**.
- [ ] **The emitter was observed refusing** a deliberately widened role, and the
      output is recorded verbatim in this file.
- [ ] Emitted OpenCode `bash` maps begin with `"*": deny`.
- [ ] `refuter`'s body names `review` and states the difference.
- [ ] `adjudicator`'s body states the `overrides` obligation and the
      title-only rule for `raise-adhoc`.
- [ ] No role's description claims a capability its `capabilities` list does not
      permit — the `B-021` test, applied before shipping rather than after.
- [ ] The registry shows the client split.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` then `git diff --exit-code docs/registry.md`
- [ ] `python3 scripts/emit-agents.py` for both clients into a scratch directory

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

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `agents/{preflight,task-planner,refuter,adjudicator}/agent.md` | Authored; two portable, two OpenCode-only |
| `docs/registry.md` | Four new Agents rows with client coverage |
| This task file | The emitter's verbatim refusal output |
| `~/.claude/agents/`, `~/.config/opencode/agents/` | Updated only if `install.sh` was run — say which, since nothing verifies freshness |

**Next task starts here**: `TASK-0064` authors the five acting roles, where every
hard boundary decision lives. Record here whether `worktree-only` was settled or
inherited open, and the exact emitter refusal message — `TASK-0064` will need to
recognise it.

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
