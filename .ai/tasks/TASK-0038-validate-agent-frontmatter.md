# TASK-0038 — validate.sh: enforce the agent schema, proven by failing fixtures

## Objective
Mirror TASK-0037's normative agent schema into `tests/validate.sh`, so
`agents/` stops being the only component category the commit gate does not
police — and **observe the new checks failing** on deliberately malformed
fixtures before trusting them.

## Minimal context

### The lesson this task exists to not repeat
Lesson 1: *a check that cannot fail is worse than no check, because it is
still trusted.* Lesson 8: *knowing lesson 1 does not prevent authoring an
unfailable check* — recorded because this repo has done it **twice**.

Two concrete instances are on file:

- TASK-0021 planned two checks that compared a deployed skill with its own
  target through a symlink. They could never fail. Struck before being run
  (REVIEW-0007 finding 3).
- `validate.sh`'s hook check originally used `[ -x ]`. On this
  `core.filemode=false` `/mnt/c` 9p checkout **every file reports
  `rwxrwxrwx`**, so it could never fail. Replaced with a check on the mode
  git records (`git ls-files -s`), which is the authoritative one.

That second trap is live in this working tree right now, and any new check
touching file modes or executability will hit it.

So the deliverable is not "checks added". It is **checks demonstrated
failing for the right reason**, then passing. The demonstration is the
work; the code is incidental.

### The gate's three load-bearing properties
`validate.sh` runs on every commit via `.githooks/pre-commit`. ADR-0007
measured it at 285–372 ms against `git status`'s own 544–724 ms, concluding
*"the performance objection does not survive measurement"* — but that
argument only holds while the gate stays cheap.

- **Offline.** No network. Ever. `smoke-mcp.sh` is kept out of the gate for
  exactly this reason, stated in three separate files.
- **Hermetic.** No dependence on machine state, env vars, or installed
  clients. ADR-0009: *"a gate that cannot pass on a clean checkout stops
  being run, and a gate that is not run is worse than no gate, because it is
  still trusted."*
- **Sub-second.** To be **measured** after this change, not assumed.

### What must not be checked, and why
ADR-0009 forbids validating runtime presence. Concretely, this task must
**not** check:

- that `~/.config/opencode/agents/` or `~/.claude/agents/` exists
- that an emitted per-client agent file exists or is current
- that any client is installed

ADR-0018 records why the last one is unfixable: emission produces a fourth
copy whose freshness nothing can verify, and *"anyone who later fixes this
by checking the deployed copy breaks every fresh clone and CI."* This task
is the most likely place for someone to try. It checks **source
completeness** only.

### Parse, don't grep
The skill checks parse YAML with `python3` rather than grepping, and the
authoring guide's frontmatter rules are mirrored *"so guide and gate cannot
drift"* (ADR-0008). A grep for `^name:` cannot tell a frontmatter key from a
line in a system prompt, and an agent file's body is a system prompt that may
legitimately contain `description:` in an example. Grepping here is not a
style preference — it is a correctness bug waiting for the first role whose
prompt discusses frontmatter.

### The one check whose absence is deliberate
The schema forbids client-native permission syntax in a role file
(ADR-0018). That **is** checkable statically — look for a `permission:` key
or the string `disallowedTools` — and it should be checked, because it is
the one rule whose violation silently defeats the entire one-source
mechanism. Worth stating explicitly since it is a body check rather than a
frontmatter check, which makes it unlike every existing skill rule.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `docs/development/authoring-guide.md` | TASK-0037 | Carries the normative Agents section: rule table with reasons, capability vocabulary, the no-client-native-syntax rule, the no-budget statement |
| `agents/_template/agent.md` | TASK-0037 | Exists; satisfies every rule except name↔directory |
| `tests/validate.sh` | pre-existing | 474 lines; eight check groups; **none reads `agents/`**. Skill checks at the top parse frontmatter with `python3`; hook check uses `git ls-files -s`, not `[ -x ]` |
| `.ai/decisions/0008-skill-linter-frontmatter-only.md` | pre-existing | Accepted; enforcement follows definition; no invented budgets |
| `.ai/decisions/0009-environment-supplied-configuration.md` | pre-existing | Accepted; **documentation completeness, never runtime presence** |
| `.ai/decisions/0018-agent-portability-one-source-per-client-emission.md` | TASK-0033/0036 | Accepted; clause 4 forbids a freshness check, clause 5 states what to validate instead |
| `.ai/reviews/REVIEW-0007-sprint-s5-session-handover.md` | pre-existing | Findings 3 and 4 — two unfailable checks struck, and a check disabled by moving a file |
| `.githooks/pre-commit` | pre-existing | 39 lines; runs `validate.sh` only; recorded `100755` in git's index |

