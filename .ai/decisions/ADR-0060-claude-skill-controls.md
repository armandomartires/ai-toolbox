# ADR-0060 — Claude Code skill controls are optional schema keys, stripped for OpenCode

**Status**: accepted
**Date**: 2026-11-11
**Task**: `TASK-0274`

Within the alignment plan item P1.4; no earlier decision applies. Extends ADR-0003 and ADR-0008.

## Context

Claude Code reads three skill frontmatter keys: `allowed-tools` (pre-approved tools), `disable-model-invocation` (only the user can invoke the skill) and `context: fork` (run in a subagent). The ADR-0003 schema did not list them. No client check named them, but the schema was the record of what a skill may carry. OpenCode and Codex may reject unknown keys, and a client that rejects a key drops the skill. `scripts/install.sh` deploys skills to Claude Code and OpenCode only; Codex gets mods and no skills from it.

## Decision

1. **Three optional keys join the schema**: `allowed-tools` (non-empty), `disable-model-invocation` (`true` or `false`) and `context` (`fork` only). `scripts/check-skill-frontmatter.py` validates their shape; `tests/validate.sh` calls it per skill. The linter moved out of `validate.sh` so a test can run it on a fixture.
2. **Applied to three skills.** `repo-inventory` gets `allowed-tools: Read Grep Glob Bash(python3 scripts/repo_inventory.py *) Bash(python3 */repo-inventory/scripts/repo_inventory.py *)`. It pre-approves only read tools and the inventory script, by the relative path SKILL.md uses and by the installed path the model calls; `allowed-tools` pre-approves and does not restrict other tools, so it is not a read-only guarantee. `unattended-ops` and `vault-secrets` get `disable-model-invocation: true`; their descriptions end with the slash command, because a disabled skill's description is not loaded for the model and the human needs the name.
3. **`context: fork` is on no skill.** None clearly fits: each skill is used inside the caller's conversation, and a fork would hide its output and decisions from it.
4. **Ports strip the keys.** `install.sh` deploys a skill with any of the three keys to OpenCode as a copy with those keys removed, in link mode too; a skill without them is linked as before. Claude Code gets the source unchanged. Whether OpenCode actually rejects them was not tested against a live client; stripping is the safe default and costs one copy that `--status` reports as COPY. Bionic (project skills) is unchanged and unverified.

## Consequences

- Editing one of the three skills needs a re-run of `install.sh` for OpenCode, as any copy does.
- `tests/test-skill-controls.sh` fails if a control is removed, a value is malformed, a stripped copy keeps a key, or OpenCode loads fewer than 8 skills.
