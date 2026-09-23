# No sprint is open

**As of 2026-09-23.** Sprint S8 closed on `REVIEW-0009` and is archived at
`.ai/planning/sprints/SPRINT-S8-third-party-extensions.md`. Nothing has been
promoted to replace it, and **that is a state, not an oversight**.

**S9 and S10 exist as plans, and neither is current.** `PLAN-0006` —
unattended task runs — was written alongside S8's closure and produced
`.ai/planning/sprints/SPRINT-S9-unattended-runs.md` (the portable core: a
loop, a skill, nine roles) and
`.ai/planning/sprints/SPRINT-S10-unattended-bindings.md` (the three client
bindings). **Both are queued, not open**, which in this repo means a file in
`sprints/` rather than here.

**S9's blocking gate is now cleared, and it is still not open.** It rested on
`ADR-0022`, which was `Proposed` and blocked on two spikes whose evidence
decided whether this repo's agent schema needed changing at all. Both spikes
ran on 2026-09-23 and **`ADR-0022` was ratified the same day** (`TASK-0076`).

**The evidence changed the decision before it was signed.** `TASK-0055`
**falsified F1** — `opencode run --agent` cannot select a `subagent`-mode role
and silently falls back to the default agent — so the ADR gained a fifth
clause and this repo owes a `mode`-schema decision. Ratifying ahead of that
would indeed have been ratifying a guess.

**Promotion remains a separate decision, and is what is still missing.**

**So promoting S9 is a human decision, not bookkeeping** — the same call
`TASK-0052` made for S6-versus-S8. `ROADMAP.md` also has no Phase 9 section
yet; adding one belongs to whoever promotes the sprint, in the same change,
because this file has twice had a phase go missing after the fact.

**This file exists to say so explicitly.** Leaving a closed sprint sitting
in `SPRINT-CURRENT.md` is the false-present-tense defect `REVIEW-0008` had
to sweep across four files, and it is cheaper to state the gap than to let
the next reader infer it.

> **Note for whoever reads S9's file next.** Its header was written while S8
> was still open and states that *"`ADR-0021` is still `Proposed` and
> `REVIEW-0009` is unwritten"*. **Both are now false** — the review is
> written and `ADR-0021` was ratified 2026-09-23. The S9 file is a plan in
> progress, so it is left for its author to correct rather than edited from
> here.

## What is outstanding, for whoever plans next

Nothing below is scheduled. It is the honest queue.

### Backlog items that are `ready`

Full entries in `.ai/planning/BACKLOG.md`.

| Item | One line |
|---|---|
| **B-018** | Deploy skills to Bionic — its Agent Skills target exists, is unused, and global installs are approval-gated |
| **B-021** | `qa-test` cannot run tests while its own description says it does. **Highest-value open item**; needs a decision about a test-command allowlist term, not a widened one |
| **B-023** | graphify has a manifest and a registry row but no `configs/` wiring section. Blocked on a rule that does not exist yet: does *every* MCP server owe three client sections? |

### Follow-ups from `REVIEW-0009`

1. **Two stale second-hand gate claims.** `tests/smoke-mcp.sh:10` says
   `validate.sh` runs in *~0.4s*; measured 572 ms native, 1008 ms on
   `/mnt/c`. `docs/operations/runbook.md:60` says *"sub-second"* without
   naming the surface. Small and mechanical.
2. **Should a capability claim cite the artifact it was read from?**
   `ADR-0021` clause 5 requires a provenance label but not a source file,
   and that gap let a hook count read from one client's manifest propagate
   as a fact about another. **Offered at ratification and declined**, so it
   is open rather than settled — reopening it means amending an `Accepted`
   ADR.
3. **B-023's underlying rule** (above).
4. **An untested commitment, carried forward deliberately.** *"If a sprint
   shrinks, the honest cut is a product, never the spike"* has now been
   stated by two sprints and exercised by neither. It should be restated in
   the next plan that risks shrinking, not quietly retired as vindicated.

### Inherited from `REVIEW-0010`, still open

5. **`ansible-core`'s version is recorded in nine places and has moved.**
6. **`skills/ansible-ops/` has never been exercised against a live estate.**
   Its closing item (B-010) was closed *with this limitation stated* — a
   closed item is not a claim of quality.

## How to open the next sprint

`PLAN-0006` already did step 1 for S9. What remains:

1. ~~Write a `PLAN-####` in `.ai/planning/plans/`.~~ **Done for S9/S10** —
   `PLAN-0006`.
2. ~~**Settle `ADR-0022`.**~~ **Done 2026-09-23** (`TASK-0076`). Both
   blocking spikes ran (`TASK-0055`, `TASK-0056`), `TASK-0057` reconciled the
   draft against what they found, and the human ratified it **as written**.
   `ADR-0022` is **`Accepted`**. Note what that did *not* do: it unblocked
   `TASK-0058`, `TASK-0060` and `TASK-0061` without scheduling them, and it
   did not promote the sprint — steps 3 and 4 below are still outstanding.
3. Add the phase to `ROADMAP.md` **in the same change** as promotion — that
   file has had two phases go missing after the fact, both diagnosed as
   needing a mechanism, and no mechanism was ever added.
4. Move the sprint file here, and confirm its task briefs exist in
   `.ai/tasks/` **before** any code is written. `PLAN-0006` reserves
   **TASK-0055…TASK-0067**; the next free number after that range is
   **TASK-0069** (`TASK-0068` closed S8).