**Verify the expected state; don't assume it.** Confirm TASK-0037 landed
and that the guide's Agents section exists — mirroring a schema that has not
been written would make the gate its author, which is the inversion
ADR-0008 forbids.

## Scope

### Included
- A new check group in `tests/validate.sh` for `agents/*/agent.md`,
  parsed with `python3`, mirroring TASK-0037's rule table:
  frontmatter present and terminated; required keys present and non-empty;
  `name` equal to the directory (`_template*` exempt); `description`
  single-line; mode valid against the enumerated set; capability profile
  drawn from the enumerated vocabulary; `metadata.version` semver if
  present.
- A body check rejecting client-native permission syntax (`permission:` as a
  key, `disallowedTools`, `tools:` as a frontmatter key).
- **Report, never skip**, any file in `agents/*/` that does not match the
  expected filename — the same rule the handover check applies in
  `.ai/tasks/`, for the same reason: *a silently skipped file is an
  unchecked file, and a renaming scheme could otherwise disable the check.*
- A `## What this does not prove` comment in the new group's source, matching
  the handover check's precedent, stating that it validates the source
  contract and **not** that any emitted file exists, is current, or grants
  the permissions the profile intended.
- Fixture-based proof: for **each** rule, a deliberately malformed fixture
  observed failing with the right message, then removed.
- A measurement of the gate's runtime before and after.

### Not included
- **Any check on deployed or emitted files.** ADR-0009, ADR-0018 clause 4.
- **Any check requiring an installed client, network, or env var.**
- **Any invented budget** — no length cap, no description byte limit, no
  role count. ADR-0008.
- **Registry checks for agents.** TASK-0039 adds the section; whether the
  existing registry-integrity checks then cover it automatically is that
  task's question.
- **`install.sh` or `sync-registry.sh` changes.** TASK-0039, TASK-0040.
- Validating the *emitter's* output correctness. That needs fixture testing
  of the emitter itself and belongs to TASK-0040; ADR-0018's consequences
  already record that `validate.sh` cannot catch a wrong mapping.
- Checking `prompts/`. Still out of scope (B-016).

## Likely files
- `tests/validate.sh` — one new check group
- `agents/_fixture-*/agent.md` — **temporary**, created and removed during
  the proof runs, never committed
- `.ai/tasks/TASK-0038-validate-agent-frontmatter.md` — this file's
  execution log carries the per-rule failure evidence

## Execution plan
1. Confirm TASK-0037 landed: the guide's Agents section and
   `agents/_template/agent.md` both exist.
2. Measure the current gate: run `bash tests/validate.sh` three times and
   record the timings, so "still sub-second" is a comparison rather than an
   assertion.
3. Read the existing skill check group as the shape to follow — `python3`
   heredoc, `fail=1` and continue rather than early exit, one message per
   defect.
4. Write the new check group, mirroring the guide's table rule for rule.
5. Add the `## What this does not prove` comment naming the emitted-file
   gap explicitly.
6. **Prove each rule fails.** For every rule, create a fixture violating
   exactly that rule, run the gate, confirm it fails **with the intended
   message**, then remove the fixture. Record each observation.
7. Prove the report-never-skip behaviour: a file named `role.md` instead of
   `agent.md` must be **reported**, not ignored.
8. Prove the body check: a fixture with a raw `permission:` block must fail.
9. Prove the template exemption: `agents/_template/` must pass despite its
   name not matching a real role.
10. Confirm the gate passes with only the template present.
11. Re-measure the runtime; compare against step 2. If it is no longer
    sub-second, that is a finding to report, not a number to round down.
12. Confirm no fixture survives: `git status` clean of `_fixture-*`.
13. `bash scripts/sync-registry.sh` — expect **no diff** (no agent kind
    yet).
14. Review the diff; commit; record the hash; push; confirm; record.

