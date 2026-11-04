# my-mod

> **Status: experimental.** Every feature of this mod is experimental while ai-toolbox is in its development stage (decided 2026-11-04, issue #5). A feature leaves experimental only through the live-verification gate (#9). Status is recorded in `status.json`.

One paragraph for the person who installs it: what the mod shows or does, on which surfaces (terminal, desktop), and what it needs.

## Manifest

`.claude-plugin/plugin.json` carries `name`, `version`, `description` and `types`, and may carry `category`: the mod's topic as one lowercase kebab-case word (`planning`, `observability`, `my-topic`). switchboard groups the Mods in its pane by it, and a mod without one falls under Other. `scripts/check-mods.py` rejects an empty or non-kebab-case value.

## Install

Mods need Claude Code 2.1.308 or later. Once published to the organization plugin library:

```
/plugin install my-mod@claudeai-organization-library
```

## Commands

- `/hello [name]` says hello, drawn as a SIGMAorbital panel.

## Design

`hooks/sigma.tsx` is the SIGMAorbital design module (`ADR-0043`). This template owns it; every mod keeps a byte-identical copy. `/hello` shows how a mod uses it: `syncTheme` and `watchTheme`, then `remember` and a `CommandOutput` hook that draws with `kit`.
