# TASK-0078 — `no-bash`, so `read-only` means what it says

## Objective

Add a twelfth capability term, **`no-bash`**, enforceable in **both** clients,
and declare it on `task-planner` and `adjudicator` — the two roles `TASK-0063`
shipped as `read-only` and portable whose emitted files constrained no shell
in either client.

## Minimal context

`TASK-0063` authored the four thinking roles correctly against the vocabulary
that existed, and **said so rather than quietly narrowing `clients`**, which
is why this was caught at all. Its report: the two portable roles *"port
because they declare no command boundary at all… neither is stopped from
writing via a shell."*

Verified before acting, by reading the emitted files rather than the source:

| | before |
|---|---|
| OpenCode `task-planner` | `permission:` denies `edit`, `write`, `task`, `webfetch`, `websearch`, `external_directory` — **no `bash` key at all**, so the user's global `{"permission": "*", "action": "allow"}` applies |
| Claude Code `task-planner` | `disallowedTools: Write, Edit, NotebookEdit, Agent, WebFetch, WebSearch` — **no `Bash`** |

So `read-only` bound at the tool layer only, and `echo x > file` defeated it.
**A declared boundary that does not hold** is the defect class this repo has
now found in `qa-test` (`B-021`), in `designer-manager` (`B-028`) and here.

**Human decision, 2026-09-23: add the term.** The alternatives were declining
it and documenting the limitation, or giving both roles `bash-allowlist` —
which would have made them OpenCode-only and **falsified the sprint's headline
claim** that `task-planner` and `adjudicator` port.

**Why it earns a place, against `ADR-0018` clause 8.1** (*a term is not
admitted merely because it can be written*): it is enforceable in **both**
clients, making it the **fifth** such term, and the Claude Code half rests on
evidence rather than analogy — `TASK-0056` observed `disallowedTools:
Bash(git push *)` removing the **entire** `Bash` tool against a control
fixture that retained it. A specifier that removes the whole tool means the
unqualified form does.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `docs/development/authoring-guide.md` | `TASK-0058`, `TASK-0074` | Eleven-term vocabulary; *"Four of the eleven are enforceable in both clients"* |
| `tests/validate.sh` | `TASK-0074`, `TASK-0059` | `VOCAB` of eleven; the `delegation-allowlist`/`no-delegation` contradiction check |
| `scripts/emit-agents.py` | `TASK-0071` | `VOCAB` of eleven; docstring *"Six of the eleven"* |
| `agents/task-planner/`, `agents/adjudicator/` | `TASK-0063` | `read-only`, `clients: [claude-code, opencode]` |

## Scope

### Included

- The term defined in the guide **first** (`ADR-0008`), with its per-client
  mapping, the `read-only` gap it closes, and the ceiling it does **not**
  reach.
- `tests/validate.sh`: `no-bash` in `VOCAB`, plus a **contradiction check**
  against every term that shapes a `bash` rule.
- `scripts/emit-agents.py`: the mapping, and the docstring's count.
- Declared on `task-planner` and `adjudicator`.

### Not included

- Any change to `preflight` or `refuter` — both need real git commands and
  keep `bash-allowlist`, which is why they are OpenCode-only.
- The five acting roles (`TASK-0064`). Several of them must run commands;
  **they must not copy the thinking roles' shape.**
- `worktree-only`'s Claude Code mapping. Still open, still `TASK-0040`'s.

## Execution plan

1. Guide: vocabulary row, the `read-only`-gap subsection, the counts.
2. Gate: `VOCAB`, `BASH_SHAPING`, the contradiction check. Prove it fires.
3. Emitter: mapping + docstring counts.
4. Declare on both roles; **emit for both clients and read the output**.
5. `validate.sh`, `sync-registry.sh`, diff, commit, push.

## Acceptance criteria

- [x] `no-bash` denies bash in **both** clients, **observed in the emitted
      files**, not inferred.
- [x] Pairing `no-bash` with a bash-shaping term **fails the gate**, observed.
- [x] `task-planner` and `adjudicator` remain `clients: [claude-code,
      opencode]` — the sprint's portability claim survives *and* is now true
      of a real boundary.
- [x] Counts agree across guide, gate and emitter, and the two *different*
      counts are disambiguated rather than silently reconciled.
- [x] No component file outside the two roles changed.

## Mandatory validations

- [x] `tests/validate.sh`
- [x] `scripts/sync-registry.sh` — no diff (descriptions unchanged)
- [x] `git status --porcelain`

## Risks and rollback

- **Adding a term nobody needs.** Mitigated by the fact that two shipped roles
  demonstrably needed it, which is the test `ADR-0018` clause 8.1 sets.
- **Claiming a sandbox.** `read-only` + `no-bash` constrains the tools an
  agent may invoke, **not** what a process it never starts would do. Stated in
  the guide so the term is not over-read.
- Rollback is `git revert` of one commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `docs/development/authoring-guide.md` | Twelve-term vocabulary; the `read-only` gap named |
| `tests/validate.sh` | `no-bash` admitted; contradiction check observed firing |
| `scripts/emit-agents.py` | Mapping; both counts corrected and disambiguated |
| `agents/task-planner/`, `agents/adjudicator/` | `no-bash` declared; still portable |
| `agents/preflight/`, `agents/refuter/` | **Unchanged** |

**Next task starts here**: `TASK-0064`, the five acting roles. **They must not
copy the thinking roles' profile** — a role that runs commands needs
`bash-allowlist` or `test-allowlist` and will be OpenCode-only.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)
- Actions: guide → gate → emitter → roles, in `ADR-0008` order; emitted for
  both clients and read the output; proved the contradiction check fires.
- Observations:
  - **The hole is closed and was verified by reading emitted files.**
    OpenCode `task-planner` now carries `bash: deny`; Claude Code carries
    `disallowedTools: Write, Edit, NotebookEdit, **Bash**, Agent, WebFetch,
    WebSearch`.
  - **Contradiction check observed failing:** a fixture pairing `no-bash`
    with `bash-allowlist` produced *"capability 'no-bash' denies the bash
    tool outright and contradicts 'bash-allowlist', which shape what bash may
    run. Under last-match-wins the emitted order would decide which applies."*
  - **I broke the gate while adding it, and the gate caught me.** The first
    insertion landed between the delegation chain's last `bad.append` and its
    `elif`, re-binding that `elif` to the new `if` — so **every** role
    carrying `delegates_to` failed with *"present without capability
    'delegation-allowlist'"*. `designer-manager` went red immediately. Moved
    the check clear of the chain and left a comment saying why, because the
    next person editing that region will be tempted the same way. This is the
    argument for running the gate rather than reading the diff.
  - **Two counts, both right, now disambiguated.** `TASK-0063` flagged that
    the emitter said *"six of the eleven"* while the guide said *"seven"*.
    Both were correct — the emitter counts the **refusal** set (`claude_code`
    is `None`), the guide counts terms **not enforceable in both**, and the
    difference is `worktree-only`, which is *partial* rather than refused.
    The docstring now says so explicitly instead of leaving a reader to pick
    one and be wrong.
- Validation:
  - `tests/validate.sh` — **OK**
  - `scripts/sync-registry.sh` — no diff
  - `git status --porcelain` — four files plus this one
- Result: **done.** The sprint's portability headline is now true of a
  boundary that actually holds, rather than true because the roles were weak.
- Commit: `19cff2d`. Pre-commit hook ran `tests/validate.sh`: OK.
- Push: **confirmed** — `origin/master` `654da49..19cff2d`.
