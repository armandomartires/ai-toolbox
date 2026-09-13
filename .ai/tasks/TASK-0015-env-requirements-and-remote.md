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
- [ ] `.env.example` exists, lists every variable with meaning and
      required/optional, and contains no values.
- [ ] `.gitignore` still ignores `.env`; no `.env` is tracked.
- [ ] `AGENTS.md` Prerequisites names the variables.
- [ ] `validate.sh` fails if a manifest's required var is missing from
      `.env.example`; passes as committed; stays offline and sub-second.
- [ ] `validate.sh` does **not** check whether any variable is set.
- [ ] No secret value appears in any tracked file or commit message.
- [ ] `origin` configured; `master` pushed; remote URL contains no token.
- [ ] CI outcome observed and the workflow's status comment updated to
      match reality.

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh
- [ ] `git remote -v` shows a token-free URL
- [ ] CI run result recorded (pass *or* fail — a failure gets recorded, not
      hidden)

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
- Status: in_progress   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent + human (visibility decision)
- Created: 2026-09-13
- Updated: 2026-09-13

## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
