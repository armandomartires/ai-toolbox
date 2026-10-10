# TASK-0148 — Document intranet TLS on a Windows host in the runbook

## Objective

On the human's request (*"add the runbook note for intranet TLS"*), 2026-10-10.
Record in `docs/operations/runbook.md` what a Windows host needs before Git
and curl can reach intranet services without certificate errors. Today it
takes a session of diagnosis to find, and *Secrets on a new host* says only
"trust the internal root CA", which on a domain-joined Windows host is
already done and is not what fails.

## Minimal context

**Measured 2026-10-10 on a domain-joined Windows 11 host, in this session**:

- Every intranet endpoint checked chains to one root: `origin`'s GitLab on
  HTTPS, and the domain controller on HTTPS and LDAPS. The root sent by the
  server is the same certificate as the one in `Cert:\LocalMachine\Root`
  (SHA-1 compared). The domain had already installed it; AD publishes no
  other CA (`certutil -ADCA` lists none).
- **Git** failed: `git ls-remote origin` printed `SSL certificate OpenSSL
  verify result: self-signed certificate in certificate chain (19)`. Git for
  Windows' system gitconfig sets `http.sslBackend=openssl`, so it checks
  against its own bundle, not the Windows store.
  `git -c http.sslBackend=schannel ls-remote origin` succeeded.
- **curl** failed, both `curl.exe` and Git Bash's (both Schannel builds):
  `CRYPT_E_NO_REVOCATION_CHECK (0x80092012)`. The server certificate has no
  CRL Distribution Point or AIA extension, so a strict revocation check
  cannot complete. `--ssl-revoke-best-effort` returned 302.
- **Already fine**: Python's `urllib` (it loads the Windows store), Node 24,
  and WSL Ubuntu and AlmaLinux-10, each of which had the CA in its own
  anchor directory.

The human approved both fixes, which were then applied to the host:
`http.sslBackend=schannel` in `~/.gitconfig`, and `ssl-revoke-best-effort`
in `~/.curlrc`. This task documents them; the host change is outside the
repository and needs no commit.

**Not observed**: Vault. `VAULT_ADDR` was unset on this host.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `docs/operations/runbook.md` | `TASK-0131` and later | *Secrets on a new host* has four steps, no Windows note |
| this host's `~/.gitconfig`, `~/.curlrc` | this session, on the human's approval | `schannel`; `ssl-revoke-best-effort` |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. A `### Intranet TLS on a Windows host` subsection under *Secrets on a new
   host*: what was measured, the two fixes, what already works, what was not
   checked, and a check command.
2. `CURRENT_STATE.md`, `TODO.md`, this brief.

### Not included

- **No intranet hostname, CA name or fingerprint** in the note. Every tracked
  file is public through the mirror (`AGENTS.md`).
- **Correcting "the instance is http:// only"** (runbook, *Authenticating a
  push*, and `ADR-0028`). The same session observed GitLab redirecting
  `http://` to `https://`. Switching `origin` to `https://` and amending the
  ADR is a separate decision, offered to the human and not taken here.
- Server-side certificates with a CRL Distribution Point. That is the
  lasting fix for the curl failure, and it belongs to whoever runs the CA.

## Likely files

`docs/operations/runbook.md`, `.ai/context/CURRENT_STATE.md`,
`.ai/tasks/TODO.md`, this brief.

## Execution plan

1. This brief.
2. The runbook subsection; check its verification command on this host.
3. `tests/validate.sh`; commit; push both remotes; record commit.

## Acceptance criteria

- [x] The runbook names both failures by their error text, each fix, and a
      check whose commands succeed on this host.
- [x] No tracked file gains an intranet hostname: `git diff` grepped for the
      domain's name finds nothing.
- [x] `tests/validate.sh` passes.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed) — no components changed

## Risks and rollback

- **The note is one host's measurement.** It says so, with the date, so a
  later host that differs is read as new evidence, not as a broken runbook.
- **`ssl-revoke-best-effort` relaxes curl.** The note says what it gives up,
  and names the server-side fix that removes the need for it.
- **Rollback:** `git revert` the task commit. The host's two config lines are
  removed by hand: `git config --global --unset http.sslBackend`, and delete
  `~/.curlrc`.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `docs/operations/runbook.md` | new subsection *Intranet TLS on a Windows host*; *Authenticating a push* deliberately unchanged |
| this host | Git on Schannel; curl revocation best-effort; `origin` and `github` both reachable |

**Next task starts here**: `master` at the record commit. The
`http://`-only claim in *Authenticating a push* and `ADR-0028` is now known
to be stale and is not yet corrected.

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-10
- Updated: 2026-10-10

## Execution log

### Attempt 1

- Date: 2026-10-10
- Agent: Claude Code (Opus 5.5), main checkout
- Actions: measured the host (above), applied the two approved fixes, wrote
  this brief and the runbook subsection.
- Observations:
  - After the fixes: `git ls-remote origin` and `git ls-remote github` both
    printed `962e8a8…	refs/heads/master`. Git Bash `curl` and `curl.exe`
    printed `302` for GitLab and the domain controller, and `200` for
    `https://github.com/`.
  - The note's check, `curl -sSL -o /dev/null -w '%{http_code}'
    "$GITLAB_URL"`, printed `200`, after following the redirect to the
    HTTPS sign-in page. Without `-L`, it would stop at the `http://` 302 and
    never test TLS.
  - **The cleartext claim, measured.** `GIT_TRACE_CURL=1 git -c
    http.extraheader="X-Dummy-Probe: 1" ls-remote origin master` sent
    `X-Dummy-Probe: 1` on the plain `http://` `GET …/info/refs`, then received
    `HTTP/1.1 301 Moved Permanently` to `https://`. `vgit`'s `AUTHORIZATION`
    header uses the same mechanism, so it crosses the network in cleartext
    once per command until `origin` is `https://`. The trace used a dummy
    header, never a token.
- Validation: `tests/validate.sh` printed `validate.sh: OK` under WSL Ubuntu
  (Python 3.14.4), and the commit's hook ran it there too. Under Git Bash on
  Windows (Python 3.12.10) it failed in two suites this diff does not touch:
  `test-worktree.sh` (6 of 8, `worktree.sh: no such worktree:
  /c/Users/…`) and `check-publish.sh` (1 of 47, the symlinked `skill_dir`
  case). Both are path and symlink handling on Windows, consistent with
  `AGENTS.md`'s "Repo developed on WSL". They are not fixed here.
  `git diff` grepped for the intranet domain, the CA's name and fingerprint
  found nothing.
- Result: done.
- Commit: `9ce320c` — *Document intranet TLS on a Windows host in the runbook (TASK-0148)*, plus the record-keeping commit after it
- Push: **confirmed to both remotes** — `962e8a8..682595d master -> master` to
  `origin` and to `github`; `HEAD`, `origin/master` and `github/master` all
  read `682595d`, and `git remote -v` is token-free. The range carries
  `TASK-0149`'s task commit `682595d` too. That task fixed the `exec` defect
  that kept this commit from being pushed first. The human ran the push from
  Git Bash, because Claude Code's safety check blocked the `vgit` command in
  this session.
