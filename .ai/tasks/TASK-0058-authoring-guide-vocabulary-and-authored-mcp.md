# TASK-0058 — Settle `worktree-only` for Claude Code, add the delegation rule, and verify the authored-MCP section

## Objective

Make three definitional changes to `docs/development/authoring-guide.md` **before
anything enforces or emits them**, per `ADR-0008`. Two close standing gaps that
predate this sprint; one is needed by the nine roles that follow.

## Minimal context

`ADR-0008`'s order is definition → enforcement → emission, and this repo has
paid for breaking it. The guide's own Gated column exists because a sentence
claiming it *"enforces every frontmatter rule below"* was **false in both
halves**.

Three items:

1. **`worktree-only` has no settled Claude Code emission.** `ADR-0018` clause 7
   assigned it to `TASK-0040`; it is still open. The guide marks it *partial*:
   OpenCode's `external_directory: deny` **refuses** tool calls outside the
   working directory, while Claude Code's `isolation: worktree` gives an
   **isolated copy**. Confinement by refusal versus by redirection — not a
   drop-in translation. **Every existing role declares it, and all nine new ones
   will.** For the *acting* roles the difference is material: an isolated copy
   is the wrong confinement for a role that must commit to the real tree.
2. **A `delegates_to` entry may name a role that is never emitted for the
   delegating role's client.** `agents/designer-manager/` does this today with
   `git-ops`. `TASK-0056` establishes whether it is silent.
3. **The authored (Python) MCP section describes a path nobody has walked.**
   `ADR-0010`'s obligation 2, becoming due because `TASK-0067` will walk it.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/decisions/0022-*.md` | `TASK-0057` | **`Accepted`.** This task does not start otherwise |
| `.ai/tasks/TASK-0056-*.md` | `TASK-0056` | `done`; `isolation: worktree` characterised, or explicitly left open |
| `.ai/tasks/TASK-0055-*.md` | `TASK-0055` | `done`; F1's verdict, which decides whether the `mode` row changes |
| `docs/development/authoring-guide.md` | pre-existing | Agents section with the ten-term vocabulary and Gated columns |
| `.ai/decisions/0018-*.md` | pre-existing | clause 7 (the open `worktree-only` question) and clause 8 |
| `.ai/decisions/0010-*.md` | pre-existing | its three reopen obligations |
| `mcp-servers/_template/` | pre-existing | the authored template — note it is `_template/`, **not** `_template-python/` |

**Verify the expected state; don't assume it.** ADR-0022 must actually read
`Accepted`; a `Proposed` ADR does not open this gate.

## Scope

### Included

- **Settle `worktree-only` for Claude Code**: emit `isolation: worktree`, or
  refuse the client. Record the decision and its reason in the guide. If
  `TASK-0056` left it open, **say so in the guide explicitly** and scope the
  affected roles — an honest open question beats a silent resolution that
  affects all nine roles plus the six that exist.
- Add the **`delegates_to` cross-client rule**: a delegate must be emitted for
  every client the delegating role declares. Definition only; `TASK-0059`
  enforces it.
- **Verify the authored-MCP section against `mcp-servers/_template/` as it
  actually is**, and correct it. Include the launch convention, and note the
  discrepancy to be resolved in `TASK-0067`: `install.sh` prints a
  `cd <dir> && uv run <name>` form, while client configs need a cwd-independent
  `uv --directory <abs> run <name>`.
- Amend the `mode` row **only if** F1 forced it.
- Update the Gated column for every row touched. A rule whose gate does not
  exist yet is marked **no**, and `TASK-0059` flips it.

### Not included

- Any change to `tests/validate.sh`. That is `TASK-0059`, deliberately separate,
  so definition and enforcement are distinguishable in the history.
- Any change to `scripts/emit-agents.py`.
- Fixing `agents/designer-manager/`.
- A new vocabulary term. The nine roles are designed to need none; if one turns
  out to be needed, that is a finding and its own task, not an improvisation
  here. `ADR-0018` clause 8.1: *a term is not admitted merely because it can be
  written.*

## Likely files

- `docs/development/authoring-guide.md`
- This task file

## Execution plan

1. Confirm ADR-0022 reads `Accepted`. Stop if not.
2. Read `TASK-0055` and `TASK-0056`'s findings.
3. Settle `worktree-only`, or record it as open with its scope.
4. Write the `delegates_to` cross-client rule, Gated **no** for now.
5. Read `mcp-servers/_template/` and correct the authored-MCP section against it.
6. Apply the `mode` row change if F1 forced it.
7. Re-read every Gated cell touched and confirm it matches what `validate.sh`
   does **today**, not what `TASK-0059` will do.
