# TASK-0035 — Import agent-tiers into this repo as its canonical home

## Objective
Execute ADR-0017: bring `agent-tiers` into `skills/agent-tiers/`, resolve
the drift per TASK-0034's recommendation, make the skill self-contained,
bump its version, and replace the installed real directory with a symlink so
the drift cannot recur.

## Minimal context

### What this closes
`agent-tiers` has been unowned since 2026-09-13, when ADR-0004 handed over
`project-workflow` alone from a roadmap item that named both skills. The
consequences are all now observable: two files differ between the installed
copy and its source while both declare `"1.0.0"`; the installed copy is a
real directory rather than a symlink; and the topology has never been
applied to the live config.

### Why the version bump is not cosmetic
ADR-0003's semver rule, applied by ADR-0004: *"The version is bumped… the
moment content changes here, so `2.1.0` stops meaning three different
things across three locations."* The same reasoning applies to `1.0.0`
meaning two things across two locations. Resolving the drift **is** a
content change, so the bump is mandatory, not optional.

The new number depends on TASK-0034's finding. If the resolution discards
content from either side, that is a breaking change to the skill's surface
for whoever relied on it. `docs/development/authoring-guide.md` requires an
ADR for interface-breaking changes — ADR-0017 is that ADR, so the bump can
be major without a second decision.

### The replacement is destructive, and authorized
`install.sh:100-103` will `rm -rf` the installed real directory before
linking, announcing a `NOTICE` first. That code exists because *"`ln -sfn`
against a real directory silently creates the link inside it, leaving the
stale skill in place and reporting success."*

`AGENTS.md` requires explicit human authorization in the task file for
deletions and overwrites. **Authorization: the human's decision of
2026-09-15 to adopt one-source-per-client emission and to reclaim
`agent-tiers` (PLAN-0004, "Human decisions required"), which necessarily
entails this repo owning the single editable copy.** The deletion is of a
*copy* whose unique content TASK-0034 has already captured — that capture
is the precondition, and this task must verify it happened rather than
assume it.

### Why the installed copy's content had to be captured first
TASK-0034 exists specifically because this task destroys the installed
copy. If TASK-0034 has not run, or its findings do not name a resolution
per differing file, **this task must stop rather than proceed on a guess.**

### What "self-contained" means here
ADR-0004 had to rewrite `project-workflow` because it cited
`opencode-customization`'s private ADR numbers (0005, 0006, 0017) — *"a
skill that ships standalone into arbitrary target projects cannot cite
another repo's private decision numbers as its mechanism's authority."*

`agent-tiers`' `SKILL.md` has a known instance of the same class: a
"Relationship to other skills in this repo" section written from the *other*
repo's perspective, which becomes false the moment the skill moves.
TASK-0034 produces the full list.

### What this task deliberately does not do
It does not switch the topology on. Reclaiming the skill and applying an
`agent` block to the live `~/.config/opencode/opencode.jsonc` are different
acts; the second changes machine configuration and is out of S7's scope.
The skill will therefore be *owned and deployed* while still *unexercised* —
recorded as a limitation under ADR-0010's treatment, not hidden.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/decisions/0017-ai-toolbox-owns-agent-tiers.md` | TASK-0033, completed by TASK-0034 | **Accepted** by the human, with a per-file drift resolution and a dangling-citation target list |
| `.ai/tasks/TASK-0034-spike-agent-tiers-drift.md` | TASK-0034 | `done`; execution log carries the differing set, newer-side determinations, citation list, model-ID verification, and the slash-command scope call |
| `~/.config/opencode/skills/agent-tiers/` | `opencode-customization` | Still a real directory, 12 files, unmodified by TASK-0034 |
| `~/AI_Workspaces/opencode-customization/opencode/skills/agent-tiers/` | that repo | Unmodified; the other side of the drift |
| `skills/_template/` | pre-existing | The skill shape to conform to: `SKILL.md` + optional `assets/`, `references/`, `scripts/` |
| `skills/project-workflow/SKILL.md` | TASK-0021 | `3.2.0`; the exemplar for a self-contained skill that names its sibling (ADR-0013) |
| `scripts/install.sh` | pre-existing | 147 lines; `:100-103` real-directory replacement; `:92-95` requires `SKILL.md` and skips `_template*` |
| `scripts/sync-registry.sh` | pre-existing | Will pick up a third skill automatically via `emit_section "Skills"` |
| `tests/validate.sh` | pre-existing | Enforces ADR-0003's five frontmatter rules: `name`↔directory, single-line `description`, non-empty `license` if present, semver `metadata.version` |
| `docs/registry.md` | generated | Currently 2 skills; must become 3 |

