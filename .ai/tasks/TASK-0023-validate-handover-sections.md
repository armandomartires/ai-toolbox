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
- [ ] All five proof cases behave as listed, including the 0019 pass.
- [ ] Error messages name the file, the missing/empty section, and
      diagnose the right direction (missing vs. empty are distinct).
- [ ] The source comment states what the check does not prove.
- [ ] The boundary constant is named and commented with its **reason**,
      not just its value.
- [ ] `validate.sh` stays offline and hermetic — passes with the entire
      environment unset and no network.
- [ ] Runtime still sub-second, stated as before/after numbers.
- [ ] TASK-0001…0019 all pass, unmodified.
- [ ] No fixture remains, verified by listing `.ai/tasks/`.
- [ ] `CURRENT_STATE.md`'s enforcement list includes the new check.

## Mandatory validations
- [ ] `tests/validate.sh` — before and after timings recorded
- [ ] Five fails-when-reverted cases, each described with its actual
      output, not summarised as "works"
- [ ] `env -i bash tests/validate.sh` (or equivalent) — proves
      hermeticity with the environment unset
- [ ] `git status --short .ai/tasks/` — no historical file modified, no
      fixture left behind
- [ ] `scripts/sync-registry.sh` — no diff

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
| `tests/validate.sh` | One additional check; offline, hermetic, sub-second; source comment stating its limits and the boundary's reason. |
| `.ai/context/CURRENT_STATE.md` | Enforcement list includes the new check. |
| `.ai/tasks/` | No fixture remains; TASK-0001…0019 unmodified. |

**Next task starts here**: sprint S5 is complete and its contract is both
documented and enforced. The next unit of work is the S5 review checkpoint
(`REVIEW-0007`), which should assess one thing above all: **whether the
handover sections in TASK-0020…0023 were actually useful when each task
was picked up, or merely filled in.** That is the only evidence that
distinguishes this convention from ceremony, and the check added here
cannot supply it — a human or a fresh session reading the files can.

## Status
- Status: planned   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13

## Execution log
### Attempt 1
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
