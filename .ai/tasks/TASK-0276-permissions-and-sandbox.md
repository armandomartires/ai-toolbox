# TASK-0276 — Ship permissions and sandbox settings (P1.6)

## Status

- Status: review
- Owner: agent
- Branch: agent/TASK-0276
- Created: 2026-11-10
- Updated: 2026-11-11
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

- [x] Merged interactive settings contain the deny and ask rules and no sandbox block
- [ ] The unattended settings contain `sandbox.enabled` and the four domains, and apply to unattended runs
  - Half met: `install.sh --unattended` writes `.claude/settings.unattended.json` with `sandbox.enabled` and the domains (tested, Q4), but no launcher passes it with `--settings`: the Claude Code binding runs as a Workflow inside a session and the CI unattended run is the OpenCode driver. It is applied to no run until TASK-0284 (Agent SDK runner) wires it; managed settings are the interim route.
- [x] A second install run is idempotent
- [x] Removing the fragment fails the test

## Mandatory validations

- [x] tests/validate.sh (OK, 2026-11-11)
- [x] `bash tests/test-install.sh`

## Risks and rollback

- Rules can break daily flows (ask on push and WebFetch); start with the plan's list and tune from use.
- `allowedDomains` too narrow stalls an unattended run; the sandbox CI job is the check.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `configs/claude-code/settings.permissions.json` | merged into project settings by `install.sh` |
| `configs/claude-code/settings.sandbox.json` | written to `.claude/settings.unattended.json` by `install.sh --unattended`; applied by nothing yet |

Next: wire `claude --settings .claude/settings.unattended.json` in the Agent SDK runner (TASK-0284). The plugin does not carry the rules: TASK-0272 found no known way for a plugin to ship them, so `install.sh` stays the writer.

## Execution log

- 2026-11-10 · agent/Sonnet 5.5 · brief written from the alignment plan; no work done yet
  - Evidence: none yet
  - Deviation: none
- 2026-11-11 · agent/Sonnet 5.5 · built; in review
  - Done: tests P0-P7 added to `tests/test-install.sh` first (5 FAIL: no fragments, `--unattended` unknown); then `configs/claude-code/settings.permissions.json`, `settings.sandbox.json`, `settings_fragments` and `claude_permissions` in `scripts/install.sh` (`--unattended` writes `.claude/settings.unattended.json`: sandbox plus the permission rules; settings.json never gets sandbox); README section with the managed-settings recommendation and `allowedDomains` tuning.
  - Evidence: `bash tests/test-install.sh` OK (62 cases); with the permissions fragment moved away it fails P0, P1, P4, P6 (4 of 62).
  - Review fixes (same day): HIGH-1 README and brief no longer claim the unattended file is applied (TASK-0284 wires it); push denies widened (-f, --force anywhere, +refspec, --mirror, --delete, :branch; `--force-with-lease` stays ask; `git -C/-c * push` ask); `.env` deny by named files at any depth so `.env.example` stays readable, README notes `cat .env` via Bash is not stopped; `--unattended` fails on a missing fragment, refuses another `--client`, and writes the file with a loud non-zero exit when `~/.claude` is absent; sandbox scalars are overwritten on re-run and `--status` prints MISSING or WEAKENED; `allowUnsandboxedCommands: false` added (key name not verifiable in this repo); `files.pythonhosted.org` added; tests renamed Q0-Q13, exact domain list, P6 message.
  - Deviation: the plugin carrying the rules (scope: TASK-0272's build reads this fragment) is not done or tested, because `scripts/build-plugin.py` does not exist yet; that check belongs to TASK-0272 and the README says so. Q10 (ask, then deny) is not applied: this brief fixes ask on push and WebFetch and names no switch to deny. The five domains are gitlab.com, github.com, pypi.org, files.pythonhosted.org, registry.npmjs.org; the intranet host is added locally, never tracked.
- 2026-11-12 · Claude Code (Opus 5.5) · handover corrected: the plugin half of Next was settled by TASK-0272 (a plugin settings.json is not a known way to ship permission rules; both plugin READMEs say so). What is left is TASK-0284's wiring
  - Evidence: `scripts/build-plugin.py` line 22 and the TASK-0272 brief's unmet TASK-0276 criterion
  - Deviation: none
