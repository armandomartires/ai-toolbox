# REVIEW-0011 — Sprint S9, unattended runs: the decision and the portable core

**Checkpoint written 2026-09-23.** Sprint S9, promoted the same day by
`TASK-0077` with `ROADMAP.md`'s Phase 9 added in the same commit.

## The pre-committed question, answered first

`PLAN-0006` committed this checkpoint's question **before the work**, per
`ADR-0012`, so it could not be written to whatever the sprint happened to
produce:

> **Did the documentation state the OpenCode-first asymmetry plainly, or did
> it describe three clients as if they were equivalent?**

**Answer: the skill states it plainly. The three wiring snapshots do not
mention it at all — and that is worse than the failure the question
anticipated.**

`skills/unattended-ops/SKILL.md:118-120` says exactly what was wanted:

> *"This harness is **OpenCode-first**, and that is not a defect… under Claude
> Code and Bionic it runs from the skill plus the gate server, with
> prompt-level rules that are **weaker by construction** — not equivalent, and
> not to be described as equivalent."*

Then, grepped rather than assumed:

| File | Says anything about the unattended harness? |
|---|---|
| `skills/unattended-ops/SKILL.md` | **Yes** — OpenCode-first, stated plainly |
| `configs/claude-code/README.md` | **No.** It gained one OpenCode-only note today (`TASK-0075`, the design-brief loop) and nothing about the nine new roles |
| `configs/opencode/README.md` | **No** |
| `configs/lm-studio-bionic/README.md` | **No.** S10's plan says Bionic *cannot orchestrate*; that is recorded nowhere a Bionic user would look |

**The question guarded against describing three clients as equivalent. What
actually happened is silence, which reads as equivalent by omission** — a
Claude Code user reading their own wiring snapshot learns nothing about seven
roles they will never receive. The failure mode was adjacent to the predicted
one and would have been missed by a checkpoint written afterwards, which is
the argument for pre-committing the question rather than a vindication of the
particular wording.

**This is exit criterion 7, and it was NOT met when this checkpoint was
written.**

> **Closed 2026-09-23 by `TASK-0080`**, on the human's instruction, before S9
> was closed — rather than closing the sprint over its own unmet criterion.
> Each snapshot now names **its own** coverage: Claude Code two of nine (with
> the seven it does not get), OpenCode all nine as the reference client,
> Bionic **zero** — the last stated on `ADR-0020`'s established
> no-agent-directory finding rather than on `SPRINT-S10`'s not-yet-established
> claim that Bionic cannot orchestrate. All three link the skill rather than
> restating its reasoning, and all three say plainly that **no binding exists
> yet, so nothing runs unattended on any client**.
>
> **The finding above is left exactly as written.** It is what the checkpoint
> found, and a review rewritten to match its own follow-up stops being
> evidence that the pre-committed question worked.

## Diff summary

**29 commits**, `c9bc83d..be4c5bf`; **56 files, +7697 / −576**.

| Deliverable | Where | Task |
|---|---|---|
| Two spikes, F1 falsified, F5 confirmed | task files only | `0055`, `0056` |
| `ADR-0022` reconciled, then ratified | `.ai/decisions/0022-*` | `0057`, `0076` |
| Authoring-guide vocabulary decisions | `docs/development/authoring-guide.md` | `0058` |
| Authored-MCP gates (`B-024`) | `tests/validate.sh` (+428 net) | `0059` |
| Registry Clients column (`B-026`) | `scripts/sync-registry.sh` | `0060` |
| The loop | `loops/unattended-run/loop.md` | `0061` |
| The skill: 7 references, template, checker | `skills/unattended-ops/` | `0062` |
| Nine roles | `agents/*` | `0063`, `0064` |
| `no-bash`, the twelfth term | guide + gate + emitter | `0078` |
| `git-ops` narrowed | `agents/git-ops/agent.md` | `0079` |

## Exit criteria — six of seven

Judged against Phase 9 as written **before** the work, not against what was
produced.

