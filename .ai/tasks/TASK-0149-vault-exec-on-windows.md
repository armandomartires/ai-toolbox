# TASK-0149 — `vault_secrets.py exec` waits for its command on Windows

## Objective

On the human's decision, 2026-10-10 (*"Fix exec first"*, chosen over pushing
around the defect). `vault_secrets.py exec` ends with `os.execvpe`. On
Windows that is not an exec: Python starts the command and exits at once, so
the caller gets status 0 before the command has finished. That blocked
`TASK-0148`'s push. The runbook's `vgit` push crashed on this host, and a push
that failed would have reported success.

## Minimal context

**Measured 2026-10-10 on a Windows 11 host, Git Bash**, with the payload
never a secret:

| Command through `exec GITLAB_PUSH_TOKEN --` | Python | Result |
|---|---|---|
| `true` | Store `python3` 3.12.10 | rc 0 |
| `env true` | Store `python3` 3.12.10 | `Segmentation fault`, rc 139 |
| `git --version` | Store `python3` 3.12.10 | rc 0, output printed *after* the next command's |
| `env true` | `C:\Python314` | rc 0 |
| `git rev-parse --verify no-such-ref-xyz` | `C:\Python314` | **rc 0**; git alone gives 128 |

The human's own `vgit … push origin master` printed `Segmentation fault`, and
`ls-remote` confirmed nothing reached either remote. The out-of-order output
and the lost status both show the command running on after Python had
already exited, which a real exec cannot do.

**Why the gate never saw it**: the gate runs on Linux, in WSL and in CI, where
`os.execvpe` does replace the process.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/vault-secrets/scripts/vault_secrets.py` | `TASK-0131`, `TASK-0132` | `cmd_exec` ends in `os.execvpe` |
| `tests/test-vault-secrets.sh` | `TASK-0131`, `TASK-0132` | T1-T25, all passing |
| `skills/vault-secrets/SKILL.md` | `TASK-0132` | `1.1.0` |
| `TASK-0148`'s commit `9ce320c` | `TASK-0148` | committed, unpushed |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. `run_command(command, env, spawn=os.name == "nt")`: on Windows,
   `subprocess.run` and `sys.exit` with the command's status. Elsewhere,
   `os.execvpe` as before. A missing command still exits 127.
2. Tests: T26, `exec`'s exit status end to end; T27, the Windows path driven
   directly with `spawn=True`, since the gate cannot run on Windows.
3. `SKILL.md`: the `exec` row says what Windows does; `1.1.1`.
4. `TODO.md`, `CURRENT_STATE.md`, this brief.

### Not included

- **Making the gate pass under Git Bash** (`test-worktree.sh`,
  `check-publish.sh`'s symlink case; `TASK-0148`'s log). The repo is
  developed on WSL.
- **A `PermissionError` from a PATH search** still escapes `exec` as a
  traceback, as it did before. It is seen in WSL, whose PATH carries
  unreadable Windows directories, and it is unchanged here.
- **Signals.** Ctrl-C on Windows reaches both processes through the console,
  and nothing here forwards it.

## Likely files

`skills/vault-secrets/scripts/vault_secrets.py`, `tests/test-vault-secrets.sh`,
`skills/vault-secrets/SKILL.md`, the ledger, this brief.

## Execution plan

1. This brief.
2. `run_command`; T26-T27; a red proof against a mutant that keeps the
   Windows behaviour (start, do not wait, exit 0).
3. Re-run on this host the commands that failed.
4. `tests/validate.sh`; commit; push `TASK-0148`'s and this task's commits to
   both remotes; record both.

## Acceptance criteria

- [x] T26 and T27 pass on Linux, and T27 fails against the no-wait mutant.
- [x] On this Windows host, `exec … -- env true` exits 0, and `exec … -- git
      rev-parse --verify no-such-ref-xyz` exits 128.
- [x] `tests/validate.sh` passes.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed) — the registry shows no
      version, and is unchanged
- [x] the red proof

## Risks and rollback

- **Linux behaviour changes?** No. `spawn` is false there, and the
  `os.execvpe` call is the same line as before. T1-T25 are unchanged and pass.
- **Rollback:** `git revert` the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `vault_secrets.py` | `run_command`: exec on POSIX; on Windows, run, wait, exit with the status |
| `test-vault-secrets.sh` | 49 cases, T26-T27 new |
| `SKILL.md` | `1.1.1` |

**Next task starts here**: `master` at this task's record commit, with
`TASK-0148` and `TASK-0149` both pushed.

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-10
- Updated: 2026-10-10

## Execution log

### Attempt 1

- Date: 2026-10-10
- Agent: Claude Code (Opus 5.5), main checkout
- Actions: measured the failure (above), wrote `run_command` and T26-T27, ran
  the suite and the red proofs under WSL, then re-ran the failing commands on
  Windows.
- Observations:
  - `tests/test-vault-secrets.sh`: `test-vault-secrets: 49/49 passed`, rc 0.
  - **Red proof, the mutant**: `sys.exit(subprocess.run(…).returncode)`
    replaced by `subprocess.Popen(command, env=env); sys.exit(0)`. The output
    was `FAIL T27 on Windows, exec waits for the command and exits with its
    status: exit 0`, `48/49 passed`, rc 1. Against the committed script the
    suite stops at T27 with `AttributeError: … no attribute 'run_command'`,
    rc 1.
  - **Live, Windows, Store `python3`**: `exec … -- env true` exited 0 (was
    139). `exec … -- git rev-parse --verify no-such-ref-xyz` exited 128 (was
    0).
  - **The first draft of T27's missing-command case** named a bare command.
    In WSL that raised `PermissionError`, not `FileNotFoundError`, because a
    Windows directory on PATH was unreadable. It now names an absolute path
    under the test's work directory.
  - **A measurement error, caught and corrected.** `wsl.exe -d Ubuntu -- bash
    -lc '…; echo $?'` re-parses its arguments through the default shell. That
    expands `$?` before the script runs, so it printed `rc=0` for a suite that
    had crashed. `wsl.exe … --exec bash -lc` measured rc 1. No gate or hook
    is affected: they check the status inside WSL. Every status above was
    taken with `--exec`.
- Validation: `tests/validate.sh` printed `validate.sh: OK` under WSL, and the
  commit's hook ran it there too.
- Result: done.
- Commit: recorded in the follow-up record commit
- Push: recorded in the follow-up record commit
