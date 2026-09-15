# TASK-0039 — sync-registry.sh: emit an Agents section

## Objective
Add `agent` as a fourth component kind to `scripts/sync-registry.sh` so
`docs/registry.md` indexes agent roles alongside skills, MCP servers and
loops.

The smallest task in Phase 2, and deliberately so: the generator was
restructured in TASK-0011 precisely to make this cheap.

## Minimal context

### Why this is a two-line change and used not to be
`sync-registry.sh` has a **single emit path**. Its header states the design
intent: the kinds *"differ in only three ways: where their components live,
how their name/description are extracted… and whether a Shape column
applies. Everything common — the header, the template skip, sorted output,
the `?` fallback — lives here once."*

That structure exists because of a specific defect. The rule "templates are
not deployable components" was once written once per section, so fixing it
in one place did not reach the others, and **the same leak had to be fixed
three times** (TASK-0005, 0006, 0008) before B-007/TASK-0011 centralized it.

The practical consequence for this task: adding a kind means one `case`
branch in `extract()` and one `emit_section` call. **THE template skip at
`:103` already covers the new kind**, and `validate.sh` independently
asserts no generated row points at a `_template*` path, so a regression
fails a check rather than reaching a commit.

If this task finds itself duplicating loop logic, it has misread the file.

### The extraction is identical to loops
`extract()`'s `skill|loop` branch already handles *"YAML frontmatter with
the same two keys; they differ only in filename."* An agent file is the same
shape: frontmatter with `name` and `description`, in `agent.md`. So the
change is adding `agent` to that branch's case list and mapping it to
`agent.md` — not writing a new extractor.

### Why `unquote()` matters here
TASK-0018 found that a quoted `description: "..."` reached the registry
with its quotes intact while an unquoted one did not — *"visible only in
the two components that quote their frontmatter and invisible in the rest."*
ADR-0008 deliberately accepts both styles, so the **generator** normalizes.

`agent-tiers`' `SKILL.md` uses a quoted folded description (`description: >-`),
which suggests the roles reconciled in TASK-0045 may too. The existing
`unquote()` handles surrounding quote pairs; a **folded multi-line** scalar
is a different case, and whether `awk '/^description:/'` handles it is worth
confirming rather than assuming. The single-line rule TASK-0038 enforces
should prevent the problem, but the two facts need to be consistent.

