# Reference: git workflow

Read this before committing or pushing.

## Rules

- **Before work:** check `git status`, the branch, the remote and recent commits. Never delete or overwrite human changes without authorization written in the task file. Leave unrelated changes alone: separate them, or stop and ask.
- **One task, one commit.** Subject: `<Imperative summary> (S###.T###)`. Review `git diff --staged` first. Never commit a secret (`reference/environments-and-secrets.md`).
- **Git is the record.** The commit subject names the task, and `git log --grep S###.T###` finds it. The brief does not carry its own hash, and no follow-up commit adds one.
- **A failed push means the task is not done.** Confirm the remote head equals local `HEAD`; an exit code alone is not confirmation. If there is no remote, say so; that is not a failure.
- **Never force-push or rewrite shared history** without explicit authorization in the task file.

## Task report

End every task with this report, one line per field:

```
Result:   done | blocked | partial — one line
Changed:  file or component — what
Verified: command → observed output
Pushed:   remote ✓ @<short hash>   (or: not pushed — why)
Next:     one line
```
