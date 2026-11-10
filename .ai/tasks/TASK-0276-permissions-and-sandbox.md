# TASK-0276 — Ship permissions and sandbox settings (P1.6)

## Status

- Status: planned
- Owner: agent
- Branch: agent/TASK-0276
- Created: 2026-11-10
- Updated: 2026-11-10
- Applies to: `configs/claude-code/`, `scripts/install.sh`, `tests/test-install.sh`
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P1.6 (N6), decisions Q13=C (permission rules everywhere, sandbox for unattended runs only); related: #11, R-05

## Objective

Add harness-side least privilege. Permission rules ship in the settings fragment merged by `install.sh` for every session; the sandbox block applies to unattended runs only (Q13=C), through managed settings or the unattended binding.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `configs/claude-code/settings.hooks.json` and the merge in `install.sh` | merges hooks only |
| the sandbox CI job (#11, R-05) | exists for unattended runs |
| `configs/claude-code/settings.permissions.json` | absent |

## Scope

- In: `settings.permissions.json`, which this task owns (deny Read of `.env*`, deny `Bash(git push --force*)`, ask `Bash(git push*)`, ask WebFetch), merged idempotently; TASK-0271's fixtures assert the push rules, so they live here only. `install.sh` merges into this checkout's project `.claude/settings.json` only, so "permissions everywhere" (Q13=C) under a marketplace-primary install (D2=B) also means shipping the same rules in the agents or skills plugin (TASK-0272's build reads this fragment, not a copy), and the test checks the plugin carries them; a sandbox settings fragment (enabled, `network.allowedDomains` for gitlab, github, pypi, npm) applied only to unattended runs, with managed settings recommended in the README; install tests.
- Out: the role guard and role-specific rules (TASK-0271); sandboxing interactive sessions (not chosen); changing the sandbox CI job; secrets management.

## Likely files

- `configs/claude-code/settings.permissions.json`
- `configs/claude-code/settings.sandbox.json` (unattended only)
- `scripts/install.sh`
- `tests/test-install.sh`
- `configs/claude-code/README.md`

## Execution plan

1. Extend `tests/test-install.sh`: after install the merged settings contain the deny and ask rules and no sandbox block for an interactive install, a second run changes nothing, and the unattended path contains `sandbox.enabled`. See it fail.
2. Write the permissions fragment and wire the merge.
3. Write the sandbox fragment and wire it to the unattended path only.
4. Run the test green; remove the permissions fragment and see it fail.
5. Document the managed-settings recommendation and how to tune `allowedDomains`.
6. Run `tests/validate.sh`.

## Acceptance criteria

- [ ] Merged interactive settings contain the deny and ask rules and no sandbox block
- [ ] The unattended settings contain `sandbox.enabled` and the four domains
- [ ] A second install run is idempotent
- [ ] Removing the fragment fails the test

## Mandatory validations

- [ ] tests/validate.sh
- [ ] `bash tests/test-install.sh`

## Risks and rollback

- Rules can break daily flows (ask on push and WebFetch); start with the plan's list and tune from use.
- `allowedDomains` too narrow stalls an unattended run; the sandbox CI job is the check.
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
