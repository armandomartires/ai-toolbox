# ADR-0043 — Mods follow SIGMAorbital, through one design module copied into each

**Status**: accepted
**Date**: 2026-10-28
**Task**: `TASK-0188`

## Context

The human asked that every mod's design follow SIGMAorbital, their Design System artifact on claude.ai (tokens v2). It is a monochrome instrument language: brightness carries the hierarchy, colour marks state only, frames are square, and titles and labels are uppercase. Each mod styled itself on its own. `agent-watch` gave each agent one of eight theme-key hues, `task-compass` used pastel sticky notes in fixed hex, and `task-orchestrator` and `switchboard` were plain text. The two pane mods also drew agent status in different glyphs and colours.

A mod draws `Box`/`Text`/`Button` trees, not HTML. A colour is a host theme key or any raw string. There is no CSS, font family, radius or shadow, and a desktop rounds every `Box` border. The sandbox cannot share a module between mods (authoring guide, *Mods*).

## Decision

1. **Exact SIGMAorbital hex, per theme.** The host's theme keys have no cyan and no violet, and their greys are not the design's ramp, so mapping to the nearest key would only approximate the system. The host's `theme` setting picks the theme: any `light` family is Daylight, anything else (or a failed read) is Night ops, the brand theme. A change is followed through `config.set` and a redraw.
2. **One owner, identical copies.** `mods/_template/hooks/sigma.tsx` owns the tokens, the status vocabulary, the agent identity glyphs, the primitives (`rule`, `frame`, `label`, `value`, `stat`, `stats`, `badge`, `meter`, `panel`), the helpers (`fit`, `elapsed`, `hms`) and the command-output cache. Every mod carries a byte-identical copy. Rule 7 of `scripts/check-mods.py` fails a differing copy, and a mod that hooks `ui.render` without one. The surface rules are written once, in the module's header.
3. **An agent's glyph is its identity, and its colour is its state.** Running is cyan with the pulse, done is `text-1`, failed is red and stopped is `text-3`. Both pane mods take this from the module. agent-watch is the exception since `ADR-0044`: its colour says which session owns a row.
4. **Slash-command output draws as panels.** A command keeps its structured result under the exact text it answered (`remember`). Its `CommandOutput` hook draws that result, and draws the plain text for a row it does not know, such as one from before a resume.

## Alternatives considered

- **The nearest theme keys.** These always follow a custom host theme, but have no cyan, and give the design's state colours only loosely.
- **A generated module per mod**, written by a script. That is a second owner of the same fact, with a build step the gate would have to run.
- **Plain-text commands with the content rules only.** Simpler, but the human chose styled output.

## Consequences

- A custom host theme does not recolour a mod; only the dark/light family is read.
- The host cannot carry the design's four typefaces, radius or the background grid. Panels are a title, a rule and a body; a card is a square frame; a `bracketed` panel is the design's region frame (surface fill, a `line` border and `text-1` corner brackets clipped from the border's own edges, `TASK-0199`); `stats` is its Readout row of stat blocks, the host's `title` size standing in for Orbitron.
- A change to the module is one edit in the template and a copy to every mod, enforced by the gate.
- The command-output cache lives in the mod's memory, so a reload or a resumed session draws older rows as text.
