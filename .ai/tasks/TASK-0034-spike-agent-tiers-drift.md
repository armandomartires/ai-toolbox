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
- Status: done — **with a blocking finding; ADR-0017 must not be accepted as
  drafted.** Awaiting a human decision (see Escalation below).
- Owner: agent
- Created: 2026-09-15
- Updated: 2026-09-15

## Execution log
### Attempt 1
- Date: 2026-09-15
- Agent: opencode (claude-opus-5)

#### ESCALATION — the spike's premise is false, and the sprint inherited it

**`agent-tiers` is not unowned. It was deliberately kept by
`opencode-customization`, by an explicit user decision, on 2026-09-13.**

The evidence is that repo's own commit `9bae137`
(2026-09-13 19:50:49 +0200), whose message states:

> *"`agent-tiers` is **deliberately kept in this repo (user decision)** —
> confirmed OpenCode-specific by design (`docs/07.agent-hierarchy.md`'s own
> scope banner), a separate concern from `project-workflow`'s removal."*

Corroborated in two more places in that repo:
- `.ai/30.ROADMAP.md:45` — *"`S027_RemoveProjectWorkflow` | 2026-09-13 |
  Removed `project-workflow`/`/scaffold-ai-docs` — migrated to `ai-toolbox`.
  **`agent-tiers` stays, confirmed OpenCode-specific.**"*
- `.ai/30.ROADMAP.md:240` — Next-up item 1: *"**Revisit `agent-tiers` →
  `ai-toolbox`** if a concrete reason emerges (**not scheduled**)."*

And the cited basis is real: `docs/07.agent-hierarchy.md` opens with
*"**OpenCode-specific.** … Codex and Claude Code have different agent
models; a cross-harness version is explicitly deferred."*

**This inverts the framing S7 was planned on.** `PLAN-0004`, ADR-0017,
`CURRENT_STATE.md` and this brief all describe the skill as *"unowned"*,
*"orphaned"*, and an ADR-0004 omission — lesson 9's worked example (*"a
decision that handles one item from a list of two … produces an orphan"*).
**It is not an orphan. It is a deferral with a stated reason and a written
reopen trigger** — the exact shape ADR-0010 has and which this repo's own
lesson 9 says an orphan lacks.

The planning session read ADR-0004's quotation of that repo's *older*
roadmap (`S027` hands over "project-workflow (and agent-tiers)") and did not
re-read the roadmap as it stands **after** `S027` actually executed. The
parenthesis was real when written; it was superseded four days later by the
commit that closed that sprint.

**What this means concretely:**
- **ADR-0017 must not be accepted as drafted.** It would assert this repo's
  ownership of a component another repo has explicitly and recently decided
  to keep, on the strength of a premise now known false.
- **TASK-0035 (the import) is not merely blocked — its justification is
  gone.** Importing would create the second copy ADR-0004 exists to
  prevent, this time *against* the other repo's recorded decision rather
  than in fulfilment of it.
- **This repo has no standing to overrule that decision unilaterally.** Both
  repos are the same human's; the reopen trigger is *"if a concrete reason
  emerges"*. **ADR-0018 is arguably that concrete reason** — this repo now
  has an emitter, a schema and a gate for agent roles, which is a
  cross-harness capability that repo explicitly deferred. But invoking a
  reopen trigger in another repo is a **human decision**, not an agent's.

**Three options, for the human:**

1. **Drop the reclamation.** Mark ADR-0017 `Rejected` with this evidence,
   close TASK-0035 as superseded, and record that `agent-tiers` stays in
   `opencode-customization`. TASK-0045 then reconciles the four roles into
   `agents/` **by authoring them fresh against ADR-0018's contract**, citing
   the installed copy as a reference rather than importing it. Cost: the
   roles are re-derived; benefit: no cross-repo ownership fight and no
   second copy.
2. **Invoke the reopen trigger.** Decide that ADR-0018's per-client emitter
   *is* the concrete reason, and hand the skill over — which requires a
   corresponding change in `opencode-customization` (its roadmap, its
   docs, its removal of the skill), i.e. work in a repo S7 has declared out
   of scope. Cost: cross-repo coordination; benefit: one owner.
3. **Narrow the scope to the roles only.** Leave the *skill*
   (`install-tiers.ps1`, `fragments/`, `models.jsonc`, the PowerShell
   topology installer) with `opencode-customization`, and bring only the
   four **role definitions** into `agents/` under ADR-0018. The two are
   separable: the installer writes `opencode.jsonc` blocks, the roles are
   markdown files. Cost: the boundary needs stating; benefit: this repo
   takes the part its new plumbing actually serves and leaves the
   OpenCode-specific installer where it was deliberately kept.

**Recommendation: option 3**, with option 1 as the fallback. It is the only
one that respects the other repo's decision *and* uses Phase 2's plumbing,
and it needs no work in `opencode-customization`. It also matches ADR-0006's
established habit of scoping by capability rather than by repo boundary.
**Not decided here** — ADR-0017's disposition is a human call, and this
spike's job was to produce the evidence.

