# Sprint S10 — Unattended runs: bindings, the gate server, and the pilot

**OPEN. Promoted 2026-09-23** by `TASK-0085`, in the same commit that added
**Phase 10** to `ROADMAP.md` — the control that file asks for, since nothing
mechanical enforces the pairing.

> **Its precondition is met.** This file read *"nothing here can start until S9
> has delivered the loop, the skill and the nine roles."* S9 delivered all
> three and closed on `REVIEW-0011` with all seven exit criteria met. Both ADRs
> this sprint rests on are **`Accepted`** — `ADR-0022` (`TASK-0076`) and
> **`ADR-0023`** (`TASK-0084`), the latter mattering here specifically because
> S10 will run concurrent sessions and now rests on a ratified rule for it.
>
> **Four claims this file carried have been corrected rather than inherited**,
> because a promoted sprint file is read as current and two of them would have
> sent a session to rebuild something that already ships. They are marked
> **[corrected]** in place below.

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

## Deliverables

| # | Depends on | Status | What |
|---|---|---|---|
| S10.1 | S9 | **done** (against a stub) — `TASK-0086` | **[corrected]** **Only the OpenCode driver remains.** The binding contract (`skills/unattended-ops/templates/binding.md`), the checker (`scripts/check-binding.sh`) and both fixtures **already ship** — `TASK-0062` built them and already ran the red-then-green proof: the incomplete fixture exits 1 naming eleven defects, the complete one exits 0. **Do not rebuild them.** |
| S10.2 | S9 | **done** (against a stub) — `TASK-0087` | The Claude Code Workflow binding: `arm-autopilot.js` de-domained into a template carrying no rule of its own. |
| S10.3 | S9 (`TASK-0059` **done**) | **done** — `TASK-0088`; `ADR-0024` supersedes `ADR-0010`; **not wired** until S10.5 | `mcp-servers/gates/` — first authored Python server; `smoke-mcp.sh` authored-shape support; supersede `ADR-0010`; **human authorization block**. Highest risk; independent of S10.1/S10.2. |
| S10.4 | S10.3 | planned | **[corrected]** The Bionic binding. `configs/lm-studio-bionic/README.md` **already records this client's coverage** (`TASK-0080`) — and states only the *established* fact: **zero** of the nine roles, for want of a user-authored agent directory (`ADR-0020`). So what this row owes is **establishing** that Bionic cannot orchestrate, or dropping the claim — not writing the section. |
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

**[corrected] Half of the original specific was already demonstrated in S9 and
has been replaced.** The `git add -A` half — *"that `git add -A` does not
resolve to `allow` through a broader glob"* — was observed denied by
`TASK-0055`'s F4 and re-verified after narrowing by `TASK-0083`. Asking it
again would let this checkpoint pass on work another sprint did.

**What is still open, and what this checkpoint must therefore demonstrate:**

1. That a role whose allowlist omits `git push` **cannot push** — still
   unobserved for the *driver-invoked* path, as opposed to a fixture.
2. **That the binding does not reintroduce what the role boundary denies.**
   `TASK-0083` established that `git add -- .` **cannot be closed at the glob
   layer** — an equal-length deny loses, and any longer pattern also matches
   legitimate dotfile paths. The rule lives in two role bodies as prose. **A
   binding that stages on the role's behalf would bypass even that.** Show it
   does not.

`scripts/emit-agents.py`'s own comments record the ordering failure happening
once already, when alphabetical sorting put `git push*: ask` after
`git push --force*: deny` and a force-push silently resolved to *ask*.

## Carried forward — open, and not S10's scope

Inherited from the post-S9 queue. Nothing below is scheduled here; it is
listed so closing a sprint did not quietly drop it.

### Known limitations, not decisions

1. **`git add -- .` cannot be closed at the glob layer**, and is a stated
   limitation rather than an open fix. `TASK-0083` closed the other two
   trailing-flag holes — `--amend` into `no-force-push`, `--no-verify` into
   the new `no-bypass` — and **verified all of it against the client**. The
   bulk-stage form is 12 characters and so is the allow it must beat; an
   equal-length deny **lost**, observed, and any longer pattern also matches
   legitimate dotfile paths like `.ai/tasks/x.md`. The deny was **removed
   rather than shipped non-firing**, and the rule lives in `git-ops`'s and
   `closer`'s bodies, labelled as weaker than a gate. Reopen only if OpenCode's
   matcher changes.

### Carried forward, still open

2. **`worktree-only` has no settled Claude Code emission.** `ADR-0018` clause
   7's leftover, owned by `TASK-0040`. `TASK-0056` attempted it and the run
   was **confounded** by permission denials, so it could not distinguish
   isolation from refusal. `TASK-0058` then left it open *explicitly*, which
   is the honest outcome. The single question that settles it: **does a
   `worktree`-isolated *subagent's* commit reach the real tree?** All nine S9
   roles declare the term.
3. **`B-025`** — no vocabulary term for *"may call only this MCP server"*. The
   only `ready` backlog row. Waiting on a **second** role that wants it: one
   instance is a case, two is a vocabulary.
4. **~~The wiring-section gate is `server.json`-only.~~ CLOSED 2026-09-24 by
   `TASK-0088`** — it reads both shapes now, and was observed failing on
   `gates` before its sections existed. Kept for the record: `TASK-0073`'s check
   behind *"The first two triggers are checked"* reads manifests, so an
   authored server with a required variable or a destructive tool would owe a
   section and never be asked for one. Goes false when `TASK-0067` ships the
   first authored server. Found by `TASK-0059`.
5. **`loops/release-check/` step 8 says to write a commit hash back *"and
   amend"***, which changes the hash just recorded. This repo's own recent
   history uses the follow-up-commit form instead. Found by `TASK-0061`.
6. **`ansible-core`'s version is recorded in several places and has moved.**
   `REVIEW-0010` said nine; a count on 2026-09-23 found **five**, so
   `TASK-0069`'s sweep reduced but did not close it. Re-count before acting.
7. **`skills/ansible-ops/` has never been exercised against a live estate.**
   Its closing item (`B-010`) was closed *with this limitation stated* — a
   closed item is not a claim of quality.
8. **An untested commitment, stated a third time.** *"If a sprint shrinks, the
   honest cut is a product, never the spike"* has now been stated by three
   sprints and exercised by none. S9 did not shrink either. It should be
   restated in the next plan that risks shrinking, not retired as vindicated.

**Closed before this sprint opened, and not to be re-raised:** `B-018`,
`B-021`, `B-023`, `B-024`, `B-026`, `B-027`, `B-028`.

## Task numbering: this sprint allocates no ids

**Deliberately, and for a reason observed rather than anticipated.** While
`PLAN-0006` was being drafted, a concurrent session allocated `TASK-0068` and
`TASK-0069` — both inside the range this sprint had provisionally reserved,
twice, within one afternoon. So the deliverables above are named **by
deliverable, not by id**: a sprint file that reserves ids it does not yet own
publishes a claim the next session will silently break, and *a plan carrying
stale ids is worse than one carrying none, because the ids look
authoritative*. An id is taken **when a brief is written**, which is when
`.ai/tasks/` can be read to see what is free. That is compatible with the
promotion rule — briefs must exist before **code**, not before promotion.

**Briefs written 2026-09-23:** `TASK-0086` (S10.1), `TASK-0087` (S10.2),
`TASK-0088` (S10.3). **Next free id: `TASK-0089`.**
