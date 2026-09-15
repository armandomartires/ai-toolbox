# TASK-0034 — Spike: inventory the agent-tiers drift and decide what survives

## Objective
Establish what ADR-0017 cannot be written without: **which side of each
differing file is newer, and why.** Two files differ between the installed
copy of `agent-tiers` and its source repo while both trees declare
`metadata.version: "1.0.0"`.

This is a **spike**: it produces evidence and a resolution recommendation,
not a component. It writes nothing to either location.

## Minimal context

### Why this is a numbered task and not a `SPIKE-####` file
`tests/validate.sh:456-463` reports a **failure** for any file in
`.ai/tasks/` whose name does not match `TASK-####-*.md`, deliberately, so
that a renaming scheme cannot silently disable the handover check. Weakening
the gate to accommodate a naming preference is the wrong trade. S6
established this precedent for TASK-0027 and TASK-0028.

### Why the drift exists at all
ADR-0004's own Context quotes `opencode-customization`'s roadmap: *"`S027`
hands `project-workflow` (and `agent-tiers`) to `ai-toolbox` permanently."*
The parenthesis was in the source text. ADR-0004 then executed the handover
for `project-workflow` alone and said nothing about the second skill.

So `agent-tiers` has been unowned since 2026-09-13 — not decided against,
and with no reopen trigger of the kind ADR-0010 carries. **A decision that
handles one item from a list of two, without saying why the second was left,
produces an orphan rather than a deferral.**

### Why "resolve the drift" has no content yet
`diff -rq` reports two differing files:

- `SKILL.md`
- `templates/bmad/docs/stories/README.md`

`diff -rq` compares bytes and says *whether* files differ, not *how*. The
naive resolution — "this repo's copy becomes canonical" — is what ADR-0004
did for `project-workflow`, and it is probably right again. But the
installed copy is the one that has been in live use, and if it carries a fix
absent upstream, declaring the repo copy canonical **silently discards
that fix**. That is the whole reason this spike exists before the ADR.

### The trap in how the installed copy is stored
`project-migration` and `project-workflow` are **symlinks** into this repo
in both `~/.config/opencode/skills/` and `~/.claude/skills/`.
`agent-tiers` is a **real directory** in `~/.config/opencode/skills/`.

`install.sh:100-103` handles this case deliberately: it announces a
`NOTICE` and `rm -rf`s a pre-existing real directory before linking,
because *"`ln -sfn` against a real directory silently creates the link
inside it, leaving the stale skill in place and reporting success."*

So the import in TASK-0035 will **delete the installed copy**. Anything
unique to it must be captured *here*, before that happens. This spike is
the only opportunity.

### A four-week-old verification this repo would inherit
`models.jsonc`'s header states that every model ID *"MUST resolve via
`opencode models` before being committed"* and records verification against
a live listing on **2026-08-19** — four weeks stale. Whether the five IDs
still resolve is unknown, and inheriting the file inherits the obligation.
Worth checking here because it is cheap now and becomes a defect later.

### What is not in question
The skill has real substance: a deterministic idempotent installer, a
commented tier→model mapping with its deviations justified, four
permission-enforced role definitions, and a documented reason why
`plan`/`build` must be inline config overrides rather than markdown files
(a markdown agent body *replaces* an OpenCode built-in's tuned system prompt
wholesale). This is a reclamation, not an evaluation of whether the skill is
worth having.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `~/.config/opencode/skills/agent-tiers/` | `opencode-customization` (installed copy) | A **real directory**, 12 files, `metadata.version: "1.0.0"`. In live use since 2026-08-24 |
| `~/AI_Workspaces/opencode-customization/opencode/skills/agent-tiers/` | that repo, at `f9f5e37` | Same 12 filenames, **two differing in content**, also `"1.0.0"` |
| `~/AI_Workspaces/opencode-customization/.ai/decisions/0001-agent-tier-model-assignment.md` | that repo | Pre-existing; a candidate dangling citation the skill may reference |
| `~/AI_Workspaces/opencode-customization/opencode/commands/{tier3,bmad}.md` | that repo | The two slash commands that invoke `install-tiers.ps1`. **Not skill files** — decide whether they are in scope for the import |
| `~/.config/opencode/opencode.jsonc` | pre-existing (live config) | 20 KB; `shell`, `plugin`, `mcp`, `provider` keys; **no `agent` key** |
| `.ai/decisions/0004-project-workflow-canonical-source.md` | TASK-0003's sprint | 85 lines; the ownership precedent this spike's ADR mirrors |
| `.ai/decisions/0017-ai-toolbox-owns-agent-tiers.md` | TASK-0033 | **Proposed**, body largely "to be completed after TASK-0034" |
| `scripts/install.sh` | pre-existing | 147 lines; `:100-103` is the real-directory replacement; `:36-39` the `CLIENTS` block |
| `git -C ~/AI_Workspaces/opencode-customization status` | pre-existing | Must be recorded before and after; that repo is **not to be modified** |

