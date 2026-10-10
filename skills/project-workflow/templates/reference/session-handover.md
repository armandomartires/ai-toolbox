# Reference: session boundaries and handover

Read this when you start a session, end one, or hand off.

## The invariant

**Every task can be started cold, in a new session, from its brief plus `20.PLAN.md` and `30.ROADMAP.md`.** If you need an earlier transcript, the brief's `Inputs` is incomplete: fix the file, not the session.

## Starting

1. Read `AGENTS.md` or its equivalent, then this convention's entry point.
2. Read `20.PLAN.md` for what is in flight.
3. Read the brief, `Inputs` first, and **verify each expected state** rather than assuming it.

Do not read `tasks/` wholesale; `Inputs` names the records that matter.

## Ending

1. Update the brief's `Outputs / handover` and Status, and `20.PLAN.md` if what is in flight changed.
2. Commit, push, and confirm the push (`reference/git-workflow.md`).
3. If the task is unfinished, name the next concrete step under `Next:`.

## Session size

One task per session is the default, not a rule. As a rough guide:
- Sync the durable files at about 60–70% of the context window.
- Hand off before about 80%.
- Start fresh when switching tasks.

Delegate bulk reading to subagents. Verify what they report: a subagent never gates a commit.
