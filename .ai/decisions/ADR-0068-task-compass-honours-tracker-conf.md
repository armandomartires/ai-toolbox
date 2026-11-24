# ADR-0068 — task-compass honours tracker.conf

**Status**: accepted 2026-11-23 by the human, as written
**Date**: 2026-11-21
**Sprint / task**: `S011.T035`

## Context

task-compass never read `tracker.conf` (ADR-0037). On a GitLab or GitHub tracker the roadmap is gone, so the pane fell back to an empty board and invited `/goals init`, which writes the `.ai/GOALS.md` copy that project-workflow's `tracker.md` forbids. The 2026-11-20 alignment audit of the mod against project-workflow 7.2.0 (`S011.T034`) found it. The design brief `docs/design/task-compass-ai-planning-brief.md` is accepted; on 2026-11-21 the human chose the direct amendment (its *Amendment 1*) rather than a new design run. That choice was not an acceptance of this ADR's text, which an agent wrote; the human accepted it as written on 2026-11-23.

## Decision

1. **The mod consumes ADR-0037's declaration.** It reads `tracker.conf` from the project folder, the one the board is found from (S019.T002); a folder holding a `tracker.conf` counts as one. An absent file means `files`, and nothing changes for such a project.
2. **A forge wins over `GOALS.md`.** On `gitlab` or `github` the mod never reads, copies or writes a `GOALS.md`; one that exists is reported as a stray copy.
3. **An invalid `tracker.conf` is a stop, never a fallback.** The pane, `/goals` and the story tool say what is wrong; the mod does not fall back to `files` or to a `GOALS.md`.
4. **The forge view is a read-only, offline state card.** The Claude Code pane shows a `Plan` panel read from the forge variant of `20.PLAN.md` under the layout's root. The mod writes nothing and calls no forge: tasks are issues there, and the project's own rules keep the state file current. A missing `20.PLAN.md`, or one that is not the forge variant, is said in the panel.
5. **The OpenCode and Codex ports decline only.** Their `story` tool, sidebar and session-start context name the tracker and write no `GOALS.md`; they draw no card.
6. **The grammar is a second implementation.** `core/tracker.ts` mirrors `skills/project-workflow/scripts/tracker_lib.py` (`load`, `validate`) case for case, and `core/tracker.ts` plus three byte-identical gated copies (Claude hooks, OpenCode, Codex) are gated by `check-mods.py` rule 10.

## Alternatives considered

- **Fetch the forge's issues, milestones or boards.** Rejected: ADR-0037 refuses forge calls from tooling, and a mod that needs a token and the network breaks its offline tests.
- **Fall back to `GOALS.md` on an invalid conf.** Rejected: it would write the file the forge convention forbids, on exactly the project whose declaration is broken.
- **A new design run.** Declined by the human: the change is one added source in an accepted design, so Amendment 1 records it.
- **Look for `tracker.conf` above the project folder.** Left out of scope.
- **A card in the OpenCode and Codex ports.** Left to the task that gives them the `.ai/` layer (ADR-0066 clause 6).

## Consequences

- A forge project no longer meets an empty board or an invitation to write `GOALS.md`; a files project is unaffected.
- Drift risk: the TypeScript parser and `tracker_lib.py` are kept in step by hand, as `statusFromWords` is with the dashboard, and no cross-language check compares them. A grammar change in one must be made in the other.
- The three node suites (`core/core.test.ts`, `opencode/compass.test.ts`, `codex/scripts/codex.test.ts`) are in no gate and are run by hand.
- Not yet seen: the `Plan` panel in a live session, and no real forge-tracked project was used.
