# TASK-0162 — Keep internal host names out of tracked files

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-11
- Updated: 2026-10-11
- Applies to: `tests/validate.sh`, `scripts/`, `.ai/` records, `skills/ansible-ops/` (comments only), `AGENTS.md`, runbook
- Source: human request 2026-10-11 (team-working-model assessment, follow-up T-a); human choices: all internal hosts, leave history, derive from `origin` plus a local patterns file

## Objective

AGENTS.md says the intranet hostname never goes in a tracked file, because the `github` mirror is public (`ADR-0028`), but nothing checked it, and 11 tracked files named internal hosts. Remove the names, and make the gate catch the next one without the gate itself naming any host.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| tracked tree | the GitLab host's short name in one task brief; PVE node names in 10 files, two of them `ansible-ops` comments |
| `origin` remote | the intranet GitLab host, in untracked `.git/config` |
| git history | holds the same names; left as it is (human choice), the full domain was never committed |

## Scope

- In: replace each name with a placeholder (`pve-node-N`, or prose for the GitLab host); `scripts/check-private-names.sh` and its suite in the gate; document the patterns file.
- Out: rewriting history or force-pushing; private IP ranges (one MikroTik default subnet, not a host name); shipping the check to other projects (follow-up `repo-baseline`).

## Likely files

- `scripts/check-private-names.sh`, `tests/test-private-names.sh`, `tests/validate.sh`
- the 11 files the check names; `skills/ansible-ops/SKILL.md` (patch version)
- `AGENTS.md`, `docs/operations/runbook.md`, `.ai/context/CURRENT_STATE.md`

## Execution plan

1. Write the check: patterns are the `origin` host, its first label (unless generic or under 4 characters) and its parent domain, plus `<git-common-dir>/info/private-patterns`; a public forge or no `origin` derives nothing and says so. It reports `file:line` and the pattern's source, never the pattern.
2. Write the suite in a mktemp repository: each derivation, the patterns file, a worktree, case, staged files, a public forge, no remote, a generic label, and that the output never prints a pattern.
3. Red-prove: run the check against the current tree, which must fail; then replace the names and run it again, which must pass.
4. Wire the check and the suite into `validate.sh`; document it in AGENTS.md and the runbook.

## Acceptance criteria

- [x] `scripts/check-private-names.sh` fails on today's tree, naming all 11 files, and passes after the replacement.
- [x] No tracked file contains the `origin` host, its first label or parent domain, or a pattern from the local file.
- [x] The check's output and the repository never contain a pattern; on a public-forge `origin` it prints that nothing private is configured, rather than passing silently.
- [x] The suite runs inside `tests/validate.sh` with no network and fails if deleted.

## Mandatory validations

- [x] tests/validate.sh (WSL)
- [x] `bash tests/test-private-names.sh`
- [x] red-proof: the check against the pre-replacement tree

## Risks and rollback

- **History still holds the names** on both remotes. Accepted by the human; a rewrite would need its own authorized task.
- **The check is only as wide as its patterns.** A host that is neither `origin` nor in the local file is not caught; each host must keep its own `private-patterns`.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| tracked tree | no internal host names |
| `check-private-names.sh` | in the gate, with its suite |

Next: T-b, selective install in `scripts/install.sh`.

## Execution log

- 2026-10-11 · Claude Code (Opus 5.5) · done
  - Evidence: `bash scripts/check-private-names.sh` on the pre-replacement tree → 36 `PRIVATE NAME:` lines across all 11 files, exit 1; after → `OK (4 patterns)`
  - Evidence: `bash tests/test-private-names.sh` → `OK (19 cases)`; 10 mutants of the check (pattern printed, no common dir, no label, no parent, always OK, case-sensitive, silent no-op, no generic list, scp parsing, untracked) → all killed
  - Evidence: `tests/validate.sh` (WSL) → `validate.sh: OK`, 42 s
  - Deviation: the first suite run under Git Bash had `grep -iF` abort and read as a pass in negative checks; assertions now use bash substring tests, and `lacks` passes only on a clean not-found
