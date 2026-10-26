# TASK-0178 — Design how task-compass reads a project's .ai/ planning

## Status

- Status: planned
- Owner: agent with the human (the design-brief loop needs a human in the session)
- Created: 2026-10-27
- Updated: 2026-10-27
- Applies to: `mods/task-compass/` (design only); a new brief in `docs/design/`
- Source: human request 2026-10-27, after `TASK-0177`: the pane shows no board in sigma-infrastructure, which plans in `.ai/`, not in `GOALS.md`

## Objective

`task-compass` reads sprints and stories only from `GOALS.md` at the project root. Projects governed by `.ai/` have none, so the pane is empty there. Run `loops/design-brief/` to an accepted, locked brief for reading `.ai/` planning, starting with sigma-infrastructure's project-workflow layout. No code in this task.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-compass/` | 0.1.0; `hooks/model.ts` parses `GOALS.md`; the `story` tool rewrites a story's checkbox |
| sigma-infrastructure, local clone | `c489281`, 2026-10-19 (sprint `S086`); the live copy is on the second workstation, unreachable from this host. `.ai/30.ROADMAP.md` *Sprint history* and *Next up*; `.ai/20.PLAN.md`; briefs `.ai/tasks/S###_Name.T###_Name.md` with a `**Status**:` line |
| `skills/project-workflow/schemas/` | owns those artifacts' shape (`ADR-0027`) |
| ai-toolbox's own `.ai/` | the project-migration layout: `TASK-NNNN-*.md` with `- Status:`, `TODO.md`, `SPRINT-CURRENT.md` (`ADR-0013`) |
| `loops/design-brief/`, `skills/design-flow/` | the sequence and the method |

## Scope

- In: one design-brief run, with alternatives critiqued, ending in a brief the human accepts and locks at `docs/design/task-compass-ai-planning-brief.md`; a follow-on implementation task named in its handover.
- Out: any change to `mods/`; the project-migration layout and forge trackers (`tracker.conf` `gitlab`/`github`), unless the brief brings them in; publishing to the plugin library.

## Questions the brief must answer

1. How the mod finds a project's layout: `.ai-layout.json`, the entrypoint, `tracker.conf`, and how `GOALS.md` ranks against them.
2. What a sprint and a story are in project-workflow, and how its task statuses map onto the pane's six.
3. Whether the `story` tool writes a brief's status, or the pane stays read-only and Claude updates briefs by the project's own rules. A mod editing governance files is a decision in its own right.
4. How the parser stays true to the schemas that own the shape (`ADR-0027`), and what fails when a schema changes.
5. Cost: about a hundred sprints and many briefs, read every few seconds inside the engine's hook sandbox.
6. Whether ai-toolbox's own project-migration layout follows in the same design or later.

## Likely files

- `docs/design/task-compass-ai-planning-brief.md` (new)
- `.ai/tasks/TASK-0178-compass-reads-ai-planning-design.md`, `.ai/tasks/TODO.md`

## Execution plan

1. Step 1 of the loop with the human: confirm the problem, the constraints and the brief's path.
2. Read the project-workflow schemas and a fresh sigma-infrastructure checkout, so the alternatives rest on the real files.
3. Run the ideate-critique cycle within the loop's cap.
4. Present the brief; the human accepts and locks it, or the cap ends the run.
5. Name the implementation task; close this one.

## Acceptance criteria

- [ ] The brief exists at the agreed path, accepted and locked by the human.
- [ ] It answers all six questions above, or says which are deferred and why.
- [ ] Its handover names the implementation task and how that task will be tested.

## Mandatory validations

- [ ] tests/validate.sh

## Risks and rollback

- **The local clone is stale.** Read the current layout from the live copy before ideating, not from this file's description of it.
- **Writing governance files from a mod** may conflict with the project's own close rules. Question 3 makes it explicit.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next:

## Execution log

- 2026-10-27 · Claude Code (Opus 5.5) · opened, not started
