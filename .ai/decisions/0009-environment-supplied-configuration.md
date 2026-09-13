# ADR-0009 — Configuration comes from the environment; validation checks its documentation, not its presence

## Status
Accepted — 2026-09-13. Extends ADR-0007 (local git mandatory, remote
recommended) with how remote credentials are supplied.

## Context
The repo's remote was listed as a "candidate" for three consecutive sprints
under the assumption that adding one was pending work. It was not. The
credentials had existed in the development environment the whole time
(`GITHUB_URL`, `GITHUB_TOKEN`, and an internal `GITLAB_URL`/`GITLAB_TOKEN`
pair). Nothing was blocked on access.

What was actually missing: **anywhere in the repo saying those variables are
what it expects.** `AGENTS.md`'s Prerequisites named only Bash and
`python3`. A new contributor cloning this repo had no way to learn that
pushing needs `GITHUB_URL` and `GITHUB_TOKEN` short of reading a task file.

The same gap already existed in a second place, which confirms it is a
pattern rather than an oversight: `mcp-servers/ansible/server.json` declares
`WORKSPACE_ROOT` as required, and `scripts/install.sh` prints it at deploy
time — but only *at* deploy time, to whoever happens to run it, with no
up-front statement and no check that the requirement is documented at all.

Two questions had to be answered separately, and conflating them is the
trap:

1. **Where do values come from?** The environment (exported vars or a
   gitignored `.env`). Not from tracked files — the repo must never carry a
   token, and `.gitignore` has ignored `.env` from the start.
2. **What should validation check?** Tempting answer: that required
   variables are *set*. That is wrong, and would have broken the gate.

## Decision

**Configuration is environment-supplied.** `.env.example` is the committed
template. It documents variable **names and meanings only, never values** —
the identical rule `server.json`'s `environment` block already follows.
`.env` stays gitignored. A token never appears in a tracked file, a commit
message, a task file, or a remote URL (`git remote -v` must stay
token-free).

**`tests/validate.sh` checks documentation completeness, not runtime
presence.** Concretely: every variable any `server.json` marks
`required: true` must appear as a `^VAR=` assignment in `.env.example`. A
variable mentioned only inside a comment does not count.

It does **not** check whether any variable is set. That distinction is the
substance of this ADR:

- A presence check would fail on every fresh clone, where no `.env` exists
  yet — blocking the first commit someone makes, exactly the failure mode
  ADR-0007 already avoided by not asserting `core.hooksPath`.
- It would fail in CI, which has no `.env` and needs none.
- It would tie a gate whose hermeticity is load-bearing to one machine's
  environment.
- A gate that cannot pass on a clean checkout stops being run, and a gate
  that is not run is worse than no gate, because it is still trusted.

Documentation completeness is checkable offline, on any machine, in
milliseconds. Runtime presence is the operator's business, reported by
`install.sh` and `smoke-mcp.sh` at the moment it actually matters —
`smoke-mcp.sh` already reports SKIP rather than FAIL when required env is
unset, which is the correct treatment of a missing value.

## Consequences
- A new MCP server cannot introduce an undocumented environment
  requirement: adding `required: true` to a manifest without updating
  `.env.example` fails the commit gate.
- `.env.example` becomes a real interface, not a courtesy file. Deleting it
  fails validation.
- `validate.sh` stays hermetic and offline (0.366 s measured with the new
  check) and still passes with no environment configured at all.
- The remote is no longer a mysterious blocked item. It is wired from
  documented variables, and B-001's "CI exists" condition is met as a
  side effect.
- The GitLab variables are documented as optional and unused rather than
  left to be guessed at. `GITLAB_URL` points at an internal host, so it is
  deliberately *not* wired as a second remote — one remote satisfies the
  objective, and a second doubles the surface on which internal
  infrastructure could be exposed.

## Alternatives rejected
- **Assert required variables are set.** Rejected above at length: breaks
  fresh clones and CI, and sacrifices hermeticity for a check that belongs
  at runtime.
- **Commit a real `.env` with placeholder values.** Rejected: a file named
  `.env` in tracked content invites someone to fill it in and commit a
  secret. The `.example` suffix and the gitignore entry both exist to
  prevent exactly that.
- **Document the variables in `AGENTS.md` only, with no template.**
  Rejected: prose cannot be cross-checked against a manifest. The template
  is what makes the rule enforceable.
- **Store the token in git config or the remote URL for convenience.**
  Rejected: `git remote -v` is printed casually, pasted into issues, and
  captured in logs.