## Acceptance criteria
- [ ] Every rule in the guide's Agents table has a corresponding check
- [ ] **Every check is observed failing** on a fixture violating exactly
      that rule, with the intended message — each failure recorded
      individually in the execution log, not summarised as "all proven"
- [ ] A misnamed file in `agents/*/` is **reported, not skipped**, and this
      is demonstrated
- [ ] The client-native-syntax body check is demonstrated failing on a raw
      `permission:` block
- [ ] `agents/_template/` passes, exempt only from name↔directory
- [ ] The check group's source carries a `## What this does not prove`
      comment naming the emitted-file gap
- [ ] **No check touches deployed files, installed clients, env vars, or the
      network** — verified by reading the added code, not by it passing
- [ ] No budget invented
- [ ] Gate runtime measured before and after; still sub-second, or the
      regression reported
- [ ] No fixture committed
- [ ] `tests/validate.sh` green with only the template present

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — run it; expect no
      diff, since the agent kind arrives in TASK-0039

## Risks and rollback
- **Risk: authoring an unfailable check.** The named, expected failure mode
  of this task. Lesson 8 says intention is not the control; the per-rule
  fixture proofs are. A check whose fixture "should" fail but passes is the
  finding, and it must be recorded rather than adjusted until it looks right.
- **Risk: the `core.filemode=false` trap.** Every file in this tree reports
  `rwxrwxrwx`. Any check involving executability or file modes must use
  git's recorded mode, as the hook check already does. This is the exact
  trap that produced one of the two historical unfailable checks.
- **Risk: grepping instead of parsing.** An agent body *is* a system prompt
  and may legitimately contain `description:` or `permission:` in prose or an
  example. A grep-based check would produce false failures on the first such
  role — and the body check for client-native syntax has to be written
  carefully for the same reason: it must distinguish a frontmatter key from a
  discussion of one.
- **Risk: someone adds a freshness check here later.** The most attractive
  wrong idea available in this task. ADR-0018 clause 4 exists to be cited,
  and the `## What this does not prove` comment puts the reasoning where a
  reader will hit it before writing the check.
- **Risk: a fixture left behind.** A `_fixture-*` directory surviving into a
  commit would either fail the gate permanently or, worse, be skipped and
  quietly become a precedent. Step 12.
- **Risk: slowing the gate.** Another `python3` invocation is not free. The
  gate's cheapness is load-bearing for ADR-0007's argument that it belongs in
  the hook at all. Measure; if it regresses, consider folding the new parse
  into an existing heredoc rather than adding a process.
- **Rollback:** one file changed. `git revert` removes the check group and
  restores the gate exactly. Nothing depends on these checks yet, since no
  real role exists until TASK-0043.

## Outputs / handover

**Intended end state — this task has not run.** The table below is a plan.
`validate.sh` requires this section non-empty for briefs ≥ 0020 and cannot
distinguish an intention from a state (ADR-0012 Decision 3), so this
sentence does it.

| Artifact | Intended end state |
|----------|-------------------|
| `tests/validate.sh` | A ninth check group covering `agents/*/agent.md`, parsed not grepped, mirroring the guide rule for rule, carrying a `## What this does not prove` comment |
| This brief's execution log | One recorded observation **per rule** of the check failing with its intended message; the misnamed-file and body-check demonstrations; before/after timings |
| `agents/` | Still only `_template/` and `README.md`. Now **enforced** rather than merely defined |
| Deployed/emitted files | **Unchecked, deliberately.** ADR-0009 and ADR-0018 clause 4 |
| Gate properties | Offline, hermetic, sub-second — the last one measured, not assumed |

**Next task starts here**: `agents/` is enforced, so any role authored by
TASK-0043 or TASK-0045 is gated at commit time. TASK-0039 and TASK-0040
remain independent and unblocked.

Deviation to watch for: if any rule in the guide turns out **not to be
statically checkable**, do not weaken the rule to fit the check or drop the
check silently. Record it as a rule the guide states and the gate cannot
enforce — the same honest status the target repo's `gather_subset` rule
carries ("Tracked as unenforced until then"), and the status that made S6's
TASK-0031 worth doing at all.

## Status
- Status: planned
- Owner: agent
- Created: 2026-09-15
- Updated: 2026-09-15

## Execution log
### Attempt 1
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
