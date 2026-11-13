# TASK-0237 — The merged gate checks from origin pass on a Windows host

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-06
- Updated: 2026-11-06
- Applies to: `scripts/mcp-sandbox.sh`, `skills/unattended-ops/scripts/journal-chain.py`
- Source: the human, 2026-11-06: "Push". `origin/master` carried 37 commits (issues #6, #7, #10, #11, #14) whose two new gate sections fail on this host; the merge commit would have been refused by the pre-commit hook.

## Objective

`tests/validate.sh` passes on this Windows host on the merged tree, so the merge of `origin/master` into `master` can be committed through the hook and pushed.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `scripts/mcp-sandbox.sh` | `while read -r var` over `python3`'s output; the Windows `python3` prints CRLF, so `var` is `WORKSPACE_ROOT\r` and `${!var}` dies with "invalid variable name" (MCP-PIN) |
| `journal-chain.py` | `import fcntl` at module level; Windows has no `fcntl` (JOURNAL self-test) |

## Scope

- In: the two portability fixes; this task file; the merge commit that carries them.
- Out: `skills/unattended-ops/templates/bindings/opencode/driver.py`, which also imports `fcntl` but is not run by the gate (recorded under Risks).

## Likely files

- `scripts/mcp-sandbox.sh`, `skills/unattended-ops/scripts/journal-chain.py`

## Execution plan

1. Coordinator: reproduce both on a pristine `origin/master` worktree; fix minimally; re-run each check; full gate; commit the merge.

## Acceptance criteria

- [x] Both checks fail identically on a pristine `origin/master` worktree (host, not the merge)
- [x] `journal-chain.py --self-test`: OK on Windows (`msvcrt.locking` on the first byte where `fcntl` is absent; POSIX path unchanged)
- [x] `mcp-sandbox.sh ansible --print` prints the argv with a `WORKSPACE_ROOT` set (a trailing CR is stripped from each name; no-op on POSIX)
- [x] `tests/validate.sh` passes on the merged tree

## Mandatory validations

- [x] `python skills/unattended-ops/scripts/journal-chain.py --self-test`: `OK (edit, delete, reorder, truncation, long lines, migration and concurrency)`
- [x] `WORKSPACE_ROOT=<tmp> bash scripts/mcp-sandbox.sh ansible --print`: exit 0
- [x] `bash tests/validate.sh`: OK (see log)

## Risks and rollback

- `msvcrt.locking` locks one byte, not the file; two appenders on Windows still serialise on it, which is what the self-test's concurrency case checks.
- `driver.py` under `templates/bindings/opencode/` still imports `fcntl` unguarded; a Windows run of that binding would fail at import. Not exercised by the gate; a task of its own if the binding is ever run here.
- Rollback: git revert the merge commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `scripts/mcp-sandbox.sh` | `var="${var%$'\r'}"` before the name is used |
| `journal-chain.py` | `_lock`/`_unlock` over `fcntl` or `msvcrt` |

Next: none.

## Execution log

- 2026-11-06 · Claude Code (Fable 5.1) · `git merge origin/master` conflicted only in CHANGELOG.md (two disjoint sections, both kept) and in the placement of `telemetry.ts`/`telemetry.test.ts`, which git had already moved under `claude/hooks/` (ADR-0054); the gate then failed MCP-PIN and JOURNAL, both reproduced on pristine `origin/master`.
  - Evidence: `od -c` on the name loop's input shows `W O R K S P A C E _ R O O T \r \n`; journal self-test OK after the lock shim; mod suite 89 pass with the merged telemetry tests; `check-mods.py` OK (5 mods)