#### Steps 1–2 — before-state and the symlink trap
Recorded before touching anything:
- `git -C ~/AI_Workspaces/opencode-customization status --short` → **empty
  (clean)**; HEAD `f9f5e37`, branch `main`.
- The two trees are **genuinely distinct**, not the same directory reached
  twice: `readlink -f` gives
  `/home/armando.martires/.config/opencode/skills/agent-tiers` versus
  `/mnt/c/Users/armando.martires/AI Workspaces/opencode-customization/opencode/skills/agent-tiers`.
  The installed copy has an empty `LinkType` — a **real directory**, as the
  brief expected.

#### Step 3 — the differing set, measured not cited
`diff -rq` on 2026-09-15 reports **exactly the two files the brief
predicted**:
- `SKILL.md`
- `templates/bmad/docs/stories/README.md`

**One correction to the brief's Inputs table: the skill has 13 files, not
12.** Both trees have 13, so it does not affect the diff — but the count was
wrong and is the kind of number that gets restated.

#### Steps 4–5 — per-file diffs, newer side, and the consistency answer

**The newer side is CONSISTENT: the repo copy is newer for both files.**
So resolution is *pick a side*, not merge-per-file — the brief's flagged
deviation does **not** fire.

Basis, three independent signals agreeing:

| File | Installed mtime | Repo mtime | Repo-side commit | Newer |
|---|---|---|---|---|
| `SKILL.md` | 2026-08-24 23:47:36 | 2026-09-13 19:33:44 | `9bae137` | **repo** |
| `templates/bmad/docs/stories/README.md` | 2026-08-24 23:47:36 | 2026-09-13 19:34:02 | `9bae137` | **repo** |

Both files are **clean in git** on the repo side (`git status --short` on
that subtree is empty), so the repo content is committed, not a working-tree
scratch edit.

**Both changes come from the same commit, and both do the same thing:
remove `project-workflow` cross-references.**
- `SKILL.md`: the section `## Relationship to other skills in this repo`
  became `## Scope`, dropping three references to `project-workflow` and
  `.ai/00.CONVENTIONS.md`.
- `stories/README.md`: *"if this project also uses the `project-workflow`
  `.ai/` convention"* became *"if this project also has a sprint-prefixed
  task convention"* — the same de-coupling, generalised.

