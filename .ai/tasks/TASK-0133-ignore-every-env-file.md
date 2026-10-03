# TASK-0133 — Ignore every .env variant, not only .env (B-053)

## Objective

Close `B-053`: `.gitignore` ignores exactly `.env`, so `.env.local` or
`.env.production` could be committed, and the GitHub mirror is public
(`ADR-0028`). Make every `.env.*` variant ignored except the tracked
`.env.example`, and gate it so the protection cannot quietly regress.
Routed by the human on 2026-10-04 (*"Proceed to complete B-052 and 53"*).

## Minimal context

- `.gitignore` line 7 reads `.env`, with no `.env.*` pattern. Measured
  2026-10-04 on `8c3a1c3`.
- The scaffold this repo ships, `ai-project-scaffold.sh`, already writes
  `.env`, `.env.*` and `!.env.example` into the repositories it migrates.
  This repo is behind its own template.
- **`!.env.example` is needed, not decorative.** `.env.*` matches
  `.env.example`. An ignore rule does not untrack a tracked file, but it
  would make `git add` of a fresh copy silently skip it.
  `TASK-0122`'s `dashboard.html` incident is this exact failure:
  - a pattern swallowed a file the repo needs;
  - the commit went green;
  - a fresh clone broke.
- **The gate has no check on ignore rules.** Since `TASK-0131`, local secret
  files are the main thing standing between this repo and a published
  credential, so a regression here should fail the commit.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.gitignore` | ongoing | line 7 `.env`; no `.env.*` |
| `tests/validate.sh` | ongoing | `validate.sh: OK` at `8c3a1c3` |
| `.ai/planning/BACKLOG.md` | TASK-0131 | `B-053` `ready`; fourteen open |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. `.gitignore`: `.env.*` and `!.env.example` beside `.env`.
2. `tests/validate.sh`: a check that `.env`, `.env.local` and
   `.env.production` are ignored and `.env.example` is not. It uses
   `git check-ignore --no-index`, so it needs no such file to exist. Outside
   a git work tree it announces that it could not run, rather than passing.
3. `BACKLOG.md` (`B-053` done, recount), `TODO.md`, and this brief.

### Not included

- Other credential-file patterns (`*.approle`, `.vault-token`, `*.pem`).
  Those files live outside the repository by design (`ADR-0031`), and
  adding patterns for files that must never be here would suggest
  otherwise.
- `B-052`, which is its own task in two repositories.

## Likely files

`.gitignore`, `tests/validate.sh`, `.ai/planning/BACKLOG.md`,
`.ai/tasks/TODO.md`, this brief.

## Execution plan

1. This brief first (worktree `agent/backlog`).
2. Edit `.gitignore` and write the gate check. Run the gate.
3. Revert proof: restore the old `.gitignore`; the check must fail, naming
   `.env.local`. Restore the change.
4. Backlog and task index; commit; push both remotes through `vgit`; record
   commit.

## Acceptance criteria

- [x] `git check-ignore` reports `.env.local` and `.env.production` as
      ignored, and `.env.example` as not ignored.
- [x] `tests/validate.sh` fails with the old `.gitignore` and passes with the
      new one; output recorded here.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed)
- [x] the revert proof against the old `.gitignore`

## Risks and rollback

- **Over-ignoring a file the repo needs.** Only `.env.example` matches among
  tracked files, and it is negated. The gate checks that it is not ignored.
- **Rollback:** `git revert` the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `.gitignore` | `.env`, `.env.*`, `!.env.example`, under a one-line comment |
| `tests/validate.sh` | a new check after the vault-secrets block; prints `NOT IGNORED`/`IGNORED`, or `SKIPPED` outside a git work tree |
| `BACKLOG.md`, `TODO.md` | `B-053` done (thirteen open); counter `TASK-0134` |

**Next task starts here**: `B-052` (`TASK-0134`), in two repositories.
No deviation from the plan.

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-04
- Updated: 2026-10-04

## Execution log

### Attempt 1

- Date: 2026-10-04
- Agent: Claude Code (Opus 5.5), worktree `agent/backlog`
- Actions: wrote the brief, then the `.gitignore` lines and the gate check.
- Observations:
  - `git check-ignore -q --no-index` now reports `.env`, `.env.local` and
    `.env.production` as ignored, and `.env.example` as not ignored.
  - **Revert proof:** with `.gitignore` restored from `HEAD`, the gate
    exited 1 with `NOT IGNORED: .env.local -- a local secret file could be
    committed (B-053)` and the same for `.env.production`. With the change
    restored, `git diff --stat` showed `.gitignore | 3 +++`.
- Validation: `bash tests/validate.sh` printed `validate.sh: OK`, exit 0.
- Result: done.
- Commit: `0c20144` — *Ignore every .env variant except the template (TASK-0133)*,
  plus the record-keeping commit after it
- Push: **confirmed to both remotes** — `8c3a1c3..0c20144 HEAD -> master` to `origin`
  and to `github`; `HEAD`, `origin/master` and `github/master` all read
  `0c20144`, and `git remote -v` is token-free. Both pushes authenticated from
  Vault through the codebase's AppRole identity
