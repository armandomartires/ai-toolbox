# SESSION-20260916-0800 — Author the project-build loop

- Date: 2026-09-15
- Agent: opencode (claude-opus-5)
- Objective: TASK-0044 — author `loops/project-build/loop.md`, the production
  sequence, with ADR-0019's merge gate made explicit.
- Entry state: clean tree at `bd28848`. Phases 1–3 complete; three design
  roles authored and emitted; `loops/design-brief/` done.

## What was authored

`loops/project-build/loop.md` — 218 lines, 8 steps: plan → implement → test →
fix (bounded) → review → document → commit → stop at the gate. Derived from
`agent-tiers`' `bmad-workflow.md`, **read in place** at its
`opencode-customization` path, since ADR-0017's rejection means the import
never happened. All four of the brief's line references were accurate against
the landed file, so no drift-resolution divergence to follow.

## Three findings the brief did not forecast

1. **ADR-0019 requires a step the inherited sequence lacks.** Clause 2.1's
   autonomous list names *document*. `bmad-workflow.md` has **seven**
   numbered items and **zero** mentions of documentation — both counted, not
   estimated. Added as step 6, and **labelled in the loop as the one
   addition**, so a reader comparing the two files finds an explanation
   rather than an unexplained discrepancy.
2. **Separating the two known bounds revealed a third one missing.** A
   `review` block correctly does *not* consume the fix-cycle budget — but
   stated only that way, the review path is **unbounded**: block → fix →
   block, indefinitely. Neither source addresses it. Added: the **same
   finding** surviving three review rounds stops and escalates, since that is
   a `review`-vs-`build` disagreement about what the story requires. **The
   brief's risk section anticipated conflating the two bounds; it did not
   anticipate the gap that conflation was hiding.**
3. **The two-owners question had no answer among the brief's options.** It
   offered "the loop is authoritative and the skill's copy points at it" or
   the reverse — **both assume this repo can edit the skill**, which ADR-0017
   settled it cannot. Recorded instead as **two artifacts with one shared
   ancestor, neither updating the other**, this loop governing work in this
   repo, and any divergence a finding to record. Weaker than one owner, and
   said so rather than implying a synchronisation that cannot happen.

## Decisions made

- **`release-check` referenced, not restated**, for the commit step — it
  genuinely does more at the tail (secret scan, registry regeneration, effect
  verification, prove-new-checks-bite). **Caveat stated**: it is scoped to
  *this* repo and names `tests/validate.sh`/`sync-registry.sh` directly, so
  elsewhere it is the pattern rather than the procedure.
- **The ambiguity condition carries an explicit test** — *"not 'is this
  hard?' but 'does the brief answer it?'"* — because clause 2.5 is the
  easiest thing here to misread as "never stops", and that reading produces a
  loop that confidently builds the wrong thing.
- **Success stated as the intended terminus**, not an early exit: the loop
  ends with work committed, unmerged, unpushed.

## The read-back that mattered

Walked all 8 steps against each role's actual capability and against
`subagent_depth: 1`. **Every subagent step (test, review, commit) is invoked
by `build`, a primary** — never subagent-to-subagent, verified against
`agent-tiers`' bmad fragment whose `build` allowlist contains exactly
`qa-test`, `review`, `git-ops`. A version where `qa-test` invoked `build` to
fix things would be unexecutable under the depth limit, and that is the
natural way to write it wrong.

Also confirmed `plan`/`build` are stated as **built-in primaries configured
by override, never markdown role files** — creating `agents/plan/` would
replace OpenCode's tuned built-in prompt wholesale.

## Validation

- `bash tests/validate.sh` → PASS. Also **observed failing** (exit 1,
  `MISSING SECTION '## Exit conditions'`) on a deliberately renamed section,
  proving the gate covers this file rather than assuming it from a green run.
  Restored and hash-verified.
- `bash scripts/sync-registry.sh` → Loops section now **three rows**.
- No permission boundary restated — grep confirms zero `permission:`,
  `disallowedTools`, `deny`, `allow:`. Seven links to ADR-0019, four to
  `AGENTS.md`, one each to the three role directories.
- No size budget invented (ADR-0008).

## Exit state

**Both loops exist as gated components, and neither can execute.**
`project-build` names `qa-test`, `review` and `git-ops`; `design-brief`'s
step 7 delegates its commit to `git-ops`. All three are TASK-0045's.

**TASK-0045 is now the single blocker** between the sprint and TASK-0046's
pilot — which is what REVIEW-0008's pre-committed question ("did anything get
exercised?") is really about.

- Result: TASK-0044 done. Commit `180051f`, pushed to `origin/master` and confirmed by re-fetch.
