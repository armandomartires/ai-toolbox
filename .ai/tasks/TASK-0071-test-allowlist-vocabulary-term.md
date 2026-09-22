# TASK-0071 — A `test-allowlist` capability term, so `qa-test` can run what it claims to run

## Objective

Close `B-021`. Add an eleventh capability term, `test-allowlist`, with its own
`test_allow` key, in the order `ADR-0008` requires — **defined in the authoring
guide, then enforced in `tests/validate.sh`, then mapped in
`scripts/emit-agents.py`** — and declare it on `agents/qa-test/agent.md` so the
role's own description stops being false.

## Minimal context

`B-021` was raised 2026-09-16 by `REVIEW-0008`, from the S7 pilot's most
actionable finding. `agents/qa-test/agent.md` declares
`bash_allow: git status*, git diff*, git log*`, which emits
`bash: {"*": deny, "git status*": allow, …}` — so the role **cannot run
`pytest`, `npm test` or `tests/validate.sh`**, while `docs/registry.md`
advertises it as *"Writes and **runs** tests … reports pass/fail evidence"*.

**The defect is the vocabulary, not the role's behaviour.** The pilot observed
the boundary working correctly: the role refused to claim passes it had not
observed. It had no term with which to ask for the one thing it exists to do.

**Human decision, 2026-09-23:** resolve it with a new scoped term rather than
by retracting the description or by folding it into `TASK-0058`. The backlog
item's own warning governs the shape: *"Do not resolve it by adding
`bash: allow` — that hands a test runner arbitrary shell and dissolves the
boundary the role exists to have."*

**So the term has to be more than `bash_allow` under a second name**, or this
task closes the item by renaming it. Two constraints on `test_allow` entries
make it a genuinely narrower boundary, and both are mechanically checkable:

1. **No entry may be, or begin with, `*`.** An allowlist that opens universal
   is `bash: allow` wearing a costume — the exact resolution `B-021` forbids.
2. **No entry may contain a shell chaining metacharacter** (`;`, `&&`, `||`,
   `|`, `$(`, a backtick, or a newline). Otherwise `pytest; rm -rf /` is one
   "test command" and the boundary is decorative.

The guide already anticipated this task's shape, which is why the design is
not being invented here: *"If you add a third parameterised term, give it its
own key and make the default **deny**."*

**The ceiling, stated before it is asked about.** This term bounds the
**command surface** a role may invoke. It does not and cannot bound what the
tests themselves execute — any test runner runs arbitrary code by definition.
A role with `test-allowlist` cannot run `curl`; it can run a test that does.
That is a real limit and it belongs in the guide rather than in a task log.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `docs/development/authoring-guide.md` | pre-existing | Capability vocabulary table, **ten** terms; "The two parameterised terms deny by default" section |
| `tests/validate.sh` | `TASK-0038` | Agent block at ~line 412; `VOCAB` set of ten; the `bash_allow` iff-check at ~line 590 |
| `scripts/emit-agents.py` | `TASK-0040` | `VOCAB` dict of ten; `emit_opencode`'s `bash-allowlist` merge branch at ~line 221 |
| `agents/qa-test/agent.md` | `TASK-0043` | `clients: [opencode]`, `bash-allowlist` + three git patterns, description claiming it **runs** tests |
| `.ai/decisions/0008-*.md` | pre-existing | `Accepted` — definition→enforcement→emission order |
| `.ai/decisions/0018-*.md` | pre-existing | `Accepted`; clause 8 (refuse, never degrade) and 8.1 (per-term client coverage stated) |

**Verify the expected state; don't assume it.** In particular re-count the
vocabulary before writing "eleven" anywhere: `emit-agents.py`'s own docstring
says *"five of the nine capability terms"* over a table of **ten**, so at least
one existing count is already wrong.

## Scope

### Included

- The term's **definition** in `docs/development/authoring-guide.md`: a
  vocabulary row, the `test_allow` schema row, its per-client coverage, the two
  entry constraints, and the command-surface ceiling above.
- The **gate** in `tests/validate.sh`: `test-allowlist` admitted to `VOCAB`;
  `test_allow` required iff declared and forbidden otherwise; non-empty; both
  entry constraints. **Each new failure mode observed failing before it
  passes**, and the fixtures recorded in this file.
- The **emission** in `scripts/emit-agents.py`: a third `PARAMETERISED` entry
  merging into the same deny-first `bash:` map as `bash-allowlist`, so a role
  may carry both; `claude_code: None`, so Claude Code emission refuses.
- `agents/qa-test/agent.md`: declare the term and a `test_allow` set.
- Correcting `emit-agents.py`'s stale *"five of the nine"* docstring count,
  because this task changes the number it is wrong about.
