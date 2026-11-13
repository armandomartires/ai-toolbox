# TASK-0220 — switchboard 0.5.0: mods and skills grouped by topic, in SIGMAorbital

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-03
- Updated: 2026-11-03
- Applies to: `mods/switchboard/`, the `category` field of every mod's `plugin.json`, `scripts/check-mods.py`, `tests/test-check-mods.sh`, `mods/_template/`, `docs/development/authoring-guide.md`
- Source: the human, 2026-11-03: a mod that turns mods on and off, listed by topic with toggle buttons, complying with SIGMAorbital

## Objective

The Switchboard pane lists Mods under topic sub-headers (a mod's `category`) and Skills under their plugin prefix, each group collapsible, drawn only with SIGMAorbital tokens; `/switchboard list` shows the same groups.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/switchboard` 0.4.0 | flat alphabetical Mods, Skills and Connectors sections, a switch per row |
| `ADR-0043` | one shared `hooks/sigma.tsx`, byte-identical in every mod (rule 7) |

## Scope

- In: `category` in `plugin.json` (optional, kebab-case); `skillTopic`, `modTopic`, `groupRows`; a `topics` and a `closedGroups` `$.state` key; group sub-headers (a plain `Button`, a `label`, tabular counts, a `rule`); grouped `/switchboard list`; the gate rule on `category`; docs.
- Out: a toggle per group; changing what a toggle refuses; any edit to `hooks/sigma.tsx`.

## Likely files

- `mods/switchboard/hooks/{model,inventory,view,register}.ts*`, `hooks/kinds/mods.ts`, `types/index.d.ts`, tests, `preview/`; the four mods' `plugin.json`; `scripts/check-mods.py`; `tests/test-check-mods.sh`

## Execution plan

1. Pure helpers and tests; manifest reading (`readManifest`, shared by `session.start` and `plugin.register`).
2. The pane and the list output.
3. `category` on each mod, the gate rule and its test, docs, preview scene.

## Acceptance criteria

- [x] Mods group by `category` (none: Other), Skills by prefix (none: Standalone), Other and Standalone last, connectors flat
- [x] A group header press collapses and expands it
- [x] No hex, `dimColor` or `bold` in switchboard outside `sigma.tsx`; every `sigma.tsx` identical
- [x] `check-mods.py` rejects an empty or non-kebab-case `category`
- [x] Each row is SIGMAorbital's Toggle, from a shared `kit().toggle`: square track, uppercase name, ON or OFF

## Mandatory validations

- [x] tests/test-mods.sh --mod switchboard
- [x] python3 scripts/check-mods.py
- [x] tests/test-check-mods.sh
- [x] python3 scripts/preview-mods.py switchboard

## Risks and rollback

- `plugin.register` reads the manifest at the event's `root`; a failed read leaves the mod under Other.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mods/switchboard` 0.5.0 | grouped pane and list; `topics` and `closedGroups` state |
| `kit().toggle` | the design system's Toggle in `mods/_template/hooks/sigma.tsx`, copied to every mod |
| `category` | agent-watch `observability`, task-compass `planning`, task-orchestrator `orchestration`, switchboard `configuration` |

Next: look at the pane in a real session and flip a mod in a group.

## Execution log

- 2026-11-03 · Claude Code (Sonnet 5.5) · helpers, pane, list, manifests, gate rule and docs written; 27 tests pass
- 2026-11-03 · Claude Code (Opus 5.5) · review fixes; rows drawn as the shared Toggle; 28 tests pass, gate OK; checked in the preview in both themes
