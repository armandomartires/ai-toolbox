# TASK-0188 — SIGMAorbital for mods: one shared design module, its gate, ADR-0043

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-28
- Updated: 2026-10-28
- Applies to: `mods/_template/hooks/sigma.tsx` (owner) and its byte-identical copies; `scripts/check-mods.py`; `docs/development/authoring-guide.md`; ADR-0043
- Source: the human's request of 2026-10-27, "harmonize the design of all mods in this project with the SIGMAorbital design system", and the plan approved on 2026-10-28 with four decisions: exact hex per theme; a wireframe panel instead of the sticky note; glyph = identity, colour = state; styled `CommandOutput` rendering for the commands

## Objective

Every mod draws with one design vocabulary taken from SIGMAorbital (claude.ai Design System artifact, tokens v2): its colour tokens in Night ops and Daylight, its status glyphs and words, square frames, and its content rules. The vocabulary lives in one module whose copies the gate keeps identical.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| SIGMAorbital `project/tokens.json` v2, `README.md`, `components/bundle.css` | read 2026-10-28 |
| Engine API (2.1.312 types) | `Box`/`Text`/`Button` trees; colours a theme key or a raw string; no CSS, fonts, radius; `$.config.list()` has a `theme` row; `CommandOutput` render site |
| `tests/test-mods.sh` | 5 mods pass (baseline 2026-10-28) |

## Scope

- In: `sigma.tsx` (tokens, theme selection, status vocabulary, `Panel`/`Label`/`Value`/`Badge`/`Meter`, `fit`/`elapsed`/`hms`, the command-output cache) with tests in `_template`; gate rule 7 (copies identical, and present where a mod draws); ADR-0043; a *Design* pointer in the authoring guide; `_template` 0.2.0.
- Out: restyling the mods (TASK-0189 to TASK-0192); fonts, radius, shadows (the host cannot draw them).

## Likely files

- `mods/_template/hooks/{sigma.tsx,sigma.test.tsx}`, `mods/_template/.claude-plugin/plugin.json`, `mods/_template/README.md`
- `scripts/check-mods.py`, its fixtures, `.ai/decisions/0043-mods-follow-sigmaorbital.md`, `docs/development/authoring-guide.md`

## Execution plan

1. Transcribe every colour token, aliases resolved, both themes.
2. Theme: `theme` row containing `light` → Daylight, else Night ops; re-read on `config.set` of `theme`.
3. Primitives and helpers; the bounded command-output cache.
4. Tests; gate rule 7 with failing and passing fixtures; ADR; guide pointer.

## Acceptance criteria

- [x] `sigma.tsx` holds every SIGMAorbital colour token in both themes, and its tests pass.
- [x] Theme selection: dark, light, and a failed read (Night ops) each tested.
- [x] `tests/validate.sh` fails when one copy of `sigma.tsx` differs from the template's, or when a drawing mod lacks one.
- [x] ADR-0043 records why exact hex, the owner-and-copies rule, and what the host cannot render.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod _template
- [x] each new test red-proved against its reverted change
- [x] tsc against the 2.1.312 API types (`_template`: 0 errors)
- [ ] seen live in the desktop app and a terminal `claude`, dark and light theme (under TASK-0189 to TASK-0192, which draw the panes)

## Risks and rollback

- A raw hex does not follow a custom host theme: only dark and light families are mapped. Rollback: git revert the task commit.

## Outputs / handover

- `mods/_template/hooks/sigma.tsx`: 34 colour tokens per theme, `themeOf`/`syncTheme`/`watchTheme`, `STATUS`, `IDENTITY` (7 glyph pairs, one fewer than agent-watch's old palette: the status glyphs and the pastel hues are out), `agentState`, `fit`/`elapsed`/`hms`/`segments`, `remember`/`recall`, and `kit` (`rule`, `frame`, `label`, `value`, `badge`, `meter`, `panel`). Byte-identical copies in `agent-watch`, `task-compass` and `switchboard`, whose hooks draw.
- `_template` 0.2.0: `/hello` draws through it, as the example a new mod copies.
- Gate: rule 7 of `scripts/check-mods.py`; `tests/test-check-mods.sh` (6 cases), run by `tests/validate.sh`.
- `ADR-0043`; a *Design* paragraph in the authoring guide's *Mods*.
- Deviations: ids renumbered from the plan (TASK-0185 to 0188 and ADR-0042 were taken upstream by switchboard); TASK-0192 added for switchboard. `syncTheme` and `watchTheme` are function declarations: `claude plugin validate` refuses `$` passed into an arrow function across an import. A panel draws no full border (the design's quiet border; brackets cannot be drawn), only a `card` is framed.
- Next: TASK-0189.

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · planned in worktree `agent/sigmaorbital`; done the same day. Workers could not be spawned (auto mode gave no verdict for the Agent tool), so the coordinator did the work.
  - Evidence: `claude plugin test mods/_template` → `9 pass 0 fail`; `bash tests/test-check-mods.sh` → `6/6 passed`; `tests/validate.sh` → `validate.sh: OK`; `tests/test-mods.sh` → `5 passed, 0 failed`; `tsc -p mods/_template` → no errors.
  - Evidence, red-proofs: no Daylight branch → 3 fail; no `watchTheme` → 1 fail; no `CommandOutput` hook → 2 fail; no desktop frame → 1 fail; rule 7 not called → S3, S4, S6 fail.
  - Found: the baseline `tsc` already reports errors against the 2.1.312 types (agent-watch 7, task-orchestrator 31 in its test, switchboard 1); none added.