8. `tests/validate.sh`, review the diff, commit.

## Acceptance criteria

- [x] `worktree-only`'s Claude Code emission is settled, or recorded as open
      with the affected roles named. → **recorded as open**, with the six
      declaring roles and the two Claude Code-emitted ones named.
- [x] The `delegates_to` cross-client rule is written and marked Gated **no**.
      → written, but marked Gated **yes**. See Deviation 2: the enforcement
      landed before this task ran, so **no** would have been false.
- [x] The authored-MCP section matches `mcp-servers/_template/` as read, and the
      launch-form discrepancy is named with its owning task. → **two**
      discrepancies found, both assigned to `TASK-0067`.
- [x] Every Gated cell touched is true of `validate.sh` **as it stands**.
- [x] No claim in the guide is left asserting something this task did not check.
- [x] `tests/validate.sh` passes.

## Mandatory validations

- [x] `tests/validate.sh` — `validate.sh: OK`, exit 0
- [x] `scripts/sync-registry.sh` — no component changed, so this must be a no-op
      → confirmed no-op; `git status` showed only the guide modified afterwards

## Risks and rollback

- **Marking a row Gated yes before the gate exists.** That is the exact defect
  the Gated column was introduced to fix, reappearing in the guide that governs
  the gate.
- **Resolving `worktree-only` silently.** It affects fifteen roles. ADR-0018
  clause 8.2 requires a loud failure over a quiet degradation.
- **Inventing a vocabulary term under time pressure.** Out of scope, and the
  ADR says why.
- Rollback: revert the commit. Nothing depends on this until `TASK-0059`.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `docs/development/authoring-guide.md` | `worktree-only` settled or scoped-open; `delegates_to` cross-client rule present, Gated no; authored-MCP section verified against the real template; `mode` row amended only if F1 forced it |
| `tests/validate.sh` | **Unchanged**, deliberately |
| `scripts/emit-agents.py` | **Unchanged**, deliberately |

**Next task starts here**: `TASK-0059` no longer enforces the `delegates_to`
rule — `TASK-0075` already did, and this task recorded it as Gated **yes**.
What `TASK-0059` still owes from here is `mode: all`: the decision is
**reject**, so `MODES` keeps its two values and the failure message should say
`all` is refused on purpose rather than unrecognised.

**`worktree-only` was left OPEN.** It is not settled for Claude Code, and the
guide now says so explicitly. `TASK-0063` and `TASK-0064` must read
*"`worktree-only` is the one term with a semantic gap"* before declaring it on
nine roles: an acting role that must commit to the real tree should be narrowed
to `opencode` rather than emitted with `isolation: worktree` on an unverified
mapping. Settling it needs a run, owned by `TASK-0040`.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context), in worktree `t0058` on branch `agent/t0058`
  (`ADR-0023`)
- Actions:
  - Verified `ADR-0022` reads **`Accepted — 2026-09-23`** before starting, per
    the Execution plan's stop condition.
  - Read `TASK-0055` and `TASK-0056` `## Findings` in full, plus
    `mcp-servers/_template/` (every file), `tests/validate.sh`,
    `scripts/install.sh`, `scripts/sync-registry.sh`, `tests/smoke-mcp.sh`,
    `scripts/emit-agents.py` and all six `agents/*/agent.md`.
  - `docs/development/authoring-guide.md`, five changes:
    1. **`mode` row amended** for F1 — a driver-invoked role must be `primary`;
       a `subagent` is silently replaced by OpenCode's default agent.
    2. **New section: *`mode: all` is rejected on purpose, not overlooked***.
       The decision `ADR-0022` clause 5.2 delegated here, argued from three
       grounds and given a reopening condition.
    3. **New section: *A delegate must exist for every client the caller
       declares***, stating both halves of the rule, its evidence
       (`TASK-0056` F5 plus its two controls) and Gated **yes**.
    4. ***`worktree-only` is the one term with a semantic gap*** rewritten to
       record the question as open, why `TASK-0056` could not answer it, that
       the emitter's current output is behaviour rather than a decision, the
       single question that settles it, and the six/two/nine role scope.
    5. **New section: *Authored (Python) servers, read from
       `mcp-servers/_template/`***, a per-element table read off the template,
       what each of the four scripts does and does not do with an authored
       server, and the two launch-form discrepancies.
