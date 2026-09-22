# ADR-0023 — One worktree per agent session, and landing by rebase onto `master`

## Status

**Proposed**, 2026-09-23. Opened by `TASK-0070`.

**Proposed rather than accepted, deliberately.** Clause 2 below **changes a
stated rule in `AGENTS.md`** — work stops going straight onto `master` and
starts arriving by `git push origin HEAD:master` from a session branch.
Changing a stated requirement is the human's call, not the agent's, which is
the rule `ADR-0019` set and `ADR-0022` is currently following. The mechanism
(clauses 1, 3, 4) is already built and safe to use; **clause 2 is what needs
a signature**, because it is the one a reader could mistake for the repo
having quietly acquired a branching workflow.

## Context

### The problem is observed, and it cost work twice in two hours

On 2026-09-23 two agent sessions worked in this checkout at the same time —
one closing sprint S8, one planning S9/S10 from `PLAN-0006`.

- **`TASK-0068` had to be renumbered.** It was written as `TASK-0055`; the
  other session's `PLAN-0006` reserved `TASK-0055`…`0067` while it was being
  written. Caught only because the other session's files appeared in a
  `git status` that was being read carefully.
- **`TASK-0069` found sixteen of the other session's files staged** in the
  shared index, mid-commit-preparation. A plain `git commit` would have swept
  that unfinished work into an unrelated commit. It was avoided with a
  path-limited `git commit -- <paths>`, and an attempt to stage only its own
  hunk of `CURRENT_STATE.md` **failed outright**, because the index already
  held the other session's version of that file.

### Why no existing control catches this

`tests/validate.sh` checks the *content* of a tree. It cannot see **who**
staged something or **whether a change was finished**. The pre-commit hook
gates correctness, not authorship. CI re-runs the same gate after the fact.

So a session committing another's half-written file produces a **green
commit** that is nonetheless wrong, and nothing in this repo reports it. That
is the specific gap: not a merge conflict, which git handles loudly, but a
silent capture of someone else's work-in-progress.

### Worktrees solve the index problem and force a branch

`git worktree` gives each session its own working tree **and its own index**,
sharing one object store and one config. Verified on 2026-09-23: `.githooks`
resolves inside a worktree, and the pre-commit gate **refused** a deliberately
invalid commit there, with `HEAD` unmoved.

But git **refuses to check out the same branch in two worktrees**. So
worktrees cannot be adopted without also deciding how work reaches `master` —
the two are one decision, not two.

### The alternative considered and rejected

**Sequencing sessions instead of isolating them** — only ever run one agent
session against this repo. It needs no mechanism and no ADR. It is rejected
because it is unenforceable: nothing prevents opening a second session, and
the two collisions above both happened without either session intending
concurrency. A convention that fails silently when broken is the shape this
repo has repeatedly refused elsewhere.

### A defect found while verifying, which decides whether this is usable

`git ls-files -s` reported **`100644` for every `.sh` and `.py` entry point**
in the repo; only `.githooks/pre-commit` was `100755`. Two things hid it:
`/mnt/c` is DrvFs and reports every file `0777` regardless (which is also why
`core.filemode` is `false`), and both the hook and CI invoke
`bash tests/validate.sh` rather than the bare path.

On a worktree placed on a real Linux filesystem, `tests/validate.sh` returned
**`Permission denied`, exit 126** — while every command in `AGENTS.md`'s
Commands section is documented as a bare path. Corrected by `TASK-0070` with
`git update-index --chmod=+x`, because a working-tree `chmod` is invisible
while `core.filemode` is `false`.

This matters to the decision rather than merely accompanying it: a worktree
on `~/` runs the gate in roughly **half** the time of one on `/mnt/c`
(~570 ms vs ~1000 ms), and that option did not exist until the modes were
fixed.

## Decision

**1. Each concurrent agent session works in its own `git worktree`**, created
by `scripts/worktree.sh add <name>` as a **sibling** of the repo, on branch
`agent/<name>`. Worktrees are never nested inside the repo: `validate.sh` and
`sync-registry.sh` glob component directories and `git status` would see the
nested tree.

**2. Work lands on `master` by rebase and push, not by committing on it.**

```bash
git fetch origin && git rebase origin/master && git push origin HEAD:master
```

`master` still receives **one commit per task**, still linear, still gated.
`AGENTS.md`'s "one task = one commit" rule is preserved; the added step is a
rebase. **No PR, no review gate, no merge commits** — `ADR-0007` keeps this
repo trunk-based and this does not change that.

**3. The main checkout keeps `master` and is the integration tree.** It is
not a session's worktree.

**4. Worktrees are short-lived.** They exist for isolation, not parallel
development. `scripts/worktree.sh remove` refuses while a worktree holds
uncommitted changes or commits not yet on `origin/master`.

**5. Nothing enforces any of this, and the repo does not pretend otherwise.**
No `validate.sh` check is added. Where a human points a session is not
something this repo can observe, and a check that cannot fail is its
most-repeated lesson. The control is the runbook and this decision.

## Consequences

- **The silent-capture failure mode is removed**, because two sessions no
  longer share an index. It is the only one of the two observed collisions
  that this decision fixes outright.

- **Task-number collisions are *not* fixed by it.** `TASK-0068`'s renumber
  would have happened anyway: numbers are allocated in plans, not in the
  index. Worth stating because the two problems arrived together and it
  would be easy to assume one decision addresses both. **It does not.**

- **Every documented command now works on a POSIX checkout.** A side effect
  of the mode fix, and a larger one than this decision: any Linux clone,
  container or CI checkout could not previously run `tests/validate.sh` as
  `AGENTS.md` documents it.

- **A rebase step is added to every task's end.** Small, but it is a change
  to the Definition of Done's push step, and a rejected push now has a
  routine meaning (`master` moved — rebase again) rather than being an
  anomaly.

- **Branches could accumulate** if clause 4 is ignored. The mitigation is a
  refusal in the tooling rather than a convention, but `worktree.sh remove`
  can be bypassed with `git worktree remove --force`, so this remains a
  discipline question.

- **The faster-gate option is now real but unused.** Nothing yet places a
  worktree on `~/`. Recorded so the ~2× difference is a known, available
  trade rather than a rediscovery.

## Falsifiable claims

Stated so a later reader can check rather than trust, in the manner
`ADR-0021` used:

1. **The pre-commit gate fires inside a worktree and refuses a bad commit.**
   Observed 2026-09-23 on both ext4 and `/mnt/c`: `INVALID SKILL: … name
   'wrong-name' does not match directory 'zz-probe'`, exit 1, `HEAD` unmoved.
2. **`git push origin HEAD:master` from a session branch keeps `master`
   linear and leaves one commit per task.** Not yet observed across two
   concurrent sessions — the case this decision exists for.
3. **Worktrees carry no gate-time penalty of their own.** Measured on
   `/mnt/c`: worktree and main checkout ran within noise of each other while
   the machine was under load.
