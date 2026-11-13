# 0053 — Mods are built from shared parts, and every pane panel is resizable

**Status**: proposed
**Date**: 2026-11-04
**Sprint / task**: `Post-S10`, `TASK-0223`
**Paths amended 2026-11-05** (`TASK-0233`, `ADR-0054`): a mod's plugin files moved to `mods/<name>/claude/`; the paths below name the new places.

## Context

`TASK-0221` gave two panels a drag handle (`ADR-0052`): Compass's Sprints board and the Sessions panel in Compass's pane. Each mod drew its own slot, bar, hint and `ui.message` hook around the shared surface module, so the Agents pane and switchboard's pane had no handle, and nothing would give one to a mod written later. On 2026-11-04 the human asked that every panel, current and future, have the handle, whether the panels could be "some sort of class", and that "classes, templates, reusable elements should be part of the development ethos ... for every future development efforts."

`kit()` in `sigma.tsx` is already the shared drawing layer every mod uses (`ADR-0043`), its one owner in `mods/_template/claude/hooks/` with byte-identical copies gated by `check-mods.py` rule 7. A `Client`'s posts still reach only the plugin that drew it, and the engine reads a module's `$.state` atoms from the file that declares them, so the stored height stays in each mod.

## Decision

1. **Shared parts first.** A mod is built from the template's parts. An element more than one mod could use is built in the owner, `mods/_template/claude/hooks/`, and copied to every mod, never inside one mod. A rule every mod must keep gets a check in `scripts/check-mods.py`. AGENTS.md, the authoring guide and the mod workflow's Build stage say so.
2. **The panel is the class.** `kit().panel(opts, body)` takes `resize: { key, rows, held, min }`. With it, on a surface whose table has `Client`, the panel holds its body at `held` rows and cuts the rest, and draws the handle on its bottom edge: a terminal redraws the edge around the grip, a desktop draws the 3px bar and a framed hint on hover. Without `Client` it draws the panel alone. This replaces each mod's own slot (`ADR-0052` clause 1's drawing).
3. **One value and one hook line per mod.** A mod keeps every held body height in one `$.state` value, `panelRows`, keyed by pane, handle and surface; `heldOf(panelRows, e, key)` reads one and `resizeAnswer(e, mins, write)` answers a handle's post, `write` being the mod's own `update` of its atom. A pane's `ui.message` hook is one line.
4. **Every panel in a pane is resizable.** task-compass (Sprints), agent-watch (Sessions, in Compass's pane and in its own Agents pane, each pane's height its own) and switchboard (its panel) pass `resize`. The gate's rule 9 fails a mod that draws a `Pane` and passes no `resize`; rule 7 now also fails a mod that carries `sigma.tsx` without the `handle.tsx` it imports.
5. **`held` is the body's rows.** Each mod gives `rows`, the body's rows as it lays itself out, and `min`, its floor. A panel whose content cannot be counted exactly estimates it; the estimate only sets where the first move of a drag starts.

## Alternatives considered

- **Keep each mod's handle code** (`ADR-0052` as it stood). Rejected: the human asked for every panel, and a third and fourth copy of the slot is the drift rule 7 exists to stop.
- **A shared hook that writes the height itself.** Not possible: the engine lists a module's `$.state` reads and writes from atoms declared in that file, and the atom is the mod's. `resizeAnswer` takes the write as a callback instead.
- **A gate that checks every panel call.** Not adopted: a text check cannot tell a pane's panel from a command-output panel. Rule 9 checks that a pane has a resizable panel; each mod's tests check its panels.

## Consequences

- A new mod copied from the template gets the handle by passing `resize`, and fails the gate if its pane passes none.
- Every mod carries `handle.tsx`, task-orchestrator and the template included, though they draw no pane.
- Changing the handle or the panel is one edit in the owner, copied to five mods.
- The Agents pane now has a handle, which `ADR-0052` left out.
