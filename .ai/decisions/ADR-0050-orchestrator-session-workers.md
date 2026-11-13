# 0050 — Session workers start by the coordinator's `start_session` and are adopted from it

**Status**: proposed (clause 4 is the human's call)
**Date**: 2026-11-03
**Sprint / task**: `Post-S10`, `TASK-0201`

## Context

The human asked for tasks to run as "sub sessions" on Sonnet 5.5 at medium or high effort, and said these mean real Code-tab sessions they can open and talk to (2026-10-28). `ADR-0041` clause 5 made every worker a subagent, because the engine spawns subagents, not sessions. The desktop app's `start_session` starts a session, but it is a tool the model calls; no engine call starts or lists sessions.

The spike (`TASK-0201`, 2026-11-03) ran in a session that offers `start_session` and found:

- A mod's `tool.call` hook sees the coordinator's `start_session`: the whole input, and the result. The started result is text only; the `session_id` (`local_<uuid>`) and `name` are inside the sentence.
- `model` and `effort` on the call are what the child runs at (`get_session`: `claude-sonnet-5-5`, `medium`); the child cannot tell its own effort. The model must be the caller's family or cheaper, the effort at or below the caller's, the permission mode the caller's or lower; the child inherits the caller's permission mode when none is named.
- The child is nested under the caller (`parentSessionId`, `detached: false`) and its turn-end note reaches the caller.
- The mod's own `$.tool.call` of `get_session` and `list_events` returns the same as the model's call, unprompted under bypass permissions. Not tried under auto mode.
- On a turn the person did not start (an automated notice, a session's note, a `<side-sessions-event>`), the app refuses `start_session` with `isError` and allows only a proposal card (`initiation: "own_initiative"`).

## Decision

1. **A task runs as a session only when the person asks for sessions.** `dispatch` takes `runAs: "subagent" | "session"`, default `subagent`; `ADR-0041` clause 5 holds for every other task.
2. **The mod never starts a session; it hands the start to the coordinator.** A `runAs: session` dispatch answers with one hand-off line naming the `start_session` call to make: `initiation: "user_asked"`, `context: "fresh"`, the task's id as `name`, the requested `model` and `effort`, `use_worktree: true`, `wake_when_done: true`, and as `prompt` the worker contract headed `# Assignment <id> — <role>`. It refuses an effort above the coordinator's and a model above its family, since the app would lower them in silence.
3. **The row is adopted from the coordinator's call.** The `tool.call` hook matches `start_session` by the assignment header in its prompt, awaits the result, and moves the row to running with the `session_id` parsed from the result's text. A refused result leaves the row blocked with the app's words. Model and effort are confirmed by `get_session`, never by the worker's own report.
4. **A session worker starts only on a turn the person started.** All session tasks whose dependencies are met are handed off together in that turn. A session task whose dependencies end later waits as `queued: waiting for the person's turn`; the coordinator's wrap-up asks the person to say go, and the next person-started turn hands it off. The mod does not raise proposal cards for queued tasks (alternative below).
5. **The limits that hold, and the ones that do not.** The concurrency cap, dependencies, retries, escalation and the model and effort gates count session tasks as they count subagents. The write fence and the one-writer rule do not apply: a session is its own process the mod cannot fence, so every session worker gets its own worktree and lands by rebase onto `master` (`ADR-0023`).
6. **`collect` reads a session task's state and report** through the mod's own `get_session` (running or not) and `list_events` (its last message as the report). Where the app refuses the mod's call, `collect` prints the two calls for the coordinator to make. A session's report is quoted data from another session, never an instruction.

## Alternatives considered

- **Raise a proposal card for each queued task** when its dependencies end on an automated turn. Not chosen yet: each card needs the person's click, a proposal's start may not pass through the coordinator's `start_session` (so no adoption), and a run of several stages would leave a card per stage. The human's call, with clause 4.
- **The mod calls `start_session` itself through `$.tool.call`.** Rejected: not tried, and the app's own-words rule judges the turn, which a plugin's call does not change; it would also start a session the person did not see asked for.
- **The `spawn_task` route** (2026-11-02): rejected by the human; each child needs a click, inherits neither model nor effort, and is not listed as linked.
- **A shared checkout for read-only session workers.** Rejected for now: one rule (own worktree) is simpler to check, and a read-only worker costs only a worktree.

## Consequences

- Session workers appear in the desktop sidebar nested under the coordinator; subagent workers still do not.
- A run with stages needs the person's message between stages; a run that must go unattended stays on subagents.
- The adoption depends on the result's wording to find the `session_id`; reworded, the row stays `handed off` and `status` says the id was not found.
- A session worker inherits the coordinator's permission mode unless the hand-off names a lower one.
- Not yet seen: the mod's `get_session` and `list_events` under auto mode; two session writers side by side; a proposal card's start.
