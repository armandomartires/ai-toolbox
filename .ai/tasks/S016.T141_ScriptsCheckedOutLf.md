# TASK-0262 — Scripts are checked out with LF, so a Linux bash on a Windows clone runs them

## Status

- Status: done
- Owner: agent (Claude Code)
- Branch: agent/TASK-0262
- Created: 2026-11-08
- Updated: 2026-11-08
- Applies to: `.gitattributes` (new), `docs/operations/runbook.md`; every `*.sh`, `*.py`, `.githooks/*` and `configs/claude-code/hooks/*`
- Source: the person's run of `bash scripts/install.sh --client claude-code` from PowerShell on 2026-11-08, which failed at `set: pipefail\r: invalid option name`

## Objective

The repo has no `.gitattributes`, and this host's Git for Windows sets `core.autocrlf=true`, so 88 of the 91 tracked scripts sat CRLF in the working copy. Git Bash tolerates the carriage return, which is why the pre-commit gate passed on every run here; PowerShell's `bash` is WSL's Linux bash, which does not. Force LF for scripts and hooks at checkout, and say in the runbook which bash to use.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `git ls-files --eol -- '*.sh' '*.py'` | 91 entries `i/lf`; 88 `w/crlf` in this clone before the fix |
| `(Get-Command bash).Source` in PowerShell | `C:\Windows\system32\bash.exe` (WSL), ahead of Git's on PATH |

## Scope

- In: `.gitattributes` with `text eol=lf` for `*.sh`, `*.py`, `.githooks/*`, `configs/claude-code/hooks/*`; a runbook subsection on line endings and which bash to run scripts with; renormalizing this clone's working copy.
- Out: the 13 blobs that hold CRLF in the index (`.ai/templates/*.md` and the skill templates `sync-templates.sh` renders): a `* text=auto` rule would rewrite them and is a decision of its own; any change to the person's PATH.

## Likely files

- `.gitattributes`, `docs/operations/runbook.md`

## Execution plan

1. Write the attributes and the runbook subsection; brief, board, TODO, changelog.
2. Commit in the task worktree (the gate runs under Git Bash, as before), rebase, push.
3. In the main checkout, delete the clean CRLF copies and `git checkout -- .` (`checkout-index -f -a` left them alone); confirm with `git ls-files --eol` and run `bash scripts/install.sh --status` under WSL's bash from PowerShell.

## Acceptance criteria

- [x] `git ls-files --eol` shows every script `i/lf` before and after: no blob changed
- [x] After renormalizing, every `*.sh` and `*.py` in the main checkout is `w/lf` (91 of 91)
- [x] `bash scripts/install.sh --status` run from PowerShell (WSL bash) prints the status table instead of the `pipefail\r` error

## Mandatory validations

- [x] `tests/validate.sh` at the commit

## Risks and rollback

- A clone that already has CRLF copies keeps them until `git checkout-index -f -a` or a fresh checkout; the runbook says so.
- Rollback: delete `.gitattributes`; working copies then follow `core.autocrlf` again.

## Outputs / handover

- The attributes file and the runbook subsection *Line endings on a Windows host*.
- Follow-up, not taken: the CRLF template blobs above, and whether `sync-templates.sh` should write LF. Under WSL, `worktree.sh list` prints a nested worktree's path joined to its Windows gitdir; WSL is not a supported runtime for the scripts, Git Bash is.

## Execution log

- 2026-11-08 · Claude Code (Fable 5.1) · diagnosed from the person's paste: PowerShell resolves WSL's bash first; Git Bash runs CRLF scripts; 88/91 scripts CRLF in the working copy, all LF in the index. Attributes, runbook, brief written in the `TASK-0262` worktree.
- 2026-11-08 · Claude Code (Fable 5.1) · landed as 66b405c; main checkout rewritten (91/91 `w/lf`); `bash scripts/install.sh --status` and `worktree.sh list` ran under WSL's bash from PowerShell. Closed.
