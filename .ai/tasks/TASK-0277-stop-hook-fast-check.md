# TASK-0277 — Stop hook runs a fast check (P1.7)

## Status

- Status: in review
- Owner: agent
- Branch: agent/TASK-0277
- Created: 2026-11-10
- Updated: 2026-11-11
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

- [x] A broken-check fixture is blocked at Stop with the failure text
- [x] A clean tree is not delayed
- [x] Removing the Stop hook lets the fixture end and it fails
- [x] The fast path takes seconds, not minutes (measured and recorded)

## Mandatory validations

- [x] tests/validate.sh (validate.sh: OK, exit 0)
- [x] the new Stop fixture test

## Risks and rollback

- Latency on every turn that changed files; the subset is chosen to keep it short and the full gate stays in CI.
- A Stop hook that blocks on a failure that was there before the session can trap it; report once and let the next stop through, or document the override.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `scripts/fast-check.sh` | frontmatter + registry + hidden-Unicode, about 10 s on Windows |
| `scripts/check-skill-frontmatter.py` | TASK-0274's linter, called by `scripts/fast-check.sh` and `tests/validate.sh`; not changed here |
| `configs/claude-code/hooks/stop-fast-check.sh`, `settings.hooks.json` | Stop hook, tracked changes only, exit 2 with the text |
| `tests/test-stop-hook.sh` | fixture, wired into `tests/validate.sh` |
| `configs/opencode/README.md` | OpenCode and Codex: no blocking Stop hook, none wired |

Next: run the gate, review the diff, commit.

## Execution log

- 2026-11-10 · agent/Sonnet 5.5 · brief written from the alignment plan; no work done yet
  - Evidence: none yet
  - Deviation: none
- 2026-11-11 · agent/Sonnet 5.5 · built the fast path, hook, fixture and docs
  - Evidence: `bash tests/test-stop-hook.sh` 6 PASS (blocked with "INVALID SKILL ... does not match directory", clean and untracked-only exit 0, stop_hook_active exit 0); with a no-op stub as the hook the blocked case FAILs (exit 1, "removing the hook" proof); `bash scripts/fast-check.sh` exit 0 in 10.9 s real on Windows Git Bash
  - Deviation: the fixture was written after the code, not before, so the first red run is the stub-hook run; this task calls the shared `scripts/check-skill-frontmatter.py` (created by TASK-0274, which owns the linter; this task does not change it); `scripts/sync-registry.sh` gained a `REGISTRY_OUT` override so the fast check renders to a scratch file; the fast subset covers skill frontmatter only (agents/loops stay in the full gate); registry compared with `--strip-trailing-cr` (CRLF checkout); OpenCode and Codex: nothing wired; whether either client has a blocking Stop hook was not verified, and `configs/opencode/README.md` says so
  - Also: tests/test-install.sh H2 updated (the merged fragment now adds a Stop hook beside a user one); validate.sh: OK after fixing a GIT-LOCATORS finding (unset GIT_DIR in the fixture)
- 2026-11-11 · agent/Sonnet 5.5 · review fixes
  - Evidence: the hook parses the payload as JSON (`stop_hook_active` counts only when exactly true; `cwd` picks the tree, then `CLAUDE_PROJECT_DIR`, then the hook's own checkout); `scripts/fast-check.sh` removes its scratch file on exit and fails when `docs/registry.md` is missing; `tests/test-stop-hook.sh` now 11 PASS, adding compact true, false-with-later-true, payload cwd, valid tracked change (silent exit 0), staged-only and rename; with a no-op stub 5 cases FAIL
  - Deviation: a failure is reported once per turn (a later turn that changes tracked files checks again); the hook does not check untracked new files or changes already committed
