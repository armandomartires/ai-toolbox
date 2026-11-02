# 0049 — A background task is a member of the session whose loop started it

**Status**: accepted
**Date**: 2026-11-02
**Sprint / task**: `Post-S10`, `TASK-0208`

## Context

The Sessions panel (`ADR-0046`, `ADR-0047`, and in Compass's pane `ADR-0048`) drew agents, Workflow runs and the orchestrator's ledger, but nothing else that runs. A 30+ minute background Bash command (an unattended-run driver) never showed, and the panel said `0 RUNNING` while it ran; the human read that as agent-watch failing. The engine gives no call that lists background tasks at will. What it hands over: the Bash result's `backgroundTaskId` (and Monitor's `taskId`) on the `tool.call` that started one; TaskStop's `task_id`; a `prompt.submit` with origin `task-notification` when one ends; and `background_tasks`, the in-flight list, on `classic.Stop` and `classic.SubagentStop`. A `UserMessage` row's structured `task` is readable only while drawing, when state writes are refused.

## Decision

1. **A background shell or monitor is a member kind** of the session that owns the loop that started it (this session for the main loop, else the session its subagent belongs to), keyed `bg-<id>`, labelled `<kind> · <description>`, its sector coded `B01`, `B02`… within that session. Its state uses the one vocabulary of `ADR-0046` (running, done, failed, stopped), its caption the command and `EXIT n`.
2. **It opens from the tool's result**, which names its id, and ends by, in order of trust: its notification's `<status>` and `exit code` (a non-zero exit fails it whatever the word), TaskStop's result (stopped), its owner subagent's end when the engine said the command dies with it (stopped), and the in-flight list no longer naming it (done until a later notification says otherwise). The in-flight list also adds a `shell` or `monitor` it names that is not tracked.
3. **Subagent and workflow tasks are never members of this kind**: they are agents and runs already.
4. **Counts**: the panel's `N RUNNING` and the FAILED block count background tasks; the AGENTS block, a session's `AGENTS` progress, the band and the status line do not, since a background command is no agent. Like an agent without a task list, a background task is one step in the roll-up.

## Alternatives considered

- **Reconstruct from the Bash call's `run_in_background` alone.** Rejected: a command the person backgrounds (Ctrl+B) or the engine moves at its timeout has no such flag; the result's id covers all three.
- **Read the `UserMessage` row's `task` from a render hook.** Rejected: a draw may not write state, and a row is drawn only when shown.
- **A sub-session per background task.** Rejected: it has no members of its own; a member row says all there is.
- **Show what runs inside an unattended-run driver (its `journal.jsonl`).** Not decided: a possible follow-up, the human's call.

## Consequences

- A long background command shows as a running row, with its elapsed time, in agent-watch's pane and in Compass's.
- The notification's text format is not typed by the engine; the parse reads its `<task-id>` and `<status>` tags. Where `cc-plugin-sec-default` bypasses classic hooks (`TASK-0182`) and a notification is missed, a row can stay running until the next notification or session.
- Not yet seen live: the notification's real text, the in-flight list's real `type` words for a shell and a monitor, and a Ctrl+B or timed-out command.
