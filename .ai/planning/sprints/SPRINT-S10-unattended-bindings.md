# Sprint S10 — Unattended runs: bindings, the gate server, and the pilot

> **Planned, not current, and downstream of S9.** Nothing here can start until
> S9 has delivered the loop, the skill and the nine roles — a binding with
> nothing to bind is a client-specific reimplementation, which is exactly what
> `ADR-0022` clause 1.4 forbids.

Planned by `PLAN-0006`. Delivers the three client bindings, this repo's **first
authored (Python) MCP server**, the wiring snapshots, and one live pilot run.

## What makes this sprint different from S9

S9 is documentation and declaration. S10 executes: it ships runnable code, it
registers a server that can launch a seventy-minute build, and it ends with a
real unattended run against a real repository.

Three things therefore carry unusual weight:

1. **A human authorization step is mandatory and cannot be improvised.** The
   gate server's `capabilities.destructive` is `true` — via its command map it
   rebuilds workbooks, rewrites workbook VBA and queries, and force-terminates
   Excel processes it started. `AGENTS.md` requires explicit human authorization
   in the task file, and the authoring guide requires an `authorization` block
   whose `task` is a path validation asserts exists.
2. **`ADR-0010` is superseded here, on its own terms**, and inherits its three
   named obligations: `smoke-mcp.sh` authored-shape support, the authoring
   guide's authored section verified against reality, and a superseding ADR.
3. **The pilot is the point.** S7's pilot (`TASK-0046`) found twelve false
   self-claims in one new skill and produced `B-021`. Budget for the same, and
   treat a pilot that finds nothing as a reason to doubt the pilot.

## A note on the numbering: this sprint allocates no task ids

**Deliberately, and for a reason observed rather than anticipated.** While
`PLAN-0006` was being drafted, a concurrent session in this repository allocated
`TASK-0068` (closing S8) and `TASK-0069` — both inside the range this sprint had
provisionally reserved, twice, within the same afternoon.

So the rows below are named by **deliverable, not by id**. An id is allocated
when its brief is written, which is also when `.ai/tasks/` can be read to see
what is actually free. A sprint file that reserves ids it does not yet own
publishes a claim that the next session will silently break — and a plan
carrying stale ids is worse than one carrying none, because the ids look
authoritative.

S9 holds `TASK-0055`…`0064`, which **are** written and therefore real.

## Deliverables

| # | Depends on | Status | What |
|---|---|---|---|
| S10.1 | S9 | planned | The binding contract (`templates/binding.md`), the OpenCode driver, and `scripts/check-binding.sh` with fixtures — incomplete binding fails, complete passes. |
| S10.2 | S9 | planned | The Claude Code Workflow binding: `arm-autopilot.js` de-domained into a template carrying no rule of its own. |
| S10.3 | S9, `TASK-0059` | planned | `mcp-servers/gates/` — first authored Python server; `smoke-mcp.sh` authored-shape support; supersede `ADR-0010`; **human authorization block**. Highest risk; independent of S10.1/S10.2. |
| S10.4 | S10.3 | planned | The Bionic binding and `configs/lm-studio-bionic/README.md`. Records plainly that Bionic cannot orchestrate. |
| S10.5 | S10.1, S10.2, S10.3 | planned | `configs/claude-code/` and `configs/opencode/`; run `install.sh` for both clients and record the emission output **verbatim** (F6). |
| S10.6 | S10.5 | planned | Regenerate `docs/registry.md`; update `.ai/context/CURRENT_STATE.md`. |
| S10.7 | S10.5, S10.1 | planned | **Pilot.** One real unattended run of at most two tasks: dry-run first, then live, watched. |
| review | all | planned | Sprint checkpoint. |

## Two design decisions carried in from `PLAN-0006`, to be honoured not re-derived

- **Rule 2 becomes structural in the OpenCode binding.** The driver invokes the
  gate from its own map and hands the agent only the evidence to read, so **no
  agent in the run ever sees a verification command string**. This is a
  correction to the original harness, not a concession to it.
- **A null refuter fails closed.** `arm-autopilot.js` lets a refuter returning
  nothing flow into the adjudicator as an absence of objections. Every binding
  must synthesise `refuted: true` on a null return. A silent refuter is not a
  clean bill of health.

## Pre-committed checkpoint question

> **Did the OpenCode port actually enforce what the Claude one only asks for —
> demonstrated against an emitted file and a real run, not asserted?**

The specific thing to demonstrate: that a role whose allowlist omits `git push`
cannot push, and that `git add -A` does not resolve to `allow` through a broader
glob. `scripts/emit-agents.py`'s own comments record that second failure
happening once already, when alphabetical sorting put `git push*: ask` after
`git push --force*: deny` and a force-push silently resolved to *ask*.
