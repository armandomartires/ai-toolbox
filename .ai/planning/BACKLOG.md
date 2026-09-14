# Backlog

| ID | Title | Priority | Value | Dependencies | Risk | Status | Ready when |
|----|-------|----------|-------|--------------|------|--------|-----------|
| B-001 | Subagent-run registry validation | low | medium | Phase 3 | low | **done** | TASK-0018 — closed as **superseded**, not implemented (ADR-0011); scoping it found two real registry defects, both fixed |
| B-002 | Skill Linter (frontmatter ~~+ line budget~~) | medium | high | Phase 1 | low | **done** | TASK-0012 — frontmatter only; line budget dropped per ADR-0008 |
| B-003 | MCP server smoke test harness | medium | high | Phase 1 | medium | **done** | TASK-0009 — `tests/smoke-mcp.sh` |
| B-004 | Repo LICENSE file (backs skill `license:` claims) | low | medium | none | low | **done** | TASK-0013 — MIT chosen by human; ADR-0003's known gap closed |
| B-005 | Re-scope Phase 2 exit criterion (LM Studio has no Agent Skills target) | high | medium | none | low | **done** | resolved by ADR-0006 |
| B-006 | ~~Port~~ **Author** a loop component | medium | medium | none | low | **done** | TASK-0008; verb corrected — nothing existed to port (ADR-0006) |
| B-007 | De-duplicate sync-registry.sh per-section loops (or assert no `_template*` row) | medium | medium | none | low | **done** | TASK-0011 — did both |
| B-008 | Unify `.ai/decisions/` file naming (`ADR-NNNN-*` vs `NNNN-*`) | low | low | none | low | **done** | TASK-0024 — 7 files renamed to `NNNN-*`; found `.ai/README.md` was prescribing the *old* scheme |
| B-009 | `project-migration` scaffolds `ADR-NNNN-*.md`, diverging from `project-workflow`'s `NNNN-*` | low | low | none | low | **done** | TASK-0025 — closed as **decided, not implemented** (ADR-0013). Its premise was false: the skills scaffold two different frameworks, not one spelled two ways |
| B-010 | No instruct layer for the `ansible` MCP server | high | high | none | medium | **ready** | S6 / TASK-0029, TASK-0030 — scoped by PLAN-0003 against a real Ansible repo before estimating; six claims in the source analysis were corrected first |
| B-011 | A documented, statically checkable, unenforced Ansible safety rule | high | high | B-010 (shares the skill's vocabulary) | medium | **ready** | S6 / TASK-0031 — `gather_subset: "!mounts"`; the rule and its failure mode are already written down in the target repo, so nothing needs inventing |
| B-012 | `server.json` overstates `WORKSPACE_ROOT` as the blast radius | medium | medium | none | low | **ready** | S6 / TASK-0026 — false for `ansible_navigator` (remote infra) and `ade_setup_environment` (system packages); restated in all 3 wiring snippets |
| B-013 | `ansible_navigator` cannot express the safe workflow but can execute unsafely | high | high | none | low | **ready** | S6 / TASK-0026 — no inventory/limit/`--check`/`--diff` parameter exists; disable it. Human authorized 2026-09-14 |

**Four items are open — B-010…B-013, all raised by PLAN-0003 and all
scoped in S6.** B-001…B-009 remain closed.

All four were written **after** the artifacts were read, which is the
practice the note below ("read the artifacts before estimating the work")
asks for. The source analysis that prompted them proposed a
staging-promotion workflow the target estate cannot implement at all; that
correction happened at plan time rather than becoming a fourth item closed
on a false premise.

Two are corrections to **this repo's own claims** (B-012, B-013), not to a
component. Worth noting because the governance layer polices components
and nothing polices the governance layer — the standing lesson 6 — and
these two are that pattern reappearing in `mcp-servers/` and `configs/`.

Three of the nine were closed by **scoping rather than building**: B-001
(superseded, ADR-0011), B-002 (split, ADR-0008), B-009 (false premise,
ADR-0013). In each case the item's *title* encoded an assumption that did
not survive contact with the files. That is now the expected outcome for
any item written before it was scoped — read the artifacts before
estimating the work.

Notes:
- B-001 was scaffold boilerplate from the initial commit (`e72b78c`), never
  scoped or justified by an observed failure. By the time its `CI exists`
  condition was met, its *mechanism* had been overtaken: registry validation
  is deterministic and hermetic in `validate.sh`, run by the pre-commit hook
  and CI. A subagent would have been slower, nondeterministic, and unable to
  gate a commit — a weaker check presented as done. Closed as superseded
  (ADR-0011). **Two real defects came out of scoping it anyway**, which is
  the argument for scoping an item before either building or dropping it.
- Read alongside B-002: both sat for sprints as boilerplate. One turned out
  to contain a real requirement once split from an unspecified one; the other
  did not. **An item's age is not an argument for implementing it.**
- B-002's title was the defect, like B-006's verb before it. It bundled a
  fully-specified requirement (frontmatter rules, written down in
  `docs/development/authoring-guide.md` and unenforced) with an entirely
  unspecified one (a "line budget" defined nowhere in the repo). That
  mismatch is why it sat `ready` for three sprints: it could not be
  scoped as written. Split, the first half took one commit. See ADR-0008.
- B-004 was a *known* gap, not a discovered one — ADR-0003 recorded at the
  time that `license: MIT` was unbacked, and it stayed that way for three
  sprints. Recording a gap honestly is necessary but not sufficient; it
  also has to get closed.
- B-003 closed by TASK-0009. Its seed was TASK-0006's by-hand `initialize`
  handshake; that incantation is now `tests/smoke-mcp.sh`, driven entirely
  from each `server.json` manifest. Kept out of `tests/validate.sh` on
  purpose so the mandatory gate stays offline and fast.
- B-007 comes from REVIEW-0004: the template-leak defect was fixed three
  separate times (MCP loop, skills loop, loops loop) because
  `sync-registry.sh` duplicates its iteration logic per section, so a rule
  added to one does not reach the others. The pattern is the finding, not
  any one fix. `tests/smoke-mcp.sh` skips templates from the outset.
- B-005 and B-006 came from REVIEW-0003's follow-ups; both closed by
  ADR-0006 and TASK-0008. B-006 is kept visible rather than deleted
  because its *verb* was the defect: it said "port", and a search found no
  first-party loop artifact existed anywhere to port. Recording the
  correction is the point.
- **B-004's row had fallen outside the table**, stranded below these notes
  since TASK-0013 appended it instead of inserting it. Moved back into the
  table by S5's planning session. Worth recording because of what it says
  about the registry-integrity work: `validate.sh` checks the *generated*
  `docs/registry.md` for column-count and pipe defects (TASK-0018), and
  nothing checks the hand-maintained tables in `.ai/`. The defect class
  this repo already fixed downstream was live upstream the whole time.
- B-008 is a naming inconsistency in `.ai/decisions/`: ADR-0001 through
  ADR-0007 use an `ADR-` prefix, ADR-0008 through ADR-0012 do not. Both
  resolve for a human reader, so nothing is broken — but any future
  tooling that globs decisions has to know both forms, and the split
  point is arbitrary rather than meaningful. Low value, genuinely
  unblocked, and explicitly **out of scope for S5** (see
  `SPRINT-CURRENT.md`): it was found while reading for PLAN-0002 and has
  nothing to do with handover. Fixing it mid-sprint would bundle an
  unrelated rename into a contract change.

  **Closed by TASK-0024.** It was never a matter of taste: the
  `project-workflow` skill, which this repo owns and is canonical for
  (ADR-0004), prescribes `decisions/NNNN-short-title.md`. The `0008`–`0012`
  files followed it; `ADR-0001`–`ADR-0007` predated it and were never
  migrated. **The item as written understated the problem** — it described
  a cosmetic split, but `.ai/README.md:4` was actively prescribing the
  *old* scheme, so the normative doc contradicted the convention this repo
  publishes to other projects. A grep for broken paths does not find a doc
  that is wrong; only reading it does.
- B-009 came out of closing B-008. `project-migration`'s scaffold script
  emits `.ai/decisions/ADR-0001-repo-structure.md` and documents
  `ADR-NNNN-*.md`, so every project it scaffolds starts on the scheme this
  repo just migrated away from. **Deliberately not fixed in TASK-0024**:
  `project-migration` is an independent skill that never claims alignment
  with `project-workflow`, so "make them agree" is a decision about
  whether the two skills share one convention — not a rename. It needs
  that decision (an ADR) before it needs code.

  **Closed by TASK-0025 / ADR-0013 as decided, not implemented.** The
  investigation found there is *no shared convention to diverge from*:
  the two skills scaffold two different frameworks, differing in nine
  ways, of which the ADR filename is the smallest. `project-workflow`
  uses `00.CONVENTIONS.md`/`20.PLAN.md`/`30.ROADMAP.md`/`reference/` with
  `S###.T###` tasks; `project-migration` uses
  `context/`/`planning/`/`sessions/`/`templates/` with `TASK-####`. **This
  repo runs the latter** (ADR-0001, and `.ai-layout.json` declaring
  `entrypoint: AGENTS.md` rather than `00.CONVENTIONS.md`).

  So the literal fix would have aligned 1 of 9 differences and produced a
  scaffold belonging to *neither* framework — worse than a clean
  divergence, since it destroys the signal that these are separate
  systems while fixing nothing. Resolved with one documentation line in
  each `SKILL.md` naming the other skill, so the item cannot be re-raised
  by the next person who greps for `ADR-`.
