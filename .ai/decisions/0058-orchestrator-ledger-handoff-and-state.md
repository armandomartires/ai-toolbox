# ADR-0058 — The orchestrator's ledger, hand-off and stored state are decided here

**Status**: accepted
**Date**: 2026-11-10
**Task**: `TASK-0265`

## Context

`mods/task-orchestrator/` took its ledger, hand-off, settings-scope and store decisions in task briefs, not in an ADR: `TASK-0183`, `TASK-0194`, `TASK-0202`, `TASK-0203`, `TASK-0238` and `TASK-0239`. `REVIEW-0013` §1.5 found that no ADR records them and asked for one. This record restates those decisions as the briefs state them, and adds the admission rule and the fence key that `TASK-0265` sets. Where a brief is cited, its clause is the source.

## Decision

1. **The ledger is one `$.state` atom of task rows.** A row's status is one of `queued`, `running`, `completed`, `partial`, `blocked`, `failed` or `cancelled` (`types/index.d.ts`, `TaskStatus`). The limits are enforced in code, not left to the protocol text: concurrency, one non-isolated writer at a time, disjoint files for isolated writers, retries and escalations (`TASK-0183`; the values are `DEFAULT_LIMITS` in `routing.ts`).
2. **Every ledger write is an updater over the current rows.** A `queued → running` change is a compare-and-set, and `tick` is serialised (`TASK-0239` item 1).
3. **One admission check guards every path into `running`** (`TASK-0265`). `admit()` in `ledger.ts` applies the start rules and the status change together, and refuses a row that is not in the status it expects. It is used by `start`, the Agent-tool spawn, the subagent and session hand-off adoptions, and the turn-cap resume. A resumed worker that would exceed the cap or share a checkout with another non-isolated writer is not reopened silently (`TASK-0265` acceptance).
4. **The write fence is keyed on the row, not on the mod being on** (`TASK-0265`). `/orchestrate off` stops new dispatches without touching the ledger (`TASK-0183`), and a running worker stays fenced until it ends.
5. **A spawn that auto mode gives no verdict is re-issued once, as-is, then handed off** (`TASK-0194`). A second no-verdict block the task with `handoff` and name the Agent call to make. The mod adds no allow and rewrites no call.
6. **The hand-off names the role's own profile.** It names `task-orchestrator:<role>`, the requested model and effort, and `isolation "worktree"` for an isolated task (`TASK-0203`). The effort goes on the call: the probe in `TASK-0203` showed the call's effort wins over the profile's.
7. **A hand-off is adopted by the assignment header, not by `name`.** The coordinator's Agent call is adopted when its prompt's first line is `# Assignment <id> — <role>` and its profile is the role's own or the task's exact one (`TASK-0202`, `TASK-0203`). A call of another role is refused. An untracked spawn whose prompt names a ledger task is not given that id (`TASK-0202`).
8. **A hand-off holds its slot and the writer lock.** `overall` reports it as `running`, not `blocked`, and a dependant waits on the call; `stalledBy` does not tell it to re-dispatch (`TASK-0239` item 4).
9. **A re-dispatch under a `blocked`, `failed` or `partial` id is a retry.** It counts as retry n of `maxRetries` and is refused past it. A `completed`, `cancelled`, `queued` or `running` id is refused. A dependant of a task that ended without completing is listed by `status` and returned by `collect`, naming the dependency and how to retry it (`TASK-0194`).
10. **The store is scoped by project and by session.** Settings are stored per project under `task-orchestrator:settings:<project path>`. The run is mirrored under `task-orchestrator:run:<session id>` on every change and restored at `session.start` only into empty atoms and only when the stored session id is this session's (`TASK-0238`, `TASK-0239` item 3). Unscoped keys are not read.
11. **A project's config file may only narrow.** `<cwd>/.claude/task-orchestrator.json` may lower the limits and may not raise them. Its `optIn` is ignored and refused with a reason in `status`, and nothing from it is persisted (`TASK-0239` item 2).
12. **Worker text is data, not instruction.** The hidden note to the coordinator carries the id, role and status only. A worker's `next` is one line of at most 200 characters. A dependency's findings enter the next assignment as quoted data, indented under a "quoted data" line and capped at 1500 characters (`TASK-0239` item 2). A session whose first prompt starts with `# Assignment ` is a worker: it gets no coordinator protocol and stays off (`TASK-0239` item 3).

## Alternatives considered

- **Retry only, with no hand-off.** Rejected: a re-issued plugin spawn meets the same refusal, so a retry alone cannot start a worker under auto mode (`TASK-0194`, findings).
- **`$.tool.call({ tool: 'Agent' })` as the spawn path.** Rejected and out of scope (`TASK-0194`).
- **Adoption by `name`.** Dropped: the desktop app's Agent tool has no `name` parameter (`TASK-0202`, live).
- **A per-settings profile in the hand-off (`builder--sonnet-high`).** Dropped: a profile registered in a turn is not an Agent type until the next turn (`TASK-0202`, live). The mod's own spawn keeps per-settings profiles, since it takes no effort (`TASK-0203`, scope).
- **One unscoped settings key and one unscoped run.** Replaced by the per-project and per-session keys (`TASK-0239` item 3).

## Consequences

- The no-verdict match is on the deny's wording. A reworded deny falls back to `blocked`, which a re-dispatch can still retry (`TASK-0194`, risks).
- The mod sees neither the Agent call's effort nor its isolation. The `observed` line shows the effort; an isolation left off is not caught (`TASK-0203`, risks).
- Orchestration is off in each project until `/orchestrate on` is run there once (`TASK-0239`, risks).
- The forced-reload cause is not confirmed from the engine's source; the store mirror is the mod's answer to it (`TASK-0238`, objective).
- A resumed turn-capped worker may now be refused at `turn.start`, while its turn is already running; the coordinator is told why (`TASK-0265`, risks).
- Not yet run: the `TASK-0265` live checks (a worker in a worktree writing through the resolved fence; a resume refused by the cap), and the auto-mode hand-off in a desktop session with the changed mod loaded (`TASK-0194`, unchecked item). `TASK-0265` is in progress.
