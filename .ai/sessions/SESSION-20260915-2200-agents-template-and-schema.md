# SESSION-20260915-2200 — Execute TASK-0037 (agents/ template and schema)

- Date: 2026-09-15
- Agent: opencode (claude-opus-5)
- Objective: Turn `agents/` from a declared category with nothing behind it
  into a defined one — `agents/_template/` plus the normative schema in
  `docs/development/authoring-guide.md`.
- Entry state: clean tree at `26996e6`. ADR-0018 accepted, TASK-0036 done
  with a capability vocabulary. TASK-0037's step-1 gate verified by reading
  both files rather than by recalling the prior session's work.

## What was done

Definition only. `validate.sh`, `sync-registry.sh` and `install.sh` are
**untouched** — ADR-0008's definition-before-enforcement order is the
reason this task exists separately from TASK-0038/0039/0040.

- **`authoring-guide.md` gained an Agents section**: 9-row frontmatter rule
  table with a reason in every row (matching the three existing sections'
  house style), a 9-term capability vocabulary mapped to both clients, the
  `worktree-only` semantic-gap subsection, the forbidden-client-native-
  syntax rule, a no-budget statement, and Claude Code's 15,000-token
  description warning as a documented **vendor threshold, not a gated
  rule**.
- **`agents/_template/agent.md`** created, conforming to the schema.
- **`agents/README.md`** rewritten as a pointer, so the guide is the one
  owner of the category's rules.
- **`PROJECT_MAP.md` and `GLOSSARY.md`** corrected — beyond the brief's
  file list, found by grepping rather than trusting it.

## Findings

1. **The brief contradicted ADR-0018, and the ADR won.** The brief, written
   pre-spike, says twice that a term mapping to only one client *"cannot be
   offered"* / *"must be excluded"*. ADR-0018 clause 8.3 says such a term
   **is** legal, with the role narrowing `clients` and the emitter refusing
   rather than degrading. **Following the brief would have left a
   three-term vocabulary that cannot state any real role's safety
   boundary** — `bash-allowlist` is load-bearing in all four `agent-tiers`
   roles. Resolved for the ADR: a decision ratified on observed evidence
   outranks a brief written on a prediction. Not escalated, because the ADR
   is accepted and unambiguous; had it been silent I would have stopped.
2. **A ninth vocabulary term was required.** TASK-0036's table has eight
   and misses `qa-test`'s `webfetch: ask`, which is neither `no-webfetch`
   nor absent. Added `webfetch-requires-confirmation`. All four roles then
   map with **no leftover boundary**, verified by script.
3. **`worktree-only` is *partial*, not OpenCode-only.** The spike said "no
   per-agent equivalent"; Claude Code has `isolation: worktree`. But
   OpenCode **refuses** out-of-worktree calls while Claude Code
   **redirects** into an isolated copy — different guarantees. Decision
   assigned to TASK-0040 and added to the sprint table, because all four
   roles declare this term.
4. **`color` dropped from the schema.** ADR-0018 called it "overlap in name
   only"; the value sets share **zero** members. A key with no portable
   value would guarantee an emitter special case on day one.
5. **The template caught its own trap.** Checking it mechanically against
   the new table flagged `disallowedTools` — in a prose warning against
   using it. Harmless to a client, but a naive TASK-0038 grep would fail
   its own template and invite a weakening exemption. Reworded.

## Proof that the gate does not cover `agents/`

The brief requires noting a green gate proves nothing here. Rather than
assert it, the template was replaced with unparseable YAML, no delimiters,
an invalid `mode` and a forbidden `permission:` block. `validate.sh`
returned **exit 0**. Restored and confirmed **byte-identical by SHA-256**,
then re-validated.

The inverse of lesson 1: the usual risk is authoring a check that cannot
fail; here the point was confirming a check is genuinely **absent**, so
TASK-0038 is known-necessary rather than presumed so.

## Validation

- `bash tests/validate.sh` → PASS (`validate.sh: OK`, exit 0), re-run after
  every edit
- `bash scripts/sync-registry.sh` → **no diff**, `docs/registry.md` SHA-256
  identical before and after, confirming nothing was done out of order
- Template checked against all 9 rule rows plus the 3 forbidden keys: every
  applicable rule PASS, name↔directory exempt by the rule's own text
- Four `agent-tiers` roles mapped to the vocabulary by script: no leftover
  boundary in any of them

## Exit state

`agents/` is **defined, not populated** — it holds no real role, as
intended. **TASK-0038, TASK-0039 and TASK-0040 are now unblocked and
mutually independent.** TASK-0040 carries an added obligation: decide
`worktree-only`'s Claude Code emission, or refuse the client.

For TASK-0038 specifically: the schema is 9 rule rows and 9 vocabulary
terms, all in one guide section to mirror. Note that the vocabulary is a
**closed set** — a check should reject an unknown term rather than accept
any string — and that `name`↔directory must exempt `_template*` only, as
the skill rule does.

- Result: TASK-0037 done. Commit and push recorded in the task log.
