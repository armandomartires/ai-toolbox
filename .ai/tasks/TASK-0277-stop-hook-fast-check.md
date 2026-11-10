# TASK-0277 — Stop hook runs a fast check (P1.7)

## Status

- Status: planned
- Owner: agent
- Branch: agent/TASK-0277
- Created: 2026-11-10
- Updated: 2026-11-10
- Applies to: `configs/claude-code/settings.hooks.json`, a new fast-check script, ports
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P1.7 (N7), decisions Q14=B (fast subset of frontmatter, registry and hidden-Unicode checks, only when tracked files changed); the plan lists no related remediation or ADR

## Objective

Stop Claude from ending a turn with a broken tree unnoticed, without running the whole `tests/validate.sh` each turn. The hook runs a fast subset (frontmatter, registry, hidden-Unicode) and only when tracked files changed.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `configs/claude-code/settings.hooks.json` | no Stop hook |
| `tests/validate.sh` | the full offline gate; its frontmatter, registry and hidden-Unicode checks can run alone or need extracting |
| OpenCode and Codex ports | no Stop equivalent |

## Scope

- In: a fast-check script (a new file, or a `tests/validate.sh` mode) running the three checks; a Stop hook that runs it only when `git status` shows tracked changes and blocks with the failure text; OpenCode and Codex equivalents where their hooks allow; a fixture.
- Out: running the full `tests/validate.sh` at Stop (not chosen); changes to what the three checks test; CI changes.

## Likely files

- `configs/claude-code/settings.hooks.json`
- `scripts/fast-check.sh` (new) or a `tests/validate.sh --fast` mode
- OpenCode: `configs/opencode/README.md` (and a new hook config beside it if OpenCode's hooks allow); Codex has no `configs/codex/`, so its Stop equivalent goes into the codex step of `scripts/install.sh` (`mod_ports codex`, `~/.codex/plugins`) or a new file there; `configs/lm-studio-bionic/` is best-effort and untouched
- a fixture test wired into `tests/validate.sh`

## Execution plan

1. Write the fixture: a session whose change breaks a frontmatter check is blocked at Stop with the failure text; a clean tree and an untracked-only change are not blocked. See it fail.
2. Extract the three checks into the fast path.
3. Add the Stop hook with the changed-files condition.
4. Run the fixture green; remove the hook and see it fail.
5. Add the port equivalents where the client supports them and note where it does not.
6. Run `tests/validate.sh`.

## Acceptance criteria

- [ ] A broken-check fixture is blocked at Stop with the failure text
- [ ] A clean tree is not delayed
- [ ] Removing the Stop hook lets the fixture end and it fails
- [ ] The fast path takes seconds, not minutes (measured and recorded)

## Mandatory validations

- [ ] tests/validate.sh
- [ ] the new Stop fixture test

## Risks and rollback

- Latency on every turn that changed files; the subset is chosen to keep it short and the full gate stays in CI.
- A Stop hook that blocks on a failure that was there before the session can trap it; report once and let the next stop through, or document the override.
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
