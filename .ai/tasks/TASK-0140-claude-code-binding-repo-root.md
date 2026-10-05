# TASK-0140 — Let the Claude Code binding be pointed at a repository (B-044)

## Objective

Close `B-044`. `unattended-run.js` can run only from the consuming
repository's own checkout: every binding path is repo-relative, every `git`
command in every prompt is bare, and `gateEnv()` hardcodes
`GATE_REPO_ROOT=.`. `TASK-0113`'s pilot hit this before it could start, and
worked around it in a copy with one hunk behind an optional
`args.repoRoot`. Ship that slot in the template, wired to the gate
environment as well, and refused when malformed. Routed by the human on
2026-10-05.

## Minimal context

- The pilot's hunk, still on disk at `/tmp/opencode/cc-pilot/unattended-run.js`
  and diffed on 2026-10-05, prepends one instruction to `header()`: *work in
  the repository at <root>; make it your working directory first*. That was
  its only difference from the template of the day.
- **It left `GATE_REPO_ROOT=.`**, which was right only because the agent had
  already changed directory. Passing the root itself removes that dependence.
- The root is spliced into every prompt. A newline or a backtick in it would
  change the prompt's structure, so the slot accepts only an absolute path on
  one line, without a backtick.
- **An instruction, not a sandbox.** Seven of the nine roles run as default
  workflow subagents, and `worktree-only` is not enforced on Claude Code
  (`ADR-0018`, measured by `TASK-0111`). `binding.md` says so.
- The OpenCode driver has a shell and takes paths directly, so it is
  unaffected.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/unattended-ops/templates/bindings/claude-code/unattended-run.js` | `TASK-0103` and later | no `repoRoot`; `GATE_REPO_ROOT=.` |
| `…/claude-code/tests/unattended-run.test.mjs` | same | 26 tests, all passing (run 2026-10-05) |
| `…/claude-code/binding.md` | same | the `args` shape has no `repoRoot` |
| `.ai/planning/BACKLOG.md` | `TASK-0139` | `B-044` `ready`; seven open |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. `unattended-run.js`:
   - an optional `args.repoRoot`, refused before any agent runs unless it is
     an absolute path on one line without a backtick;
   - `header()` opens every prompt with it when it is set;
   - `gateEnv()` passes it as `GATE_REPO_ROOT`.
   Without it, behaviour is unchanged.
2. Three tests: the refusal, every prompt naming the root along with the
   gate environment carrying it, and the unchanged behaviour without it.
3. `binding.md`: the `args` shape and one paragraph, including what the slot
   does not enforce.
4. `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md`, this brief.

### Not included

- The OpenCode driver.
- Making the binding's paths absolute. They stay repo-relative, relative to
  the root.
- A live run. The suite proves control flow against a model of the runtime,
  as its header says.

## Likely files

The three binding files above, the ledger, this brief.

## Execution plan

1. This brief first.
2. Apply the change and the tests.
3. Red proof: the new tests run against the pre-task script must fail, and
   the 26 existing tests must still pass.
4. `tests/validate.sh`; ledger; commit; push both remotes; record commit.

## Acceptance criteria

- [x] With `repoRoot`, every role's prompt starts by naming it, and the gate
      environment carries it.
- [x] Without it, no prompt names a root, and `GATE_REPO_ROOT=.` is
      unchanged.
- [x] A relative, unanswered, multi-line or backticked root is refused
      before any agent runs.
- [x] The new tests fail against the pre-task script; the suite passes after.

## Mandatory validations

- [x] tests/validate.sh
- [x] `node --test …/unattended-run.test.mjs`
- [x] the red proof against the pre-task script

## Risks and rollback

- **A false sense of containment.** `binding.md` states that the root is an
  instruction, not a boundary.
- **Rollback:** `git revert` the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `unattended-run.js` | optional `args.repoRoot`, validated, in `header()` and `gateEnv()` |
| `unattended-run.test.mjs` | 29 tests |
| `binding.md` | `repoRoot` in the `args` shape, with one paragraph |
| `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md` | `B-044` done; six open |

**Next task starts here**: `master` at the record commit.

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-05
- Updated: 2026-10-05

## Execution log

### Attempt 1

- Date: 2026-10-05
- Agent: Claude Code (Opus 5.5), main checkout
- Actions: wrote the brief, then applied the change, the tests and the
  `binding.md` paragraph in one scripted edit, each passage matched exactly
  once.
- Observations:
  - **After**: `node --test …/unattended-run.test.mjs` gave `# tests 29`,
    `# pass 29`.
  - **Against the pre-task script**: `# pass 27`, `# fail 2`. The failures
    were `refuses a repoRoot that is relative, unanswered, multi-line or
    carries a backtick` and `with args.repoRoot, every role is told the root
    first and the gate env carries it`. The third new test, without a root,
    passes both ways, as a regression guard should.
  - **Mutation**, `GATE_REPO_ROOT` left at `.` while the root is set: exactly
    test 4 failed.
  - `check-binding.sh` printed the same output for the old and new
    `binding.md`: only the template placeholders.
- Validation: `tests/validate.sh` printed `validate.sh: OK`, and the registry
  is unchanged.
- Result: done. No live Workflow run was made; the suite models the runtime.
- Commit: `340fa7e` — *Let the Claude Code binding be pointed at a repository (TASK-0140)*, plus the record-keeping commit after it
- Push: **confirmed to both remotes** — `8b32bd4..340fa7e master -> master` to
  `origin` and to `github`; `HEAD`, `origin/master` and `github/master` all
  read `340fa7e`, and `git remote -v` is token-free
