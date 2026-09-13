# TASK-0015 — Document required environment variables; wire the git remote

## Objective
Make the repo's environment requirements explicit and machine-checked, then
use them to wire the git remote — closing the "add a git remote" candidate
and unblocking B-001's stated condition.

## Minimal context
The human's instruction, verbatim in intent: the git URL and token are in
environment variables, and **this should be stated in the project
requirements so a new user knows they are required** — in env vars or in a
`.env` file.

That is the real gap. The credentials already exist on this machine
(`GITHUB_URL`, `GITHUB_TOKEN`, plus `GITLAB_URL`/`GITLAB_TOKEN`), so the
remote was never blocked on access. It was blocked on nobody having written
down that those variables are what the repo expects. `AGENTS.md`'s
"Prerequisites" names only Bash and `python3`.

There is a second, pre-existing instance of the same gap:
`mcp-servers/ansible/server.json` declares `WORKSPACE_ROOT` as required
environment, and `install.sh` prints it at deploy time — but nothing tells a
new contributor up front, and nothing verifies the documentation lists it.

Verified state before starting (read-only API probe, no writes):
- `GITHUB_TOKEN` authenticates as user `armandomartires`.
- `armandomartires/ai-toolbox` returns 404 — the remote repo does not exist.
- `GITLAB_URL` points at an internal host (`sigsrvgit1.intra.*`).
- Neither URL embeds credentials; a repo-wide grep found no internal
  hostnames and no credential patterns (`ghp_`, `github_pat_`, `glpat-`,
  `AKIA`, PEM headers) anywhere in tracked content.

## Scope
### Included
- `.env.example` — committed template naming every variable the repo uses,
  with meaning and whether it is required. **Names and meanings only, never
  values**, matching the rule `server.json`'s `environment` block already
  follows.
- `AGENTS.md` Prerequisites: state the variables, and that `.env` is
  gitignored and must never be committed.
- `README.md` and `docs/operations/runbook.md`: how to supply them.
- A **hermetic** `validate.sh` check: every `environment` var marked
  `required` in any `server.json` must appear in `.env.example`, so the
  template cannot silently fall behind a manifest.
- ADR-0009 recording that remote/credential configuration is environment-
  supplied, and why validation checks *documentation completeness* rather
  than *variable presence*.
- Wire `origin` from `GITHUB_URL`, push `master`, then verify the CI
  workflow actually runs and remove its UNVERIFIED label **only if it
  passes**.

### Not included
- Committing any secret value, or a real `.env`. `.gitignore` already
  ignores `.env`; this task must not weaken that.
- A `validate.sh` check that any variable is *set*. That would make the
  mandatory gate fail on a fresh clone and on CI, and would tie a hermetic
  check to one machine's environment. Documentation completeness is
  checkable offline; runtime presence is not the gate's business.
- Storing the token in git config, a remote URL, or any tracked file. The
  push must authenticate without persisting the credential.
- GitLab as a second remote. Its URL is an internal host; one remote
  satisfies the objective and a second doubles the publication surface.

## Preconditions
- Working tree clean; `validate.sh` passing.
- Secret scan clean (done — see Minimal context).
- **Human decision required on repo visibility before any outbound call.**

## Likely files
- `.env.example` (new), `AGENTS.md`, `README.md`,
  `docs/operations/runbook.md`, `tests/validate.sh`,
  `.ai/decisions/0009-environment-supplied-configuration.md`,
  `.github/workflows/validate.yml`

## Execution plan
1. Write `.env.example` from observed reality: the two GitHub vars, the two
   GitLab vars marked optional, and `WORKSPACE_ROOT` from ansible's
   manifest.
2. Add the manifest↔template cross-check to `validate.sh`; prove it fails
   by removing `WORKSPACE_ROOT` from the template.
3. Update `AGENTS.md`, `README.md`, runbook. Write ADR-0009.
4. Ask the human for visibility. Create the repo, add `origin`, push.
5. Poll the workflow run. Update the CI file's status comment to match what
   actually happened — pass or fail.

## Acceptance criteria
- [x] `.env.example` exists, lists every variable with meaning and
      required/optional, and contains no values.
- [x] `.gitignore` still ignores `.env` (`git check-ignore` confirms); no
      `.env` is tracked; `.env.example` is *not* ignored.
- [x] `AGENTS.md` Prerequisites names the variables.
- [x] `validate.sh` fails if a manifest's required var is missing from
      `.env.example`; passes as committed; 0.366 s, offline.
