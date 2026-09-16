# SESSION-20260917-0400 — Narrow the MCP blast radius; build and prove the `gather_subset` guard

- Date: 2026-09-16
- Agent/model: opencode (claude-opus-5)
- Objective: Continue S6 after its spikes and ADR bodies. Execute `TASK-0026`
  (the false blast-radius claim, and disabling `ansible_navigator`) and
  `TASK-0031` (the guard — the sprint's highest-value deliverable).
- Context consulted: `.ai/planning/SPRINT-CURRENT.md` (S6), `TASK-0026`,
  `TASK-0031`, `TASK-0052` (its D1–D4 corrections), `TASK-0027`'s
  recommendation, `ADR-0016`, `ADR-0020`, `tests/validate.sh`'s manifest and
  wiring-claim checks, `skills/ansible-ops/` (SKILL.md, `references/hazards.md`,
  `templates/change-record.md`), `docs/operations/runbook.md`. **Outside this
  repo, read-only:** `SIGMA-infrastructure`'s `ansible.cfg:21-48`,
  `playbooks/`, `inventory/production.yml`; the installed `ansible-lint`
  package source (`rules/__init__.py`, `rules/complexity.py`, the config JSON
  schema).
- Tasks worked on: `TASK-0026` (done), `TASK-0031` (done). **Closes B-011,
  B-012, B-013.**

## Decisions

- **Express the tool disablement in BOTH the manifest and the wiring
  snippets**, with the manifest key stating that nothing checks it. The brief
  preferred snippets-only; a manifest key was addable without changing what
  the gate requires of other servers, so the *reason* travels with the
  manifest while the *operative* mechanism stays the snippets.
- **Decline one of `TASK-0026`'s own acceptance criteria.** The "LM Studio
  supplies models only" statement is refuted by `ADR-0020`; executing it would
  have restored a known-false claim. Marked complete-as-declined with the
  reason rather than skipped or mechanically obeyed.
- **Write the seven fixtures before the guard**, and write **fixture 6 before
  fixture 5**, since 5 is the one that gives false comfort.
- **Keep the guard and its harness OUT of `tests/validate.sh`.** It lints other
  repositories and needs `ansible-lint`; folding it in would break the gate's
  hermetic property (ADR-0009).
- **Correct `references/hazards.md` in the same change that falsified it**
  rather than leaving a follow-up. A known-false shipped claim is not a
  follow-up.

## Findings

**1. The false blast-radius claim was in SIX places, not the four `TASK-0026`
predicted.** `server.json`, three `configs/*/README.md`, **plus
`docs/operations/runbook.md:185`** — which told an operator wiring up a live
client that `WORKSPACE_ROOT` *was* the blast radius — **plus a *lessons* list**
at `configs/lm-studio-bionic/README.md:253`. The brief listed the runbook only
as "check, do not assume". **The brief's own count of the defect was an
instance of the defect.** Found by grepping the sentence; nothing in
`validate.sh` could see any of it.

**2. Three of `TASK-0026`'s Inputs rows were stale and one named a file that no
longer exists** (`configs/lm-studio/README.md`, renamed by `TASK-0047`). All
four line-number claims were wrong. The brief's instruction to re-read before
editing is what caught it.

**3. The gate's authorization check was observed failing for the first time
against this manifest** — `granted: false` with `destructive: true` produced
the correct message at exit 1 — then restored **byte-identically by SHA-256**.

**4. `TASK-0027`'s recommendation was WRONG on its own tiebreaker, and this is
the session's most consequential finding.** It called `.ansible-lint`-based
per-rule config the "declarative wiring tiebreaker". For a **custom** rule that
is a **fatal** error: the config schema's `$defs.rule` sets
`additionalProperties: false` and permits only `exclude_paths`, so
`rules: {gather-subset-mounts: {...}}` yields *"Additional properties are not
allowed"* at **exit 3 with nothing linted**. `AnsibleLintRule.get_config()`
exists, reads `options.rules[<id>]`, and **the schema forbids ever populating
it** — an API reachable only through an illegal config. Configuration moved to
environment variables, with the downgrade recorded: rule config now sits
outside the committed lint config and is not reviewable alongside it.
`enable_list` *is* legal, so enabling stays declarative.

**5. My fires-proof harness had the defect it was built to prevent.** It
matched the rule **ID**, which appears in `ansible-lint`'s *error* output
(`$.rules['gather-subset-mounts']`). With finding 4 active, four fixtures were
reported as *"fired but WRONG MESSAGE"* rather than *"did not fire"* — **so a
careless read concludes the rule fires and merely words things badly, when it
had not run at all.** Fixed to match the rule's own messages, plus a
`config_ok` pre-flight that aborts when the config is rejected so the harness
cannot silently test nothing. **TASK-0042's lesson in a new place: match on the
check's own message, never on a string that also appears in unrelated
output.**

**6. Fixture 4 could never reach the branch it was written to exercise.**
`hosts: "{{ undefined }}"` is failed first by the built-in `syntax-check`,
which is **unskippable**. Replaced with a wildcard pattern — syntactically
valid, still unresolvable — after which the ambiguity branch fires with its
distinct message. **A branch unreachable by its own test case is not proven by
a passing suite; it simply never runs.** Recorded as the guard's ceiling in
four places rather than worked around.

**7. The decisive proof of the guard is outside the fixture set.** Fixture 5's
silence is satisfied equally by a correct guard and by one that classifies
nothing (`TASK-0052` D2). So the guard was run against the **real** estate:
silent on both actual playbooks, then — with `gather_facts` flipped to `true`
**in a `/tmp` copy only** — it fired naming **`sigsrvpve1`**, resolved through
the real nested inventory. That is what makes the silence discriminating rather
than inert. `SIGMA-infrastructure` was never written to.

**8. A shipped false claim was created and corrected in the same change.**
`references/hazards.md` said the repo ships *"no guard, no hook, no wrapper, no
linting rule"* for any hazard class. True when written, **false once the guard
landed** — the self-describing-artifact class `TASK-0046` diagnosed, recurring
in the sprint that delivered the guard. Replaced with what is now true, four
verified limits attached, supersession visible rather than overwritten.

**9. A false claim I wrote in the PREVIOUS session was found and retracted.**
`TASK-0027`'s log and that session record said my probe's
`create_matcherror(..., lineno=1)` signature was invalid. `rules/__init__.py:85-95`
shows `lineno` **is** a documented parameter, proven by re-running the original
form — it fired. The probe's silence had **one** cause (`profile: production`
filtering an unlisted rule) and I reported two, having changed two things at
once and credited the wrong one. **Retraction spread checked by grep rather
than assumed:** it reached two files, not the four my first correction note
claimed — which would have been a second unverified claim inside the
correction of the first.

