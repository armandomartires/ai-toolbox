# Reference: git workflow

Linked from `00.CONVENTIONS.md` — read this before pushing, or when
writing a task brief's Status/Execution-log section.

## The core rule

**A failed push means the task is not done.** A local commit is not
enough — confirm the push actually landed by comparing the remote's head
against local `HEAD` (`git log --oneline -1` vs. what the remote shows),
not just "the command returned exit 0." Record the outcome in the task
brief's Status/Execution-log honestly: if there is no remote configured,
say so explicitly rather than silently omitting the Push line.

## Before starting work

- Check `git status`, current branch, remote, uncommitted changes, and
  recent commits. Never delete or overwrite human changes without
  explicit authorization recorded in the task file.
- Pre-existing unrelated changes are neither committed nor deleted as a
  side effect of an unrelated task — separate them, or stop and ask.

## Committing

- **One task = one logical commit.** Do not bundle unrelated fixes,
  formatting changes, or refactors with a functional change.
- Present-tense imperative subject line (`Add X`, `Fix Y`, not `Added X`).
- No stray whitespace-only changes bundled with real changes.
- Before committing: review `git diff --staged` and confirm only the
  intended changes are staged.
- **Never commit secrets, keys, or tokens.** See
  `reference/environments-and-secrets.md`.

## Pushing

- Confirm a push actually landed before recording a task as `completed` —
  compare local and remote `HEAD`, don't trust exit code alone.
- **Never force-push without explicit human authorization** recorded in
  the task file. If a push fails, diagnose and report; do not declare the
  task done and move on.
- If a remote is not configured at all, that's a fact to record, not a
  failure to paper over — a task can still reach `completed` locally with
  an honest note that nothing was pushed.

## Branching

- Prefer small, task-scoped branches for anything non-trivial; trivial
  changes (a typo fix, a one-line config tweak) may commit directly if
  that matches the project's own `AGENTS.md` convention.
- Never rewrite shared history (rebase/force-push a branch others may
  have pulled) without explicit authorization.
