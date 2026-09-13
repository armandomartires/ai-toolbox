# Reference: session boundaries and handover

Linked from `00.CONVENTIONS.md` — read this when starting a session,
ending one, or deciding whether to hand off to a fresh one.

## The invariant

**Every task must be startable cold, in a brand-new session, from its own
task file plus `20.PLAN.md` and `30.ROADMAP.md`** — with no dependency on
a prior conversation.

Checkable by inspection: open the task file in a fresh session and see
whether you know where to begin. If you need the previous session's
transcript, the task's `Inputs` section is incomplete — fix the file, not
the next session. Everything below is *how* to hold this invariant; only
the invariant is mandatory.

## Starting a session (read order)

1. The project's normative rules — `AGENTS.md` or equivalent.
2. This convention's entry point.
3. `20.PLAN.md` — the orchestrator: what is in flight, in what order,
   with what dependencies.
4. The task file you are picking up, **`Inputs` first** — it names every
   artifact consumed and the state each should be in.
5. **Verify that declared state rather than assuming it.** If `Inputs`
   claims a size cap holds or a version was bumped, check. A stale
   `Inputs` table is the one failure this convention cannot catch for you.

Do not read `tasks/` wholesale to "get context" — those are point-in-time
records, and `Inputs` names the few that are load-bearing.

## Ending a session

1. Update the durable files: the task's `Outputs / handover` and Status,
   plus `20.PLAN.md` if what is in flight changed.
2. Commit, and confirm the push landed — `reference/git-workflow.md`.
3. If the task is **unfinished**, name the next concrete step in
   `Outputs / handover`. "In progress" with no next step is no handover.

A session ending without step 1 loses work that exists nowhere but in a
context window about to be discarded.

## One task per session — default, not rule

One task per session is the **default**: it keeps context small and makes
the invariant trivially true. It is not mandatory — a session may close
several tasks provided each file independently satisfies the invariant.

Rotate proactively, not reactively. Advisory heuristics:

- Sync durable files at roughly **60–70%** of the context window, while
  the sync is still cheap.
- Hand off before roughly **80%**, at a task boundary where possible.
- Start fresh when **switching tasks**, and when the agent begins fumbling
  what it handled correctly earlier — the second is the better signal.

These percentages track today's context windows, not this convention.
Revise them as needed; never encode them in a check.

## Subagents

Delegating research or bulk mechanical work to a subagent is sanctioned,
and is the right tool for "read thirty files, report which three matter" —
that volume never enters the main context. Two limits: the main agent
verifies results rather than trusting them, and a subagent never gates a
commit. Its report is evidence, not validation.