- Raising a backlog item for the `bash_allow` sibling hazard (below).

### Not included

- **Applying the two entry constraints to `bash_allow`.** Same hazard, and
  `git-ops`/`shell-runner` would pass unchanged — but it widens an agreed
  decision into one nobody made, and it changes the boundary of two roles this
  task was not scoped against. **Raise it as a backlog item instead.**
- Any change to `agents/git-ops/agent.md` or `agents/shell-runner/agent.md`.
- The registry's Clients column — that is `B-026` / S9's `TASK-0060`.
- Verifying that OpenCode's matcher actually matches these patterns at run
  time. See Risks: this task can prove the term is declared, gated and emitted;
  it **cannot** prove `pytest*` matches `pytest -q tests/` without running the
  client, and it will not claim to.

## Likely files

- `docs/development/authoring-guide.md` — definition
- `tests/validate.sh` — enforcement
- `scripts/emit-agents.py` — emission + docstring count
- `agents/qa-test/agent.md` — the role that forced the term
- `.ai/planning/BACKLOG.md` — B-021 closed, new item raised
- `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md` — records
- **Not** `docs/registry.md`: `qa-test`'s description becomes *true* rather
  than different, so the generated row should not move. If it does, that is a
  finding.

## Execution plan

1. Re-read the vocabulary and count it. Record the actual number.
2. Guide first (ADR-0008): vocabulary row, schema row, constraints, ceiling,
   and the per-client coverage sentence updated from "ten"/"six".
3. Gate second. Write the checks, then **prove each fails**: a fixture role
   declaring `test-allowlist` with no `test_allow`; with an empty one; with a
   `*` entry; with a `;` entry; and a `test_allow` present without the term.
   Record the observed failure text for each.
4. Emitter third. Add the `VOCAB` entry and the merge branch; fix the
   docstring count.
5. Emit `qa-test` for OpenCode into a scratch dir and **read the emitted
   `bash:` map** — confirm `"*": "deny"` is first and the test patterns are
   present alongside the three git ones.
6. Attempt to emit `qa-test` for **claude-code** and confirm it is *skipped*
   (not in its `clients`), then a scratch fixture declaring the term with
   `clients: [claude-code]` and confirm **EMISSION REFUSED**.
7. `tests/validate.sh`, `scripts/sync-registry.sh`, remove fixtures, verify
   removal, review the diff, commit, push, record.

## Acceptance criteria

- [ ] The guide defines `test-allowlist` and `test_allow` before either other
      file references them, and states the per-client coverage explicitly.
- [ ] `tests/validate.sh` rejects all five malformed cases, **each observed
      failing with its message recorded in this file**.
- [ ] A correct `qa-test` passes the gate.
- [ ] `scripts/emit-agents.py` emits the merged deny-first `bash:` map with
      `"*": "deny"` first, and **refuses** a claude-code emission of the term.
- [ ] `agents/qa-test/agent.md`'s description is true of the role as emitted.
- [ ] Vocabulary counts agree across guide, gate and emitter — including the
      stale docstring.
