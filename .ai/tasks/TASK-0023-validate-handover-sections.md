# TASK-0023 — validate.sh: detect missing or empty handover sections

## Objective
Add a check to `tests/validate.sh` that the task template still carries
both handover headings, and that task files numbered ≥ 0020 have non-empty
`## Inputs` and `## Outputs / handover` sections — labelled in its own
source as omission detection, not contract verification.

## Inputs
| Artifact | Produced by | Expected state |
|---|---|---|
| `.ai/templates/TASK.md` | **TASK-0022** | Restructured, headings final. **Read the headings from this file, not from ADR-0012's prose** — TASK-0022's plan step 2 permits a deviation on which sections merged, and its execution log records whether one happened. |
| `.ai/tasks/TASK-0022-*.md` execution log | TASK-0022 | Records any deviation from the planned merge. Must be read before writing the check. |
| `.ai/decisions/0012-handover-contract-resumability-invariant.md` | ADR-0012, this sprint | Decision 3 defines the check's scope, the `≥ 0020` boundary, and the limits on what it may claim. |
| `tests/validate.sh` | pre-existing, 373 lines | Passing, offline, ~0.375 s. **Does not read `.ai/` at all** — this task changes that, which ADR-0012's Consequences flags as a real scope change. |
| `.ai/tasks/TASK-0001…0019` | sprints S1–S4 | Lack the new sections by design. Must still pass after this change — they are the proof the boundary works. |
| `.ai/planning/SPRINT-CURRENT.md` standing constraints | S4 | Hermeticity, offline, sub-second are load-bearing. Never add a check needing an env var or the network. |

## Minimal context
An unenforced template section is the first thing to disappear under time
pressure, and its absence is silent. That is the regression class worth
catching.

What this check must **not** do is imply more than it proves. It can see
that a heading exists with content beneath it. It cannot see whether the
declared inputs are the real inputs. ADR-0009 already set this boundary
for the repo (validation checks documentation completeness, never runtime
presence), and `CURRENT_STATE.md:99-104` records the cost of getting it
wrong: a check that cannot fail is worse than none, because it is still
trusted. TASK-0017's corollary is the concrete version — the ansible
server reported all 10 tools with `WORKSPACE_ROOT` pointing at a
nonexistent path.

The `≥ 0020` boundary is a numeric constant, not an allowlist: an
allowlist needs an edit per new task and rots the first time someone
forgets.

## Scope
### Included
- A `validate.sh` check with two parts:
  1. `.ai/templates/TASK.md` contains both required headings.
  2. Every `.ai/tasks/TASK-####-*.md` with `#### >= 0020` has both
     headings, each with at least one non-whitespace, non-comment line
     beneath it.
- A source comment stating what the check does **and does not** prove, and
  why the boundary constant exists.
- Fails-when-reverted proof for every failure mode.

### Not included
- **Checking that inputs/outputs are accurate.** Not mechanically
  decidable; ADR-0012 Decision 3.
- **Checking `.ai/` beyond the task template and task files.** No ADR,
  plan, review, or session check. Scope creep into a governance linter is
  how a fast gate becomes a slow one.
- **Any network or environment dependency.** Standing constraint.
- **Adding this to `tests/smoke-mcp.sh`** or making the hook run anything
  new. The hook already runs `validate.sh`; that is the whole delivery
  mechanism.
- **Retrofitting old task files** so the boundary can be dropped.
  ADR-0012 Decision 4.
- Enforcing the *table* format of the sections. Content presence only —
  a check on markdown table shape would reject a legitimately prose
  handover and add nothing.

## Preconditions
- TASK-0022 done; headings final; its execution log read.
- Working tree clean; `tests/validate.sh` passing.

## Likely files
- `tests/validate.sh`
- possibly `AGENTS.md` (Commands section) and
  `.ai/context/CURRENT_STATE.md`'s "What `validate.sh` enforces" list,
  which enumerates every current check and would otherwise be stale

## Execution plan
1. Read TASK-0022's execution log and its finished template. Take the
   heading strings from the file.
2. Record the current `validate.sh` runtime as a baseline before editing,
   so the sub-second claim afterwards is a comparison and not an
   assertion.
3. Write the check. `python3` is already a declared prerequisite, so
   heading-and-body parsing does not need to be hand-rolled in grep — the
   same reasoning TASK-0012 used for frontmatter, where `grep -q '^name:'`
   looked reasonable and was useless.
4. Derive the task number from the filename with an explicit pattern;
   a file that does not match `TASK-####-` is skipped, not silently
   treated as `0000`.
5. Prove each failure mode, one at a time — five cases:
   - a task file ≥ 0020 with `## Inputs` deleted → fails
   - a task file ≥ 0020 with `## Inputs` present but empty → fails
   - the same with `## Outputs / handover` → fails
   - a heading removed from the template → fails
   - a file numbered 0019 with neither section → **passes** (the boundary
     works)
