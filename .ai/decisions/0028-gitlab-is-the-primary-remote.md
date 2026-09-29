# ADR-0028 — The intranet GitLab is the primary remote; GitHub is a public mirror

## Status

Accepted (2026-09-29). **Amended 2026-09-30** on the human's routing: the
push token lives in the session environment, exported from the shell profile
next to `GITLAB_TOKEN`, not in a separate file. The text below records the file
as first decided and is left as written; see the last **Consequences** bullet.

Task: `TASK-0126`. Extends `ADR-0007` (a remote is recommended) and `ADR-0009`
(configuration comes from the environment); supersedes neither. `ADR-0009`'s
description of `GITLAB_URL`/`GITLAB_TOKEN` as an unused mirror pair is
overtaken by this decision and is left as written.

## Context

`origin` has been `github.com/armandomartires/ai-toolbox` since `TASK-0015`,
and that repository is **public** (`TASK-0123`). The human asked on 2026-09-29
for the organisation's intranet GitLab — `$GITLAB_URL`, a variable this repo
has documented since `ADR-0009` and never used — to become the primary remote.

Measured the same day, before anything was changed:

- The instance answers on **`http://` only**; its `https://` port refuses
  connections. Whatever credential git sends crosses the network in cleartext.
- `GITLAB_TOKEN` is an **administrator** token with `api`, `sudo` and
  `admin_mode`. It is the credential that can do the most damage on that
  instance, and it would be the one exposed by every push.
- No runner is online, so GitLab CI cannot run here yet. Three workflows —
  the mandatory gate's second opinion, the failure alert and the dashboard
  deploy — exist only as GitHub Actions and depend on GitHub receiving pushes.

## Decision

**`origin` is `armandomartires`'s private `ai-toolbox` project on
`$GITLAB_URL`; the GitHub repository is kept as the remote `github`, a public
mirror that every task end pushes to as well; and git authenticates to GitLab
with a project access token, `GITLAB_PUSH_TOKEN`, never with `GITLAB_TOKEN`.**

The push token is scoped `read_repository` + `write_repository` on this one
project, Maintainer (a protected `master` admits Maintainers), and expires
2027-09-28. It lives outside every checkout, in `~/.config/ai-toolbox/env` at
mode `600` — on the WSL home, where file modes are real, not on `/mnt/c`, where
`core.filemode` is false and every file reads world-accessible.

The intranet hostname never enters a tracked file. The mirror is public, so a
committed hostname is a published piece of internal infrastructure. Docs name
the variable.

## Alternatives considered

- **Replace GitHub outright.** Rejected by the human. It would silently stop
  `validate.yml`, `ci-alert.yml` and `dashboard.yml`, since nothing would push
  to GitHub, and there is no GitLab runner to take them over.
- **Keep `origin` = GitHub and add a `gitlab` remote as master's upstream.**
  Less churn in docs, but every runbook and `scripts/worktree.sh` instruction
  says `origin`, and "origin" would then no longer mean the primary copy. The
  name and the role should agree.
- **Push with `GITLAB_TOKEN`.** Rejected: an admin `sudo` token in cleartext on
  every push, for an operation that needs one project's write access.
- **SSH.** Would remove the cleartext problem entirely, but needs a registered
  key and SSH reachability, neither checked. Open as a later improvement; the
  project token makes it an upgrade rather than a precondition.
- **Server-side push mirroring** (GitLab pushes to GitHub). Stores a GitHub
  credential on the intranet server and assumes outbound access from it that
  nobody has measured. Client-side dual push needs neither.

## Consequences

- **Pushes now go to two remotes**, and a task's push record names both. The
  runbook's *Authenticating a push* carries the two commands. Forgetting the
  mirror is not dangerous — GitLab has the history — but it leaves GitHub CI
  and the public dashboard behind, and nothing will say so except the
  hash comparison.
- **CI still runs only on the mirror.** `validate.yml` is therefore a second
  opinion on the *mirror's* state, reached only if the mirror push happens.
  Moving it to GitLab needs a runner.
- **The cleartext exposure is reduced, not removed.** What crosses the wire is
  a one-project, repository-only, expiring token. Removing it needs https on
  the instance, which this repository cannot change.
- **The token expires on 2027-09-28** and pushes will then fail with an auth
  error. Rotation: create a new project access token with the same scopes and
  replace the line in `~/.config/ai-toolbox/env`.
- **Other clones keep pushing to GitHub as `origin`** until re-pointed. The
  mirror accepts it, so nothing breaks loudly — which is the risk.
- **Pages.** The project reports a `pages_access_level`, which suggests the
  feature exists on the instance but does not prove it is served. Publishing
  the dashboard there is `TASK-0127`'s question.
- **Amendment, 2026-09-30 — where the push token lives.** The human pointed
  out that `GITLAB_TOKEN` is a session environment variable, exported from the
  shell profile with the other remote variables, and routed the push token
  there too. `GITLAB_PUSH_TOKEN` is now exported from the same profile, and
  `~/.config/ai-toolbox/env` is deleted. This matches `ADR-0009` (configuration
  comes from the environment) better than a file only this repo knew to source.
  **Unchanged**: git still sends only the narrow project token, never
  `GITLAB_TOKEN`. That half of the decision, which is about cleartext exposure,
  stands as written. Rotation now means replacing the `export
  GITLAB_PUSH_TOKEN=` line in the profile.
