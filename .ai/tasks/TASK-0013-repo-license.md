# TASK-0013 — Add a repo LICENSE backing the skills' `license: MIT` claims

## Objective
Close B-004. Ship an MIT `LICENSE` file so the `license: MIT` that both
shipped skills declare in frontmatter is backed by an actual grant.

## Minimal context
`skills/project-migration/SKILL.md:4` and
`skills/project-workflow/SKILL.md:4` both declare `license: MIT`.
The repo has no `LICENSE` file. ADR-0003 noticed this at the time and
recorded it honestly rather than hiding it:

> `license: MIT` on a skill is unbacked until the repo ships a `LICENSE`
> file (backlog B-004). — `.ai/decisions/ADR-0003-skill-frontmatter-schema.md:53`

That is the defect: the repo makes a licensing *claim* it does not
substantiate. Anyone taking the skills at their word has no grant to rely
on. It is a legal-clarity gap, not a cosmetic one, which is why it should
not sit in the backlog as `idea` indefinitely.

MIT was confirmed by the human — the same license the skills already claim,
so no frontmatter has to change.

## Scope
### Included
- `LICENSE` at the repo root: MIT, copyright `2026 Armando Martires` (the
  `metadata.author` both skills already carry).
- A Licensing section in `README.md` stating the repo's license and
  distinguishing it from the licenses of *upstream* packages that external
  MCP servers merely wire up.
- Close B-004 in `BACKLOG.md`; update ADR-0003's now-stale consequence.

### Not included
- Per-component license files. One repo-level grant covers all components;
  per-directory copies create multiple owners of one fact.
- Changing any skill's `license:` value. They already say MIT.
- Relicensing or asserting anything about `upstream.license` in
  `mcp-servers/*/server.json`. `ansible`'s upstream is independently MIT;
  that is a record of *their* license and this task must not imply the repo
  grants rights over upstream code it does not vendor.
- A `validate.sh` check that `license:` matches the repo LICENSE. Tempting,
  but a skill could legitimately carry a different license one day; the
  authoring guide now advises the pairing in prose instead.

## Preconditions
- TASK-0012 landed (the linter's non-empty `license` check exists).
- Human has confirmed MIT and the copyright holder.

## Likely files
- `LICENSE` (new)
- `README.md`
- `.ai/decisions/ADR-0003-skill-frontmatter-schema.md`
- `.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`

## Execution plan
1. Write the standard MIT text verbatim — no edits to the body. A modified
   MIT text is not MIT and defeats the purpose of a recognizable license.
2. Add the README Licensing section, explicitly separating repo license
   from upstream package licenses.
3. Amend ADR-0003's consequence bullet: the claim is no longer unbacked.
   Amend rather than delete — the record of it having been a known gap is
   worth keeping.
4. Run `tests/validate.sh` and `scripts/sync-registry.sh`.

## Acceptance criteria
- [x] `LICENSE` exists at the repo root, is unmodified MIT text, and names
      a copyright year and holder (2026 Armando Martires).
- [x] Both skills' `license: MIT` is now backed; no skill file changed.
- [x] `README.md` states the license and distinguishes upstream licenses.
- [x] ADR-0003 no longer asserts the claim is unbacked, and says which
      task closed it.
- [x] B-004 marked done in `BACKLOG.md`.
- [x] `tests/validate.sh` passes.

## Mandatory validations
- [x] tests/validate.sh — OK
- [x] scripts/sync-registry.sh — ran; registry unchanged as expected

## Risks and rollback
- Risk: mis-stating the copyright holder. Mitigation: taken from the
  `metadata.author` the skills already ship, and confirmed by the human.
- Risk: implying a grant over upstream MCP packages the repo does not own.
  Mitigation: the README section says so explicitly.
- Rollback: delete `LICENSE` and revert the commit. No code depends on it.

## Dependencies
TASK-0012 (ordering only, not functional).

## Expected result
The repo's licensing claims are substantiated; B-004 closes; ADR-0003's
recorded gap is marked resolved rather than left contradicting reality.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13

## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode
- Actions:
  - Added `LICENSE` (unmodified MIT, 2026 Armando Martires).
  - Added a Licensing section to `README.md` separating the repo's grant
    from upstream package licenses recorded in `server.json`.
  - Amended ADR-0003's consequence: struck the "unbacked" bullet and
    pointed at this task, rather than deleting it.
- Observations:
  - The copyright holder was not invented — it is the `metadata.author`
    both skills already ship, confirmed by the human.
  - Worth stating plainly in the README because it is easy to get wrong:
    `mcp-servers/ansible/server.json` records `upstream.license: MIT` for
    `@ansible/ansible-mcp-server`. That is a record of *upstream's*
    license. This repo vendors none of that code and grants nothing over
    it; the coincidence that both are MIT makes the distinction easier to
    blur, not less important.
  - Deliberately did not add a `validate.sh` check tying skill `license:`
    to the repo LICENSE. A component could legitimately differ someday;
    the authoring guide states the expectation in prose instead.
- Validation:
  - `tests/validate.sh` OK.
  - `scripts/sync-registry.sh` ran; `docs/registry.md` unchanged.
  - No skill file was modified — confirmed by the commit's file list.
- Result: success. B-004 closed; ADR-0003's three-sprint-old known gap now
  reads as resolved instead of contradicting the repo's contents.
- Commit: 741f698
- Push: deferred to TASK-0015, which wires the remote

