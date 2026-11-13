# ADR-0007 — Local git is mandatory, a remote is recommended; automation is hook-first

## Status
Accepted (2026-09-13)

## Context
`ROADMAP.md`'s Phase 3 exit criterion read: *"tests/validate.sh wired into
CI or pre-commit."* Its objectives named "CI checks". Both were written at
scaffold time, before anyone checked whether this repo had a remote.

It does not. `git remote -v` returns nothing, and every task from
TASK-0001 through TASK-0009 recorded "no remote configured — nothing to
push." `AGENTS.md`'s Git rules meanwhile instruct: *"At task end: validate,
review diff, commit, **push to GitHub**, record the commit hash and push
result in the task log."* That instruction has been unsatisfiable for the
repo's entire history — nine tasks recorded a push result of "nothing to
push" against a rule that presumes pushing.

Human decision (2026-09-13), stated as a general project rule rather than
a fact about this repo: **every project must have a local git repository; a
remote (GitHub, GitLab) is recommended but not mandatory.**

That settles what Phase 3's automation can rely on. A gate that only runs
in CI would, in this repo today, run nowhere.

Two measurements were taken before deciding the mechanism, because the
prior objection to a pre-commit hook was performance on a WSL `/mnt/c`
working tree (a 9p mount, known to be slow):

| Operation | Cost (5 runs) |
|---|---|
| `git status --porcelain` | 544–724 ms |
| `bash tests/validate.sh` | 285–372 ms |

`validate.sh` is roughly **half** the cost of the `git status` git already
runs. The performance objection does not survive measurement.

## Decision

**1. Local git is the mandatory substrate; a remote is recommended.**
`AGENTS.md`'s Git rules are amended so pushing is conditional on a remote
existing, rather than an unconditional step that every task must record as
inapplicable. A task in a remote-less repo is complete when it is
committed locally.

**2. Automation is hook-first, CI-optional.** Phase 3's exit criterion is
restated as: *`tests/validate.sh` runs automatically before every commit.*
The mechanism is a tracked `.githooks/pre-commit`, activated by setting
`core.hooksPath` — which `scripts/install.sh` does. Rationale for tracked
hooks rather than `.git/hooks/`: `.git/` is not version-controlled, so a
hook placed there exists on exactly one machine and is invisible to
review. A tracked hook is a component of the repo like any other.

**3. A CI workflow ships alongside, inert until a remote exists.** This is
deliberately *not* the "don't build for a shape with no instance" case
that ADR-0005's paper-check avoided. The difference: a CI workflow file is
declarative configuration whose correctness does not depend on being
exercised, and its cost is one small file. An unexercised *code path*
(a Python-server smoke test with no Python server) is a different risk,
because untested code is wrong by default. A workflow file that never runs
is merely dormant. It is documented as unverified until a remote exists —
the same honesty applied to LM Studio's unverified wiring snippet.

**4. The hook must be bypassable, and its bypass documented.**
`git commit --no-verify` exists and will be used, legitimately — for a
work-in-progress commit on a scratch branch, or when the gate itself is
what is being fixed. A hook that cannot be bypassed gets deleted by the
first person it blocks. Better to document the escape hatch than to
pretend it does not exist.

## Alternatives considered

- **CI only, no hook.** Rejected: with no remote, the gate would run
  nowhere. It would satisfy the criterion's wording while providing no
  actual verification — the exact failure mode REVIEW-0003 named ("a
  script reporting success is not evidence the effect happened"), applied
  to a plan instead of a script.
- **Hook only, no CI file.** Seriously considered, and defensible by
  ADR-0005's precedent. Rejected narrowly because the marginal cost is one
  declarative file, and because writing it now records *what* CI should
  check while the reasoning is fresh, rather than reconstructing it later.
  Labelled unverified so it makes no false claim.
- **Untracked `.git/hooks/pre-commit`, documented in the runbook.**
  Rejected: unreviewable, unversioned, and silently absent on every fresh
  clone — the same drift class as OpenCode's stale hand-placed skill copy
  that TASK-0006 had to fix.
- **Keep `AGENTS.md`'s unconditional "push to GitHub".** Rejected: a rule
  that every task must record as inapplicable is noise that trains readers
  to ignore rules. Either it is required or it is conditional; it is
  conditional.
- **Make a remote mandatory.** Rejected by the human: local git is the
  requirement, a remote is a recommendation. Some projects are legitimately
  local-only.

## Consequences
- `ROADMAP.md` Phase 3's objectives and exit criterion are restated:
  hook-first, CI optional-and-inert-until-a-remote-exists.
- `AGENTS.md`'s Git rules make pushing conditional on a remote; its
  Commands section documents hook installation and the `--no-verify`
  bypass.
- `scripts/install.sh` gains hook activation via `core.hooksPath`. This
  makes `install.sh` do something to the *repo* and not only to client
  directories, which is a widening of its role — acceptable because it is
  already the single entry point a human runs after cloning.
- `tests/validate.sh` becomes load-bearing on every commit. Its
  hermeticity (offline, ~330 ms, no network) stops being a nicety and
  becomes a requirement: the reason TASK-0009 kept the network-dependent
  smoke test *out* of it is now doubly justified. `tests/smoke-mcp.sh`
  must never be added to the hook.
- Risk accepted: a slow or flaky `validate.sh` would now block commits.
  Mitigated by the measurement above and by the `--no-verify` escape
  hatch. If `validate.sh` ever grows a network dependency, this decision
  needs revisiting.