**Verify the expected state; don't assume it.** Specifically: confirm
ADR-0017 is `Accepted` and not still `Proposed`, and confirm TASK-0034's log
actually names a resolution per differing file. **If either is untrue, stop
and escalate** — this task destroys a copy and must not run on a guess.

## Scope

### Included
- Create `skills/agent-tiers/` from the resolved content, conforming to
  `skills/_template/`'s shape.
- Apply TASK-0034's per-file drift resolution, recording in the execution
  log which side won for each file and why.
- Rewrite every dangling citation from TASK-0034's list so the skill is
  self-contained: no reference to `opencode-customization`'s ADR numbers,
  paths, or `.ai/` layout.
- Rewrite the "Relationship to other skills" section from *this* repo's
  perspective, naming `project-workflow` and `project-migration` and
  referencing ADR-0013's divergence.
- Bump `metadata.version` per ADR-0003's semver rule.
- Run `scripts/install.sh link` and observe the `NOTICE` and replacement;
  confirm the installed path is afterwards a **symlink** into this repo.
- Regenerate `docs/registry.md`; confirm three skills, no `_template` row.
- Record, as a limitation, that the topology remains unapplied.

### Not included
- **Switching the topology on.** No `agent` key added to any
  `opencode.jsonc`, project or global. Out of S7's scope.
- **Running `install-tiers.ps1`** in any mode, including `-WhatIf`.
- **Any write to `opencode-customization`**, including retiring its copy.
  ADR-0017 clause 3 leaves that as that repo's own task — a real,
  acknowledged gap, exactly as ADR-0004 left one.
- **Reconciling the four role definitions into `agents/`.** TASK-0045,
  gated on ADR-0018 and TASK-0040.
- **Re-verifying the model IDs.** TASK-0034 does that; this task records
  the result and, if any ID failed, notes it as inherited debt rather than
  fixing it here.
- Deploying to Claude Code's skills directory beyond what `install.sh`
  already does for every skill.

## Likely files
- `skills/agent-tiers/SKILL.md`
- `skills/agent-tiers/models.jsonc`
- `skills/agent-tiers/install-tiers.ps1`
- `skills/agent-tiers/agents/{git-ops,shell-runner,qa-test,review}.md`
- `skills/agent-tiers/fragments/opencode.{tier3,bmad}.jsonc`
- `skills/agent-tiers/templates/bmad/bmad-workflow.md`
- `skills/agent-tiers/templates/bmad/docs/{stories,specs,qa}/README.md`
- `docs/registry.md` — regenerated
- `.ai/tasks/TASK-0035-import-agent-tiers.md` — this file
- Possibly `skills/agent-tiers/commands/` **if** TASK-0034 recommended
  including `tier3.md`/`bmad.md`. Deliberately left conditional: this is a
  forecast, and if the two disagree at the end that is a finding.

## Execution plan
1. Confirm ADR-0017 is `Accepted` and TASK-0034 is `done` with a per-file
   resolution. **Stop and escalate if not.**
2. `git status --short` in `ai-toolbox` (expect clean) and in
   `opencode-customization` (record as before-state).
3. Copy the resolved content into `skills/agent-tiers/`, applying the
   per-file resolution. Record each choice.
4. Rewrite the dangling citations from TASK-0034's list. Grep afterwards for
   `opencode-customization`, `ADR-00`, and absolute paths to confirm none
   remain.
5. Rewrite the "Relationship to other skills" section for this repo.
6. Bump `metadata.version`; confirm it is semver and quoted per ADR-0003.
7. `bash tests/validate.sh` — expect the five skill frontmatter rules to
   pass for the new skill, including `name` equal to the directory.
8. `bash scripts/sync-registry.sh`; confirm `docs/registry.md` lists three
   skills and no `_template` row.
9. `bash scripts/install.sh link` — **observe** the `NOTICE` for the
   pre-existing real directory. Do not suppress it.
10. Confirm `~/.config/opencode/skills/agent-tiers` is now a symlink
    (`ls -ld`) pointing into this repo, and that `~/.claude/skills/` got the
    same treatment.
11. Confirm `~/.config/opencode/opencode.jsonc` still has **no `agent`
    key** — the import must not have switched anything on.
12. `git status --short` in `opencode-customization`; confirm byte-identical
    to step 2.
13. Review `git diff`; scan for secrets — `models.jsonc` carries provider
    model IDs, which are not secrets, but confirm no token or key came
    across.
14. Commit; record the hash; push; confirm by re-fetch; record the result.

## Acceptance criteria
- [ ] `skills/agent-tiers/SKILL.md` passes every ADR-0003 frontmatter rule;
      **no size budget is invented** (ADR-0008)
- [ ] `name` in the frontmatter equals the directory name, since it
      determines the install path
