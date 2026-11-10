# TASK-0273 — Loops as invocable skills (P1.3)

## Status

- Status: planned
- Owner: agent
- Branch: agent/TASK-0273
- Created: 2026-11-10
- Updated: 2026-11-10
- Applies to: `loops/`, `scripts/sync-registry.sh`, `docs/registry.md`
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P1.3 (N3), no decision applies directly; the wrappers ship inside the skills plugin from TASK-0272; related: ADR-0004

## Objective

Make the five loop procedures one command away with thin wrappers that set `disable-model-invocation: true`, take an argument hint, and link to `loop.md` as the single source. A wrapper restates no rule.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `loops/<n>/loop.md`, five loops | no SKILL.md wrapper |
| `scripts/sync-registry.sh`, `docs/registry.md` | do not list wrappers |
| TASK-0272 | soft dependency: the skills plugin build the wrappers are added to; authoring can start any time |
| TASK-0274 | real dependency: the frontmatter linter must accept `disable-model-invocation` before a wrapper can pass `tests/validate.sh` |

## Scope

- In: five wrappers (`loops/<n>/SKILL.md` or `skills/run-<n>/`, decided against the existing skill layout) with `disable-model-invocation: true` and an argument hint; registry sync lists them; a validate check; adding the five wrappers to the skills plugin build from TASK-0272 (this task owns that, once the plugin build exists).
- Out: any change to a loop's rules; ports' handling of the key (TASK-0274).

## Likely files

- `loops/*/SKILL.md` or `skills/run-*/SKILL.md`
- `scripts/sync-registry.sh`
- `docs/registry.md`
- `scripts/build-plugin.py` (TASK-0272's, extended to include the wrappers)
- `tests/validate.sh`

## Execution plan

1. Add the validate check: five loop skills exist, each with `disable-model-invocation: true`, each links to `loop.md`, none restates a rule (a length and keyword guard). Run and see it fail.
2. Write the five wrappers.
3. Update `sync-registry.sh` and regenerate `docs/registry.md`.
4. Run the check green; delete a wrapper and see it fail; restore it.
5. Add the wrappers to the skills plugin build and check the plugin still counts 8 skills.
6. Run `tests/validate.sh`.

## Acceptance criteria

- [ ] Five loop skills exist with `disable-model-invocation: true` and link to `loop.md`
- [ ] The registry lists them
- [ ] Deleting a wrapper fails the validate check

## Mandatory validations

- [ ] tests/validate.sh

## Risks and rollback

- A wrapper can drift into a second copy of the rules; the length guard and the link requirement keep it thin.
- Skill count tests elsewhere (8 skills) must not count the wrappers; check `tests/test-install.sh`.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next:

## Execution log

- 2026-11-10 · agent/Sonnet 5.5 · brief written from the alignment plan; no work done yet
  - Evidence: none yet
  - Deviation: none
