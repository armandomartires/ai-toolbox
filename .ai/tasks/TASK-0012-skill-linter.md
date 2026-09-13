# TASK-0012 — Skill linter (frontmatter rules only)

## Objective
Close B-002. Enforce every skill-frontmatter rule that
`docs/development/authoring-guide.md` actually defines, so a
non-conforming skill fails a check instead of reaching a commit.

## Minimal context
B-002 was titled "Skill Linter (frontmatter + line budget)" and sat
`ready` for three sprints. On scoping it, the two halves turned out to be
very different propositions:

- **Frontmatter** is well-defined. `authoring-guide.md:4-5` lists required
  (`name`, `description`) and optional (`license`, `metadata.author`,
  `metadata.version`) keys; `:63-64` adds "must match the directory name"
  and "one line".
- **Line budget** is defined *nowhere*. No maximum, cap, or limit for
  `SKILL.md` exists in the authoring guide, any ADR, or `AGENTS.md`.
  Current files are 24 / 43 / 56 lines with no stated ceiling.

Today `validate.sh` only greps for the *presence* of `^name:` and
`^description:`. That misses: a `name` that disagrees with its directory
(the exact defect class that produced three template-leak regressions in
the registry), a multi-line `description`, and a malformed `version`.

## Scope
### Included
- Extend the skills block of `tests/validate.sh` to check:
  1. `name` present, and equal to the directory name (templates exempt —
     the existing MCP/loop checks already carry this carve-out).
  2. `description` present and a single line.
  3. `metadata.version`, **if present**, is semver.
  4. `license`, if present, is non-empty.
- ADR-0008 recording that the line-budget half was dropped, with reason.
- Update `docs/development/authoring-guide.md` to state that these rules
  are machine-enforced, so the guide and the gate cannot silently diverge.

### Not included
- Any `SKILL.md` length or size cap. Inventing a threshold is exactly what
  `AGENTS.md`'s ambiguity policy forbids; the human chose frontmatter-only.
- A separate linter script. `validate.sh` is already the mandatory gate
  and already runs pre-commit; a second entry point would be a second
  thing to remember to run.
- Reformatting existing skills. They must pass as-is, or the check is
  wrong.

## Preconditions
- Working tree clean; `tests/validate.sh` passing at HEAD.
- Sprint S4 open in `SPRINT-CURRENT.md`.

## Likely files
- `tests/validate.sh`
- `.ai/decisions/0008-skill-linter-frontmatter-only.md`
- `docs/development/authoring-guide.md`
- `.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`

## Execution plan
1. Parse frontmatter in `validate.sh` with `python3` (already a hard
   prerequisite for the MCP checks — no new dependency), not with `grep`,
   because "description is one line" is not a grep-shaped question.
2. Run against the three existing skills; all must pass unchanged.
3. Prove each rule fails: create a temporary fixture skill violating one
   rule at a time, confirm the specific expected message, remove it.
4. Confirm the fixture is gone by directory listing, not by trusting a
   clean `git status` — the lesson recorded in TASK-0009.
5. Write ADR-0008; update the authoring guide; close B-002.

## Acceptance criteria
- [x] All three existing skills pass with no edits to them.
- [x] A skill whose `name` differs from its directory fails.
- [x] A skill with a multi-line `description` fails.
- [x] A skill with `metadata.version: 1.0` (not semver) fails.
- [x] A skill missing `name` or `description` still fails (no regression).
- [x] `_template` is exempt from the name-matches-directory rule only,
      and still checked for everything else.
- [x] ADR-0008 states the line budget was dropped and why.
- [x] `validate.sh` stays offline and sub-second (0.318s measured).
- [x] No fixture files remain (verified by `ls skills/`).

## Mandatory validations
- [x] tests/validate.sh — OK
- [x] scripts/sync-registry.sh — ran; `docs/registry.md` unchanged, as
      expected for a task that adds no component

## Risks and rollback
- Risk: an over-strict semver regex rejects a legitimate pre-release
  version. Mitigation: accept the full `MAJOR.MINOR.PATCH` core with
  optional pre-release/build, and only check `version` when it is present.
- Risk: YAML quoting. `project-workflow` quotes its version (`"3.0.0"`),
  `project-migration` does not. Both must pass.
- Rollback: revert the single commit; the check is additive.

## Dependencies
None. Must land before TASK-0013 so the new `license` check exists before
a `LICENSE` file makes that claim meaningful.

## Expected result
`validate.sh` enforces the authoring guide's stated frontmatter rules;
B-002 closes with its scope reduction recorded rather than silently
dropped.

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
  - Replaced the two-line presence-only grep in `tests/validate.sh` with a
    `python3` frontmatter parser checking delimiters, `name` (incl.
    directory equality), single-line `description`, non-empty `license`,
    and semver `metadata.version`.
  - Moved the `python3` prerequisite check above the skills block, since
    that block now needs it too. No new dependency — it was already hard
    required by the MCP manifest checks.
  - Wrote ADR-0008; rewrote the authoring guide's Skills section as a rule
    table stating the rules are machine-enforced.
- Observations:
  - The line-budget half of B-002 had no threshold defined anywhere. Grep
    of the authoring guide, all ADRs, and `AGENTS.md` returned nothing.
    Dropped by human decision rather than invented; ADR-0008 records the
    precondition for adding one later.
  - YAML quoting differs across the two real skills — `project-workflow`
    quotes `"3.0.0"`, `project-migration` does not. The parser strips
    matching quotes so both pass; fixture 10 covers the quoted form.
  - The old check could not have caught a name/directory mismatch, which
    is the same defect class behind three template-leak regressions.
- Validation:
  - `tests/validate.sh` OK, 0.318s, offline.
  - Fails-when-reverted, 10 fixtures one rule at a time — each produced
    its specific expected message, nothing more:
    name mismatch; multi-line description (reported "spans 3 lines");
    `version: 1.0`; missing name; missing description; no frontmatter;
    unterminated frontmatter; empty license. Two must-pass cases: valid
    frontmatter with `2.1.0-rc.1`, and fully quoted values — both OK.
  - Fixture removal confirmed by `ls skills/` (project-migration,
    project-workflow, _template), per TASK-0009's lesson about not
    trusting a clean `git status` alone.
  - `scripts/sync-registry.sh` ran; registry unchanged.
- Result: success. B-002 closed with its scope reduction recorded.
- Commit: 8d20055
- Push: deferred to TASK-0015, which wires the remote (no remote existed
  at commit time; ADR-0007 makes this a recorded state, not a skipped step)
