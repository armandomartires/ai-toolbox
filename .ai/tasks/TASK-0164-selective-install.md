# TASK-0164 — Selective install: choose which components `install.sh` deploys

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-11
- Updated: 2026-10-11
- Applies to: `scripts/install.sh`, `scripts/emit-agents.py`, `tests/`, `ADR-0026`, docs
- Source: human request 2026-10-11 (team-working-model assessment, follow-up T-b); human choices: a gitignored `install.selection` plus `--only`, and deselection removes what install regenerates

## Objective

`install.sh` deploys every skill and every role a client declares, so a user who wants two components gets all of them. Let the user name what they want, have every later run honour it, and make a deselected component leave the client without anything being lost.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `scripts/install.sh` | all skills per client; prints every MCP server; `--status` covers skills only |
| `scripts/emit-agents.py` | `<client> <target>`, emits every role declaring the client; prunes per `ADR-0026` |
| `ADR-0026` | prunes only a role that stops declaring a client |

## Scope

- In: `--only NAME[,NAME...]` and `install.selection` (gitignored, one name per line) across skills, roles and MCP servers; validation before anything is written; deselected skill links to this checkout unlinked, deselected roles' emitted files removed; copies reported, never removed; `--status` shows what is selected; `ADR-0026` amended; a hermetic suite in the gate.
- Out: bundles or dependencies between components (loops declare none); agent rows in `--status`; installing MCP servers (still printed only).

## Likely files

- `scripts/install.sh`, `scripts/emit-agents.py`, `tests/test-install.sh`, `tests/validate.sh`, `.gitignore`
- `.ai/decisions/0026-prune-stale-emitted-agents.md`, `AGENTS.md`, `README.md`, `.ai/context/CURRENT_STATE.md`

## Execution plan

1. `emit-agents.py`: optional `--only ROLE,...` (empty means none); a role outside it is pruned under the same `emitted_by_us` guard, and an unknown role is refused.
2. `install.sh`: build the name index (skills, roles, servers; a name in two kinds is refused); read `--only`, else `install.selection`, else everything; refuse unknown names and an empty file before any write; apply the selection to skills, roles, MCP output and `--status`.
3. `tests/test-install.sh`: a fake repository and a fake `HOME` under mktemp, covering every case in the acceptance criteria.
4. Red-prove by mutation; wire into `validate.sh`; amend `ADR-0026`; update the docs.

## Acceptance criteria

- [x] With no file and no `--only`, behaviour and output match today's: every skill linked, every declared role emitted, every server printed.
- [x] `--only` overrides `install.selection`; the file ignores comments, blank lines and CRLF; an unknown name or an empty file exits 2 having written nothing.
- [x] A deselected skill's link to this checkout is removed, and so is a deselected role's emitted file; a copy, a link elsewhere, a foreign file and a symlink are left in place, and a left copy is reported.
- [x] `--status` marks unselected skills `not selected` and flags an absent one only when selected.
- [x] The suite runs inside `tests/validate.sh` with no network and touches nothing outside its temp directory.

## Mandatory validations

- [x] tests/validate.sh (WSL)
- [x] `bash tests/test-install.sh` (WSL and Git Bash)
- [x] mutation red-proof of `tests/test-install.sh`

## Risks and rollback

- **Deselecting removes links and emitted files** from the user's client directories. Bounded: only links to this checkout and files `emitted_by_us` names; both come back by re-running.
- **A role a loop needs can be deselected** without warning, since no dependency data exists.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `install.sh` | `--only`, `install.selection`, selection-aware `--status` |
| `emit-agents.py` | `--only`, pruning deselected roles |

Next: T-c, the `repo-inventory` skill.

## Execution log

- 2026-10-11 · Claude Code (Opus 5.5) · done
  - Evidence: `bash tests/test-install.sh` → `OK (25 cases)` under WSL and Git Bash; 13 mutants of `install.sh` and `emit-agents.py` → all killed
  - Evidence: `tests/validate.sh` (WSL, AlmaLinux) → `validate.sh: OK`, 35 s; `tests/test-emit-prune.sh` (WSL) → OK
  - Deviation: the suite found that `ADR-0026`'s prune guard never matched an OpenCode emission (no `name:`); fixed in `emitted_by_us` by an exact-content match, and recorded in the ADR's amendment
  - Deviation: numbered 0164, not 0163: a concurrent session took 0163 in its own worktree (`ADR-0023`'s known collision)
  - Note: `tests/test-emit-prune.sh` fails one case under Git Bash before and after this change, because `ln -s` copies there (`TASK-0160`); it passes under WSL
