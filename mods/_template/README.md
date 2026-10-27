# my-mod

One paragraph for the person who installs it: what the mod shows or does, on which surfaces (terminal, desktop), and what it needs.

## Install

Mods need Claude Code 2.1.308 or later. Once published to the organization plugin library:

```
/plugin install my-mod@claudeai-organization-library
```

## Commands

- `/hello [name]` says hello, drawn as a SIGMAorbital panel.

## Design

`hooks/sigma.tsx` is the SIGMAorbital design module (`ADR-0043`). This template owns it; every mod keeps a byte-identical copy. `/hello` shows how a mod uses it: `syncTheme` and `watchTheme`, then `remember` and a `CommandOutput` hook that draws with `kit`.
