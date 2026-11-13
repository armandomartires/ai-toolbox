# 0051 — A mod is developed through nine gated stages, with one copy loaded per session

**Status**: proposed
**Date**: 2026-11-03
**Sprint / task**: `Post-S10`, `TASK-0218`

## Context

On 2026-11-03 the human found mod edits "sometimes live and sometimes not". `TASK-0217` found two causes: a link from a session's dev-mods folder into the checkout that did not reload, and the desktop app drawing the organization library's task-compass 0.8.0 over the checkout's 0.9.1. It answered with `scripts/dev-mods.py`, `scripts/preview-mods.py` and two runbook sections. The steps of a mod change were then spread over the authoring guide's *Mods* table, those runbook sections, `tests/test-mods.sh`, `ADR-0033` and `ADR-0040`, and each mod's `DEVELOPING.md`; no one place said their order, their checks or who runs each. The human asked for one structured workflow in Anthropic's own terms, with a chart, the skills it needs, and a view to OpenCode and Codex.

Claude Code's public plugin docs (read 2026-11-03) say: develop against the directory with `--plugin-dir`, not an installed copy; a `--plugin-dir` or `CLAUDE_CODE_PLUGIN_DIRS` plugin replaces a same-named installed or synced plugin, silently; `version` is a string, not checked against semver, and users get a new copy only when it changes; `claude plugin validate --strict`, then install from a local marketplace and start a session, before publishing.

## Decision

1. **Nine stages, in order: Plan, Scaffold, Load, Build, Preview, Test, Live check, Version, Commit and Publish.** `docs/development/mod-workflow.md` is their one owner: each names its command, its check and who runs it. A mod task's brief lists the stages it skips and why.
2. **Each check gates the next stage.** A stage starts only when the previous stage's check passed: `check-mods.py` before Load, `claude plugin validate` before Preview, a scene drawn before Test, `tests/test-mods.sh` PASS (SKIP is not a pass) before Live check, the human's sighting before Version, the version line drawn before Commit, `tests/validate.sh` before Publish.
3. **One copy of a mod loads per session.** While a mod is developed, the session loads the checkout's copy (named in `CLAUDE_CODE_PLUGIN_DIRS`, or copied in by `scripts/dev-mods.py`, never linked) and the library's copy is turned off on claude.ai. The version line a mod prints on the desktop (`AGENT-WATCH 0.8.1`, `COMPASS 0.9.2`) is the check, because on 2026-11-03 the desktop app drew the library's copy over the checkout's against the documented precedence.
4. **Version and changelog.** `plugin.json`'s `version` is semver by this repo's rule (authoring guide, *Versioning*), bumped in the task that changes the mod, since a new version is what reaches library users. Git is the changelog (`ADR-0033`): `git log --oneline -- mods/<name>`. A mod keeps no `CHANGELOG.md`; its README's *Not yet verified* section holds what no live check has seen.
5. **Publishing is the human's stage.** `PublishPlugin` from a session shows every file and sends on their yes; a GitHub marketplace is for people outside the organization. Teammates install `<name>@claudeai-organization-library`.
6. **The agent's stages have a runnable form,** `skills/mod-dev/`: `check`, `scaffold`, `sync`, `preview`, `test`, `status`, `all`. The skill runs the repo's scripts; it owns no rule.
7. **Portability is recorded, not built.** The stages map to OpenCode plugins and Codex as `mod-workflow.md` says; a port is a backlog row per client (`B-069`, `B-070`) until a task runs one. `ADR-0040` clause 2 (mods target Claude Code only) stands until then.

## Alternatives considered

- **Extend the runbook's two sections instead.** Rejected: the runbook is HOW-TO for one host; the order and the gates are a rule, which belongs in `docs/development/` and an ADR.
- **A `CHANGELOG.md` per mod.** Rejected: a second record beside git, which `ADR-0033` retired for every other artifact.
- **A mod that lists loaded versions.** Deferred (`B-071`): the version line each pane prints answers the question today; `mod-dev.sh status` prints what `claude plugin list` reports beside `plugin.json`.
- **`claude plugin tag` per release.** Not adopted: one commit per task is the record; the tag may be added by hand when a version is published.

## Consequences

- A mod task reads one document for its order and its gates; the runbook keeps the host-specific how-to.
- The gate still cannot run the mod tests (`ADR-0040` clause 3); the workflow makes `tests/test-mods.sh` a named stage instead.
- Publishing, the live check and turning the library copy off stay human steps, so the workflow has two hand-offs the chart shows.
- An OpenCode or Codex port needs an amendment to `ADR-0040` clause 2 and a decision on where the port's code lives (`mod-workflow.md`, *Portability*).
