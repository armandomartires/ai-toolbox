# TASK-0102 — Emit each role's allowed shell commands into its body, and draft the upstream report

## Objective

Close `B-034`: every OpenCode role with a shell allowlist is told, in its
emitted body, exactly which commands it may run and to quote path
arguments — generated from its frontmatter, so the list has one owner — and
the quoting asymmetry is written up for OpenCode's tracker, for the human to
file.

## Minimal context

`TASK-0092` findings 12 and 16:

- **12** — the closer's `git add -- .ai/planning/SPRINT-CURRENT.md` was
  **denied**; seconds later `git add -- ".ai/planning/SPRINT-CURRENT.md"` was
  **allowed** (opencode 1.18.31). The allowlist's verdict depended on
  quoting, not on what the command does.
- **16** — every role kept reaching for `cat`, `ls`, `grep`, `sed`,
  `find /` and `echo`, all denied by its allowlist; each denial is a wasted
  model round.

**The human's decision, 2026-09-25 (multiple choice, the recommended
option):** *draft the upstream report; the human files it.* Publishing to an
external tracker is not this session's call.

**Why generated, not written into `agents/*/agent.md`:** the allowlist
already lives in each role's frontmatter (`bash_allow`, `test_allow`). A
hand-written list in the body would be a second owner that drifts the first
time a pattern changes. `scripts/emit-agents.py` appends the section to the
**OpenCode** emission only — `bash-allowlist` and `test-allowlist` refuse for
Claude Code, so no Claude Code file can carry one.

**Why "quote path arguments" is safe advice:** it removes a denial of a
legitimate command; it opens nothing new. The bulk-stage forms that matter
(`git add -- .`, quoted or not) pass the allowlist *either way* (finding 18)
and are caught by the driver's commit-paths check (`TASK-0097`).

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `scripts/emit-agents.py` | `TASK-0040`…`0091` | `emit_opencode()` writes frontmatter + body verbatim |
| `tests/test-emit-prune.sh` | `TASK-0091` | the emitter's hand-run test, the pattern to copy |

## Scope

### Included

- `emit_opencode()`: for a role declaring `bash-allowlist` or
  `test-allowlist`, append a generated section listing every allowed pattern,
  naming the utilities that are denied, and saying to quote path arguments.
- `tests/test-emit-allowlist-note.sh`: the section appears for an
  allowlisted role with its exact patterns, and not for a role without one;
  shown failing with the emitter change reverted.
- The upstream report, drafted below in this file.

### Not included

- Filing the report (the human's).
- Re-emission to the live client directories — once, at the end of the
  backlog pass.

## Likely files

`scripts/emit-agents.py`, `tests/test-emit-allowlist-note.sh`,
`docs/development/authoring-guide.md` (if it describes emitted bodies),
`.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`,
`.ai/planning/SPRINT-CURRENT.md`, `.ai/context/CURRENT_STATE.md`.

## Execution plan

1. Test first; watch it fail.
2. Implement; run it and `test-emit-prune.sh`; revert-prove.
3. Draft the upstream report; docs; state; commit; push.

## Acceptance criteria

- [x] An emitted OpenCode role with a shell allowlist ends with the generated
      section, listing each of its patterns verbatim.
- [x] A role with no shell allowlist gets no such section.
- [x] The new test fails with the emitter change reverted.
- [x] `tests/test-emit-prune.sh` and `tests/validate.sh` pass.
- [x] The upstream report is drafted here, reproducible from what was
      observed, claiming nothing that was not.

## Mandatory validations

- [x] `tests/test-emit-allowlist-note.sh`
- [x] `tests/test-emit-prune.sh`
- [x] `tests/validate.sh`

## Risks and rollback

- A longer emitted body costs every call a little context. Accepted against
  a denied round per reach. Rollback: `git revert` and re-emit.

## Upstream report (draft — the human decides whether and where to file it)

> **Title:** Bash permission verdict changes with quoting: `git add -- .ai/x`
> denied, `git add -- ".ai/x"` allowed by the same allowlist
>
> **Version:** opencode 1.18.31, Linux (WSL2); the shell tool reported
> `shell=/usr/bin/pwsh`.
>
> **Agent permission block** (primary agent, run with `opencode run --agent`;
> abridged — its deny rules for destructive git verbs are omitted, and none
> of them matches `git add`):
>
> ```yaml
> permission:
>   bash:
>     "*": deny
>     "git status*": allow
>     "git diff*": allow
>     "git log*": allow
>     "git rev-parse*": allow
>     "git add -- *": allow
>     "git commit -m *": allow
> ```
>
> **Observed**, seconds apart in one session:
>
> - `git add -- .ai/planning/SPRINT-CURRENT.md` → denied, *"a rule prevents
>   you from using this specific tool call"*.
> - `git add -- ".ai/planning/SPRINT-CURRENT.md"` → allowed, and staged the
>   file.
>
> **Expected:** the same verdict for both — each is `git add -- <path>` and
> matches `git add -- *` as written.
>
> **Why it matters:** an allowlist is a boundary. If rewording a command
> (quoting) can flip its verdict, the boundary's behaviour is not predictable
> from the patterns. Not observed, and so not claimed: the direction in which
> the matcher treats the forms differently for any other pattern or path.
>
> **Related, possibly separate:** with `"git add -- .": deny` written *after*
> `"git add -- *": allow` (both 12 characters), `git add -- .` was still
> allowed, although the deny came later. How are equal-length matches
> resolved, and is it documented?

*Source: `TASK-0092` findings 12 and 18, `TASK-0083` (the tie-break). The
first bullet pair is this report's only observation of the asymmetry; it
was seen once, in a real run, and not re-run in isolation — whoever files it
may want to reproduce it first.*

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `scripts/emit-agents.py` | `emit_opencode()` appends `allowlist_note()` for a role with `bash-allowlist`/`test-allowlist`: its patterns verbatim, the common utilities **no pattern allows** (derived, so the sentence cannot contradict the list), and *quote path arguments* |
| `tests/test-emit-allowlist-note.sh` | New, hand-run, 8 checks |
| `docs/development/authoring-guide.md` | The Body row names the one generated addition and says not to hand-write it |
| This file | The upstream report, drafted, **not filed** |
| Emitted copies | Not yet re-emitted — once, at the end of the pass |

**Next task starts here**: `B-029`…`B-031`, `B-033`, `B-034` closed;
`B-025`, `B-032`, `B-035` open.

## Status
- Status: done
- Owner: agent (decision: human, 2026-09-25)
- Created: 2026-09-25
- Updated: 2026-09-25

## Execution log
### Attempt 1
- Date: 2026-09-25
- Agent: Claude Opus 5.5 (1M context)
- Actions: test first; `allowlist_note()`; guide row; upstream draft.
- Validation: new test 7 of 8 red before the change (the negative check
  passes trivially, as it should); green after. Emitter at `HEAD` → red;
  restored and `cmp`-verified. `test-emit-prune.sh` OK; `tests/validate.sh`
  OK; registry unchanged.
- **Tightened after the first green:** the first cut named `cat`, `ls`,
  `grep`, `sed`, `find`, `echo` as denied unconditionally. No current
  allowlist permits any of them, but a future one could, and the sentence
  would then contradict the list above it; the names are now derived
  (`fnmatch` against the role's patterns) — checked with a synthetic
  `ls*` allowlist, which drops `ls` from the sentence.
- Result: **done.**
- Commit: `78f689d`. Pre-commit hook ran `tests/validate.sh`: OK.
- Push: **confirmed** — `6b25aa8..78f689d`, local and remote hash equal.