6. Check the error messages point the right way. TASK-0018 found a
   column-count hint that read correctly in one direction and misled in
   the other; a misleading hint costs the reader more than no hint.
7. Remove every fixture and verify by listing, not by memory — TASK-0018's
   habit.
8. Re-run and compare the timing against the baseline.
9. Update `CURRENT_STATE.md`'s enforcement list, which is otherwise now
   incomplete.

## Acceptance criteria
- [x] All five proof cases behave as listed, including the 0019 pass.
      **Seven were run** — two more than planned; see log.
- [x] Error messages name the file, the missing/empty section, and
      diagnose the right direction (missing vs. empty are distinct
      messages, verified separately).
- [x] The source comment states what the check does not prove.
- [x] The boundary constant (`FIRST_CONTRACT_TASK = 20`) is named and
      commented with its reason — historical records are not
      retrofitted — not just its value.
- [x] `validate.sh` stays offline and hermetic — `env -i` run passes; no
      network primitive anywhere in the file.
- [x] Runtime still sub-second: **~390 ms → ~455 ms** (3 runs each).
- [x] TASK-0001…0019 all pass, unmodified.
- [x] No fixture remains, verified by listing `.ai/tasks/` and by
      file-hash comparison of the two files temporarily mutated.
- [x] `CURRENT_STATE.md`'s enforcement list includes the new check **and
      its stated limit**.

## Mandatory validations
- [x] `tests/validate.sh` — baseline 393/398/381 ms; after
      447/451/469 ms
- [x] **Seven** fails-when-reverted cases, each with its actual output
      recorded in the log
- [x] `env -i /bin/bash -c '… bash tests/validate.sh'` — passes with the
      entire environment unset
- [x] `git status --short` — only `tests/validate.sh` modified; both
      temporarily-mutated files restored byte-identically (`Get-FileHash`)
- [x] `scripts/sync-registry.sh` — no diff

## Risks and rollback
- **Risk: a green gate read as "the handovers are good".** The check's
  real limitation, and social rather than technical. Mitigation: the
  limit is stated in the source comment, where a future reader hits it,
  and in ADR-0012's Consequences. This is `CURRENT_STATE.md` lesson 1
  applied before the fact rather than after.
- **Risk: the gate now fails on governance-only edits.** Deleting a
  heading from a task file can block a commit that touches no component.
  That is the intended catch, but it is new behaviour for a gate that has
  only ever policed `skills/`, `mcp-servers/`, `loops/` and `configs/`.
  Recorded in ADR-0012 rather than discovered later.
- **Risk: "non-empty" is looser than it looks.** A section containing only
  the template's own placeholder text would pass. Mitigation: skip
  blockquote and HTML-comment lines when deciding emptiness, and state
  plainly in the comment that placeholder *prose* is not detectable. Do
  not pretend otherwise.
- **Risk: the boundary silently stops applying** if a future task numbering
  scheme changes (e.g. sprint-prefixed `S005.T001`, which the skill's own
  scheme uses). Mitigation: files not matching the expected pattern are
  **reported as unrecognised, not skipped silently** — a skipped file is
  an unchecked file, and the repo's own rule is that a SKIP is not a pass.
- Rollback: the check is additive; revert the commit.

## Dependencies
TASK-0022 (final headings and any plan deviation), ADR-0012 (scope and
limits). Last task of sprint S5.

## Outputs / handover
| Artifact | End state |
|---|---|
| `tests/validate.sh` | 373 → 474 lines. One additional check: template headings + `≥ 0020` briefs, walked recursively so `completed/` cannot hide one. Offline, hermetic, ~455 ms. Source comment states what it does **not** prove and why the boundary exists. |
| `.ai/context/CURRENT_STATE.md` | Enforcement list includes the check **and its stated limit** — omission, not correctness. |
| `.ai/tasks/` | No fixture remains (listed); TASK-0001…0019 unmodified; two temporarily-mutated files restored byte-identically. |
| `docs/registry.md` | Unchanged. |

**Next task starts here**: **sprint S5 is complete** — all four tasks
done, the contract documented in the skill and enforced in this repo. The
next unit of work is `REVIEW-0007`, the S5 checkpoint.

It should assess one thing above all, and the evidence is already sitting
in these four task files: **the convention caught a real defect in every
single task that used it.**

- TASK-0020 — a handover note claiming the deployed copy was stale; it was
  a symlink.
- TASK-0021 — ADR-0012 claiming the skill's template had no output-shaped
  section; `Files touched` was one, so following the ADR created the
  duplication it forbids.
- TASK-0022 — PLAN-0002 specifying a four-section merge; measurement
  showed one section carried up to 82 lines of narrative a table would
  destroy.
- TASK-0023 — this task's own check silently exempting
  `.ai/tasks/completed/`, found by the fails-when-reverted proofs.

