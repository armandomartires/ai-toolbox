# REVIEW-0010 — Sprint S6, Ansible agent guardrails

- Task(s) reviewed: TASK-0026, TASK-0027, TASK-0028, TASK-0031, TASK-0032
  (+ TASK-0029/0030 delivered by S7's pilot; TASK-0052 un-parked the sprint;
  ADR-0014, ADR-0015, ADR-0016 **all still `Proposed`**)
- Reviewer: Claude Opus 5 (1M context) — agent self-review, evidence re-run
  rather than re-read where a command existed
- Date: 2026-09-22
- **Number:** `REVIEW-0009` is reserved by S8's file and remains unused.
  This checkpoint takes the next free number, as `SPRINT-CURRENT.md:129-131`
  requires.

## Diff summary

Eight commits, `d278c64..ec1cef8` (un-park through TASK-0032's commit-hash
record). **38 files, +5106/−972.**

| Group | Commits | What |
|---|---|---|
| Un-park | `d278c64` | S6 current again, S8 re-queued, four defects (D1–D4) corrected in TASK-0031's brief before any of it ran |
| Spikes | `ce05bf7` | TASK-0027 (lint the real playbooks) and TASK-0028 (hook interception) |
| Decisions | `8217221` | ADR-0014/0015/0016 **bodies** written from spike evidence — **no status changed** |
| Narrowing | `94d727d` | `ansible_navigator` disabled by default; blast-radius claim corrected |
| The guard | `ba59062` | `gather_subset_guard.py`, 8 fixtures + fixture inventory, `tests/gather-subset-guard.sh`; closes B-011 |
| Evidence | `9a19627` | Target-repo findings recorded; closes B-010 and the sprint's slice |
| Records | `a969867`, `ec1cef8` | Commit hashes and confirmed pushes |

New artifacts: `skills/ansible-ops/scripts/gather_subset_guard.py`,
`skills/ansible-ops/fixtures/gather-subset/` (8 fixtures + `inventory.yml`),
`tests/gather-subset-guard.sh`. Changed: `mcp-servers/ansible/server.json`,
`configs/opencode/README.md`, `docs/operations/runbook.md`,
`skills/ansible-ops/references/`.

**No component was added to the mandatory gate**, which is correct:
`tests/gather-subset-guard.sh` appears in neither `tests/validate.sh` nor
`.githooks/pre-commit` (verified: zero matches in both).

## Findings

### 1. S6's evidence base is no longer re-checkable at the commit it was read from

**This is the finding this checkpoint exists to surface, and it was not
predicted by anyone.**

S6's fifth exit criterion records its own verification method:
`SIGMA-infrastructure`'s `git status` empty, **`HEAD` `d4e2dd1`**,
**`[ahead 42]`** unchanged, and **`ansible.log` mtime `2026-09-12 16:15:01`**.
Re-checked 2026-09-22 at
`/mnt/c/Users/armando.martires/AI Workspaces/SIGMA-infrastructure`:

| Recorded by S6 | Observed 2026-09-22 |
|---|---|
| `HEAD` = `d4e2dd1` | `HEAD` = **`95b6966`**, dated **2026-09-06** |
| `[ahead 42]` | **no remote configured**, so no ahead-count exists |
| `ansible.log`, mtime 2026-09-12 | **file absent** |
| — | 30 commits total; single branch `master`; reflog's newest entry **2026-09-06** |
| — | `d4e2dd1` **exists as a commit object but is on no branch** |

