# 0048 — Compass's pane carries agent-watch's panel and meter, through a slot

**Status**: accepted
**Date**: 2026-11-02
**Sprint / task**: `Post-S10`, `TASK-0207`

## Context

`ADR-0047` clause 3 left Compass untouched in stage 1: it still draws its own Sessions panel from a byte copy of agent-watch's `sessions.ts` and a mirror of its state (`ADR-0045`), so the panel's logic exists twice. On 2026-10-31 the human asked for Compass to include agent-watch's work "to avoid code and functionality duplication", and on 2026-11-02 for Compass also to include the progress bar above the prompt, meaning agent-watch's task-list meter. The one-commit attempt (`a273657`, `TASK-0205`) made Compass's board vanish in the live app; the cause is not known.

## Decision

1. **Compass's pane hook calls `next(e)`** and draws what it resolves to after its Sprints board; it keeps no Sessions code, `sessions.ts` copy, `sunburst.ts` or mirror of agent-watch's state. Without agent-watch it draws its board alone.
2. **agent-watch hooks Compass's pane** by its id (`task-compass`, one constant a test pins), awaits `next(e)` and adds, after what it returns, its meter and then its Sessions panel. The meter is the band's, shared by code, drawn under the same rule (nothing while there is no task list and nothing runs).
3. **Both hooks survive a rejected `next(e)` and leave out core's own drawing.** The engine's types make core the last hook, answering `{ type: 'engine', ref }`, so the innermost hook's `next(e)` resolves to that element when no plugin beneath drew the pane. Embedded in a tree it makes the tree fail whole (reproduced in the mod test kit: Compass's board does not draw), the likeliest cause of `a273657`'s vanished board. Each hook drops it, and writes one debug-log line saying what `next(e)` resolved to, so a live failure leaves evidence.
4. **Gate rule 7** drops the `sessions.ts` entry: `sigma.tsx` alone is shared. `ADR-0045` is superseded; `ADR-0047` clause 3 is superseded.
5. **The first live run is off master**: both mods load from the task's worktree in a terminal session before master carries the change.

## Alternatives considered

- **Keep the copy and mirror.** Rejected by the human: duplicated code and function.
- **Embed Compass's board in agent-watch's pane.** Rejected: agent-watch must stand alone and Compass's board has no business there.
- **Pass the drawing through `$.state`.** Rejected (`ADR-0047`): state is JSON only and a Button's handler stays with the plugin that drew it.

## Consequences

- A change to agent-watch's panel or meter shows in Compass with no Compass edit; the gate holds no copy of either.
- A Compass pane hook that stops calling `next(e)` hides the contribution silently when Compass loads first; a test pins it.
- Renaming Compass's pane breaks the slot without an error; the pinned constant is the only guard.
- Compass's pane scrolls: the board fills its height and the contribution sits below.
- Seen live (2026-11-02, a terminal session, both mods loaded from the task's worktree in the order `task-compass:agent-watch`): the real engine does answer `engine` at the bottom (agent-watch's `next(e)` resolved `object (type engine)`, Compass's `object (type Box)`, so agent-watch sits innermost); the board survives; the meter's glyph and `1 RUNNING` and the Sessions panel draw below it and follow a running agent; the pane scrolls; no render error is logged. In steady state the pane redraws about 4 times a second at 27.6 ms on average (77.5 ms at most), about 12% of one worker, and about 3 per 10 s idle.
- Still unverified: a press in the contributed panel (a Button's handler is stamped with the plugin whose hook the tree leaves, which may re-stamp a nested one); the meter's progress bar (the session had no task-list tool); the reverse load order; that embedding core's element was what hid `a273657`'s board (reproduced in the kit, not seen live).
- A user-level `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` beats a shell variable, so a run off master passes `--settings '{"env":{"CLAUDE_CODE_PLUGIN_DIRS":…}}'` with the variable unset in the shell.