**Verify the expected state; don't assume it.** Re-run `diff -rq` rather
than trusting the two-file claim above — it was measured on 2026-09-15 and
either tree may have changed. Also confirm `~/AI_Workspaces` is still the
symlink to `/mnt/c/Users/armando.martires/AI Workspaces/`, since the two
paths are the same tree and a diff between them would be meaningless.

## Scope

### Included
- Re-run `diff -rq` across both trees; record the current differing set.
- For each differing file, produce a **content diff** and determine which
  side is newer, using file mtimes, that repo's git log for its copy, and
  the content itself.
- Check whether either copy is newer than the other **inconsistently** —
  i.e. one file newer here, another newer there. That is the interesting
  and worst case, and it decides whether resolution is "pick a side" or
  "merge per file".
- Grep both `SKILL.md` copies for citations that would dangle once the
  skill moves: references to `opencode-customization`, its ADR numbers, its
  paths, or its `.ai/` layout. ADR-0004 had to fix exactly this class for
  `project-workflow`.
- Verify the five model IDs in `models.jsonc` against a live
  `opencode models` listing; record which resolve and which do not.
- Record whether the two slash commands (`tier3.md`, `bmad.md`) are part of
  the skill or part of that repo's client config, and recommend whether the
  import includes them. They live outside the skill directory, so this is a
  genuine scope question rather than an oversight.
- Recommend the drift resolution for ADR-0017, per file, with reasoning.

### Not included
- **Any write to `opencode-customization`.** Verify with `git status`
  there before and after.
- **Any write to `~/.config/opencode/`.** Including the live
  `opencode.jsonc`. Switching the topology on is explicitly out of S7's
  scope and needs its own task and authorization.
- **The import itself.** TASK-0035, gated on ADR-0017.
- **Accepting ADR-0017.** This spike feeds it; the human accepts it.
- Evaluating whether the four roles are the *right* roles. TASK-0045
  reconciles them under ADR-0018's contract; this spike is about ownership
  and drift only.
- Running `install-tiers.ps1` in any mode, including `-WhatIf`. It writes
  config; a spike must not.

## Likely files
- `.ai/tasks/TASK-0034-spike-agent-tiers-drift.md` — this file's execution
  log carries the findings
- Possibly a short evidence file under `.ai/` if the diffs are too long for
  the log; decide at execution time rather than pre-creating one
- Nothing else. This task writes no component and no config.

## Execution plan
1. `git -C ~/AI_Workspaces/opencode-customization status --short` and
   `log --oneline -1`; record verbatim as the before-state.
2. Confirm the two trees are genuinely distinct paths (not both reached via
   the `~/AI_Workspaces` symlink into the same directory).
3. `diff -rq` both trees; record the differing set. Compare against the
   expected two files and note any change.
4. For each differing file: full `diff -u`, plus mtimes on the installed
   copy and `git log --follow` on the repo copy.
5. Decide per file which side is newer and why. Flag explicitly if the
   direction is **inconsistent** across files.
6. Grep both `SKILL.md` copies for `opencode-customization`, `ADR-`,
   `.ai/`, and any absolute path; list every citation that would dangle
   after the move.
7. Run `opencode models` and check the five IDs from `models.jsonc`
   (`frontier`, `coder`, `analyst`, `guarded`, `cheap`). Record which
   resolve.
8. Inspect `tier3.md` and `bmad.md`; decide and record whether they are
   skill content or client config.
9. Write the per-file resolution recommendation for ADR-0017.
10. `git -C ~/AI_Workspaces/opencode-customization status --short` again;
    confirm byte-identical to step 1.
