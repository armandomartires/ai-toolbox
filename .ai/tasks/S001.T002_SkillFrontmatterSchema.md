# TASK-0002 — Extend the skill frontmatter schema (license, metadata)

## Objective
Allow `license` and `metadata` (`author`, `version`) in skill frontmatter,
document them, and record the decision — so every skill carries
attribution and a semver version instead of the ad-hoc keys the imported
`project-migration` skill introduced.

## Minimal context
`skills/project-migration/SKILL.md:4-7` declares `license: MIT` and a
`metadata` block with `author` and `version`. Neither key exists in
`skills/_template/SKILL.md` (which defines only `name` and
`description`), and `docs/development/authoring-guide.md:17-18` says
versions live in a "frontmatter comment" — which contradicts a structured
`metadata.version` field.

The human decided (session 2026-09-12) to extend the template rather than
strip the keys, so version and authorship are captured for all future
skills. Because this sets the schema every future skill must follow, it
warrants an ADR.

`tests/validate.sh` only greps for `^name:` and `^description:`, so the
new keys need no validator change to pass. Enforcing them is deliberately
deferred to backlog B-002 (Skill Linter).

## Scope

### Included
- Add optional `license` and `metadata` (`author`, `version`) to
  `skills/_template/SKILL.md`.
- Update `docs/development/authoring-guide.md`: document the keys under
  "Skills" and replace the "frontmatter comment" versioning rule with
  `metadata.version` (semver).
- Add `.ai/decisions/ADR-0003-skill-frontmatter-schema.md`.
- Normalize `skills/project-migration/SKILL.md:7` from `'1.0'` to
  `1.0.0`.

### Not included
- Changing `tests/validate.sh` to enforce the new keys — B-002.
- Adding a repo `LICENSE` file — B-004.
- Any MCP-server or loop metadata convention; this task is skills only.

## Preconditions
- TASK-0001 need not be complete, but if both are in flight, coordinate
  the edit to `SKILL.md:7`: TASK-0001 excludes it, this task owns it.

## Likely files
- `skills/_template/SKILL.md`
- `docs/development/authoring-guide.md` (Skills section; lines 17-19)
- `.ai/decisions/ADR-0003-skill-frontmatter-schema.md` (new)
- `skills/project-migration/SKILL.md` (line 7)

## Execution plan
1. Add the optional keys to `skills/_template/SKILL.md` frontmatter, with
   a comment marking them optional so template users do not think they
   are required.
2. Update the authoring guide's Skills section to list required keys
   (`name`, `description`) and optional keys (`license`, `metadata`).
3. Replace authoring-guide line 18 ("Semver per component (pyproject.toml
   or frontmatter comment)") so skills use `metadata.version` and MCP
   servers keep `pyproject.toml`. Leave the ADR requirement for
   interface-breaking changes intact.
4. Write ADR-0003 from `.ai/templates/ADR.md`.
5. Set `skills/project-migration/SKILL.md:7` to `version: 1.0.0`.
6. Run validations, regenerate the registry, commit, push, log.

## Acceptance criteria
- [x] `skills/_template/SKILL.md` shows `license` and `metadata`
      (`author`, `version`) marked optional.
- [x] The authoring guide lists required vs optional skill frontmatter
      keys and no longer prescribes a version *comment* for skills.
- [x] ADR-0003 exists, status Accepted, and states the rejected
      alternative (stripping the keys).
- [x] `project-migration` declares `version: 1.0.0`.
- [x] No contradiction remains between the template and the guide.

## Mandatory validations
- [x] tests/validate.sh — `validate.sh: OK`
- [x] scripts/sync-registry.sh (if components changed) — regenerated;
      output identical to the version already committed in TASK-0001
      (no diff), confirming `metadata.version: 1.0.0` and `license: MIT`
      do not alter the generated row.
- [x] Confirm the registry still parses `name`/`description` correctly —
      inspected the generated row: `project-migration`'s name and full
      description render intact; indented `metadata.author`/`version`
      did not shadow the top-level keys, as expected from
      `sync-registry.sh:16-17` matching only unindented `^name:`.

## Risks and rollback
- The registry generator uses naive `awk` on the first `^name:` line.
  Indented `metadata` keys do not match `^name:`, so the risk is low, but
  a `name:` nested under `metadata` would break it — hence the explicit
  validation above.
- Rollback: `git revert` this task's commit; the template and guide
  return to name/description only.

## Dependencies
None. Pairs with TASK-0001 but is independently shippable.

## Expected result
A single, documented skill frontmatter schema that the template, the
authoring guide, and the one live skill all agree on, with the rationale
captured in ADR-0003.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-12
- Updated: 2026-09-12
## Execution log
### Attempt 1
- Date: 2026-09-12
- Agent: opencode (anthropic/claude-sonnet-5)
- Actions: added optional `license`/`metadata` (`author`, `version`) to
  `skills/_template/SKILL.md`, commented as optional; updated the
  authoring guide's Skills and Versioning sections to match; flipped
  ADR-0003 from Proposed to Accepted; normalized
  `skills/project-migration/SKILL.md` version from `'1.0'` to `1.0.0`.
- Observations: `docs/registry.md` regenerated to an output identical to
  what TASK-0001 already committed — the new frontmatter keys don't
  perturb the generator, confirming the risk noted in this task's Risks
  section did not materialize. No changes needed to `docs/registry.md`
  in this commit.
- Validation: all Mandatory validations above passed.
- Result: success.
- Commit: "Extend skill frontmatter schema (license, metadata)" on
  `master` — see `git log --oneline -1` for the current hash (recording
  it here would immediately go stale on amend, per TASK-0001's note).
- Push: no remote configured (`git remote -v` empty) — nothing to push.
