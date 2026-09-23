# No sprint is open

**As of 2026-09-23.** Sprint S9 closed on `REVIEW-0011` (`TASK-0081`) and is
archived at `.ai/planning/sprints/SPRINT-S9-unattended-runs.md`. Nothing has
been promoted to replace it, and **that is a state, not an oversight** — the
same thing this file said after S8, for the same reason.

**S9 closed with all seven exit criteria met**, which is worth stating plainly
because one of them was not met when its checkpoint was written. `REVIEW-0011`
found criterion 7 unmet — the OpenCode-first asymmetry was stated in the skill
and in **none** of the three wiring snapshots — and recommended fixing it
before closure rather than closing over it. `TASK-0080` did. **A sprint that
closes over its own unmet criterion teaches the next sprint that criteria are
advisory**, which is why the order mattered.

**S10 exists as a plan and is not current.** `PLAN-0006` produced
`.ai/planning/sprints/SPRINT-S10-unattended-bindings.md` — the three client
bindings and this repo's first authored MCP server. It is **queued, not
open**, which in this repo means a file in `sprints/` rather than here. It
**allocates no task ids**, deliberately, after two sessions collided inside a
reserved range in one afternoon; ids are allocated when briefs are written,
which is when `.ai/tasks/` can be read to see what is free.

**Nothing runs unattended yet.** S9 delivered the portable core — a loop, a
skill, nine roles. **Every binding is S10**, and none exists. A reader finding
those components installed should not conclude the capability is available;
all three `configs/*/README.md` now say so.

## What is outstanding, for whoever plans next

Nothing below is scheduled. It is the honest queue.

### Decisions waiting on a human

1. **The three trailing-flag holes.** A prefix glob cannot constrain a
   trailing flag, so for **both** `git-ops` and `closer`,
   `git commit -m x --amend`, `git commit -m x --no-verify` and — worst —
   **`git add -- .`** all resolve to **allow**. The last bulk-stages through
   the pattern meant to prevent bulk staging; `--no-verify` bypasses the
   mandatory commit gate. **Not a one-line fix:** `bash_allow` emits allows
   only, so closing them means editing `no-force-push`'s map in
   `scripts/emit-agents.py`, which changes the boundary of **four** roles at
   once. Found by `TASK-0079`; `git-ops`'s body warns the role meanwhile and
   says plainly that prose is weaker than a gate.
2. **Ratify `ADR-0023`** (one worktree per agent session). Still `Proposed`,
   and it now has the evidence it was waiting for: **five concurrent sessions**
   ran in their own worktrees during S9 and landed serially by rebase, with no
   index collision and one registry conflict that resolved cleanly. The
   failure it was written for happened **twice** on 2026-09-23 before the
   mechanism existed and **not once since**. Cheapest open item.

### Carried forward, still open

3. **`worktree-only` has no settled Claude Code emission.** `ADR-0018` clause
   7's leftover, owned by `TASK-0040`. `TASK-0056` attempted it and the run
   was **confounded** by permission denials, so it could not distinguish
   isolation from refusal. `TASK-0058` then left it open *explicitly*, which
   is the honest outcome. The single question that settles it: **does a
   `worktree`-isolated *subagent's* commit reach the real tree?** All nine S9
   roles declare the term.
4. **`B-025`** — no vocabulary term for *"may call only this MCP server"*. The
   only `ready` backlog row. Waiting on a **second** role that wants it: one
   instance is a case, two is a vocabulary.
5. **The wiring-section gate is `server.json`-only.** `TASK-0073`'s check
   behind *"The first two triggers are checked"* reads manifests, so an
   authored server with a required variable or a destructive tool would owe a
   section and never be asked for one. Goes false when `TASK-0067` ships the
   first authored server. Found by `TASK-0059`.
6. **`loops/release-check/` step 8 says to write a commit hash back *"and
   amend"***, which changes the hash just recorded. This repo's own recent
   history uses the follow-up-commit form instead. Found by `TASK-0061`.
7. **`ansible-core`'s version is recorded in several places and has moved.**
   `REVIEW-0010` said nine; a count on 2026-09-23 found **five**, so
   `TASK-0069`'s sweep reduced but did not close it. Re-count before acting.
8. **`skills/ansible-ops/` has never been exercised against a live estate.**
   Its closing item (`B-010`) was closed *with this limitation stated* — a
   closed item is not a claim of quality.
9. **An untested commitment, stated a third time.** *"If a sprint shrinks, the
   honest cut is a product, never the spike"* has now been stated by three
   sprints and exercised by none. S9 did not shrink either. It should be
   restated in the next plan that risks shrinking, not retired as vindicated.

**Closed during S9, and not to be re-raised:** `B-024` (`TASK-0059`), `B-026`
(`TASK-0060`), and before it `B-018`, `B-021`, `B-023`, `B-027`, `B-028`.

## How to open the next sprint

1. ~~Write a `PLAN-####` in `.ai/planning/plans/`.~~ **Done for S10** —
   `PLAN-0006`.
2. **Settle any ADR the sprint rests on.** S10 rests on no unratified
   decision: `ADR-0022` is `Accepted`. But `ADR-0023` is `Proposed` and S10
   will run concurrent sessions, so ratifying it belongs *with* the promotion
   rather than after it.
3. Add the phase to `ROADMAP.md` **in the same change** as promotion. No
   mechanism enforces this — `tests/validate.sh` has no roadmap/sprint check
   and is not getting one, because it is a judgment call — so **the atomic
   commit is the control**. `TASK-0077` did it that way and `git show --stat`
   on `7f21c2c` is the proof.
4. Move the sprint file here, and confirm its task briefs exist in
   `.ai/tasks/` **before** any code is written — by counting them, not by
   reading the sprint's own table. **Next free number: `TASK-0082`.**
