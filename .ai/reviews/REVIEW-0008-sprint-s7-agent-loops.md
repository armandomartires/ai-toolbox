# REVIEW-0008 — Sprint S7, Design and production agent loops

- Task(s) reviewed: TASK-0033, TASK-0034, TASK-0036…TASK-0046
  (TASK-0035 cancelled; + ADR-0017 rejected, ADR-0018, ADR-0019, PLAN-0004)
- Reviewer: opencode (agent self-review), scope decisions by the human
- Date: 2026-09-16

## Diff summary
Thirty-two commits, `cb0aa96..ff212dd` (S6's closing record through the
pilot's commit-hash record). 76 files, **+15026/−193**.

| Group | Commits | What |
|---|---|---|
| Open | `9105246` | Park S6, open S7 with PLAN-0004 |
| Decisions | `c03537e`, `ab66b4e`, `fb424c7` | ADR-0019 accepted, ADR-0018 accepted, ADR-0017 **rejected** |
| Phase 1 | `724f62c`, `5078757` | Two spikes (schema mapping, `agent-tiers` drift) |
| Phase 2 | `7ccfa6d`, `8a9996b`, `e0e9d68`, `36cab90` | `agents/` defined, indexed, enforced, emitted |
| Phase 3 | `1fc55a9`, `ef4b6ce`, `3a588da` | `loops/design-brief/`, `skills/design-flow/`, 3 design roles |
| Phase 4 | `180051f`, `4fc1f12` | `loops/project-build/`, 3 production roles |
| Phase 5 | `8e1d1be`, `31e0520` | Brief lock commit; the pilot |
| Records | 11 commits | Commit-hash/push records per task |

New components: `agents/` (7 dirs incl. `_template/`), `loops/design-brief/`,
`loops/project-build/`, `loops/ansible-change/`, `skills/design-flow/`,
`skills/ansible-ops/` (8 files), `docs/design/ansible-ops-brief.md`.
Changed plumbing: `tests/validate.sh`, `scripts/sync-registry.sh`,
`scripts/install.sh`, `scripts/emit-agents.py` (new),
`docs/development/authoring-guide.md`, `docs/registry.md`.

## Findings

**1. The pre-committed question is answerable YES, and the evidence is
independent of the task logs.** This was the one thing the review existed to
settle, so it was checked against artifacts rather than against claims:

| Claim | How it was verified here | Result |
|---|---|---|
| The gate polices real roles | broke `name: critic` → `crtiic` | `INVALID AGENT: … does not match directory 'critic'`, exit 1; restored byte-identical by SHA-256 |
| The registry indexes them | read `docs/registry.md` `## Agents` | 6 roles, `_template` correctly absent |
| Emission produced files | listed both client dirs | **9 files**: 6 in `~/.config/opencode/agents/`, 3 in `~/.claude/agents/` |
| Refusal, not degradation | the 3 OpenCode-only roles | absent from `~/.claude/agents/` — skipped, not emitted weakened |
| The lock mechanism | `git show --stat 8e1d1be` | a dedicated **brief-only** commit, as step 7 requires |
| The pilot's checker runs | ran it on both fixtures | exit 0 naming its own limits; exit 1 naming `approver`, `snapshot_ref`, `rollback_verified` |

So the sprint is **not** the fourth instance of the scaffolding pattern it
was written to avoid. That is the headline, and it is earned.

**2. The gate is no longer sub-second, and S7 is most of the reason.**
`AGENTS.md:46` calls it "Fast, offline, hermetic; keep it that way", and
TASK-0038 was explicitly required to *measure* rather than assume. It did,
recording 654→606 ms. Today, in the working tree: **965/999/1039 ms**, and
six further runs 980–1047 ms. It has crossed the line the repo treats as
load-bearing.

Two measurement traps had to be cleared before that number meant anything,
and the first one invalidated my initial attempt:

- **I first compared a `/tmp` worktree against the `/mnt/c` repo**, and got a
  reassuring 358 ms for TASK-0038's commit. That compared **ext4 against 9p
  DrvFs**, not commit against commit. Re-run on the repo's own filesystem,
  the same commit measures **622 ms** — matching TASK-0038's recorded 606 ms
  and confirming the baseline was honest.
- On that like-for-like basis the progression is: `e0e9d68` (TASK-0038)
  **622 ms** → `4fc1f12` (TASK-0045) **880 ms** → `31e0520` (pilot)
  **960 ms** → `2dc8389` (HEAD) **1138 ms**.

So **S7 took the gate from 622 to 960 ms (+54%)**, and post-S7 work pushed it
past 1100. TASK-0038 recorded linear scaling in role count as a known
property; that property has now been paid. The regression is real but it is
*growth*, not a defect in any one check — and worth stating plainly, because
the next sprint that adds a component category inherits a gate with no
headroom.

**3. Four executed tasks left no session record — and the index cannot show
it.** `.ai/sessions/` has 25 files and `INDEX.md` has 25 rows, so every
consistency check available passes. But reading the `Tasks` column, no row
owns **TASK-0041, TASK-0042, TASK-0046 or TASK-0047**. Three of those are
substantive: the design-brief loop, the design-flow skill, and **the pilot
itself** — the sprint's single most consequential task.

This is the S6 defect exactly (`SESSION-20260915-1000`'s row records
reconstructing a missing S6 session), recurring **inside the sprint that
reconstructed it**, and four times rather than once. ADR-0012's invariant is
that a task be startable cold from its own file plus the two index files; for
these four the second half of that is missing. Not reconstructed here:
fabricating four session records a day later would be inventing the evidence
the convention exists to preserve. Raised as a follow-up instead.

**4. S7's own state records were wrong in three places, which is the sprint's
own headline finding turned on itself.** TASK-0046's central discovery was a
class: *false claims an artifact makes about itself*. Auditing the closure
state found three more instances, all in S7's governance files:

| Where | Said | Actually |
|---|---|---|
| `SPRINT-CURRENT.md:63` | TASK-0033 **planned** | `- Status: done` in its own file |
| `CURRENT_STATE.md:91` | "All **six** S7 tasks are done" | **13 done**, 1 cancelled |
| `ROADMAP.md:226-228` | "**eleven** of the sprint's tasks" done | 13 done (the line predates the pilot) |

The roadmap's "eleven" was true when written and decayed — lesson 7. The
"six" was never true. TASK-0033's row is the sharpest: the task that
*opened this sprint* is recorded in the sprint file as not yet started,
while its own file says done. **`validate.sh` cannot catch any of these** —
it checks section presence, never whether a status assertion in one file
matches the status in another. Fixed in the same commit as this review.

**5. Three backlog items S7 delivered are still marked `ready`.** B-015
(agent portability — delivered by ADR-0018), B-016 (`agents/` has nothing
behind it — delivered by TASK-0037…0040), and B-017 (no design stage —
delivered by ADR-0019 + TASK-0041…0043) all still read **ready**, with
"must be decided **before** any role is authored" and "no template, no
schema, no `validate.sh` check, no registry section, no `install.sh` path"
still in the present tense. All five of those now exist. Same class as
finding 4, in a fourth file. Corrected with this review.

**6. `qa-test` cannot run tests, and nothing tracked it.** The pilot found
this and called it the most actionable finding; I re-verified it from the
emitted file, not the log:

```
bash: {"*": deny, "git log*": allow, "git diff*": allow, "git status*": allow}
```

Its own registry description says *"Writes and **runs** tests … reports
pass/fail evidence"*. It cannot run `pytest`, `npm test` or
`tests/validate.sh`. **The role's description is a false claim about
itself** — finding 4's class again, in shipped content this time.

The pilot recorded it correctly and the role behaved correctly (it refused
to claim unobserved passes, which is the boundary working). But grepping
`BACKLOG.md` for it returns **nothing**: the finding lives only in prose in
three narrative files. A defect recorded only in a task log is a defect that
will be rediscovered rather than fixed. Raised here as **B-021**.

**7. The emitter's two near-miss defects are genuinely fixed, verified from
the emitted artifact.** TASK-0045's worst finding was that alphabetical glob
sorting made `git push --force` resolve to **ask** under OpenCode's
last-match-wins, in the one role whose purpose is that it cannot force-push.
Read back from `~/.config/opencode/agents/git-ops.md`:

```
"*": deny → "git *": allow → "git push*": ask → "git rebase*": deny
→ "git push -f*": deny → "git clean -f*": deny → "git push --force*": deny
→ … → "git push --force-with-lease*": deny
```

Ascending by pattern length, so every force variant lands after `git push*`
and resolves **deny**; `git clean -f*` is present. Both fixes are live in
the deployed file, not merely in the source. Worth preserving the *method*:
both were found by set-differencing `key=action` pairs against the reference
roles, and **both would have passed a read-through**.

**8. ADR-0014 and ADR-0015 are still `proposed`, and ADR-0015 now
contradicts a shipped component.** S6's decision to build from recorded
evidence left both owing ratification; the pilot then shipped
`skills/ansible-ops/` under them. ADR-0015's text still argues for
"`templates/` carries blank forms the consuming repo fills in" (`:25`,
`:80`, `:109`) — the shape the pilot **tested and found wrong**, because
`install.sh:105` symlinks a deployed skill into this working tree, so an
operator filling a shipped template writes one estate's production facts
into the portable component. The shipped skill correctly uses the derived,
persist-nothing shape (`SKILL.md:24`: *"derived per change, never declared
and never stored"*).

So the ADR of record for a shipped component describes a rejected design.
`CURRENT_STATE.md` already says clause 1 "must be rewritten, not cited",
which is the right disposition — but it is a note in a narrative file, not a
change to the ADR, and `ansible-ops` is shipping meanwhile. **Out of S7's
scope** (both ADRs are S6's, parked) and left as a follow-up rather than
rewritten here, because rewriting a parked sprint's ADR inside another
sprint's closure is how ownership gets muddled. Recorded so the next reader
of ADR-0015 is warned before citing it.

**9. No fabricated verification.** Three places where the honest record was
available and cheaper: the filesystem confound in finding 2 is reported
including my wrong first measurement; the four missing session records are
left missing rather than reconstructed; and B-011/TASK-0031 remains
undelivered, with the shipped skill saying so in writing
(`SKILL.md:190`, the defect class is *"mechanically unenforced"*) rather
than implying coverage.

## Validation results
Independently re-run for this review, not copied from the task logs:

- `tests/validate.sh`: **OK**, exit 0. **965/999/1039 ms** in the working
  tree — **over the sub-second budget** (finding 2).
- **Like-for-like timing**, same filesystem, 3-run averages: `e0e9d68`
  622 ms, `4fc1f12` 880 ms, `31e0520` 960 ms, `2dc8389` 1138 ms.
- **Hermetic**: `env -i /bin/bash -c '… bash tests/validate.sh'` →
  `validate.sh: OK`, exit 0 with the entire environment unset.
- **Offline**: no `curl|wget|urllib|requests|ls-remote|npx|npm|pip install`
  primitive anywhere in `validate.sh`.
- **Fails-when-reverted**: `name: critic` → `crtiic` gives exit 1 and
  `INVALID AGENT: agents/critic/agent.md: name 'crtiic' does not match
  directory 'critic'`; restored → exit 0, byte-identical by SHA-256.
- **Registry current**: `scripts/sync-registry.sh` re-run produces **no
  diff** against the committed `docs/registry.md`.
- **Emission live**: 6 files in `~/.config/opencode/agents/`, 3 in
  `~/.claude/agents/`; the 3 OpenCode-only roles absent from Claude Code, so
  clause 8's refusal is observable in the filesystem.
- **`git-ops` permission order re-derived** from the emitted file: shorter
  patterns first, every force variant resolving deny, `git clean -f*`
  present.
- **The pilot's checker exercised both ways** on its two shipped fixtures:
  exit 0 stating its own limits; exit 1 naming three specific fields.
- **All three loops** carry `## Exit conditions` with a numeric bound and an
  escalation path (`design-brief` cap 3; `project-build` three bounds;
  `ansible-change` 3 per gate).
- Secrets: `git diff cb0aa96..ff212dd` scanned for `ghp_`, `github_pat_`,
  `glpat-`, `AKIA`, PEM headers — the single hit is **prose describing a
  scan**, not a credential. `git remote -v` token-free.
- Pushes: `ff212dd` and `HEAD` both confirmed ancestors of `origin/master`
  (`2dc8389`), so all 32 S7 commits are on the remote.
- Working tree clean; only `.pilot-scratch/` present, gitignored by
  `1e07584`, and **not walked by the gate** (verified — it is not the cause
  of finding 2).

## Verdict
**Approve.**

Every Phase 7 exit criterion is met, and the one that mattered — *the pilot
ran* — is verified from artifacts rather than from its own log: the loops
executed, their exit conditions fired, the roles' boundaries bound at
runtime, and the plumbing was exercised by real content. The dropped
criterion (importing `agent-tiers`) was dropped on evidence, and the
sprint's ordering principle is what stopped it, which is the strongest thing
in the sprint.

Approved with findings 2, 3 and 6 on the record: the gate has left its
stated budget, four tasks including the pilot left no session record, and
the pilot's most actionable finding was tracked only in prose until now.

Findings 4 and 5 are **fixed in the same commit as this review** — they were
false statements about state, and leaving them to a follow-up would be
recording a known-false status.

## Follow-up tasks
1. **The gate needs a decided budget, not a lapsed one.** It is at ~1150 ms
   against an `AGENTS.md` claim of sub-second. Either state a new bound and
   why, or reduce it — but the number must be *decided*, since "keep it that
   way" now describes something that already changed. Note the trap for
   whoever measures: **timing on `/tmp` (ext4) and comparing against
   `/mnt/c` (9p) understates by ~40%.** Measure on the repo's filesystem.
2. **B-021 (raised): `qa-test` cannot run tests.** Its `bash_allow` admits
   only `git status/diff/log`, while its description claims it runs them.
   Needs a vocabulary decision (a test-command allowlist term), not a
   widened allowlist — and until then the description overstates the role.
3. **Four missing session records.** TASK-0041, 0042, 0046, 0047 have no
   `SESSION-*.md` and no owning `INDEX.md` row. Deliberately not
   reconstructed. The generalisable point: **`INDEX.md` row-count matching
   file-count proves nothing about coverage**, because a missing session is
   missing from both. Any future check should compare task IDs against the
   `Tasks` column, not count rows.
4. **ADR-0015 must be rewritten before it is next cited** (finding 8). Its
   `templates/` shape is contradicted by `install.sh:105` and by the
   component now shipping under it. ADR-0014 also still owes ratification.
   Both are S6's, parked — so this belongs to whatever unparks S6, not to a
   convenience fix.
5. **B-011 / TASK-0031 remains the highest-value undelivered item** from
   S6: the `gather_subset: "!mounts"` rule is documented and statically
   checkable, and still unenforced. The shipped `ansible-ops` skill states
   this rather than implying coverage.
6. **`prompts/` is still a 127-byte README.** S7 made `agents/` real and
   deliberately did not extend the treatment. Unchanged, and still needing
   its own justification rather than momentum.
7. **The `{tier:}` placeholder resolves nowhere** and permanently cannot
   here (ADR-0017 rejected, `models.jsonc` owned by another repo). Harmless
   — `model` is optional, no role uses it — and documented in three places.
   **Do not close it by adding a second mapping**; that is the two-owners
   defect ADR-0018 clause 7 exists to prevent.
8. **`worktree-only` is the weakest mapping in the vocabulary** — OpenCode
   refuses, Claude Code redirects into an isolated copy. All roles declare
   it. Re-examine it first if roles ever behave differently across clients.