**The constraint itself held.** The working tree is clean and nothing
indicates this repo modified that one — decision 3 ("read as evidence and
never modified") is not breached, and no finding here suggests otherwise.

**What broke is the ability to re-verify.** `d4e2dd1` is dated 2026-09-12 and
the current `HEAD` is dated 2026-09-06, while the reflog has not moved since
2026-09-06. A checkout cannot have been at a 09-12 commit on 09-16 and have a
reflog ending 09-06. So **the working copy S6 read is not the working copy at
that path today.** Whether the directory was replaced, reset, or a different
clone was read during S6 **cannot be determined read-only, and is not guessed
at here.**

**The substance survived.** `ansible.cfg` still carries the
`gather_subset` / pmxcfs / `/etc/pve` content the guard's entire rationale
rests on (6 matches), and every file S6 cited — `ansible.cfg`,
`inventory/production.yml`, `.ansible-lint`, `.pre-commit-config.yaml`,
`requirements.yml` — is still present.

**The consequence worth carrying forward:** `TASK-0032` recorded F1–F4 **in
this repo's `CURRENT_STATE.md`** rather than leaving them as pointers into
the target repo, and it did so for an unrelated reason — ADR-0015 forbids
estate facts in a symlink-deployed component. That choice is what preserved
S6's evidence. **A decision taken for one reason turned out to be
load-bearing for another**, and the generalisation is cheap: a citation into
a repo you do not control is a pointer that can dangle, so record the fact,
not the coordinates.

### 2. The guard is insulated from finding 1 — the sprint's strongest property

`tests/gather-subset-guard.sh` copies its fixtures and **its own
`inventory.yml`** into a work directory and points the rule at them via
`GATHER_SUBSET_GUARD_INVENTORY`. It never reads `SIGMA-infrastructure`.

So S6's highest-value deliverable does not depend on the evidence base that
drifted. **Re-run 2026-09-22: `gather-subset-guard: PASS (10 checks)`**, all
ten enumerated — four fixtures that must fire (including f6's bare-hostname
resolution and f7's mis-scoped `module_defaults`), four that must stay
silent, one message-distinguishability check, and the negative control that
reproduces the `enable_list` silent-no-op trap.

The negative control is the part that matters. It is the direct answer to the
sprint's own standing constraint — *"a check that cannot fail is worse than
no check"* — and to lesson 8's admission that knowing this had not prevented
authoring one twice. This time it did.

### 3. Toolchain drift: `ansible-core` 2.20.8 → 2.21.4

The repo records `ansible-core 2.20.8` in **nine** places (ADR-0014:47,
`SPRINT-CURRENT.md:114`, `ROADMAP.md:317`, `CURRENT_STATE.md:498`,
`PLAN-0003:145`, two task files, a session log). Observed 2026-09-22 by
running the binary: `ansible-lint 26.8.0` **using `ansible-core 2.21.4`**.
`ansible-lint` itself is unchanged at 26.8.0; upstream now offers 26.9.0.

**Benign for the guard** — finding 2's 10/10 was obtained *on* 2.21.4, so the
rule works across both. **Not benign for ADR-0014's evidence**: its "53 rules
/ 0 real violations" was observed under 2.20.8 and has not been re-run under
2.21.4. That is a ratification consideration, not a blocker — the ADR's
decision (accept and narrow the pinned MCP surface) does not turn on the rule
count.

### 4. The gate's budget is still undecided, one sprint after it was raised

`REVIEW-0008` follow-up 1 asked for a **decided** bound, since `AGENTS.md`
calls sub-second load-bearing while the gate had left it. Measured
2026-09-22 on the repo's own filesystem (`/mnt/c`, 9p — not `/tmp`, per that
review's own warning):

```
run1: 1245 ms   run2: 1040 ms   run3: 971 ms
```

Mean ~1085 ms. Still past the claim, and **nothing has been decided**.

S6 is not the cause and does not aggravate it: the guard harness was
deliberately kept out of the gate. The point is structural — **a follow-up
recorded in a checkpoint and not actioned recurred at the next checkpoint**,
which is `REVIEW-0008`'s own finding 2 about findings that live only in
prose, now demonstrated on that review's own follow-up list.

### 5. Two of the three ADRs changed shape after their filenames were set

Both are deliberate and both are flagged in their own `## Status` blocks, so
this is a **ratification hazard, not a defect**:

- **ADR-0015**'s filename still reads
  `ansible-knowledge-portable-core-plus-templates` — the mechanism its
  clause 1 **formally reverses**. Kept deliberately, per ADR-0017's
  precedent. A reader skimming `.ai/decisions/` filenames will read the
  opposite of what the ADR decides.
- **ADR-0016**'s conclusion (no `hooks/` category) survived, but its
  *reasoning inverted*: the plan expected interception to fail; TASK-0028
  found it **works in both clients**, and what declines the category is that
  the two disagree on the tool's *name*. It must read as **declined**, never
  unavailable.

All three bodies are real, not skeletons — 122 / 196 / 157 lines, **zero
"to be written" markers** (the state `REVIEW-0008` follow-up 4 flagged is
resolved).

### 6. The plan-time limitation held, and is narrower than predicted

S6 wrote its own headline finding before the work: *"the skill will end this
sprint in the same epistemic position as `mcp-servers/_template/`: plausible,
unexercised scaffolding"*, and said so should be the checkpoint's headline.
Honouring that, with a correction in the sprint's favour:

- **`skills/ansible-ops/` — unexercised, as predicted.** It was authored from
  the estate and never executed against it. Finding 1 makes this worse than
  it looked: the estate it was authored from is no longer re-checkable at
  that commit.
- **The guard — exercised, contrary to the prediction.** Eight fixtures, a
  negative control, and 10/10 today. The prediction was written when
  TASK-0031 was a plan; the raised bar from TASK-0052 (seven fixtures, not
  five) is what moved it.

So the limitation is real but **applies to the skill, not to the sprint's
strongest deliverable**. Stating it undifferentiated would understate what
S6 actually proved.

### 7. Three external-evidence drifts inside one week, all caught by stamps

Bionic's version and MCP config (`TASK-0053`, 2026-09-22), `ansible-core`
(finding 3), and the target repo (finding 1). Every one was caught because
the original observation carried a version, a hash or a timestamp — which is
exactly the defence `ADR-0020` said was the only one available for claims
about things this repo does not control.

**The defence works. Its trigger does not exist.** All three were found by
someone happening to re-read the file, twice in a session about something
else. There is no scheduled or gated re-check, and `AGENTS.md` names none.
This is not a request for one — it is the observation that the repo now has
three data points on the decay rate of its external claims, and nothing that
uses them.

## Validation results

| Check | Result |
|---|---|
| `tests/validate.sh` | **OK** — re-run repeatedly through this session |
| `tests/gather-subset-guard.sh` | **PASS (10 checks)** on `ansible-lint 26.8.0` / `ansible-core 2.21.4` |
| `scripts/sync-registry.sh` | regenerated, **no diff** |
| Gate timing | **971 / 1040 / 1245 ms** on `/mnt/c` — see finding 4 |
| Guard in the mandatory gate? | **No**, correctly — 0 matches in `validate.sh` and `.githooks/pre-commit` |
| `SIGMA-infrastructure` working tree | **clean** — constraint held (but see finding 1) |
| B-010…B-013 | **all four `done`** in `BACKLOG.md` |
| ADR bodies | 122 / 196 / 157 lines, **0 skeleton markers** |
| Phase 6 exit criteria | **5 of 5 MET** per `ROADMAP.md`; criteria 4 and 5 re-verified directly here |

## Verdict

**Approve the work. The sprint cannot be closed by this review.**

Every Phase 6 exit criterion is met, and the one that mattered — the guard —
is verified by re-running it rather than by reading its log: it fires on four
distinct failure shapes, stays silent on four safe ones, and its negative
control reproduces the silent-no-op trap that would have made it worthless.
That is the sprint's purpose, delivered, and finding 1 does not touch it.

Approved with findings 1, 3, 4 and 7 on the record.

**Closure is blocked on an act this review cannot perform.** ADR-0014,
ADR-0015 and ADR-0016 remain `Proposed`, and ADR-0014 states the position
plainly: *"What remains is a human act, not more evidence."* Every
ratification in this repo is recorded as a human decision — ADR-0017
rejected, ADR-0019 *"ratified by the human on the date it was proposed"*.
An agent accepting them would be manufacturing the one signature the
convention exists to require.

**S6 therefore stays current.** The ratification packet below is what the
decision needs; nothing else is outstanding.

## Ratification packet — what accepting each ADR commits you to

Summaries only. Each ADR is the owner of its own text; read the linked
`## Decision` before signing.

### ADR-0014 — Accept the pinned ansible MCP surface; narrow, don't extend
- **Commits you to:** living with 2-of-7 capability coverage rather than
  authoring a Python MCP server, and keeping **ADR-0010 closed** with its
  reopen trigger deliberately unpulled — even though the gap is exactly the
  "real reason" that trigger describes.
- **Substantive, not a restatement:** it closes a door a future reader will
  otherwise re-open on noticing the gap.
- **Consideration:** its "53 rules / 0 real violations" evidence was observed
  under `ansible-core` 2.20.8; the live toolchain is 2.21.4 (finding 3). The
  decision does not rest on the count.

### ADR-0015 — Derive per change; persist nothing *(clause 1 reversed)*
- **Commits you to:** the reversal. The planned "portable core plus
  per-project `templates/`" mechanism is **rejected**, because
  `install.sh:105` symlinks a deployed skill into this repo's working tree —
  so an operator filling a shipped template would write one estate's
  production facts into a portable component. `templates/` survives only for
  **copy-out** artifacts carrying no estate facts (`change-record.md`).
- **This is the one that most needs a human:** reversing an approved
  mechanism is substantive. Ratification is owed *specifically* on clause 1.
- **Read past the filename** — it still names the rejected shape (finding 5).

### ADR-0016 — No `hooks/` category *(reasoning inverted)*
- **Commits you to:** declining the category on portability grounds, **not**
  on capability grounds. Interception **works in both clients**; they
  disagree on the tool's name (`mcp__ansible__zen_of_ansible` in Claude Code,
  documented, vs `ansible_zen_of_ansible` in OpenCode, observed live), so no
  portable artifact can match the same string.
- **Also commits you to:** its three-part reopen trigger, and to the rule
  that a future category is **not** named `hooks/` after one vendor's word.
- **Low risk:** the conclusion is unchanged from the plan; only its basis
  moved, and it moved onto firmer evidence.

## Follow-up tasks

1. **Ratify or reject ADR-0014/0015/0016** — the only thing between S6 and
   closure. Packet above.
2. **Decide the gate's budget** (`REVIEW-0008` follow-up 1, still open).
   It is at ~1085 ms against a sub-second claim in `AGENTS.md`. Either state
   a new bound with a reason or reduce it, but **decide** it — this is its
   second checkpoint unactioned. Measure on `/mnt/c`, never `/tmp`.
3. **Reconcile the `ansible-core` version across nine files** (finding 3), or
   state once that the recorded version is a dated observation and stop
   repeating it. Nine copies of a decaying fact is eight too many — the
   "one owner per fact" rule applies to observations too.
4. **Decide what, if anything, re-checks external claims** (finding 7). Three
   drifts in one week were each caught by chance. This is a judgment call
   about whether the repo wants a trigger at all; recording "no, by choice"
   closes it as legitimately as building one.
5. **`skills/ansible-ops/` remains unexercised against a live estate**
   (finding 6), and finding 1 means the estate it was authored from is no
   longer re-checkable at that commit. Adoption is that repo's own sprint to
   open (decision 3) — unchanged, but now with a shorter half-life.
6. **B-018, B-019, B-020, B-021 stay `ready`.** None is S6's, none is
   resolved by this checkpoint, and S8 remains re-queued behind S6's closure.
