# Sprint S9 — Unattended runs: the decision and the portable core

**CLOSED 2026-09-23 on `REVIEW-0011`** (`TASK-0081`). Promoted the same day by
`TASK-0077`, in the same commit that added **Phase 9** to `ROADMAP.md`.

> **All seven exit criteria met.** Criterion 7 — the asymmetry stated in the
> skill *and* all three wiring snapshots — was **not** met when `REVIEW-0011`
> was written, and `TASK-0080` closed it **before** this closure rather than
> closing the sprint over its own unmet criterion.
>
> **No ratification packet**, unlike S6 and S8: `ADR-0022` was ratified by
> `TASK-0076` *before* the sprint opened, because its two blocking spikes had
> to produce evidence first. **F1 was falsified**, so what was signed is more
> cautious than the draft.
>
> **Delivered:** `loops/unattended-run/` (14 steps, nine roles, three unmerged
> retry bounds, a null refuter that fails closed); `skills/unattended-ops/`
> (seven references, a binding template, a completeness checker proved
> red-then-green); nine agent roles, seven OpenCode-only and two portable;
> `no-bash`, a twelfth capability term; and three closed backlog items
> (`B-021` adjacent, `B-024`, `B-026`).
>
> **The sprint's defining finding:** the false-boundary defect class appeared
> **four times** — `qa-test`, `designer-manager`, `read-only` not stopping a
> shell, and `git-ops`'s `no-force-push` covering push only. Three of the four
> were caught by *resolving what a declaration actually produces* rather than
> reading the declaration.
>
> **What is NOT closed and moved to `SPRINT-CURRENT.md`:** the three
> trailing-flag holes affecting `git-ops` and `closer`; `ADR-0023`'s
> ratification; `worktree-only`'s Claude Code emission; `B-025`; the
> `server.json`-only wiring-section gate; and `loops/release-check/` step 8.
>
> **Everything below is the sprint as it stood while open.**

Planned by `PLAN-0006`. Delivers `ADR-0022` and the client-agnostic half of an
unattended-run harness: a loop, a skill and nine agent roles. The three client
bindings and this repo's first authored MCP server are **S10**, deliberately.

> **This file was `sprints/SPRINT-S9-unattended-runs.md` until promotion.**
> That copy is deleted rather than kept in sync — one owner per fact. It comes
> back to `sprints/` at closure, which is how S6 and S8 moved.
>
> **Five claims it carried have been corrected here rather than inherited**,
> because a promoted sprint file is read as current: it said no sprint could
> displace it and that it *"does not promote itself"* (spent); *"six of the
> ten capability terms"* (now **seven of eleven** — `TASK-0071` added
> `test-allowlist`); that `TASK-0059` owes the `delegates_to` cross-client
> check (**already built** by `TASK-0075`); that `B-021` is not closed by this
> sprint (**true, but because `TASK-0071` closed it** outside the sprint); and
> that `worktree-only` is simply open (it is, **and `TASK-0056` has now tried
> and been confounded**, which is different from untouched).

## Why the split

The portable core is useful and reviewable on its own. The bindings are three
client-specific artifacts plus an authored MCP server that carries its own ADR
supersession (`ADR-0010`) and its own human authorization step. Bundling them
would produce one sprint whose checkpoint could not say which half worked.

## The binding constraint

**Seven of the nine roles will be OpenCode-only**, under `ADR-0018` clause
8.3. **Seven of the eleven** capability terms have no per-agent Claude Code
expression, and they are the seven that carry the safety value. The two that
port — `task-planner` and `adjudicator` — are **the two that only think**.

This is the sprint's headline fact, and `REVIEW-0011`'s pre-committed question
is whether the docs stated it plainly or described three clients as if they
were equivalent.

## What the spikes changed before the sprint opened

Both ran 2026-09-23, ahead of promotion, because they change no component file
and the ADR could not be signed without them.

- **F1 was falsified.** `opencode run --agent` **cannot** select a
  `subagent`-mode role: it warns on stderr and **falls back to the default
  agent**, returning well-formed stdout with exit 0. A driver reading stdout
  or the JSON stream cannot tell the wrong agent answered. So every
  driver-invoked role must be `primary`, and **`mode: all` turns out to be a
  real third value** OpenCode accepts and `MODES` rejects — `ADR-0022` clause
  5.2 makes `TASK-0058` decide that **explicitly**.
- **F5 was confirmed**, and it was a live defect: a dead name inside a Claude
  Code `Agent(...)` allowlist is **silent**. Fixed and gated by `TASK-0075`
  (`B-028`), which is why `TASK-0059` now owes less than its brief says.