**10. The mandatory gate is unaffected, measured not assumed.** 1111 / 1108 /
1073 ms on `/mnt/c` after the change against `~1150 ms` before. Timed on
`/mnt/c` deliberately; `/tmp` understates by ~40%.

## Validation

- `bash tests/gather-subset-guard.sh` → **`PASS (10 checks)`**: four fixtures
  fire with the right message, four stay silent, the two failure messages are
  proven distinguishable, and a **negative control reproduces the
  `enable_list` silent-no-op trap**.
- `bash tests/validate.sh` → **`validate.sh: OK`** throughout, and **observed
  failing** on a deliberately broken `authorization` block before being
  trusted, then restored byte-identically (SHA-256).
- `bash scripts/sync-registry.sh` → **no diff** both times. Correct: the guard
  ships inside an existing skill, and `description` was untouched.
- **`SIGMA-infrastructure` untouched.** `git status --short` empty before and
  after every task; `HEAD` `d4e2dd1`; `[ahead 42]`;
  `capture_pve_baseline.yml` still `gather_facts: false`; its `ansible.log`
  mtime still `2026-09-12 16:15:01`. Every mutation was in `/tmp/opencode/`.
- Commits: `94d727d` (TASK-0026), `a969867` (hash records), and the
  TASK-0031 commit recorded in that brief.

## Handover

**S6 is nearly complete. Remaining: `TASK-0032`, ratification of the three
ADRs, and a checkpoint.** All five of Phase 6's exit criteria are now met, so
what is left is judgment rather than implementation.

**Ratification is genuinely owed and is the human's**, especially `ADR-0015`,
whose clause 1 *reverses* a mechanism the plan approved.

**Two things the checkpoint should weigh, since they are uncomfortable:**
- **`TASK-0027`'s recommendation was falsified by the task that implemented
  it** (finding 4). The spike's *conclusion* — a custom `ansible-lint` rule —
  survived; its stated *reason* for preferring that route did not. Worth asking
  whether the recommendation would have been the same had the schema constraint
  been known.
- **Three of this sprint's mechanisms can each be installed and inert**, and
  two of them were *observed* in that state during the sprint. The guard now
  ships a fires-proof; nothing equivalent exists for the Claude Code matcher or
  the `experimental.codeMode` case, and neither is this repo's to fix.

**`TASK-0032` can start cold**: it records the target-repo evidence trail and
must state that the repo which motivated the guard **does not run it**, and why
that was correct under Option (a). The evidence it needs is already gathered
across `TASK-0027`, `TASK-0031` and this record.

**The checkpoint is NOT `REVIEW-0009`** — S8 reserved that number.
