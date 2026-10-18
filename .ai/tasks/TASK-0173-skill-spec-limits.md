# TASK-0173 — Gate the Agent Skills spec's length and name limits

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-18
- Updated: 2026-10-18
- Applies to: `skills/project-workflow/SKILL.md`, `tests/validate.sh`, `docs/development/authoring-guide.md`
- Source: human request 2026-10-18 (correction 1 of the review against current practice)

## Objective

`project-workflow`'s `description` is 1062 characters, over the Agent Skills spec's 1024, and the gate cannot see it: it checks presence and one line, not length. State the spec's limits in the authoring guide, gate them, and trim the description, so that no skill this repo deploys breaks the spec unnoticed.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| Agent Skills spec (`agentskills.io/specification`) | `name` 1–64, `[a-z0-9-]`, no leading, trailing or `--` hyphen; `description` 1–1024; `compatibility` 1–500 if present. Re-read at execution |
| `tests/validate.sh` skill linter | checks delimiters, name = directory, description present and single-line, semver; no length or charset |
| `authoring-guide.md` *Skills* table | states no limit; the gate enforces only what this table states (`ADR-0008`) |
| `project-workflow` | 7.1.0; description 1062 characters, the only skill over the limit (next: `vault-secrets`, 829) |

## Scope

- In: the guide's frontmatter rows; the three checks in the skill linter; a trimmed `project-workflow` description, 7.1.1; the regenerated registry.
- Out: agent and loop descriptions (the spec is for skills only); a `SKILL.md` line budget (`ADR-0008` stands; the spec's 500 lines is a recommendation); shortening the other skills' descriptions; `dashboard/pm_metrics.py`, which is vendored (`ADR-0036`); re-vendoring downstream copies.

## Likely files

- `docs/development/authoring-guide.md`
- `tests/validate.sh`
- `skills/project-workflow/SKILL.md`
- `docs/registry.md` (generated), `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`

## Execution plan

1. Re-read the spec; add its limits to the guide's `name`, `description` and `compatibility` rows, marked gated, and cite the spec as their source.
2. In the linter: `name` matches `^[a-z0-9]+(-[a-z0-9]+)*$` and is at most 64 characters; `description` at most 1024; `compatibility` 1–500 if present. Count characters, not bytes.
3. Run the gate: it must fail on `project-workflow` alone, naming 1062 > 1024. That is the red proof on the real subject.
4. Red-prove the name and `compatibility` rules in a scratch worktree with throwaway skills (`Bad`, `-bad`, `bad--name`, a 65-character name, a 501-character `compatibility`); commit none of them.
5. Trim the description to roughly 600 characters. Keep what the skill does, the USE FOR triggers and the DO NOT USE FOR boundary; drop the list of dashboard charts. Bump to 7.1.1.
6. Run `scripts/sync-registry.sh`; the gate goes green; update the live files.

## Acceptance criteria

- [x] The gate fails on a 1025-character description, and passes at 1024.
- [x] The gate fails on each invalid name in step 4, and on a 501-character `compatibility`.
- [x] Each new failure message names the file, the rule and the measured value.
- [x] `project-workflow`'s description is at most 1024 characters and still names the WHY/WHAT'S-NEXT boundary.
- [x] The guide's table marks every new rule as gated.

## Mandatory validations

- [x] tests/validate.sh
- [x] the new checks against `HEAD`'s `project-workflow` (red proof)
- [x] the step 4 cases in a scratch worktree

## Risks and rollback

- **Trimming moves routing.** A shorter description can change when the skill triggers. Keep every USE FOR keyword that `project-migration` does not also claim.
- **Downstream copies drift.** Projects vendoring `project-workflow` report a manifest mismatch until they re-vendor 7.1.1 (`ADR-0036`). That is the intended signal, not a failure of this task.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `tests/validate.sh` | skill linter: `name` ≤ 64 and `^[a-z0-9]+(-[a-z0-9]+)*$`; `description` ≤ 1024; `compatibility` 1–500 when present |
| `authoring-guide.md` | the three limits stated, gated, sourced to the spec |
| `project-workflow` | 7.1.1; description 765 characters |
| `docs/registry.md` | regenerated |

Next: downstream projects re-vendor `project-workflow` 7.1.1 when their gate reports the manifest mismatch.

## Execution log

- 2026-10-18 · Claude Code (Opus 5.5) · done
  - Evidence: `tests/validate.sh` with the checks, before the trim → exit 1, one line: `description is 1062 characters — the spec allows at most 1024`
  - Evidence: scratch worktree, eight throwaway skills → `Bad`, `-bad`, `bad--name`, 65-character name, 1025-character description, 501-character `compatibility` each fail with their rule; 1024 and 500 pass
  - Evidence: `tests/validate.sh` after the trim → `validate.sh: OK`
  - Deviation: the trimmed description is 765 characters, not about 600; it keeps every trigger keyword `project-migration` does not claim