| # | Criterion | Verdict |
|---|---|---|
| 1 | `ADR-0022` ratified on evidence | **Met.** `Accepted` 2026-09-23 after both spikes ran; **F1 was falsified**, adding clause 5 and making the decision more cautious than the draft |
| 2 | The `mode` question decided **explicitly** | **Met.** `TASK-0058` **rejected `mode: all`** with three reasons and a reopening condition. `MODES` unchanged; the gate now refuses `all` by name rather than as a typo |
| 3 | `worktree-only` settled **or explicitly recorded as not settled** | **Met, by the second branch.** Recorded as open, with the reason (`TASK-0056`'s attempt was confounded) and the single question that settles it: *does a `worktree`-isolated **subagent's** commit reach the real tree?* |
| 4 | Registry shows client coverage | **Met.** `\| Name \| Clients \| Description \| Path \|`; eleven of fifteen rows read `opencode` |
| 5 | Loop authored **before** the roles | **Met, checkable in `git log`:** loop `e28e2da` 19:37 → thinking roles `02c1cb2` 20:07 → acting roles `69e6eb2` 21:02 |
| 6 | Nine roles emit; emission **refuses** when one is widened | **Met.** `opencode` exit 0, 15 files; `claude-code` exit 0, 4 files, five skipped. Refusal observed twice, in `TASK-0063` and `TASK-0064`, with exit 1 and no file written |
| 7 | Asymmetry stated plainly in the skill **and both wiring snapshots** | **NOT MET at checkpoint time. Met 2026-09-23 by `TASK-0080`** — see the closing note |

**Seven of nine roles are OpenCode-only and two port**, exactly as the sprint
claimed. That claim survived a real challenge rather than being asserted: see
finding 1.

## Findings

### 1. The portability claim was nearly true for the wrong reason

`TASK-0063` reported that `task-planner` and `adjudicator` ported **because
they declared no command boundary at all**. Verified by reading the emitted
files: OpenCode carried no `bash` key, Claude Code no `Bash` in
`disallowedTools`. So `read-only` bound at the tool layer only and
`echo x > file` defeated it. **They ported because they were weak.**

`TASK-0078` added **`no-bash`** — the fifth term enforceable in both clients,
with the Claude Code half resting on `TASK-0056`'s observation that a
`Bash(...)` specifier removes the *entire* tool. The headline is now true of a
boundary that holds.

**The mechanism that caught it was an agent reporting a weakness in its own
work instead of quietly narrowing `clients`.** No gate would have caught it;
`validate.sh` cannot ask whether a declared boundary means anything.

### 2. The false-boundary defect class appeared FOUR times in one sprint

| Role / term | Claimed | Actually |
|---|---|---|
| `qa-test` (`B-021`) | "runs tests" | `bash_allow` denied every test command |
| `designer-manager` (`B-028`) | delegates to `git-ops` | `git-ops` did not exist for that client, silently |
| `read-only` | read-only | did not stop a shell |
| `git-ops` (`TASK-0079`) | `no-force-push` | covered push only; `git add -A`, `git checkout --`, `git stash drop`, `git rm`, `git branch -D` all allowed |

**Four instances, four different mechanisms, one shape: a component's
self-description outrunning its enforcement.** Three were found by *resolving
what a declaration actually produces* rather than reading the declaration.
That method should be named as the repo's standard move for capability work,
because it is now 3-for-4.

### 3. Three holes remain open, and they affect two roles

A prefix glob ending in `*` cannot constrain a trailing flag:

| form | `git-ops` | `closer` |
|---|---|---|
| `git commit --amend -m msg` | deny | deny |
| **`git commit -m msg --amend`** | **allow** | **allow** |
| **`git commit -m msg --no-verify`** | **allow** | **allow** |
| **`git add -- .`** | **allow** | **allow** |

`git add -- .` **bulk-stages through the pattern meant to prevent bulk
staging**. `--no-verify` bypasses the mandatory commit gate, which `AGENTS.md`
forbids without explicit human request.

**Not closed, and not a one-line fix.** `bash_allow` emits allows only; the
denies come from `no-force-push`'s fixed map in `scripts/emit-agents.py`, so
closing these changes the boundary of **four** roles at once. Surfaced to the
human; `git-ops`'s body warns the role in the meantime and says plainly that
prose is weaker than a gate.

### 4. Parallel execution worked, and `ADR-0023` now has evidence

**First real use of the worktree mechanism.** Three concurrent sessions
(`0058`/`0060`/`0061`), then two (`0059`/`0062`), each in its own worktree on
its own branch, landed serially by rebase. `master` stayed linear with one
commit per task. **No index collision, no cross-session staging** — the
failure `ADR-0023` was written for, which had happened twice on 2026-09-23
before the mechanism existed.

**`ADR-0023` is still `Proposed`.** It has now been exercised across five
concurrent sessions and a registry conflict that resolved cleanly on rebase.
That is the evidence its ratification was waiting for.

### 5. The gate caught the reviewer

While adding `no-bash` I inserted a check between the delegation chain's last
statement and its `elif`, re-binding that `elif` and making **every** role
carrying `delegates_to` fail with an unrelated message. `designer-manager`
went red immediately. **Recorded because the lesson is not "be careful" but
"run the gate rather than read the diff"** — the diff looked right.

### 6. Documentation debt created by my own scoping

I scoped `TASK-0059` out of the authoring guide to avoid a conflict with
`TASK-0058` **that had already landed**. The gate therefore shipped enforcing
a `[tool.ai-toolbox]` schema the guide did not define — `ADR-0008`'s order
inverted — alongside two now-false claims. Fixed in `b897a05` and named there
rather than quietly patched.

### 7. A naming near-miss, caught at landing

The loop named its ninth role `scribe`; `PLAN-0006`, `SPRINT-CURRENT.md` and
`TASK-0064`'s brief all said `run-scribe`. Left alone, `TASK-0064` would have
authored a role the loop never cites. Caught because landing included reading
the artifact rather than the report.

### 8. The untested commitment, stated a third time

*"If a sprint shrinks, the honest cut is a product, never the spike."* S9 did
not shrink, so it is **still unexercised** — three sprints, three statements,
zero tests. It should be restated in S10's plan, not retired as vindicated.

## Validation results

| Check | Result |
|---|---|
| `tests/validate.sh` | **OK** |
| `scripts/sync-registry.sh` | No diff — registry current |
| Working tree | Clean apart from untracked `.claude/` |
| `git log origin/master..HEAD` | **0** — everything pushed |
| `git fsck --connectivity-only` | Dangling blobs/trees only, from rebases and removed worktrees; **no corruption** |

**One incident worth recording.** Mid-review, `/mnt/c` reached **100% full
(24 MB free)** and `git status` failed writing `.git/index.lock`. Work stopped
rather than retrying against a full disk. Nothing was lost — local `HEAD` and
`origin/master` were identical at `be4c5bf`. Resumed after the human freed
space. **The repo's own gate is unaffected by this, but a reader should know
that `/mnt/c` is the constrained resource on this machine**, not the WSL
volume (`/dev/sdd`, 929 GB free) where scratch work happens.

## Verdict

**S9 delivered its portable core: one loop, one skill with seven references
and a working checker, nine roles, two vocabulary decisions, three closed
backlog items and a twelfth capability term that exists because the sprint
caught itself shipping a boundary that did not hold.**

**Six of seven exit criteria are met. Criterion 7 is not**, and it is the one
the pre-committed question targeted. That is not a reason to call the sprint a
failure — it is the checkpoint doing its job, on a gap that is three
documentation sections wide and would otherwise have shipped invisibly.

**Recommendation: fix criterion 7 before closing S9**, rather than closing
with a stated exit criterion unmet. It is small, it is the sprint's own
commitment, and a sprint that closes over its own unmet criterion teaches the
next sprint that criteria are advisory.

> **Taken, 2026-09-23.** `TASK-0080` closed criterion 7. **All seven exit
> criteria are now met**, and nothing stands against closing S9 but the
> decision itself.

**Closing the sprint is a human decision**, as promoting it was.

## Follow-up tasks

| # | Item | Why it is not in this sprint |
|---|---|---|
| 1 | ~~State the asymmetry in all three `configs/*/README.md`~~ | **Done 2026-09-23, `TASK-0080`.** Bionic's section states the *established* fact (zero roles, `ADR-0020`) rather than S10.4's unestablished orchestration claim |
| 2 | **Decide the trailing-flag holes** — whether `no-force-push`'s emitter map gains `--amend`, `--no-verify` and `git add -- .` denies | Changes four roles' boundaries; a vocabulary-behaviour decision, not a task's to take |
| 3 | **Ratify `ADR-0023`** | Now has the evidence five concurrent sessions provide |
| 4 | `worktree-only`'s Claude Code emission | Still `TASK-0040`'s; needs a run where writes are permitted |
| 5 | `B-025` — "may call only this MCP server" | Still waiting on a *second* role that wants it |
| 6 | The wiring-section gate is `server.json`-only | Goes false when `TASK-0067` ships the first authored server |
| 7 | `loops/release-check/` step 8 says "and amend" | Changes the hash it just recorded; found by `TASK-0061` |
