# Sprint S9 — Unattended runs: the decision and the portable core

> **Planned, and there is no sprint open to displace.** `SPRINT-CURRENT.md`
> reads *"No sprint is open"* as of 2026-09-23: S8 closed on `REVIEW-0009`
> with `ADR-0021` ratified as written, and nothing was promoted to replace it —
> *"a state, not an oversight"*, in that file's own words.
>
> **So promotion is available rather than contested, and it is still the
> human's.** This file does not promote itself. `PLAN-0006` is planning-only
> until someone says otherwise, and the repo has three precedents for a sprint
> file that changed state without changing content (`TASK-0052`, `TASK-0054`).
> Recorded here rather than assumed, because assuming it is how a sprint gets
> promoted by a file that only describes one.

Planned by `PLAN-0006`. Delivers `ADR-0022` and the client-agnostic half of an
unattended-run harness: a loop, a skill and nine agent roles. The three client
bindings and this repo's first authored MCP server are **S10**, deliberately.

## Why the split

The portable core is useful and reviewable on its own. The bindings are three
client-specific artifacts plus an authored MCP server that carries its own ADR
supersession (`ADR-0010`) and its own human authorization step. Bundling them
would produce one sprint whose checkpoint could not say which half worked.

## The binding constraint

**Seven of the nine roles will be OpenCode-only**, under `ADR-0018` clause 8.3.
Six of the ten capability terms have no per-agent Claude Code expression, and
they are the six that carry the safety value. The two that port —
`task-planner` and `adjudicator` — are **the two that only think**.

This is the sprint's headline fact, and `REVIEW-0011`'s pre-committed question
is whether the docs stated it plainly or described three clients as if they were
equivalent.

## Two standing defects this sprint must clear first

Neither was raised by this plan; both block it.

- **`ADR-0018` clause 8.5 is unsatisfied.** The registry's Agents section is
  `| Name | Description | Path |` and cannot say a role is OpenCode-only. Adding
  seven such roles to it would advertise them as universal — the same class of
  false self-claim as `B-021`. Raised as `B-026`, closed by `TASK-0060`, and it
  must land **before** `TASK-0064`.
- **`worktree-only` has no settled Claude Code emission** (`ADR-0018` clause 7's
  leftover, assigned to `TASK-0040`, still open). All nine roles declare it, and
  for the *acting* roles an isolated copy is the wrong confinement. `TASK-0058`
  must settle it or say explicitly that it has not.

## Tasks

| Task | Depends on | Status | What |
|---|---|---|---|
| `TASK-0055` | — | **done** | **Spike.** OpenCode driver surface: F1, F2, F4 against the installed `opencode 1.18.31`. Read-only, scratch project, per-claim markers and negative controls. **Critical path.** |
| `TASK-0056` | — | **done** | **Spike.** Claude Code delegation and boundary surface: F5 against the live `designer-manager` emission; whether any command boundary is expressible per-agent there at all. Parallel with 0055. |
| `TASK-0057` | 0055, 0056 | **done** | Author `ADR-0022` from that evidence; leave `Proposed`. Six corrections made visibly; clause 5 added because **F1 was falsified**. |
| *gate* | 0057 | **CLEARED 2026-09-23** | **Human ratification of `ADR-0022`.** A gate, not a task — recorded by `TASK-0076`. The sprint is still **not promoted**; ratification unblocked the rows below without scheduling them. |
| `TASK-0058` | gate | planned | Authoring guide: settle `worktree-only` for Claude Code; the `delegates_to` cross-client rule; the authored-MCP section verified against reality (`ADR-0010` obligation 2); the `mode` row if F1 forces it. |
| `TASK-0059` | 0058 | planned | `validate.sh`: the `delegates_to` cross-client check **with a fixture proving it fails before it passes**; extend the destructive-capability and `.env.example` gates to the authored shape (`B-024`). |
| `TASK-0060` | gate | planned | `sync-registry.sh`: Agents section gains a Clients column. Closes `B-026` / `ADR-0018` clause 8.5. |
| `TASK-0061` | gate | planned | `loops/unattended-run/loop.md`. Authored **before** the roles. |
| `TASK-0062` | 0061 | planned | `skills/unattended-ops/` — `SKILL.md` plus seven references. |
| `TASK-0063` | 0059, 0061 | planned | The four **thinking** roles: `preflight`, `task-planner`, `refuter`, `adjudicator`. |
| `TASK-0064` | 0060, 0063 | planned | The five **acting** roles: `implementer`, `gate-runner`, `closer`, `park-steward`, `run-scribe`. |
| `REVIEW-0011` | all | planned | Checkpoint. |

`TASK-0060` is independent of `TASK-0059` and can run in parallel with the
0058→0059 chain. `TASK-0061` and `TASK-0062` likewise sit on their own front
once the gate clears, which suits `ADR-0012` Decision 2 — one task per session
is the default, not a rule.

## Backlog items raised by this sprint

| ID | Title | Priority |
|---|---|---|
| `B-024` | The authored MCP shape has no destructive-capability gate and no `.env.example` gate | high |
| `B-025` | No vocabulary term for "may call only this MCP server" | medium |
| `B-026` | `ADR-0018` clause 8.5 unsatisfied — the registry shows no client coverage | medium |

`B-021` is **not** closed by this sprint and must not be recorded as such.

## Pre-committed checkpoint question

> **Did the documentation state the OpenCode-first asymmetry plainly, or did it
> describe three clients as if they were equivalent?**

Committed before the work, per `ADR-0012`, so the checkpoint cannot be written
to whatever the sprint happened to produce. The failure mode it targets is the
one `ADR-0020` recorded costing four tasks and two reviews: a capability claim
about a third-party client that nobody checked.