- [x] `validate.sh` does **not** check whether any variable is set.
- [x] No secret value appears in any tracked file or commit message.
- [x] `origin` configured; `master` pushed; remote URL token-free.
- [x] CI outcome observed (run #1, success) and the workflow's status
      comment updated from UNVERIFIED to VERIFIED.

## Mandatory validations
- [x] tests/validate.sh — OK
- [x] scripts/sync-registry.sh — registry unchanged
- [x] `git remote -v` token-free (grep for `@` returns 0); no
      `credential.helper` persisted; no token in `.git/config`
- [x] CI run #1 on ea5372e — **success**, all 7 steps green including
      "Confirm the registry is up to date"

## Risks and rollback
- **Risk: publishing internal information.** Mitigated by the pre-flight
  grep for internal hostnames and credential patterns (clean), and by the
  visibility decision going to the human.
- **Risk: leaking the token into a tracked file or the remote URL.**
  Mitigation: authenticate via a transient credential helper for the single
  push; assert `git remote -v` is token-free afterwards.
- Risk: a public repo cannot be made private retroactively in any
  meaningful sense — anything pushed may have been copied. This is why
  visibility is a human call.
- Rollback: `git remote remove origin`; delete the remote repo. Local
  history is unaffected.

## Dependencies
TASK-0012–0014 landed (they are the commits this will push).

## Expected result
Environment requirements are documented and their documentation is
enforced; a remote exists; CI's status claim matches observed reality
instead of a guess.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent + human (visibility decision)
- Created: 2026-09-13
- Updated: 2026-09-13

## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode
- Actions:
  - Added `.env.example`; documented the variables in `AGENTS.md`
    (Prerequisites), `README.md` (new Getting started), and
    `docs/operations/runbook.md` (new Environment variables table).
  - Added the manifest↔template cross-check to `validate.sh`. Wrote
    ADR-0009.
  - Created `armandomartires/ai-toolbox` **private** (human decision) via
    the REST API; added `origin`; pushed `master`.
  - Observed CI run #1, then changed the workflow's status comment from
    UNVERIFIED to VERIFIED and updated `AGENTS.md`'s git rules to state a
    remote now exists.
- Observations:
  - **The remote was never actually blocked.** `GITHUB_URL` and
    `GITHUB_TOKEN` had been in the environment the whole time; the token
    authenticated as `armandomartires` on the first probe. Three sprints of
    "add a git remote" as a candidate item were really "nobody wrote down
    that these variables are the interface". That is the finding worth
    keeping: an item can look blocked when it is merely undocumented.
  - Deliberately resisted the obvious-looking check. Asserting required
    vars are *set* would have broken every fresh clone and the CI run that
    has just been proven to work — CI has no `.env` and needs none. The
    check tests documentation completeness instead (ADR-0009).
  - Pre-flight secret scan before any outbound call: no `ghp_`,
    `github_pat_`, `glpat-`, `AKIA`, or PEM headers, and no internal
    hostnames in tracked content. `GITLAB_URL` points at an internal host
    but that value lives only in the environment, never in the repo — and
    GitLab was deliberately not wired as a second remote.
  - GitHub created the repo with `default_branch: main` while this repo
    uses `master`. Pushing `master` created it as a second branch; `main`
    exists only as the repo's nominal default and holds nothing. Worth
    knowing before anyone opens a PR against the wrong base. Not changed
    here — renaming a default branch is a destructive-ish change needing
    its own authorization.
  - Token handling: a one-shot `GIT_ASKPASS` helper reading from the
    environment. Verified afterwards that `git remote -v` is token-free, no
    `credential.helper` was persisted, and `.git/config` contains no token.
  - The askpass helper needed `chmod +x` — first attempt failed with
    "cannot exec". Unrelated to the `core.filemode` trap from TASK-0014:
    that file is in `/tmp` (ext4), not on the `/mnt/c` 9p mount, so the
    executable bit works normally there.
- Validation:
  - `tests/validate.sh` OK at 0.366 s, offline, with the whole environment
    unset.
  - Fails-when-reverted for the new check, four cases: `WORKSPACE_ROOT`
    removed from the template → `UNDOCUMENTED ENV` naming the manifest and
    the variable; the variable present *only in a comment* → still fails
    (comments are not documentation for this purpose); `.env.example`
    deleted → `MISSING .env.example`; restored → OK, byte-identical to the
    original (`diff -q`).
  - CI run #1 on ea5372e: success. All 7 steps green, including the
    registry-staleness check — so the workflow's syntax and behaviour are
    now confirmed rather than assumed.
- Result: success. Environment requirements documented *and* enforced; the
  remote exists and is private; CI's status claim now matches an observed
  run. B-001's "CI exists" precondition is met as a side effect, though
  B-001 itself remains unscoped.
- Commit: ea5372e (env docs + validate.sh check + ADR-0009), d586ed0 (CI
  label VERIFIED + AGENTS.md git rules)
- Push: `origin master` — both pushed successfully (ea5372e, then
  ea5372e..d586ed0). Remote URL token-free; CI green on both.

