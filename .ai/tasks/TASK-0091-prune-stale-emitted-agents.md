# TASK-0091 — Prune an emitted agent file when its role stops declaring that client

## Objective

Make the emitter remove a client's agent file for a role this repo owns once
that role no longer declares the client, and remove the one stale file that
exists today (`~/.claude/agents/designer-manager.md`). Recorded as `ADR-0026`,
because `scripts/install.sh` states that an installer deleting files from a
user's config directory "needs its own decision, not a convenience".

## Minimal context

`TASK-0090` found `~/.claude/agents/designer-manager.md` left over from an
earlier install: the role is OpenCode-only now, emission skips it for Claude
Code, and nothing deletes the old file — so a Claude Code session can still
load a role the repo no longer emits for that client.

### Authorization — the human's, 2026-09-24

Chosen from multiple-choice options (the agent chose none): **"Delete it +
add pruning"** — remove the stale file now, and make the installer remove
emitted role files for roles that no longer declare that client, only files
it emitted, identified by name against `agents/`. `AGENTS.md` requires
explicit human authorization in the task file for deletions; this is it, and
it covers **only** the deletion rule below.

### The rule, conservative on purpose

In `scripts/emit-agents.py`, when a role in `agents/` does **not** declare
the target client, delete `<target>/<role>.md` **only if all hold**:

1. it is a regular file (not a symlink, not a directory);
2. it opens with frontmatter whose `name:` equals the role's name.

Otherwise leave it, and say so. Files for names that are not roles in
`agents/` are never touched. A **refused** role's existing file is not
pruned. A role **deleted** from `agents/` is not pruned either — the emitter
cannot know a name it no longer has; that limit is stated, not solved.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `scripts/emit-agents.py` | `TASK-0036` et al. | Skips undeclared roles; never deletes |
| `scripts/install.sh` | pre-existing | Comment: "Nothing prunes a stale emitted file" |
| `~/.claude/agents/designer-manager.md` | an earlier install | Stale |

## Scope

### Included

- The pruning rule in `emit-agents.py`, with its reasons in the docstring.
- `install.sh`'s comment corrected.
- `tests/test-emit-prune.sh`: hermetic, temp directory only.
- `ADR-0026`; re-run `install.sh link` so the stale file is pruned by the
  mechanism rather than by hand, and record the output.

### Not included

- Pruning roles deleted from `agents/` (needs a record of what was emitted).
- Any skill-directory pruning.
- Wiring the new test into `tests/validate.sh`.

## Likely files

`scripts/emit-agents.py`, `scripts/install.sh`, `tests/test-emit-prune.sh`,
`.ai/decisions/0026-*.md`, `configs/claude-code/README.md`,
`.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`.

## Execution plan

1. Write the test; watch it fail on the current emitter.
2. Implement the rule; watch it pass.
3. Re-run `install.sh link`; confirm `designer-manager.md` pruned from
   `~/.claude/agents/` and nothing else removed anywhere.
4. ADR, snapshot, state; validate; commit; push.

## Acceptance criteria

- [x] The test fails on the current emitter and passes after the change.
- [x] A stale, emitted-looking file for an undeclared role is removed.
- [x] Left alone: an unrelated file, a symlink named after a role, and a
      role-named file whose `name:` differs.
- [x] A declared role is still emitted.
- [x] `install.sh link` prunes `~/.claude/agents/designer-manager.md` and
      removes nothing else in either client (before/after listing).
- [x] `tests/validate.sh` passes.

## Mandatory validations

- [x] `bash tests/test-emit-prune.sh`
- [x] `tests/validate.sh`
- [x] Before/after listing of both clients' agent directories

## Risks and rollback

- **Deleting from a user's home directory.** Bounded by the two conditions
  above and by the human's authorization. Any removal is printed
  (`agent pruned: …`). Rollback: `git revert`, then re-run `install.sh` for
  any client that should have the role.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `scripts/emit-agents.py` | `emitted_by_us()` + the prune branch; announces `agent pruned: …` |
| `scripts/install.sh` | Comment states the rule and its remaining limit |
| `tests/test-emit-prune.sh` | New, hermetic, six checks; **not wired** into `validate.sh` |
| `.ai/decisions/0026-*.md` | New, `Accepted` |
| `~/.claude/agents/designer-manager.md` | **Removed by the mechanism**, not by hand — the only file removed from either client |

**Next task starts here**: both clients' agent directories match what
`agents/` declares. Pilot planning (S10.7) is next.

## Status
- Status: done
- Owner: agent (authorization: human)
- Created: 2026-09-24
- Updated: 2026-09-24

## Execution log
### Attempt 1
- Date: 2026-09-24
- Agent: Claude Opus 5.5 (1M context)
- Actions: wrote the test first and watched it fail; implemented the narrow
  rule; proved the guard with a revert; re-ran `install.sh link` with a
  before/after listing of both clients.
- Observations:
  1. **The unrelated-file check cannot fail by loosening the guard**, and
     that is correct rather than a weak test: the emitter only ever considers
     names of roles in `agents/`, so a non-role file is protected
     structurally. The guard's job is the two role-named cases — the symlink
     and the foreign `name:` — and the revert turned exactly those red.
  2. **The stale file went by the mechanism, not by hand**, so the pruning
     path has now run once against a real client directory.
- Validation: `test-emit-prune.sh` 4 ok / 2 FAIL before, 6 ok after; guard
  loosened to `lexists` → the symlink and foreign-name checks FAIL, restored
  and `cmp`-verified. `install.sh link` exit 0; one line
  `agent pruned: designer-manager -> claude-code`; before/after diff: only
  `designer-manager.md` gone from `~/.claude/agents/`; `opencode.jsonc`
  unchanged. `tests/validate.sh` OK.
- Result: **done.**
- Commit: *(recorded in the follow-up commit)*
- Push: *(recorded in the follow-up commit)*