- Observations:
  - **`mode: all` → reject.** `mode` here is a portability declaration, and it
    is load-bearing: `delegation-allowlist` is valid only with `primary`
    because Claude Code ignores an `Agent(...)` allowlist inside a subagent
    definition. `all` means both, so the same file's boundary would be
    enforced or silently widened depending on invocation — the failure the
    field exists to prevent. Nothing needs it (clause 5.1 already requires
    `primary` for driver targets), and `TASK-0055` tested only *selection*, not
    delegability or `delegation-allowlist` interaction. `ADR-0018` clause 8.1
    applies directly.
  - **`worktree-only` → left open**, which the brief and `SPRINT-CURRENT.md`
    both name as acceptable. Deciding "emit" would ratify current emitter
    behaviour on confounded evidence; deciding "refuse" would break `critic`
    and `ideator` — the two roles emitted for Claude Code, both declaring the
    term — on the same confounded evidence, and would be a component change
    this task is scoped out of.
  - **`mcp-servers/_template/` is three files and has no `__init__.py`.**
    Nothing in the repo has ever built it, so whether hatchling packages the
    namespace package as it stands is unverified and is written down as
    unverified.
  - **A second launch discrepancy exists beyond the one the brief named.**
    `install.sh` prints `uv run $(basename "$d")`, so the printed command only
    works when the `[project.scripts]` entry point equals the directory name.
    The template does not model that (`_template` vs `template-mcp-server`),
    and no rule requires it — the external shape has a name-equals-directory
    rule, the authored shape has none.
  - **`validate.sh` reads `pyproject.toml` not at all.** The destructive
    capability gate and the `.env.example` check parse `server.json` only, so
    they never see an authored server — `B-024`, restated in the guide with
    its owner.
- **Deviations from the Plan**, all from facts that post-date the brief:
  1. **The vocabulary has eleven terms, not ten.** `TASK-0071` added
     `test-allowlist` and `TASK-0074` put both command allowlists behind one
     rule. The guide was already correct on both, so no edit was needed — but
     the brief's Inputs table says "ten-term vocabulary" and is wrong.
  2. **The `delegates_to` rule is Gated `yes`, not `no`.** The brief and the
     acceptance criterion both said **no**, on the assumption that `TASK-0059`
     would enforce it. `TASK-0075` enforced it first (`INVALID DELEGATION` in
     `tests/validate.sh`, commit `607a955`, which also narrowed
     `agents/designer-manager/` to `opencode`). Writing **no** would have been
     a false Gated cell — the exact defect the column exists to catch — so the
     criterion "every Gated cell touched is true of `validate.sh` as it
     stands" was followed over the criterion naming the value.
  3. **The plan's step 4 ordering was reversed in effect**: the rule was
     written to *match* an existing gate rather than to precede one. Definition
     still precedes emission; it no longer precedes enforcement, because
     enforcement arrived early.
  4. **"Update the Gated column for every row touched" could not be done
     literally.** The Agents rule table has **no** Gated column — only the
     Skills, Loops, wiring-section and third-party tables do. Gated status for
     each agent rule touched is stated in prose in its own subsection instead.
     Adding a Gated column to the whole Agents table would mean asserting
     ~13 new gate claims this task did not verify individually, which is the
     risk the brief's own Risks section names first.
  5. **The `mode` row *was* amended** — the brief made it conditional on F1,
     and F1 was falsified.
- Validation:
  - `tests/validate.sh` → `validate.sh: OK`, exit 0.
  - `scripts/sync-registry.sh` → no-op; `git status` after it showed only
    `docs/development/authoring-guide.md` modified, so `docs/registry.md` is
    unchanged and no component was touched.
  - `tests/validate.sh` re-ran automatically via `.githooks/pre-commit` on
    commit. Not bypassed.
  - Secrets: the diff adds no value of any kind — only file paths, script
    names and quoted tool output already present in the task files.
  - Out of scope and confirmed untouched: `tests/validate.sh`,
    `scripts/emit-agents.py`, `agents/*`, `.ai/tasks/TODO.md`,
    `.ai/context/CURRENT_STATE.md`, `.ai/planning/SPRINT-CURRENT.md`,
    `.ai/planning/BACKLOG.md`.
- Result: **done.** Both decisions the ADR delegated here are made and argued
  in the guide: `mode: all` **rejected**, `worktree-only` **explicitly left
  open** with its scope. The `delegates_to` cross-client rule now states what
  the gate already enforces, so definition and enforcement agree.
- Commit: `c39a37b` — *Decide mode: all, scope worktree-only, verify
  authored-MCP section*. Recorded by a following commit, the convention this
  repo already uses (`3e664c2`, `12a3bff`): a task file cannot carry the hash
  of the commit that contains it.
- Push: **not pushed, deliberately.** This task ran in worktree `t0058`
  alongside two concurrent sessions; the human lands all three branches
  serially onto `master` to keep it linear (`ADR-0023`), and instructed this
  session not to push and not to rebase.