11. Confirm `~/.config/opencode/skills/agent-tiers/` is still a real
    directory and unmodified.
12. `bash tests/validate.sh` in `ai-toolbox` — this task edits only its own
    brief, so the gate should be green throughout.

## Acceptance criteria
- [ ] The current differing set is recorded, measured rather than cited
- [ ] Each differing file has a content diff and a newer-side determination
      **with its basis stated** (mtime, git log, or content)
- [ ] Whether the newer side is **consistent across files** is answered
      explicitly — it decides pick-a-side vs merge-per-file
- [ ] Every citation in `SKILL.md` that would dangle after the move is
      listed, so ADR-0017 clause 1 has a concrete target list
- [ ] The five model IDs are checked against a live `opencode models`
      listing, with the date recorded, and the result stated per ID
- [ ] A recommendation on whether `tier3.md`/`bmad.md` are in scope for the
      import, with reasoning
- [ ] A per-file drift resolution recommendation sufficient for ADR-0017 to
      cite
- [ ] `git status` in `opencode-customization` byte-identical before and
      after
- [ ] `~/.config/opencode/` unmodified; no `agent` key added to
      `opencode.jsonc`
- [ ] No secret material read, copied, or printed

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — **not expected**;
      this task adds no component

## Risks and rollback
- **Risk: the two trees are the same directory.** `~/AI_Workspaces` is a
  symlink to `/mnt/c/Users/armando.martires/AI Workspaces/`, and the
  installed skill is a real directory rather than a link — but confirming
  this rather than assuming it costs one command, and a diff between a path
  and itself would report "identical" and be read as "no drift". Step 2.
- **Risk: reading `diff -rq` as the whole answer.** It reports *that* files
  differ. A resolution needs to know *what* differs and which side is newer,
  which is the entire point of this spike.
- **Risk: accidentally writing to the other repo.** Read-only tools only;
  never run `install-tiers.ps1`, not even `-WhatIf`; verify with
  `git status` afterwards.
- **Risk: mtimes are unreliable on this mount.** This is a `/mnt/c` 9p
  checkout with `core.filemode=false`, where file metadata already behaves
  unusually (every file reports `rwxrwxrwx`). Treat mtime as one signal and
  prefer git history and content reasoning where they disagree.
- **Risk: `opencode models` requires network or a provider credential.** If
  it cannot run, record that the verification could **not** be performed
  rather than assuming the IDs are fine. An unverifiable claim recorded as
  unverified is correct; recorded as verified is the defect this repo keeps
  paying for.
- **Rollback:** nothing to roll back. The only committed change is this
  brief's execution log.

## Outputs / handover

**Intended end state — this task has not run.** The table below is a plan.
`validate.sh` requires this section non-empty for briefs ≥ 0020 and cannot
distinguish an intention from a state (ADR-0012 Decision 3), so this
sentence does it.

| Artifact | Intended end state |
|----------|-------------------|
| This brief's execution log | Current differing set; per-file diff and newer-side determination with basis; consistency answer; dangling-citation list; per-ID model verification with date; slash-command scope recommendation; per-file resolution recommendation |
| `~/.config/opencode/skills/agent-tiers/` | **Unmodified.** Still a real directory, still the live copy |
| `opencode-customization` | **Byte-identical to before**, proven by `git status` twice |
| `~/.config/opencode/opencode.jsonc` | **Unmodified.** Still no `agent` key |
| ADR-0017 | Unblocked: its "to be completed after TASK-0034" sections have concrete evidence to be written against |

**Next task starts here**: ADR-0017 can be written and accepted against an
observed drift resolution rather than an assumed one, and TASK-0035 knows
exactly which content survives the import and which citations it must
rewrite to make the skill self-contained.

Deviation to watch for: **if the newer side is inconsistent across the two
files**, ADR-0017's expected "this repo's copy becomes canonical" is wrong
as written, and the resolution becomes per-file rather than
pick-a-side. Record that plainly — TASK-0035 is scoped against the
recommendation, not against a free choice. Second deviation: if
`tier3.md`/`bmad.md` turn out to be in scope, TASK-0035's file count grows
and this repo acquires a `commands/` question it does not currently have,
which would need its own decision rather than being absorbed silently.

## Status
- Status: planned
- Owner: agent
- Created: 2026-09-15
- Updated: 2026-09-15

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
