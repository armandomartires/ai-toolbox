---
name: release-check
description: Verify, index, review, and commit a completed unit of work in this repo. Run at the end of any task that changed a component, a script, or documentation.
---

# Release Check Loop

Closes out a unit of work in ai-toolbox. This loop owns the **sequence and
its exit conditions** only; the rules it enforces live elsewhere and are
linked, never restated:

- `AGENTS.md` — Git rules, Definition of done, Destructive changes.
- `docs/operations/runbook.md` — the commands and their options.
- The task's own file in `.ai/tasks/` — acceptance criteria and validations.

If this loop and `AGENTS.md` ever disagree, `AGENTS.md` wins.

## Trigger
A task's implementation work is finished and its acceptance criteria are
believed met — or any change to a component, script, or doc is ready to
land. Not for work in progress: run this when you intend to commit.

## Steps

1. **Validate.** `bash tests/validate.sh`
   Expected: `validate.sh: OK`, exit 0. Any other output is a stop, not a
   warning.

2. **Prove new checks bite.** If this unit of work *added* a validation,
   break it deliberately with a throwaway fixture, confirm it fails for
   the reason it exists, then remove the fixture and confirm a valid case
   still passes.
   Expected: the intended failure message, then a clean pass.
   A check never seen to fail has not been validated, and a check that
   fails unconditionally is worse than none.

3. **Regenerate the index if components changed.**
   `bash scripts/sync-registry.sh`
   Expected: `Registry written to docs/registry.md`, and
   `git diff docs/registry.md` shows only intended rows — no template
   listed as a real component.

4. **Verify the effect, not the exit code.** For anything that touched the
   filesystem outside the repo (a deploy, a client config), inspect the
   result directly: read the deployed file, resolve the symlink, compare
   the checksum.
   Expected: observed state matches intent.
   A script reporting success is not evidence the effect happened.

5. **Scan for secrets.** Check the diff for credentials, tokens, keys, or
   `.env` content before staging.
   Expected: nothing found. A hit is a hard stop.

6. **Review the diff.** `git status` then `git diff --staged` after
   staging.
   Expected: only intended changes; one logical change; no stray
   whitespace or unrelated edits.

7. **Record the outcome in the task file.** Fill in the execution log:
   actions, observations, validation output, deviations from the plan, and
   the result. Update `.ai/context/CURRENT_STATE.md` if the change was
   significant.
   Expected: the task file reflects what actually happened, including
   anything that did not work.

8. **Commit, then record the hash.** Commit with a present-tense
   imperative subject line, then write the resulting hash back into the
   task file and amend.
   Expected: `git log --oneline -1` shows the commit; `git status` is
   clean.

## Exit conditions

- **Success:** steps 1–8 all met their expected outputs, the working tree
  is clean, and the task file records the real commit hash. The task may
  be marked `done`.

- **Failure — validation or review fails:** fix the cause and restart from
  step 1. **Bound: 3 attempts.** After a third failure, stop and escalate
  to the human with what was tried and what the failure actually says. Do
  not keep retrying a check that keeps failing — repeated identical
  failure means the diagnosis is wrong, not that the fix needs another
  pass.

- **Failure — a secret is found (step 5):** stop immediately. Do not
  commit, do not stage. Remove the secret, then restart from step 1. Never
  "commit now and clean history later."

- **Failure — the diff contains unrelated changes (step 6):** do not
  bundle them. Unstage the unrelated work and either commit it separately
  or leave it for its own task, per `AGENTS.md`'s one-task-one-commit rule.

- **Escalate without retrying** when the required action is destructive —
  a deletion, an overwrite of human changes, a history rewrite, or a
  force-push. `AGENTS.md` requires explicit human authorization in the
  task file first, and no number of retries substitutes for it.