### No Shape column
MCP servers carry a Shape column because two shapes exist and it is
**derived from which marker file is present** (ADR-0005's Clarification),
never self-declared. Agents have one shape. `emit_section`'s fourth
parameter stays empty, matching skills and loops.

There is a live question worth being explicit about: a role's **mode**
(primary vs subagent) is arguably registry-worthy, since it is the single
most consequential fact about a role. But it is *self-declared* frontmatter,
not derived — and ADR-0005's reasoning was that a self-declared field *"could
contradict the directory's actual contents; a derived one cannot."* Adding a
Mode column is therefore a real decision, not a formatting choice. **Default
to not adding it**; if it is added, the registry-integrity checks' per-section
column counting must be re-verified.

### The integrity checks derive column counts per section
`validate.sh`'s registry content check derives the expected column count
**per section from its own header**, with a direction-aware hint (too many
cells → an unescaped `|`; too few → a half-applied format change). So a new
section is covered automatically **provided its header and rows agree**.
That is worth verifying by observation rather than trusting, since it is the
one place this task could silently break an existing check.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `docs/development/authoring-guide.md` | TASK-0037 | Agents section normative; `name` and `description` rules fixed, `description` single-line |
| `agents/_template/agent.md` | TASK-0037 | Exists; must be **excluded** from the registry by the central template skip |
| `scripts/sync-registry.sh` | pre-existing | 125 lines. `unquote()` `:32-39`; `extract()` `:44-82`; `emit_section()` `:87-112`; THE template skip `:103`; three `emit_section` calls `:119-123` |
| `tests/validate.sh` | pre-existing, extended by TASK-0038 | Asserts no `_template*` row in the registry, independently of the generator; derives column counts per section from each header |
| `docs/registry.md` | generated | Currently Skills (2 or 3 after TASK-0035), MCP Servers (1, with Shape), Loops (1). No Agents section |
| `.ai/decisions/0005-mcp-servers-allow-node-packages.md` | pre-existing | Accepted + Clarified; derived-not-self-declared, the reasoning behind declining a Mode column |

**Verify the expected state; don't assume it.** Re-read
`sync-registry.sh` before editing: this brief cites line numbers, and a
prior task in the sprint may have shifted them.

## Scope

### Included
- Add `agent` to `extract()`'s frontmatter branch, mapping to `agent.md`.
- Add one `emit_section "Agents" agent agents` call.
- Regenerate `docs/registry.md` and commit the result.
- Verify the template is excluded **by the central skip**, not by a new
  per-section skip.
- Verify `validate.sh`'s registry-integrity checks cover the new section
  automatically, by observation.

### Not included
- **Any new template-skip logic.** B-007's whole point. If the central skip
  does not cover the new kind, that is a finding about the central skip.
- **A Shape column.** One shape.
- **A Mode column**, unless deliberately decided — and then only with the
  column-count checks re-verified and the self-declared-vs-derived tension
  recorded.
- **Any `validate.sh` change.** TASK-0038 owns the agent checks; this task
  only *verifies* that the existing registry checks extend.
- **Any `install.sh` change.** TASK-0040.
- **Authoring a role.** TASK-0043, 0045. This task ships a section that will
  legitimately be **empty except for its header** until then.
- A `prompts/` section. B-016; out of scope.

## Likely files
- `scripts/sync-registry.sh`
- `docs/registry.md` — regenerated
- `.ai/tasks/TASK-0039-registry-agents-section.md` — this file

## Execution plan
1. Confirm TASK-0037 landed; re-read `sync-registry.sh` and correct the
   line references above if they have moved.
2. Add `agent` to the `skill|loop` case in `extract()` and map it to
   `agent.md`.
3. Add the `emit_section "Agents" agent agents` call, placed to match the
   order categories appear in `AGENTS.md`'s Structure section.
4. Run `bash scripts/sync-registry.sh`; read the generated diff.
5. Confirm an **Agents** section exists with the right header and no
   `_template` row.
6. Confirm the template's exclusion came from the central skip — by
   inspecting the code path, not just the absence of the row.
7. **Prove the integrity checks extend**: temporarily add a malformed row to
   the new section (an unescaped `|`, then a missing cell) and confirm
   `validate.sh` fails with its direction-aware hint. Revert.
8. Temporarily add a fake `agents/_fixture-role/agent.md`, regenerate, and
   confirm it appears — proving the section is not merely an empty header
   that would silently never populate. Remove it and regenerate.
9. `bash tests/validate.sh` — expect green.
10. Confirm no fixture survives; `git status` clean of `_fixture-*`.
11. Review the diff; commit **both** the script and the regenerated
    registry; record the hash; push; confirm; record.

## Acceptance criteria
- [ ] `extract()` handles `agent` **within** the existing frontmatter
      branch; no duplicated iteration logic anywhere
- [ ] Exactly one new `emit_section` call
- [ ] `docs/registry.md` regenerated and committed, with an Agents section
- [ ] `agents/_template/` **absent** from the registry, excluded by the
      central skip — verified by reading the code path
- [ ] The section is **proven to populate**, using a temporary fixture role,
      not assumed from an empty header
- [ ] `validate.sh`'s registry-integrity checks **observed failing** on a
      malformed row in the new section, in both directions (extra cell,
      missing cell)
- [ ] No Shape column; no Mode column unless deliberately decided and
      recorded with the column counts re-verified
- [ ] No fixture committed
- [ ] `tests/validate.sh` green

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — **required**; this
      task changes the generator, so the regenerated registry must be
      committed in the same commit. CI re-runs a staleness check

## Risks and rollback
- **Risk: shipping an empty header that never populates.** The likeliest
  silent failure: no real role exists yet, so an Agents section with only a
  header looks correct whether the extractor works or not. Step 8 is the
  control — a temporary fixture proves population before the section is
  trusted. This is the same shape as lesson 1: a check, or here a generator
  branch, that cannot be seen working is still trusted.
- **Risk: re-introducing the per-section template skip.** B-007's defect was
  fixed three times before being centralized. Adding a skip "to be safe"
  recreates the exact duplication TASK-0011 removed.
- **Risk: a folded or multi-line description.** `awk '/^description:/'` takes
  the first line after the key. A `description: >-` folded scalar would yield
  an empty or partial cell. TASK-0038 enforces single-line descriptions,
  which should prevent it — but the generator's behaviour on the bad input
  should be known rather than assumed, since `agent-tiers` uses exactly that
  style today.
- **Risk: breaking an existing registry check.** The column-count check
  derives its expectation per section from that section's header. A
  malformed header would break the check for the new section only, silently.
  Step 7 proves it works instead of assuming the derivation generalizes.
- **Risk: committing the script without the regenerated registry.** CI runs a
  staleness check and would catch it, but the hook is the gate and CI is the
  second opinion — the regeneration belongs in the same commit.
- **Rollback:** two files, one of them generated. `git revert` removes the
  branch and restores the previous registry. Nothing depends on the Agents
  section until TASK-0043 authors a role.

## Outputs / handover

**Intended end state — this task has not run.** The table below is a plan.
`validate.sh` requires this section non-empty for briefs ≥ 0020 and cannot
distinguish an intention from a state (ADR-0012 Decision 3), so this
sentence does it.

| Artifact | Intended end state |
|----------|-------------------|
| `scripts/sync-registry.sh` | Four kinds; `agent` handled inside the existing frontmatter branch; one added `emit_section` call; **no** new template-skip logic |
| `docs/registry.md` | Regenerated, committed, with an Agents section — legitimately empty below its header until TASK-0043 |
| This brief's execution log | The fixture-population proof, and the integrity-check failure observed in both directions |
| Template exclusion | Confirmed to come from the central skip at `:103`, verified by code path rather than by the row's absence |
| `tests/validate.sh`, `scripts/install.sh` | **Untouched.** TASK-0038 and TASK-0040 |

**Next task starts here**: the registry indexes four component kinds, and a
role authored later appears in it automatically with no generator change.
TASK-0040 is unblocked and independent.

Deviation to watch for: if a Mode column is added after all, record the
self-declared-vs-derived tension explicitly (ADR-0005's Clarification is the
relevant reasoning) and re-verify the per-section column-count check, since
it derives its expectation from the header this task would have changed.

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
