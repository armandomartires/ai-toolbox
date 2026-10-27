# TASK-0180 — Compass keeps GOALS.md under .ai/

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-27
- Updated: 2026-10-27
- Applies to: `mods/task-compass/` (0.2.0 → 0.3.0); its README and `DEVELOPING.md`; `ADR-0040`; `CURRENT_STATE.md`
- Source: human request 2026-10-27: only `AGENTS.md` and `CLAUDE.md` belong at a project's root; the mod should keep `GOALS.md` in `.ai/`, moving a root one there and creating one there when there is none

## Objective

The Compass mod reads and writes `GOALS.md` at the project root. Make its home `<layout root>/GOALS.md` (`.ai/` by default, or what `.ai-layout.json` declares), and keep a root `GOALS.md` working so projects on the published 0.1.x and 0.2.0 do not break.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-compass/` | 0.2.0; `tests/test-mods.sh --mod task-compass` → 27 pass |
| `$.fs` of the mod engine | `read`, `write` (creates folders), `list`, `exists`, `stat`; **no delete, rename or mkdir**, so a mod cannot move a file |
| `docs/design/task-compass-ai-planning-brief.md` | locked; read, never edited. Its rule "a `GOALS.md` wins over `.ai/`" stands |

## Scope

- In, when the session's folder is loaded:
  - `<layout root>/GOALS.md` exists: it is the board; a root `GOALS.md` beside it is ignored and reported as a leftover, and neither is overwritten.
  - Only a root `GOALS.md`: it is copied byte for byte to `<layout root>/GOALS.md`, which becomes the board; the root file stays, reported as a leftover for the person to delete. If the copy cannot be written, the root file is read and written in place.
  - Neither, and the project plans in `.ai/` (roadmap present): nothing is written; the read-only `.ai/` board stays.
  - Neither otherwise: nothing is written; `/goals init` creates `<layout root>/GOALS.md`.
  - A malformed `.ai-layout.json` keeps being reported; a root `GOALS.md` is then used in place, as before.
- Out: deleting or blanking a root `GOALS.md` (a mod cannot, and the rule is to never alter human files unasked); creating the file automatically on load (it would hide an `.ai/` plan and write into any folder a session opens); publishing 0.3.0 to the organization library (a human step).

## Likely files

- `mods/task-compass/hooks/register.tsx`, `hooks/register.test.tsx`, `hooks/layer.test.tsx`
- `mods/task-compass/README.md`, `DEVELOPING.md`, `.claude-plugin/plugin.json`
- `.ai/decisions/0040-mods-component-kind.md`, `.ai/context/CURRENT_STATE.md`, `docs/registry.md`

## Execution plan

1. Write the new tests first; run them red.
2. Split the layout resolution out of `findLayer`; add the lookup, copy and leftover report to `loadGoals`; point `/goals init` at the home path.
3. Adjust the existing stub in `register.test.tsx` so its board lives at `.ai/GOALS.md`; the root cases are covered in `layer.test.tsx`.
4. Update the README, `DEVELOPING.md`, `plugin.json` (0.3.0), `ADR-0040`, `CURRENT_STATE.md`; run `scripts/sync-registry.sh`.
5. Run `tests/test-mods.sh --mod task-compass` and `tests/validate.sh`; red-prove each new test against the reverted change.
6. Commit with the task id, push to `origin` only, confirm both remotes.

## Acceptance criteria

- [x] With only a root `GOALS.md`, the board loads from `<root>/GOALS.md`, a byte-identical copy; the root file is untouched; `/goals` names the root file as a leftover.
- [x] With both files, the `.ai/` one is read and written by the story tool; the root file is never written.
- [x] With neither, no write happens on load, in a plain project and in an `.ai/`-plan project; `/goals init` writes `.ai/GOALS.md`, or the declared root's.
- [x] A declared layout root is honoured; a malformed declaration is still reported.
- [x] README, `DEVELOPING.md` and `ADR-0040` no longer say the file lives at the root; `plugin.json` is 0.3.0.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod task-compass
- [x] each new test red-proved against its reverted change

## Risks and rollback

- **The leftover.** A moved file leaves its root twin until the person deletes it; the report repeats on `/goals` and in the story tool's description until then.
- **Published 0.1.x and 0.2.0** keep reading the root file; a project that has moved to `.ai/GOALS.md` looks empty to them until they update.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mods/task-compass/` 0.3.0 | `register.tsx` resolves `<layout root>/GOALS.md` first, copies a lone root `GOALS.md` there, reports the root one as a leftover in `/goals` and the story tool's description, writes nothing when there is none, and `/goals init` creates the file under the layout root; 33 tests |
| README, `DEVELOPING.md`, `ADR-0040`, `CURRENT_STATE.md`, registry | say the file lives under `.ai/` |

Next: publish 0.3.0 to the organization plugin library (a human step); delete the leftover root `GOALS.md` in any project the mod migrated.

## Execution log

- 2026-10-27 · Claude Code (Sonnet 5.5) · started
  - Evidence: `tests/test-mods.sh --mod task-compass` → `PASS task-compass:  33 pass` (27 before; 6 new, and the `a GOALS.md wins over .ai/` test and the `register.test.tsx` stub now use `.ai/GOALS.md`)
  - Evidence: `register.tsx` stashed → 12 failures, every new test among them except `a project that plans in .ai/ gets no GOALS.md written on load`, a guard that passes both ways by design (it asserts the absence of a write)
  - Not run: `tsc -p mods/task-compass` (no `tsc` on this host)
  - Deviation (design): the first plan said "notice" for the leftover; `$.ui.notice` needs a tool call id, so the report is in `/goals` and the story tool's description
