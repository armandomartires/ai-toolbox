# TASK-0201 — task-orchestrator 0.5.0: session workers

## Status

- Status: blocked
- Owner: agent (Claude Code)
- Created: 2026-10-28
- Updated: 2026-11-02
- Applies to: `mods/task-orchestrator/` (0.4.0 → 0.5.0)
- Source: the human's review request of 2026-10-28 ("…assigning the tasks to sub sessions running sonnet 5.5 in medium or high effort…"); their answer that "sub sessions" means real Code-tab sessions; the approved plan; "Yes, spike next"
- Blocked on: a desktop session that offers the app's `start_session` tool (step 1)

## Objective

When the person asks for sessions, a task runs as a Code-tab session they can open and talk to, still under the orchestrator's ledger, concurrency cap, dependencies, retries and model/effort gates.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-orchestrator/` 0.4.0 | workers are subagents only; the protocol says so; the auto-mode hand-off pattern (`handoffCall`, adoption in the `agent.spawn` hook) |
| the desktop app's `start_session`, `get_session`, `set_session_effort`, `list_events` | model-callable tools; no engine call starts or lists sessions |

## Spike findings (2026-10-28)

- **Not offered here.** In session `Orchestrate mod alignment review` (desktop, Remote Control on, `isRemote: true`, auto mode) neither `start_session` nor `hand_off_to_session` is offered, though other tools' descriptions name both. Which sessions get them is unknown; the one session started from another on this account (2026-10-26) had a parent without Remote Control.
- **A mod sees the app's tool calls.** agent-watch's band follows the app's `update_plan` through a `tool.call` hook, checked live by the human in `TASK-0181`; so a hook on the coordinator's `start_session` and its result is expected to work. Its input schema and result shape are still unseen.
- **A started session does not inherit the parent's effort.** The 2026-10-26 child ran `claude-opus-5-5` at effort `low` in its parent's folder (no worktree): the coordinator must set model and effort itself, in `start_session` or by `set_session_effort`.
- **Sidebar nesting is the app's.** The 2026-10-26 child carries `parentSessionId` and `startedBy` and was listed under its parent; the human expects session workers nested under the coordinator's title in the sidebar (2026-10-28). Only `start_session` produces that.
- **Not tried:** whether the mod's own `$.tool.call` of `get_session` / `list_events` passes auto mode (`ARCHITECTURE.md` expects a plugin's call to get no verdict, as its spawn does).

## Spike findings (2026-11-02): the `spawn_task` route

- **Still not offered here.** Session `Agent-watch mod sync with Compass` (desktop, Remote Control on, `isRemote: true`, auto mode, Opus 5.5 high) has no `start_session`.
- **`spawn_task` nests a child.** The app's `spawn_task` raised a chip; once the human clicked it, the child (`Test session for the sidebar screenshot`) was listed under its parent in the sidebar. `get_session` on it: `parentSessionId` = the parent, `detached: false`, its own worktree and branch (`claude/<name>`), no `startedBy` and no `name`, so `list_sessions` with `linked: true` does not list it.
- **It inherits neither model nor effort.** The child ran `claude-haiku-5-5` at `high` under an Opus 5.5 parent. `set_session_model` and `set_session_effort` exist here, but go silent only for a session this one started with `start_session`, so on this route they may prompt.
- **Each child needs the human's click.** `spawn_task` returns a `task_id`, not a session id; the click arrives as a notice, so a coordinator finds the child by `parentSessionId` and title. A worker never starts unattended on this route.
- **Its subagents stay its own.** A child is a full session in its own process: its mods and subagents run there, and this session's agent-watch cannot see them. The parent's panel could show the child as a node only.
- **The human's choice, 2026-11-02:** wait for `start_session`; this route is not built.

## Scope

- In: `dispatch` `runAs: "subagent" | "session"`; a session task goes straight to a hand-off line naming the `start_session` call (prompt = the contract, model, effort, own worktree); adoption from the coordinator's `start_session` through `tool.call`; `collect` reading state and report through `get_session`/`list_events`, or printing those calls for the coordinator; the write fence and one-writer rule not applied to sessions (own process, own worktree, landing by rebase, `ADR-0023`); an ADR; tests; docs; 0.5.0.
- Out: starting a session from the mod itself (no engine call); messaging a running session.

## Likely files

- `mods/task-orchestrator/hooks/{ledger.ts,register.tsx,contract.ts}`, their tests, `README.md`, `ARCHITECTURE.md`, `.claude-plugin/plugin.json`; a new ADR in `.ai/decisions/`

## Execution plan

1. Spike, in a session that offers `start_session`: record its input schema and result; confirm the mod's `tool.call` hook sees the call and the `session_id`; try `$.tool.call` of `get_session` and `list_events` from the mod under auto mode. Stop condition: if the hook does not see the call, record it and fall back to a protocol-only change (start sessions directly, untracked).
2. ADR: session workers by hand-off and adoption.
3. `ledger.ts`: `runAs`, `sessionId`; `startBlocker` without the writer fence for sessions. `register.tsx`: dispatch, hand-off, adoption, collect. `contract.ts`: the protocol picks `session` when asked.
4. Tests, each red-proved; README, ARCHITECTURE; 0.5.0; gates; a live run of the human's prompt on two small tasks.

## Acceptance criteria

- [ ] A `runAs: session` dispatch answers with the `start_session` call to make, never spawning a subagent.
- [ ] The coordinator's `start_session` for that task id moves its row to running with the session id; model and effort are those requested.
- [ ] Two session tasks that write run side by side; the cap and dependencies still hold.
- [ ] `collect` returns a session task's report, or the calls that fetch it.
- [ ] Each session worker appears in the desktop sidebar nested under the coordinator's session (the app nests a session `start_session` started; a subagent never appears there, and a mod cannot add a sidebar row).
- [ ] Live: the human's prompt starts sessions on Sonnet 5.5 at the chosen efforts, shown by `get_session` and `/orchestrate status`.

## Mandatory validations

- [ ] tests/test-mods.sh --mod task-orchestrator
- [ ] tests/validate.sh
- [ ] the new tests red-proved against 0.4.0's source

## Risks and rollback

- `start_session` may be absent from the sessions the person orchestrates from (Remote Control, as here); then session workers need a session that has it.
- Rollback: git revert the task commit.

## Outputs / handover

(filled at close)

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · spike step 1 started; `start_session` not offered in this session; the findings above recorded from the session list and `TASK-0181`; paused
- 2026-11-02 · Claude Code (Opus 5.5) · `start_session` still not offered; one `spawn_task` child started by the human and read with `get_session`; the `spawn_task` findings recorded; the human chose to wait for `start_session`; still blocked
