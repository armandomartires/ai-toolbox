# Reading the report

Each row is one repository, listed under its main working tree. Linked worktrees appear inside their repository's flags, never as rows of their own. The **Attention** column is the list of flags. `-` means nothing in the repository exists only here, as far as this clone knows.

| Flag | What a delete would lose | How to clear it |
|---|---|---|
| `no remote` | Everything: this is the only copy. A bare repository on a server with no remote is flagged too, since it is also a sole copy. | Create a remote, `git remote add`, push every branch and tag. |
| `uncommitted: N conflicted, N staged, N modified, N untracked` | Work in the working tree. A linked worktree is named after `uncommitted`. | Commit it, or decide it is disposable. Untracked files may be build output; check before discarding. |
| `detached HEAD: N commit(s) on no branch or remote` | Commits only HEAD reaches; they disappear from view at the next checkout. | `git switch -c <name>`, then push. |
| `stash: N` | Stashed changes, which are never pushed. | `git stash list`, then pop, commit and push, or drop the ones you have judged disposable. |
| `<branch>: N commit(s) on no remote` | Those commits. The count is commits reachable from the branch and from no remote-tracking ref, so it also catches a branch with no upstream. | Push the branch. |
| `<branch>: upstream gone` | Nothing by itself, since the remote branch was deleted. It usually comes with the line above, which is the real risk. | Push it again, or delete the branch once its commits are merged elsewhere. |

**Could not be read** lists directories that look like repositories but that git refused, with git's reason. Typical reasons:

- `dubious ownership`: a repository owned by another user. The script does not override `safe.directory`, because that check is there to stop a foreign repository's configuration running code. Inventory it as its owner.
- `not a git repository: /mnt/c/...`: a worktree registered from WSL, read from Windows, or the other way round. Run the inventory from the side that created it.
- A corrupt or empty `.git`: investigate by hand before deleting anything.

**Last fetch** is when the clone last fetched from any remote. `never` means the remote-tracking refs date from the clone, or nothing was ever fetched. An old date weakens "on no remote" in both directions, so fetch first when the answer matters.

**What it does not see:** tags not on a remote; notes; ignored files (on purpose, since they are usually build output, but a git-ignored `.env` with the only copy of a setting would be lost too); and repositories outside the roots. A linked worktree of a repository inside the roots is read wherever it lives, because git lists it.