**The installed copy carries no unique fix.** This is the question the
spike existed to answer (*"if it carries a fix absent upstream, declaring
the repo copy canonical silently discards that fix"*). It does not: the
installed copy is simply **older**, predating `S027`. Nothing would be lost
by preferring the repo copy — which is now moot for import purposes, but
still the answer.

#### Step 6 — citations that would dangle after a move

The repo copy has **already removed three of the four** `SKILL.md` dangling
citations, as a side effect of `S027`. What remains, in **both** copies:

| File | Line | Citation | Dangles? |
|---|---|---|---|
| `SKILL.md` | 137 | *"matching this repo's `install-opencode.ps1` convention"* | **Yes** — no such file in `ai-toolbox` (verified absent) |
| `install-tiers.ps1` | 33 | `opencode/install-opencode.ps1`'s existing behavior | **Yes** |
| `install-tiers.ps1` | 405 | re-running `opencode/install-opencode.ps1` from the repo | **Yes** |
| `install-tiers.ps1` | 408 | `install-opencode.ps1`'s allowlist does not mirror back | **Yes** |
| `install-tiers.ps1` | 413 | same, **inside a runtime `Write-Warning` string** shown to the user | **Yes** |

So the dangling-citation surface is **five references across two files**,
four of them in `install-tiers.ps1` and one of those in text a user sees at
runtime. `models.jsonc` cites no ADR (the brief anticipated a possible
`decisions/0001-*` citation; there is none — that ADR is referenced from
that repo's *roadmap*, not from the skill).

**This materially supports option 3.** Every dangling citation is in the
*installer* half, not the *roles* half. The four `agents/*.md` files contain
**zero** cross-repo references — checked, they are self-contained.

#### Step 7 — model IDs re-verified against a live listing

`models.jsonc` claimed verification on **2026-08-19** (four weeks stale).
Re-verified **2026-09-15** against `opencode models` (506 lines).

`models.jsonc` declares five tiers but **four distinct IDs** — `analyst`
deliberately duplicates `coder`, documented in the file as intentional.

| ID | Tiers | Result |
|---|---|---|
| `perplexity-agent/anthropic/claude-opus-5` | `frontier` | **RESOLVES** |
| `perplexity-agent/anthropic/claude-sonnet-5` | `coder`, `analyst` | **RESOLVES** |
| `perplexity-agent/anthropic/claude-haiku-4-5` | `guarded` | **RESOLVES** |
| `perplexity-agent/openai/gpt-5.6-luna` | `cheap` | **RESOLVES** |

**All four resolve.** The four-week-old verification still holds; no stale
model ID would have been inherited. The brief's fallback (record it as
*unverifiable* if `opencode models` could not run) was not needed — the
command ran offline against the local provider catalogue.

#### Step 8 — `tier3.md` / `bmad.md` are client config, not skill content

**Recommendation: out of scope for any import.** Both are OpenCode
*command* files (`opencode/commands/`), each carrying OpenCode-native
frontmatter and a body whose first instruction is
`skill({ name: "agent-tiers" })` — they **invoke** the skill, they are not
part of it. They are the same class of artifact as a client wiring snippet.

Two supporting reasons:
- This repo has **no `commands/` category** and would acquire one silently.
  `AGENTS.md` names five component categories; `commands/` is not among
  them, and adding one deserves its own decision rather than arriving as
  import overspill.
- `skill()` invocation is OpenCode-specific, so a command file is
  single-client by construction — the same property that excluded dynamic
  workflows in ADR-0019.

- Actions:
  1. Recorded the before-state of `opencode-customization` (clean,
     `f9f5e37`, `main`).
  2. Proved the two trees are distinct paths via `readlink -f`.
  3. Re-ran `diff -rq`; confirmed the two-file differing set; corrected the
     file count to 13.
  4. Produced `diff -u` for both files; collected mtimes and
     `git log --follow` on the repo side.
  5. Determined the newer side per file and answered the consistency
     question.
  6. Grepped both copies plus every other skill file for cross-repo
     citations; verified `install-opencode.ps1` is absent from this repo.
  7. Re-verified all four distinct model IDs against a live listing.
  8. Read both command files and decided their scope.
  9. **Read that repo's commit `9bae137` and its roadmap** — which is where
     the blocking finding came from, and which was not in the brief's plan.
  10. Re-checked the after-state of both locations.

- Observations:
  - **The finding came from a step the brief did not ask for.** The plan
    covered diffing, mtimes, and `git log --follow` **on the two differing
    files**. It did not ask *why* they differ. Reading the commit message
    behind the drift is what surfaced the ownership decision — the drift and
    the decision have the same cause (`S027`), so investigating one
    necessarily reveals the other, but only if you read the commit rather
    than just its diff. **A `diff -u` answers "what changed"; the commit
    message answers "who decided what, and when".**
  - **Lesson 9 was misapplied by the planning session, and that is worth
    recording precisely.** Lesson 9 says a decision handling one of two
    items without saying why produces an orphan. ADR-0004 *did* look like
    that. But the other repo subsequently supplied the missing half —
    reason, scope banner, and a reopen trigger — so the orphan was closed
    **elsewhere**, four days later, and this repo never re-read the source
    it had quoted. **Lesson 7 (a claim decays between being written and
    being acted on) outranked lesson 9 here**, and the decayed claim was a
    quotation of an *external* document, which CURRENT_STATE already flags
    as the faster-decaying class.
  - **`CURRENT_STATE.md`'s S7 section states this as fact in three places**
    (*"unowned"*, *"deployed but unowned — the only component on this
    machine in that state"*, and B-014's framing). Those need correcting
    whichever option the human picks, so the repo does not keep restating a
    false premise — the exact pattern TASK-0019 was written about.
  - **The installed copy is still the live one and still a real directory**,
    so nothing about the current machine state changed or needs to change
    until the disposition is decided.

- Validation:
  - `bash tests/validate.sh` → **PASS** (`validate.sh: OK`, exit 0). This
    task edits only its own brief.
  - `scripts/sync-registry.sh` → **not run; not applicable.** No component
    added or changed.
  - **`opencode-customization` byte-identical**: `git status --short` empty
    before and after; HEAD `f9f5e37` unchanged. Never written to;
    `install-tiers.ps1` never executed, not even with `-WhatIf`.
  - **`~/.config/opencode/` unmodified**: the installed skill is still a
    real directory with `SKILL.md` mtime 2026-08-24 23:47:36;
    `opencode.jsonc` mtime still 2026-08-24 23:48:09 with **no `agent`
    key**.
  - **No secret material read, copied or printed.**

- Result: **done as a spike — every acceptance criterion met — but its
  headline output is a blocking finding rather than the expected drift
  resolution.**

  The drift question itself is fully answered: **two files differ, the repo
  copy is newer for both, consistently, from one commit, and the installed
  copy carries no unique fix.** All four model IDs still resolve. Five
  dangling citations exist, all in the installer half. The two slash
  commands are client config and out of scope.

  **But ADR-0017 cannot be written as drafted, because the premise it rests
  on — that `agent-tiers` is unowned — is false.** The other repo kept it
  deliberately, with a stated reason and an unpulled reopen trigger, on
  2026-09-13. Three options are laid out above with a recommendation
  (**option 3**: bring the four roles into `agents/` under ADR-0018, leave
  the PowerShell installer where it was deliberately kept). **The choice is
  the human's**, and TASK-0035 should not start until it is made.
- Commit: recorded below
- Push: recorded below
