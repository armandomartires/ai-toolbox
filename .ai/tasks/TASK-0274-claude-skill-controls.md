# TASK-0274 — Claude skill controls in the schema (P1.4)

## Status

- Status: planned
- Owner: agent
- Branch: agent/TASK-0274
- Created: 2026-11-10
- Updated: 2026-11-10
- Applies to: `skills/*/SKILL.md`, the ADR-0003 schema, the frontmatter linter (ADR-0008), ports
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P1.4 (N4), no decision applies; related: ADR-0003, ADR-0008

## Objective

Let skills use `allowed-tools`, `disable-model-invocation` and `context: fork` where they fit, without breaking the clients that reject unknown keys.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| ADR-0003 schema and the frontmatter linter (ADR-0008) | reject the Claude Code keys |
| `skills/repo-inventory`, `skills/unattended-ops`, `skills/vault-secrets` | no controls set |
| the OpenCode and Codex ports | load 8 skills; may reject unknown keys |

## Scope

- In: the schema and linter accept the keys; `repo-inventory` gets read-only `allowed-tools`; `unattended-ops` and `vault-secrets` get `disable-model-invocation: true`; the ports strip keys for clients that reject them; a test.
- Out: `context: fork` on any skill unless one clearly fits (decide in the task and record it); the loop wrappers (TASK-0273); changing skill bodies.

## Likely files

- the ADR-0003 schema file and the frontmatter linter script
- `skills/repo-inventory/SKILL.md`, `skills/unattended-ops/SKILL.md`, `skills/vault-secrets/SKILL.md`
- the port emitters or install steps
- a test wired into `tests/validate.sh`

## Execution plan

1. Write the test: the linter accepts the keys; `repo-inventory` has read-only `allowed-tools`; `unattended-ops` and `vault-secrets` have `disable-model-invocation`; the OpenCode and Codex installs still load 8 skills. See it fail.
2. Extend the schema and linter.
3. Edit the three skills.
4. Make the ports strip the keys where a client rejects them.
5. Run the test green; revert one skill edit and see it fail.
6. Run `tests/validate.sh` and `tests/test-install.sh`.

## Acceptance criteria

- [ ] The linter accepts the new keys
- [ ] The three skills carry the stated controls
- [ ] OpenCode and Codex still load 8 skills
- [ ] Reverting a skill edit fails the test

## Mandatory validations

- [ ] tests/validate.sh
- [ ] `bash tests/test-install.sh`

## Risks and rollback

- A client that rejects an unknown key would drop the skill; the port stripping is tested for both ports.
- `disable-model-invocation` on `unattended-ops` stops auto-use; its description must still name the slash command.
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
