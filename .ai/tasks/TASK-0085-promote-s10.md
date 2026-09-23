# TASK-0085 — Promote sprint S10, and add Phase 10 in the same change

## Objective

Do steps **3 and 4** of `SPRINT-CURRENT.md`'s *"How to open the next sprint"*:
add **Phase 10** to `ROADMAP.md` and move
`sprints/SPRINT-S10-unattended-bindings.md` into `SPRINT-CURRENT.md` — **in
one commit**, the only control that pairing has.

## Minimal context

Steps 1 and 2 are done. `PLAN-0006` wrote the plan, and **both ADRs the sprint
rests on are `Accepted`**: `ADR-0022` (`TASK-0076`) and `ADR-0023`
(`TASK-0084`). The second matters here specifically — S10 will run concurrent
sessions, and it now rests on a ratified rule for doing so rather than a
proposed one.

**Human decision to promote given 2026-09-23.**

**S9 delivered what S10 depends on.** The sprint file's header says *"nothing
here can start until S9 has delivered the loop, the skill and the nine
roles"*. It has: `loops/unattended-run/`, `skills/unattended-ops/` and nine
roles all shipped, and S9 closed on `REVIEW-0011` with all seven exit criteria
met.

### Four stale claims promotion must correct, not inherit

Checked against the tree rather than read off the file:

| Claim in `SPRINT-S10` | Reality |
|---|---|
| **S10.1** delivers *"the binding contract (`templates/binding.md`) … and `scripts/check-binding.sh` with fixtures — incomplete binding fails, complete passes"* | **All three already exist**, shipped by `TASK-0062`, and the red-then-green proof was already run. **What actually remains of S10.1 is the OpenCode driver.** |
| **S10.3** depends on `TASK-0059` | `TASK-0059` is **`done`** — the authored-MCP gates landed in S9 |
| **S10.4** *"Records plainly that Bionic cannot orchestrate"* | `configs/lm-studio-bionic/README.md` **already records the client's coverage** (`TASK-0080`) — and deliberately states only the *established* fact, zero roles for want of an agent directory. What S10.4 owes is **establishing** the orchestration claim or dropping it, not writing the section |
| The checkpoint question's second half — *"that `git add -A` does not resolve to `allow` through a broader glob"* | **Already demonstrated**, twice: `TASK-0055`'s F4 observed it denied, and `TASK-0083` re-verified after narrowing. The question needs a half that is still open |

**Leaving these would misdirect real work.** A session opening S10.1 would
rebuild a checker that exists and has already been proved to fail on cue.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/planning/sprints/SPRINT-S10-unattended-bindings.md` | `PLAN-0006` | Seven deliverables, **no task ids**, deliberately |
| `.ai/planning/SPRINT-CURRENT.md` | `TASK-0081` | *"No sprint is open"*; one limitation and seven carried-forward items |
| `.ai/planning/ROADMAP.md` | `TASK-0081` | Phases 1–9; **no Phase 10** |
| `.ai/decisions/0022-*.md`, `0023-*.md` | `TASK-0076`, `TASK-0084` | Both **`Accepted`** |

**Verify the expected state; don't assume it.** Re-read what already exists
under `skills/unattended-ops/` before copying S10.1's row — that is where two
of the four stale claims are.

## Scope

### Included

- `ROADMAP.md`: Phase 10, exit criteria stated **before** the work.
- `SPRINT-CURRENT.md` becomes S10, with the four stale claims corrected and
  the still-open carried-forward items preserved.
- `git mv` of the queued sprint file.
- `CURRENT_STATE.md`, `TODO.md`.

### Not included

- **Allocating task ids.** S10 deliberately allocates none, and its reason
  holds: *"a plan carrying stale ids is worse than one carrying none, because
  the ids look authoritative."* An id is taken when a brief is written. That
  is compatible with step 4, which requires briefs before **code**, not before
  promotion — and the corrected file says so explicitly.
- **Starting any deliverable.** Promotion opens the sprint.
- Rewriting `PLAN-0006` or either ADR. Dated records.

## Execution plan

1. Re-read `skills/unattended-ops/` and `TASK-0059`'s status.
2. Write Phase 10 into `ROADMAP.md`.
3. Rewrite `SPRINT-CURRENT.md` as S10, correcting the four claims.
4. `git mv` the queued file.
5. `tests/validate.sh`; **one commit**; push.

## Acceptance criteria

- [ ] `ROADMAP.md` has a Phase 10 with exit criteria written before the work.
- [ ] `SPRINT-CURRENT.md` is S10; none of the four stale claims survives.
- [ ] S10.1's row names the **driver** as what remains, and says the contract,
      checker and fixtures already ship.
- [ ] The checkpoint question has a half that is **still open**.
- [ ] `sprints/SPRINT-S10-unattended-bindings.md` no longer exists.
- [ ] Phase 10 and the move are in **one commit**.
- [ ] Carried-forward items survive; nothing closed is re-listed.
- [ ] No component file changed; `tests/validate.sh` passes.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` (expect no diff)
- [ ] `git status --porcelain` — `.ai/` only

