# TASK-0201 — task-orchestrator 0.5.0: session workers

## Status

- Status: in progress
- Owner: agent (Claude Code)
- Created: 2026-10-28
- Updated: 2026-11-03
- Applies to: `mods/task-orchestrator/` (0.4.0 → 0.5.0)
- Source: the human's review request of 2026-10-28 ("…assigning the tasks to sub sessions running sonnet 5.5 in medium or high effort…"); their answer that "sub sessions" means real Code-tab sessions; the approved plan; "Yes, spike next"
- Unblocked: 2026-11-03, step 1 run in a session that offers `start_session`

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

## Spike findings (2026-11-03): `start_session`, step 1

- **Offered here.** Session `Clone AI toolbox repository` (desktop, Remote Control on, `isRemote: false`, acceptEdits then bypass permissions, Opus 5.5 high) has `start_session`. Remote Control is not what withheld it; the two sessions without it had `isRemote: true` and auto mode.
- **Its input.** `initiation` (`user_asked` starts at once and returns the id), `title`, `name`, `context` (`fresh` needs `background` of 80+ characters), `prompt`, `model` (same family or cheaper than the caller's), `effort` (at or below the caller's), `use_worktree`, `branch_name`, `source_branch`, `permission_mode` (the caller's or lower), `wake_when_done`, `cwd`/`target`/`host`/`preset`.
- **Refused on a turn the person did not start.** On a turn begun by an automated notice (here, the mods-loaded notice) the app answered `isError` with "Start sessions only on the user's own words to you here…; propose the session instead (initiation "own_initiative")". So a coordinator cannot start the next queued session worker from a worker-ended note or a `<side-sessions-event>` turn; only a proposal card. A run whose later tasks start only after earlier ones end needs the person's message to start them, or all its sessions started in the person's turn.
- **A mod's `tool.call` hook sees the call and its result.** A throwaway probe mod (`session-probe`, in this session's dev-mods folder, not in the repo) recorded the full input, `tool_use_id`, and the result, refused or not. The started result is text only, `{ result: [{ type: 'text', text }], text }`: the `session_id` (`local_<uuid>`) and `name` are in the sentence, with no structured field, so adoption parses it.
- **Model and effort are those requested.** `get_session` on the child: `claude-sonnet-5-5`, `medium`, `parentSessionId` = the coordinator, `detached: false`, `cwd` the shared checkout (`use_worktree: false`), `permissionMode` the coordinator's (`bypassPermissions`).
- **The mod's own `$.tool.call` of `get_session` and `list_events` works**, unprompted under bypass permissions, and returns the same text as the model's call. Under auto mode, still untried. `list_events` marks the transcript as untrusted quoted data.
- **The worker knows its model, not its effort.** The child reported `claude-sonnet-5-5` and could not tell its effort, so the coordinator (or the mod, by `get_session`) is the one to confirm effort; the child changed nothing and its turn-end note reached the parent.
- **The app gives the child a shared notes folder** per parent (`…\side-session-notes\<parent id>`), named in the child's first message.

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

- [x] A `runAs: session` dispatch answers with the `start_session` call to make, never spawning a subagent.
- [ ] The coordinator's `start_session` for that task id moves its row to running with the session id; model and effort are those requested.
- [ ] Two session tasks that write run side by side; the cap and dependencies still hold.
- [x] `collect` returns a session task's report, or the calls that fetch it.
- [ ] Each session worker appears in the desktop sidebar nested under the coordinator's session (the app nests a session `start_session` started; a subagent never appears there, and a mod cannot add a sidebar row).
- [ ] Live: the human's prompt starts sessions on Sonnet 5.5 at the chosen efforts, shown by `get_session` and `/orchestrate status`.

## Mandatory validations

- [x] tests/test-mods.sh --mod task-orchestrator
- [ ] tests/validate.sh
- [x] the new tests red-proved against 0.4.0's source

## Risks and rollback

- `start_session` may be absent from the sessions the person orchestrates from (Remote Control, as here); then session workers need a session that has it.
- Rollback: git revert the task commit.

## Outputs / handover

(filled at close)

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · spike step 1 started; `start_session` not offered in this session; the findings above recorded from the session list and `TASK-0181`; paused
- 2026-11-02 · Claude Code (Opus 5.5) · `start_session` still not offered; one `spawn_task` child started by the human and read with `get_session`; the `spawn_task` findings recorded; the human chose to wait for `start_session`; still blocked
- 2026-11-03 · Claude Code (Opus 5.5) · `start_session` offered in this session; spike step 1 run with a throwaway probe mod and one Sonnet 5.5 child; findings above; the hook sees the call, so the stop condition does not apply
- 2026-11-03 · Claude Code (Opus 5.5) · unblocked by the human; step 2: `ADR-0050` drafted as proposed, clause 4 (starts only on the person's turn) left to the human
- 2026-11-03 · Claude Code (Opus 5.5) · steps 3 and 4 by orchestrated workers: T1 implemented, T2 docs; R1 not ready (two high: the person's-turn gate leaked, a session ending in `collect` did not tick); T3 fixed them; T4 replaced the dispatch-time effort note with an observed `effort mismatch` note (the human's "warn on mismatch"); R3 found a queued session holding a slot and a false mismatch on Agent-spawned workers; T5 fixed both; R4 ready; `tests/test-mods.sh --mod task-orchestrator` 56 pass, `check-mods.py` OK, run by the coordinator, each new test red-proved by its builder; open: the live run with two session workers, `tests/validate.sh` in WSL, and clause 4