Four for four, each caught by the same step (*verify the declared state;
don't assume it*), and none by the check that now exists. **That is the
finding REVIEW-0007 should lead with**: the value delivered was the
verification discipline, not the enforcement. The check prevents a
regression class; it did not find any of these. A reviewer should ask
whether the sections were genuinely useful when picked up cold, or merely
filled in — and TASK-0021's inherited-but-unfailable checks are the
cautionary case, since they were *written* into a plan and would have been
performed and passed had nobody re-read them.

**Next task starts here**: sprint S5 is complete and its contract is both
documented and enforced. The next unit of work is the S5 review checkpoint
(`REVIEW-0007`), which should assess one thing above all: **whether the
handover sections in TASK-0020…0023 were actually useful when each task
was picked up, or merely filled in.** That is the only evidence that
distinguishes this convention from ceremony, and the check added here
cannot supply it — a human or a fresh session reading the files can.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13

## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode
- Actions:
  - Read TASK-0022's execution log and took the heading strings from
    `.ai/templates/TASK.md` itself, per its handover note 2. Confirmed
    `validate.sh` had never read `.ai/` before this change.
  - Recorded the baseline runtime over three runs *before* editing, so
    the sub-second claim afterwards is a comparison rather than an
    assertion.
  - Wrote the check in `python3` (already a declared prerequisite): the
    template must carry both headings, and every `TASK-####-*.md`
    numbered ≥ 20 must have both, non-empty.
  - Proved seven failure modes, then closed a gap the proofs exposed.
- Observations:
  - **The proofs found a real gap in my own check, which is the point of
    running them.** `.ai/tasks/completed/` exists (empty) and
    `.ai/README.md` documents it as a destination for task files. My
    first version used a flat `os.listdir()`, so **a brief could evade the
    check entirely by being archived**. Confirmed with a fixture: a
    `TASK-0099` with no handover sections passed while one level down.
    Switched to `os.walk()`; the same fixture then failed with a
    `completed/` path prefix. A check that can be disabled by moving a
    file is not a check — and this one would have been disabled by the
    repo's own documented archiving step.
  - **Case 7 is the proof that matters for the boundary.** Copying
    TASK-0019 to `TASK-0020-probe.md` — *identical content, only the
    number changed* — flipped the result from pass to fail. That
    demonstrates the boundary itself discriminates, rather than something
    incidental about old files' content. Testing only "0019 passes" would
    have been consistent with a check that never fires at all.
  - **Case 6 tests my own safeguard.** A future sprint-prefixed scheme
    (`S005.T001_Name.md`, which the skill's own task-ID scheme uses)
    would not match `TASK-####-`. Rather than skip silently — a skipped
    file is an unchecked file, and this repo's rule is that a SKIP is not
    a pass — it is reported as unverifiable. Verified with a fixture.
  - Placeholder handling is deliberately limited and stated as such:
    HTML comments, blockquotes and empty table separators are stripped
    before deciding emptiness, but a section containing the template's
    own *prose* placeholder would pass. That is not detectable, and the
    comment says so rather than implying otherwise.
  - Runtime grew ~65 ms (≈17%) for 24 small files. Still well sub-second,
    but this is the first check whose cost scales with `.ai/` rather than
    with the component count — worth watching if task briefs multiply.
  - The gate now fails on governance-only edits. ADR-0012 flagged this as
    a deliberate scope change; it is now live, not theoretical.
- Validation:
  - Baseline 393/398/381 ms → after 447/451/469 ms. Sub-second.
  - Seven cases, each run individually with the tree restored between:
    1. `## Inputs` renamed away in a ≥0020 brief → `missing '## Inputs'`
    2. `## Inputs` body emptied → `'## Inputs' is present but empty`
    3. `## Outputs / handover` body emptied → the matching empty message
    4. heading removed from the **template** →
       `templates/TASK.md: missing '## Outputs / handover'`
    5. **TASK-0019, real file, neither section → passes** (boundary)
    6. `S005.T001_FutureScheme.md` → reported as unverifiable, not
       skipped
    7. TASK-0019's content copied to `TASK-0020-probe.md` → fails on both
       sections, proving the number is what discriminates
  - Plus the gap case: `completed/TASK-0099-escapee.md` passed before the
    `os.walk()` fix and failed after.
  - `env -i` run — passes with the environment entirely unset.
  - No network primitive (`curl|wget|urllib|requests|ls-remote|npx|npm`)
    anywhere in `validate.sh`.
  - Fixtures: `.ai/tasks/` listed; only real briefs and `TODO.md`
    present. Both temporarily-mutated files restored byte-identically,
    verified by `Get-FileHash`, not by memory.
  - `scripts/sync-registry.sh` — no diff.
- Result: success. The handover contract is now enforced as omission
  detection, honestly labelled. The proofs found one real defect in the
  check itself (the `completed/` escape hatch) before it could ship.
- Commit: `7106f9c`
- Push: `origin master`, confirmed — local and
  `git ls-remote origin master` both `7106f9c`. Note the commit itself was
  gated by the new check via `.githooks/pre-commit`: the check ran against
  the tree containing it and passed, so it is live rather than merely
  written.