- [ ] The per-file drift resolution is applied and **each choice recorded
      with its reason** in the execution log
- [ ] Zero citations remain to `opencode-customization`'s ADR numbers,
      paths, or `.ai/` layout — verified by grep, not by inspection
- [ ] The "Relationship to other skills" section is written from this
      repo's perspective and references ADR-0013
- [ ] `metadata.version` bumped, quoted, semver
- [ ] `docs/registry.md` lists **three** skills, regenerated not
      hand-edited, with no `_template*` row
- [ ] `install.sh link` **observed** printing the `NOTICE` and replacing the
      real directory
- [ ] `~/.config/opencode/skills/agent-tiers` and
      `~/.claude/skills/agent-tiers` are both **symlinks** into this repo
- [ ] `~/.config/opencode/opencode.jsonc` still has no `agent` key
- [ ] `git status` in `opencode-customization` byte-identical before and
      after
- [ ] The unapplied-topology limitation is recorded in the execution log
- [ ] `tests/validate.sh` green

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — **required**; this
      task adds a component, so the regenerated registry must be committed

## Risks and rollback
- **Risk: proceeding without TASK-0034.** This task deletes the installed
  copy. Step 1 is a hard gate, and the correct action on a missing input is
  to stop, not to re-derive the resolution inline under time pressure.
- **Risk: `ln -sfn` into a real directory.** The exact trap
  `install.sh:100-103` was written for. Do not work around the `NOTICE` by
  removing the directory manually first — running the script as written is
  what proves the mechanism handles this case.
- **Risk: `core.filemode=false` on this checkout.** `install-tiers.ps1`
  ships executable-ish; if any script in the skill needs the executable bit,
  `chmod +x` will **not** work here. Use
  `git update-index --chmod=+x`, as `docs/operations/runbook.md` documents
  for `.githooks/pre-commit`.
- **Risk: silently inheriting a stale model verification.** If TASK-0034
  found an ID that no longer resolves, importing the file as-is ships a
  known-broken default. Record it as inherited debt with a backlog item
  rather than either fixing it here (out of scope) or ignoring it.
- **Risk: the skill's own maintenance instructions become wrong.**
  `SKILL.md`'s "Maintaining this skill" section tells the reader how to add
  a tier or an agent, and it currently assumes that repo's layout. It must
  be checked, not just the obvious relationship section.
- **Risk: reading a green `install.sh` as proof of deployment.** TASK-0017's
  lesson: the ansible server connected and enumerated all ten tools with
  `WORKSPACE_ROOT` pointing at a nonexistent path. Verify the symlink with
  `ls -ld`, not by the script exiting 0.
- **Rollback:** `git revert` the commit restores the repo. The *installed*
  copy is not restored by that — it will be a dangling symlink into a
  removed directory. Recovery is `git revert` then re-run
  `scripts/install.sh link`, or restore the original from
  `opencode-customization`'s tree, which is untouched throughout and is the
  real safety net for this task.

## Outputs / handover

**Intended end state — this task has not run.** The table below is a plan.
`validate.sh` requires this section non-empty for briefs ≥ 0020 and cannot
distinguish an intention from a state (ADR-0012 Decision 3), so this
sentence does it.

| Artifact | Intended end state |
|----------|-------------------|
| `skills/agent-tiers/` | Third skill in this repo; drift resolved with each choice recorded; self-contained, no dangling citations; `metadata.version` bumped |
| `docs/registry.md` | Regenerated; three skills; no `_template*` row |
| `~/.config/opencode/skills/agent-tiers` | A **symlink** into this repo, replacing the real directory. The `NOTICE` observed, not assumed |
| `~/.claude/skills/agent-tiers` | A symlink into this repo (new — Claude Code did not have this skill) |
| `~/.config/opencode/opencode.jsonc` | **Unchanged.** Still no `agent` key; the topology remains unapplied, recorded as a limitation |
| `opencode-customization` | **Untouched**, left with a stale copy and no task to retire it — a real acknowledged gap per ADR-0017 clause 3 |
| Model-ID verification | Result recorded; any failure logged as inherited debt with a new backlog item, not fixed here |

**Next task starts here**: this repo owns three skills, there is one
editable copy of `agent-tiers`, and TASK-0044 can derive
`loops/project-build/` from `skills/agent-tiers/templates/bmad/bmad-workflow.md`
at a path inside this repo rather than from another repo's tree.

Deviation to watch for: if TASK-0034's resolution turns out to be per-file
rather than pick-a-side, the version bump's size changes and the execution
log must justify the number chosen. If the slash commands came into scope,
this repo acquires a `commands/` question it does not currently have — that
needs its own decision, recorded here and escalated, never absorbed
silently.

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
