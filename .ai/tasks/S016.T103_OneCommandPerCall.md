# TASK-0209 — An allowlisted role runs one shell command per call

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-02
- Updated: 2026-11-02
- Applies to: `scripts/emit-agents.py` (`allowlist_note`), `tests/test-emit-allowlist-note.sh`, the emitted OpenCode roles
- Source: `TASK-0176`'s run `pilot-20261022`; the human, 2026-11-02: "Fix roles, rerun"

## Objective

A role with a shell allowlist ran `echo "---NAME-ONLY---"; git diff …` under OpenCode, which checks each part of a compound command, so the call was denied for the `echo` and no `git diff` reached the adjudicator, which parked the task as unevidenced. The generated allowlist note must say to run one command per call.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `allowlist_note` | lists the patterns, names `echo` among the utilities not to use, and says to quote paths; says nothing about compound commands |
| opencode log, 2026-11-02 | denials: `bash "echo \"---NAME-ONLY---\""`, `bash "echo \"---REV-PARSE---\""`, `bash 3bf39d2..HEAD`, and `external_directory` on the gate map, `/tmp/opencode/*` and opencode's own data |

## Scope

- In: one sentence in the generated note: one command per call, no `;`, `&&`, `||`, `|` or newline-joined commands, since OpenCode denies the whole call when any part is outside the list; the test; re-emitting the installed OpenCode roles.
- Out: widening any allowlist (`echo` would also allow `echo … > file` in read-only roles); the driver's `tool-denied` label, which counts every tool error; the park check's exact stash-message match; reading the gate map from outside the repository, which `worktree-only` denies by design. Each is a `TASK-0176` finding.

## Likely files

- `scripts/emit-agents.py`, `tests/test-emit-allowlist-note.sh`

## Execution plan

1. Add the sentence to `allowlist_note`; add a check to the test; red-prove it.
2. `tests/validate.sh`, `tests/test-emit-allowlist-note.sh`, `tests/test-install.sh`.
3. Re-emit the OpenCode roles into `~/.config/opencode/agents/`.
4. `TASK-0176` reruns the pilot; its journal shows whether a compound-command denial recurs.

## Acceptance criteria

- [x] Every emitted role with a shell allowlist says to run one command per call, and why.
- [x] The new check fails with the sentence removed.
- [x] The installed implementer role carries the sentence.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-emit-allowlist-note.sh

## Risks and rollback

- A model may chain commands anyway; the rerun shows it. Then the next step is a driver-side record of the changed paths, not a wider allowlist.
- Rollback: git revert the task commit and re-emit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `allowlist_note` | says to run one command per call, and why |
| `~/.config/opencode/agents/` | re-emitted; 10 allowlisted roles carry the sentence, nothing else changed |

Next: `TASK-0176` reruns the pilot.

## Execution log

- 2026-11-02 · Claude Code (Opus 5.5) · brief written before the change
- 2026-11-02 · Claude Code (Opus 5.5) · done
  - Evidence: `tests/test-emit-allowlist-note.sh` → `OK`; with the sentence removed → `FAIL it says to run one command per call`; `tests/validate.sh` → `OK`; `tests/test-install.sh` → `OK (25 cases)`.
  - Evidence: `emit-agents.py opencode ~/.config/opencode/agents` → 10 roles carry the sentence; the installed implementer differs from before by that sentence alone.