## Risks and rollback

- **Inheriting the stale claims**, sending a session to rebuild a shipped
  checker. The main risk, and the reason this task exists rather than a bare
  `git mv`.
- **Splitting the commit**, so the roadmap and the sprint disagree.
- **Allocating ids to look tidy**, against S10's own recorded reason.
- Rollback is `git revert` of one commit.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `ROADMAP.md` | Phase 10, exit criteria pre-stated |
| `SPRINT-CURRENT.md` | Sprint S10, **open**, four claims corrected |
| `sprints/SPRINT-S10-unattended-bindings.md` | **Deleted** |
| Component layer | **Unchanged** |

**Next task starts here**: S10.3 (`mcp-servers/gates/`) is the highest-risk
deliverable and independent of S10.1/S10.2, so it can start immediately. It
needs a **human authorization block** before any destructive capability is
declared. **Next free id: `TASK-0086`.**

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)
- Actions: checked `skills/unattended-ops/` and `TASK-0059`'s status against
  the sprint file's claims **before** moving anything; wrote Phase 10 with
  seven exit criteria; `git mv` of the queued file; the four stale claims
  corrected in place and marked **[corrected]**; the post-S9 carried-forward
  items folded in under their own heading. **One commit.**
- Observations:
  - **Two of the four corrections would have cost real work**, which is the
    justification for this being a task rather than a `git mv`. S10.1 claimed
    to deliver the binding contract, the checker and its fixtures; **all three
    already ship** from `TASK-0062`, complete with the red-then-green proof.
    A session opening S10.1 would have rebuilt a working checker. **Only the
    OpenCode driver remains.**
  - **Half the pre-committed checkpoint question was already answered.** Its
    specific asked to demonstrate *"that `git add -A` does not resolve to
    `allow` through a broader glob"* — observed denied by `TASK-0055`'s F4 and
    re-verified by `TASK-0083`. Left as written, this checkpoint could have
    passed on another sprint's evidence. **Replaced with a half that is still
    open**, and it is the sharper question: `git add -- .` cannot be closed at
    the glob layer and survives only as prose in two role bodies, so **a
    binding that stages on a role's behalf would bypass even that.**
  - **Bionic's row was over-scoped.** `configs/lm-studio-bionic/README.md`
    already records this client's coverage (`TASK-0080`), stating only the
    *established* fact — zero roles, for want of an agent directory. What
    S10.4 owes is **establishing** the "cannot orchestrate" claim or dropping
    it, not writing a section that exists.
  - **No ids were allocated, deliberately**, against the temptation to tidy.
    S10's own reason holds and is now stated once rather than twice: a plan
    carrying stale ids is worse than one carrying none. Step 4 of the
    promotion rule requires briefs before **code**, not before promotion.
  - **The post-S9 no-sprint file is not archived**, and should not be: it was
    a transient state, not a sprint. Its still-open content moved into S10's
    file under its own heading so closing S9 did not drop it.
- Validation:
  - `tests/validate.sh` — **OK**
  - `scripts/sync-registry.sh` — no diff
  - `git status --porcelain` — `.ai/` only; no component file changed
  - `sprints/` holds **S1–S9**; S10 is no longer queued
- Result: **done.** Sprint S10 is **open**, with the four claims corrected.
- Commit: `60b491d`. Pre-commit hook ran `tests/validate.sh`: OK. **Verified atomic:** `git show --stat` lists `ROADMAP.md` (+46) and the deletion of `sprints/SPRINT-S10-unattended-bindings.md` (-81) together.
- Push: **confirmed** — `origin/master` `a4d4bfc..60b491d`.