- [ ] `docs/registry.md` is regenerated and its `qa-test` row is unchanged.
- [ ] Fixtures removed, removal verified.
- [ ] `B-021` closed in `BACKLOG.md` with what was decided and what was left.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` — components changed
- [ ] `git status --porcelain` — no fixture or scratch file left behind

## Risks and rollback

- **Closing the item by renaming the defect.** The whole risk. If `test_allow`
  accepts anything `bash_allow` would, `B-021` is not closed. The two entry
  constraints are the mitigation, and each must be observed failing.
- **Claiming the patterns match.** This repo cannot verify OpenCode's matcher
  offline, and `ADR-0020` clause 6 forbids inferring it. `TASK-0055`'s **F4**
  is already scoped to settle exactly this question for `git add`; its verdict
  applies here and this task must be re-read when it lands. Anything unproven
  is recorded as **unsettled**, never reasoned to.
- **A malformed fixture emptying the agent list.** `ADR-0018` records one bad
  file making `opencode agent list` return nothing. Fixtures go in a scratch
  directory, never in `agents/`, and removal is verified rather than assumed.
- Rollback is `git revert` of a single commit; nothing outside the repo changes.

## Outputs / handover

*Forecast until verified — this section describes an intention until the
execution log below records otherwise.*

| Artifact | End state |
|----------|-----------|
| `docs/development/authoring-guide.md` | Eleven-term vocabulary; `test_allow` schema row; constraints and ceiling stated |
| `tests/validate.sh` | Five new failure modes, each observed failing |
| `scripts/emit-agents.py` | Third parameterised term; corrected docstring count |
| `agents/qa-test/agent.md` | Declares `test-allowlist`; description now true |
| `agents/git-ops/agent.md`, `agents/shell-runner/agent.md` | **Unchanged**, deliberately |
| `.ai/planning/BACKLOG.md` | `B-021` **done**; the `bash_allow` sibling raised as a new item |

**Next task starts here**: `B-018` (`TASK-0072`), which is independent of this
one. The `bash_allow` sibling item raised here stays `ready` and unscheduled.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)
- Actions:
  1. Counted the vocabulary in all three files before writing "eleven"
     anywhere. **Ten terms** in the guide table, in `validate.sh`'s `VOCAB`
     and in `emit-agents.py`'s `VOCAB` — agreeing with each other and
     disagreeing with `emit-agents.py`'s own docstring, which said *"five of
     the nine"*. The five was right (the `claude_code: None` set); the nine
     was simply wrong. Corrected to **six of the eleven** and annotated so the
     next person to add a term corrects both numbers.
  2. **Guide** (`ADR-0008` step 1): vocabulary row; `test_allow` schema row;
     the "three parameterised terms" heading; a new subsection giving the two
     entry constraints, the reason `bash_allow` does not share them, and the
     command-surface ceiling; the four-of-eleven / seven-OpenCode-only counts.
  3. **Gate** (step 2): `test-allowlist` into `VOCAB`; the iff-check against
     `test_allow` in both directions; non-empty; the wildcard guard; the
     chaining-metacharacter guard. Comment records what is *not* checkable
     here and points at `TASK-0055` F4.
  4. **Emitter** (step 3): third `PARAMETERISED` entry, `claude_code: None`;
     the `bash-allowlist` branch generalised to both terms, keyed by term, so
     two allowlists merge into one map instead of the second discarding the
     first.
  5. `agents/qa-test/agent.md`: declared the term plus ten `test_allow`
     patterns, and added a paragraph telling the role what to do when a
     project's real test command is *not* in its allowlist (report a blocker;
     do not reach for a shell, do not rewrite the project's test setup).
- Observations:
  - **All five failure modes observed failing**, each with a distinct message,
    via fixtures under `agents/` created and removed in one scripted pass:
    missing `test_allow` → *"requires a 'test_allow' block list…"*; empty →
    *"an allowlist that permits nothing denies everything"*; `'*'` → *"is or
    begins with '*' — …the `bash: allow` resolution B-021 forbids"*;
    `'pytest; rm -rf /'` → *"contains the shell chaining metacharacter ';'"*;
    `test_allow` without the term → *"would have no effect"*.
  - **Negative control passed**: a correct declaration validates, so the five
    failures are discriminating rather than a fixture that fails for any
    reason.
  - **Emitted output read, not assumed.** `qa-test`'s OpenCode `bash` map
    carries `"*": deny` **first**, then all three `bash_allow` git patterns
    *and* all ten `test_allow` patterns in one merged map — the case that
    would have silently lost a set if the branch had assigned instead of
    merged.
  - **Claude Code emission refuses**, observed against a scratch fixture
    declaring the term with `clients: [claude-code]`: *"EMISSION REFUSED: role
    … declares 'test-allowlist', which Claude Code cannot enforce per-agent…"*.
    Note the division of labour this exposes and confirms: `validate.sh`
    **passes** that fixture. Term/client compatibility is the emitter's job,
    by design — the gate checks source completeness (ADR-0009).
  - **Side finding, and the one worth carrying forward:
    `agents/shell-runner/` has never existed.** The authoring guide asserted
    *"`git-ops` and `shell-runner` are OpenCode-only roles"* in the present
    tense; `CURRENT_STATE.md:1666` separately records the role as **not
    authored**. I was editing that exact sentence to add `qa-test` and would
    have propagated the false name had I not checked it while verifying a
    claim for `B-027`. Guide corrected to `git-ops`, `review` and `qa-test`,
    with a note. **`ADR-0017` and `ADR-0018` still name it and are left
    alone** — a decision record states what was decided when, and `ADR-0021`'s
    preserved falsified predictions set that precedent.
  - **Registry row unchanged**, as the brief predicted: the description became
    *true* rather than different. `scripts/sync-registry.sh` produced no diff.
- Validation:
  - `tests/validate.sh` — **OK** (1.592s on `/mnt/c`)
  - `scripts/sync-registry.sh` — regenerated, **no diff**
  - `git status --porcelain` — no fixture or scratch file left behind;
    `agents/` shows only the intended `qa-test` modification
- Result: **done.** `B-021` closed on the route the item itself specified.
  `B-027` raised for the `bash_allow` sibling hazard the asymmetry creates.
- Commit: *pending — recorded in the follow-up commit, the same shape as
  TASK-0069 and TASK-0070*
- Push: *pending*
