# TASK-0235 — The repository gate passes on a Windows host

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-06
- Updated: 2026-11-06
- Applies to: `scripts/worktree.sh`, `skills/project-workflow/scripts/check-publish.sh`, `tests/validate.sh`, `skills/vault-secrets/scripts/vault_secrets.py`
- Source: the human, 2026-11-06, on the pre-commit hook refusing TASK-0234: "Fix the gate first".

## Objective

`tests/validate.sh` passes on this Windows host (Git Bash) as it does on Linux, so the pre-commit hook gates commits here instead of being bypassed.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `scripts/worktree.sh` | `REPO=$(pwd -P)` gives `/c/...`; `git worktree list --porcelain` prints `C:/...`; the exact match at `add` and `remove` never succeeds on Windows, so `remove` always exits "no such worktree" |
| `check-publish.sh` symlink case | Git Bash's `ln -s` copies by default; the fixture became an untracked folder and hit the "not tracked" refusal, never the symlink check |
| `tests/validate.sh` STANDARD | `cmp -s` byte-exact; under autocrlf the generated copy differs from the tracked file by CR alone, so it read "stale" on every commit here |
| `vault_secrets.py` prompts | `getpass.getpass` reads the console on Windows, not stdin; the suite's piped password hangs 30 s and the suite aborts at T1 (noted in TASK-0227) |

## Scope

- In: the two path-handling fixes; a SKIP with a reason when a host cannot make a symlink; the STANDARD comparison ignoring CR; secret prompts read stdin when it is not a tty.
- Out: `publish_lib.py`'s realpath check (works), `tests/test-worktree.sh` (unchanged).

## Likely files

- `scripts/worktree.sh`, `skills/project-workflow/scripts/check-publish.sh`, `tests/validate.sh`, `skills/vault-secrets/scripts/vault_secrets.py`

## Execution plan

1. Debugger: root-cause both on a pristine HEAD, fix minimally, prove no change on POSIX.
2. Coordinator: full gate, then commit.

## Acceptance criteria

- [x] `tests/test-worktree.sh`: 8 of 8 on this host; `pwd -W` exits 2 on GNU bash so Linux keeps `pwd -P`
- [x] `check-publish.sh`: 60 of 60 here with a native symlink (`MSYS=winsymlinks:nativestrict`), SKIP with a reason where none can be made
- [x] Both suites pass under WSL Ubuntu on LF copies
- [x] STANDARD: the check passes with CR ignored and still fails on an appended line
- [x] `tests/test-vault-secrets.sh`: 119/119 on this host, 117/117 under WSL (T57 is Windows-only)
- [x] `tests/validate.sh` passes on this host: `validate.sh: OK`

## Mandatory validations

- [x] `bash tests/test-worktree.sh`: OK (8 cases)
- [x] `bash skills/project-workflow/scripts/check-publish.sh`: OK (60 cases)
- [x] `bash tests/validate.sh`: `validate.sh: OK`
- [x] `bash tests/test-vault-secrets.sh`: `119/119 passed`

## Risks and rollback

- The vault-secrets suite set only `HOME`; Windows Python reads `USERPROFILE`, so every earlier Windows run logged in and out against the real `~/.vault-token`, which now holds the test token. Fixed in the test; the human must run `vault_secrets.py login` once.
- On Windows the script sets no access list on `~/.vault-token` or `.env`; they inherit the folder's. `check` now flags a `.env` others can read.
- The Windows `gh` stub needs pip's distlib launcher. `VAULT_SECRETS_MAPS` on Windows also splits on `;` and keeps a drive letter's colon; `skills/vault-secrets/SKILL.md` and the runbook still say only "colon-separated" (true, incomplete).
- A Windows host without Developer Mode SKIPs the symlink case (59 counted) rather than running it; the SKIP line names the cause.
- `worktree.sh` messages show `C:/...` paths on Windows; both shells accept them.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `scripts/worktree.sh` | `REPO=$(pwd -W 2>/dev/null \|\| pwd -P)` |
| `check-publish.sh` | symlink fixture made natively, checked with `-L`, SKIP otherwise |
| `tests/validate.sh` | STANDARD compared through `tr -d '
'` on both sides |

Next: the human runs `vault_secrets.py login` to replace the test token in `~/.vault-token`; a one-line note on the `;` separator in SKILL.md and the runbook.

## Execution log

- 2026-11-06 · Claude Code (Fable 5.1, coordinator; debugger opus/high, observed claude-opus-5-5/high) · both suites failed identically on a pristine HEAD worktree, so the cause was the host; the debugger fixed both in two files, verified on Windows and WSL Ubuntu.
  - Evidence: before `test-worktree.sh: 6 of 8 case(s) FAILED`, after `OK (8 cases)`; before `check-publish.sh: 1 of 60 case(s) FAILED`, after `OK (60 cases)`; WSL `pwd -W` rc=2, both suites OK
- 2026-11-06 · Claude Code (Fable 5.1) · the full gate then showed two more host-only failures: STANDARD (CR-only difference, fixed in `validate.sh`, content guard re-proved) and VAULT-SECRETS (getpass on Windows; builder G2 sonnet/medium dispatched).
  - Evidence: `cmp -s <(tr -d '
' …)` passes on the fresh generation; appending a line to the check copy is caught
- 2026-11-06 · Claude Code (Fable 5.1; G2 retry escalated to opus/high, observed claude-opus-5-5/high) · vault-secrets: the `HOME`/`USERPROFILE` cascade, `C:` map paths, `check_local` skipping Windows, and the `gh` stub never found as `gh.exe`; all four fixed behind `os.name == "nt"`. Found that the suite had been overwriting the real `~/.vault-token`. The STANDARD patch needed three tries: a CR byte inside `tr -d ''` is invisible and stripped by Git Bash; the line now carries the two characters ``.
  - Evidence: `test-vault-secrets: 119/119 passed` here; WSL `117/117 passed` on HEAD and with the change; red run with the two script branches reverted → `116/119`; `bash tests/validate.sh` → `validate.sh: OK`
