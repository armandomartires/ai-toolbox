---
name: mod-dev
description: "Run the agent's stages of ai-toolbox's mod workflow in order (check the shape, scaffold from the template, validate, sync into a session as files, preview the panes, run the kit's tests, report which copy of a mod is loaded). USE FOR: any change to a mod under mods/ in an ai-toolbox checkout, from a new mod to a version bump. DO NOT USE FOR: skills, MCP servers, loops or agents; publishing a mod to the organization library or a marketplace (the human's step); work outside an ai-toolbox checkout."
license: MIT
metadata:
  author: armando.martires
  version: "1.0.0"
---

# mod-dev

The runnable form of `docs/development/mod-workflow.md` (`ADR-0051`): nine
stages, each gated by a check, the agent's ones driven by one script. The
rules live in that page and the authoring guide's *Mods* table; this skill
only runs the repository's scripts in the right order and says what to do
next.

## When to load it

Any task that touches `mods/<name>/`. Load the `plugin-authoring` skill too:
it gives the running build's API types and makes the session hot-reload the
mod. Run everything from inside the ai-toolbox checkout.

## The stages and their commands

| # | Stage | Command | Gate |
|---|-------|---------|------|
| 1 | Plan | the task brief and Compass line (`project-workflow`) | the brief passes its schema; the human says build |
| 2 | Scaffold | `scripts/mod-dev.sh scaffold <name>` | `check` → `OK` |
| 3 | Load | `scripts/mod-dev.sh sync <name> [--session ID] [--watch]`; the person answers *Turn them on* once; the library copy is off | `status <name>` shows one loaded copy |
| 4 | Build | edit `mods/<name>/claude/hooks/`; `scripts/mod-dev.sh validate <name> [--strict]` | `Validation passed` |
| 5 | Preview | `scripts/mod-dev.sh preview <name> [--serve 8765]`, then `build/preview/index.html` | every scene drawn, no failure |
| 6 | Test | red-proof, then `scripts/mod-dev.sh test <name>` | `PASS`; `SKIP` is not a pass |
| 7 | Live check | the human, in a real session on each surface | they saw it; the version line matches |
| 8 | Version | bump `plugin.json`, the pane's version line, README *Not yet verified*, `10.CURRENT_STATE.md` | `check` → `OK`; `status` shows the new version loaded |
| 9 | Commit and Publish | `tests/validate.sh`, one commit `(S###.T###)`, push `origin`; the human publishes with `PublishPlugin` | the gate; `<name>@synced` at the new version |

`scripts/mod-dev.sh all <name>` runs 2's check, 4's validate, 3's sync, 5's
build and 6's test in that order and ends with `status`. It stops at the
first failure and names the stage.

## Rules the script holds you to

- **Copy, never link.** `sync` mirrors the mod into the session's
  `~/.claude/dev-mods/<session>/` as files, replacing a link it finds. Edit
  the checkout, never the copy.
- **One copy per session.** `status` prints the manifest's version, every
  copy `claude plugin list` reports (`@inline`, `@synced`, a marketplace) and
  every dev-mods copy. Two loaded copies, or a version line in the pane that
  differs from the manifest, mean the library copy is still on: turning it
  off on claude.ai is the human's step.
- **SKIP is not a pass.** `test` exits 3 when no `claude` of 2.1.308 or later
  is on `PATH`; say so in the task report instead of ticking the validation.
- **The gate is still `tests/validate.sh`.** `check` runs the shape check
  the gate runs; the kit's tests are outside the gate (`ADR-0040`).

## Scripts

- `scripts/mod-dev.sh`: the subcommands above; `--help` prints them. Exit 0
  ok, 1 a stage failed, 2 usage or not in an ai-toolbox checkout, 3 skipped.