- **Two things that will bite a binding author**, both found by failure:
  `opencode run` with no configured default model and no TTY **hangs forever
  with no output, no error and no exit**; and an `ask` permission headless
  **auto-denies while reporting *"The user rejected permission"*** with no
  user present. Unattended, every `ask` is a `deny` carrying a false
  attribution.

## Two standing defects this sprint must clear

Neither was raised by this plan; both block it.

- **`ADR-0018` clause 8.5 is unsatisfied.** The registry's Agents section is
  `| Name | Description | Path |` and cannot say a role is OpenCode-only.
  Raised as `B-026`, closed by `TASK-0060`, and it must land **before**
  `TASK-0064`. **`TASK-0075` made this worse, not better** — four of six
  existing roles are now OpenCode-only while the registry presents all six
  identically.
- **`worktree-only` has no settled Claude Code emission** (`ADR-0018` clause
  7's leftover, assigned to `TASK-0040`, still open). All nine roles declare
  it, and for the *acting* roles an isolated copy is the wrong confinement.
  **`TASK-0056` attempted it and the run was confounded** by permission
  denials, so it could not distinguish isolation from refusal. `TASK-0058`
  must settle it or say explicitly that it has not.

## Tasks

| Task | Depends on | Status | What |
|---|---|---|---|
| `TASK-0055` | — | **done** | **Spike.** OpenCode driver surface: F1, F2, F4 against `opencode 1.18.31`. **F1 falsified.** |
| `TASK-0056` | — | **done** | **Spike.** Claude Code delegation and boundary surface. **F5 confirmed**; raised `B-028`; `isolation: worktree` left unsettled. |
| `TASK-0057` | 0055, 0056 | **done** | Author `ADR-0022` from that evidence. Six corrections made visibly; **clause 5 added because F1 was falsified**. |
| *gate* | 0057 | **CLEARED 2026-09-23** | **Human ratification of `ADR-0022`.** A gate, not a task — `TASK-0076`. Ratified **as written**. |
| `TASK-0058` | gate | **done** | Authoring guide: settle `worktree-only` for Claude Code; the `delegates_to` cross-client rule; the authored-MCP section verified against reality (`ADR-0010` obligation 2); **the `mode` row, which F1 now forces**. |
| `TASK-0059` | 0058 | **ready (reduced)** | `validate.sh`: extend the destructive-capability and `.env.example` gates to the **authored** shape (`B-024`). **Its `delegates_to` check already exists** — built by `TASK-0075`, observed firing on the real defect. What remains is re-reading it against whatever `TASK-0058` settles about `mode`. |
| `TASK-0060` | gate | **done** | `sync-registry.sh`: Agents section gains a Clients column. Closes `B-026` / `ADR-0018` clause 8.5. **Must land before `TASK-0064`.** |
| `TASK-0061` | gate | **done** | `loops/unattended-run/loop.md`. Authored **before** the roles. |
| `TASK-0062` | 0061 | planned | `skills/unattended-ops/` — `SKILL.md` plus seven references. |
| `TASK-0063` | 0059, 0061 | planned | The four **thinking** roles: `preflight`, `task-planner`, `refuter`, `adjudicator`. |
| `TASK-0064` | 0060, 0063 | planned | The five **acting** roles: `implementer`, `gate-runner`, `closer`, `park-steward`, `run-scribe`. |
| `REVIEW-0011` | all | **done** | Checkpoint. **Six of seven exit criteria met; criterion 7 is NOT** — the asymmetry is stated in the skill and in none of the three wiring snapshots. Recommends fixing it before closure. |

## Three tasks ran in parallel, 2026-09-23 — and what they decided

`TASK-0058`, `TASK-0060` and `TASK-0061` ran **concurrently, one worktree
each** (`ADR-0023`), and landed serially by rebase so `master` stayed linear
with one task per commit. Three decisions came out of them that the rest of
the sprint depends on:

- **`mode: all` is REJECTED** (`TASK-0058`, discharging `ADR-0022` clause
  5.2's requirement to decide *explicitly*). `mode` here is a portability
  declaration, not a passthrough, and it is load-bearing for a safety rule:
  `delegation-allowlist` is valid only with `primary`, because Claude Code
  ignores an `Agent(...)` allowlist inside a subagent definition. **`all`
  means both**, so such a role's boundary would be enforced or silently
  widened *depending on how it was invoked* — unknowable from the file.
  `MODES` is unchanged; **`TASK-0059` owes only a message that reads as a
  deliberate refusal** rather than an unrecognised string.
- **`worktree-only` for Claude Code is still NOT settled**, explicitly and
  with the reason written into the guide. Deciding *emit* would ratify
  current emitter behaviour on confounded evidence; deciding *refuse* would
  break `critic` and `ideator` on the same confounded evidence. The single
  question that settles it: **does a `worktree`-isolated subagent's commit
  reach the real tree?** Owner stays `TASK-0040`.
- **The registry now shows client coverage** (`TASK-0060`, closing `B-026`
  and `ADR-0018` clause 8.5): `| Name | Clients | Description | Path |`,
  four of six roles visibly `opencode`-only. **It also corrected the
  justification `B-026` itself gave** — "`validate.sh` constrains `clients`
  to a closed set" does *not* separate it from `mode`, since `MODES` is
  closed-set checked too. The real separator is the emitter: `clients` is the
  **gate** (a role omitting a client gets **no file written**), while `mode`
  is merely carried through. So the `mode` decision reads as upheld-with-a-
  test, not reversed.

**Two defects found in passing, both recorded rather than fixed in scope:**
`loops/release-check/` step 8 instructs an author to write a commit hash back
*"and amend"*, which changes the hash just recorded; and `install.sh`'s
printed authored-MCP launch command has **two** form discrepancies, not one
(both assigned to `TASK-0067`).

**One correction applied at landing:** the loop named its ninth role
`scribe` while `PLAN-0006`, this file and `TASK-0064`'s brief all say
**`run-scribe`**. Renamed in the loop, since the planned name is what the
unwritten task will follow. The *consolidation* it represents — journal and
handover are two acts given to one role, keeping the count at nine — stands,
and `TASK-0063`/`TASK-0064` should look at it.

**Three front doors are open at once.** `TASK-0058` and `TASK-0060` both
depend only on the cleared gate and are independent of each other;
`TASK-0061` sits on a third. That suits `ADR-0012` Decision 2 — one task per
session is the default, not a rule — and `ADR-0023` if two sessions run, which
requires **one worktree each** (`scripts/worktree.sh`).

## Backlog items raised by this sprint

| ID | Title | Status |
|---|---|---|
| `B-024` | The authored MCP shape has no destructive-capability gate and no `.env.example` gate | **ready** — `TASK-0059` |
| `B-025` | No vocabulary term for "may call only this MCP server" | **ready** — waiting on a *second* role that wants it; one instance is a case, two is a vocabulary |
| `B-026` | `ADR-0018` clause 8.5 unsatisfied — the registry shows no client coverage | **ready** — `TASK-0060` |

**`B-021` is not closed by this sprint**, and the reason has changed: it was
**closed 2026-09-23 by `TASK-0071`**, outside the sprint, by adding the
`test-allowlist` term. Do not record it as an S9 deliverable.

## Pre-committed checkpoint question

> **Did the documentation state the OpenCode-first asymmetry plainly, or did
> it describe three clients as if they were equivalent?**

Committed before the work, per `ADR-0012`, so the checkpoint cannot be written
to whatever the sprint happened to produce. The failure mode it targets is the
one `ADR-0020` recorded costing four tasks and two reviews: a capability claim
about a third-party client that nobody checked.

## Carried forward — open, and not S9's scope

These outlived the no-sprint period and are **not** scheduled here. Listed so
they are not lost, and so nobody re-opens a closed one.

1. **Should a capability claim cite the artifact it was read from?**
   `ADR-0021` clause 5 requires a provenance label but not a source file, and
   that gap let a hook count read from one client's manifest propagate as a
   fact about another. **Offered at ratification and declined**, so reopening
   it means amending an `Accepted` ADR.
2. **An untested commitment, carried forward deliberately.** *"If a sprint
   shrinks, the honest cut is a product, never the spike"* has been stated by
   two sprints and exercised by neither. **S9 risks shrinking** — it is nine
   roles, a loop and a skill — so it is restated here rather than quietly
   retired as vindicated.
3. **`ansible-core`'s version is recorded in several places and has moved.**
   `REVIEW-0010` said nine; a count on 2026-09-23 found **five**, so
   `TASK-0069`'s sweep reduced but did not close it. Re-count before acting.
4. **`skills/ansible-ops/` has never been exercised against a live estate.**
   Its closing item (`B-010`) was closed *with this limitation stated* — a
   closed item is not a claim of quality.

**Closed since the no-sprint queue was written, and not to be re-raised:**
`B-018` (`TASK-0072`), `B-021` (`TASK-0071`), `B-023` (`TASK-0073`), `B-027`
(`TASK-0074`), `B-028` (`TASK-0075`), and `REVIEW-0009`'s two stale gate-cost
claims (`TASK-0069`).

## S10 is still queued

`sprints/SPRINT-S10-unattended-bindings.md` — the three client bindings and
`mcp-servers/gates/`. It **allocates no task ids**, deliberately, after two
sessions collided inside a reserved range in one afternoon. Its ids are
allocated when its briefs are written, which is when `.ai/tasks/` can be read
to see what is free. **Next free number after this task: `TASK-0078`.**
