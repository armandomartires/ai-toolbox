# Developing a mod: the workflow

The rule for every change to a mod under `mods/` (`ADR-0051`). A mod is a
Claude Code plugin whose hooks module the engine loads (`ADR-0040`); its
shape is the authoring guide's *Mods* table, and the host-specific how-to is
the runbook (*Loading a mod in development*, *Previewing a mod's panes*).
This page owns the **order**, the **check that gates each stage**, and
**who runs it**. The same page as a chart: `mod-workflow.html`.

The terms are Claude Code's own (its plugin docs, read 2026-11-03, and the
bundled `plugin-authoring` skill): *develop against the directory with
`--plugin-dir`, not against an installed copy*; a plugin named in
`CLAUDE_CODE_PLUGIN_DIRS` *replaces a same-named installed marketplace
plugin or skills-directory plugin*, and a plugin *synced from claude.ai*
ranks lowest; `version` is *a version string, not checked against semver*,
and users get a new copy *only when the plugin's computed version differs*.

## The nine stages

Each stage starts only when the previous stage's check passed. `A` is the
agent, `H` the human; `A→H` is a hand-off the chart draws as a lane change.
`skills/mod-dev/scripts/mod-dev.sh` runs the agent's stages in this order
(`/mod-dev`).

| # | Stage | Command | Check that gates the next stage | Who |
|---|-------|---------|----------------------------------|-----|
| 1 | **Plan** | A task brief from `.ai/templates/TASK.md` at the next free number, naming the mod and its version step (`0.8.1 → 0.9.0`); a Compass line in `.ai/GOALS.md` and `TODO.md`. A new pane's shape goes through a design brief in `docs/design/` first (`skills/design-flow`). | `skills/project-workflow/scripts/check-artifact.sh <brief> --kind task` passes; the human says build. | A→H |
| 2 | **Scaffold** (new mod only) | `mod-dev.sh scaffold <name>`: copies `mods/_template/` to `mods/<name>/`, sets `name` in `plugin.json`, then `scripts/sync-registry.sh`. `hooks/sigma.tsx` stays byte-identical to the template's (`ADR-0043`). | `python3 scripts/check-mods.py` → `OK`. | A |
| 3 | **Load** | One copy per session (below). This session: `python3 scripts/dev-mods.py <name>` copies the mod into `~/.claude/dev-mods/<session>/`; the engine asks once, *Turn on the mods Claude writes in this session?*, and the person answers *Turn them on*. Every session on the host: `scripts/install.sh --client claude-code`, run in that host's main checkout, writes `CLAUDE_CODE_PLUGIN_DIRS` and `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` into `~/.claude/settings.json`; once per host (Windows, WSL, each SSH machine). | `scripts/install.sh --status` shows no `MISSING` mod; `claude plugin list` names the copy (`<name>@inline`, with its `Path:`), and no other copy of the name is enabled; `mod-dev.sh status <name>`. | A→H |
| 4 | **Build** | Edit `mods/<name>/hooks/`, with the `plugin-authoring` skill loaded; the engine lays this build's types in `mods/<name>/.claude-plugin/types/` once the mod has loaded, so `tsc -p mods/<name>` type-checks it. Pure logic goes in plain modules (`model.ts`, `rails.ts`), hooks and drawing in `.tsx`. Build from the template's shared parts, and put a new reusable element in the owner first (`ADR-0053`); every pane panel takes `resize`. A save reloads the mod when the turn ends. | `claude plugin validate mods/<name>` → `Validation passed`, and its `hooks:` and `calls:` lines list what was meant. | A |
| 5 | **Preview** | A scene per pane in `mods/<name>/preview/*.scene.tsx`; `python3 scripts/preview-mods.py --serve 8765` (the `mod-preview` entry of `.claude/launch.json` opens it in the browser pane); `build/preview/index.html`. | Every scene draws at its sizes on `terminal` and `desktop` with no failure in the page. | A (H looks) |
| 6 | **Test** | Red-proof: the test fails on the code before the change, then passes. `tests/test-mods.sh --mod <name>` runs `claude plugin validate` and `claude plugin test`. | `PASS <name>`. `SKIP` is not a pass; a `FAIL` the Windows clone also shows at `HEAD` is run again in WSL. | A |
| 7 | **Live check** | The mod loaded in a real session, on each surface it draws for (terminal, desktop). What was seen, and what was not, goes to the README's *Not yet verified* section. | The human saw the behaviour the brief names, and the pane's version line (`AGENT-WATCH 0.8.1`) is the version under development. | H (A records) |
| 8 | **Version** | Bump `version` in `.claude-plugin/plugin.json`: patch for a fix, minor for a feature, major for a change to `types/index.d.ts` that a mirror reads (`check-mods.py` rule 8). The pane's version line follows the manifest. Edit `CURRENT_STATE.md`'s *Mods* row. No `CHANGELOG.md`: `git log --oneline -- mods/<name>` is the changelog (`ADR-0033`). | `python3 scripts/check-mods.py` → `OK`; `mod-dev.sh status <name>` shows the manifest's version loaded. | A |
| 9 | **Commit and Publish** | `tests/validate.sh` (the pre-commit gate), `scripts/check-private-names.sh`, the diff reviewed; the brief, `TODO.md` and `GOALS.md` say done; one commit, `<Imperative summary> (TASK-NNNN)`; push `origin` only with `vgit_origin` (`AGENTS.md`, *Git rules*). Then the human publishes to the organization library with `PublishPlugin` from a session, which shows every file and sends on their yes; teammates run `/plugin install <name>@claudeai-organization-library`. | The gate passes; `ls-remote` on both remotes equals `HEAD`; `claude plugin list` on a host that loads the library copy shows `<name>@synced` at the new version. | A→H |

Before the first publish of a mod, the docs' own checklist: a permanent
kebab-case `name` (never changed after publishing), `claude plugin validate
--strict`, `description`, `author`, `homepage` and `repository` in the
manifest, and `README.md` with the install line. `claude plugin tag` makes
a `<name>--v<version>` git tag; it is optional here, since the task commit is
the record.

## One copy of a mod per session

The documented precedence, highest first: a managed `enabledPlugins` lock;
a `--plugin-dir`, `--plugin-url` or `CLAUDE_CODE_PLUGIN_DIRS` plugin; an
installed marketplace plugin; a skills-directory plugin; a plugin synced
from claude.ai. Two enabled plugins of one name load only one copy's hooks,
and the replacement of a marketplace copy is silent (`--debug` logs it).

What this repository adds, from what was observed (`TASK-0217`):

- **Turn the library copy off while developing.** On 2026-11-03 the desktop
  app drew the library's task-compass 0.8.0 over the 0.9.1 named in
  `CLAUDE_CODE_PLUGIN_DIRS`, while `claude plugin list` reported the
  opposite. The version line each pane prints on the desktop is the check,
  not the list. Turn the library copy off on claude.ai for the mod under
  development; after publishing, turn it on again and, if the checkout's copy
  should then yield, set `"<name>@inline": false` under `enabledPlugins`.
- **Copy, never link.** A junction from a session's dev-mods folder into the
  checkout kept running hours-old code. `scripts/dev-mods.py` copies as
  files and mirrors edits (`--watch`); it replaces a link it finds.
- **Edit in the checkout.** The copy in `~/.claude/dev-mods/<session>/` is a
  mirror; an edit there is lost at the next sync and would load a second
  plugin of the name.
- **One checkout, on `master`.** `CLAUDE_CODE_PLUGIN_DIRS` names the main
  checkout, so every session loads that branch; a task's worktree is not
  what loads (`ADR-0023`).

When a mod seems not to run, the docs' order: `claude plugin validate`,
then `/reload-plugins`, then the `/plugin` Errors tab, then `claude plugin
list`; here, read the version line last. A hook that failed is skipped and
named once in the transcript of a session that hot-reloads the folder; every
occurrence is in `claude --debug`'s log.

## Traps the stages meet

The engine and desktop behaviour a mod meets is the authoring guide's *Mods*
list (auto mode will not evaluate writes to a loaded mod's files; a security
plugin skips `prompt.compose`; the desktop moves the session's folder; no
hover on a desktop pane; rounded corners on every `Box`). Two bear on the
workflow itself:

- **Auto mode and stage 4.** Use a permission mode that asks before edits
  while a mod is loaded from the folder being edited.
- **The kit and stage 5.** `claude plugin test` gives a test no files and
  drops console output, so a scene throws its trees and the preview script
  reads them from the failure message; a scene never runs in the suite.

## Portability: OpenCode plugins and Codex

Mods target Claude Code only (`ADR-0040` clause 2). The stages, not the
code, carry over; this section says how far, so a port is a backlog row
with a known shape (`B-069`, `B-070`) rather than a surprise. It follows the
pattern `agents/` set: one source, emitted or written per client, never a
symlink (`ADR-0018`).

Read 2026-11-03 from each client's own docs (OpenCode 2.2, `@opencode/plugin`;
Codex CLI 0.166 and the Codex app). Both change weekly; re-read before a port.

| Stage | Claude Code mod (here) | OpenCode plugin | Codex |
|-------|------------------------|-----------------|-------|
| Plan, Commit | a task brief, one commit per task | the same | the same |
| Scaffold | `mods/_template/` | would live in `mods/<name>/opencode/`: `index.ts` (`Plugin.define({ id, setup(ctx) })`) and `tui.tsx`, importing the mod's pure modules (`model.ts`, `rails.ts`) | would live in `mods/<name>/codex/`: a plugin bundle, `plugin.json` at its root (the `agent-plugins.org` schema), `hooks/hooks.json`, `skills/`, `mcp.json` |
| Load | `CLAUDE_CODE_PLUGIN_DIRS`, `dev-mods.py`; hot reload on save | the folder `.opencode/plugins/<name>/` is discovered at start, or `"plugins"` in `opencode.json(c)` (`"plugin"` in 1.x); TUI-only parts in `~/.config/opencode/cli.json`; no hot reload documented | copy into `~/.codex/plugins/`, add a marketplace entry, restart; no hot reload |
| Build | a hooks module on `$`: `tool.call`, `prompt.submit`, `ui.render`, `$.command.register`, `$.tool.register` | `ctx.tool.hook("execute.before" \| "execute.after")`, `ctx.permission.hook("evaluate")`, `ctx.session.hook("prompt")`, `ctx.event.subscribe`; tools by `ctx.tool.transform`, commands by `ctx.command.transform`; a pane by `context.ui.slot({ append: "sidebar.content" \| "session.panel" \| "home.footer.status" \| … })` in Solid JSX on OpenTUI, toasts by `context.ui.toast.show` | `hooks.json`: `SessionStart`, `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Stop` and more, each an external command reading JSON on stdin (exit 2 blocks; `PreToolUse` cannot ask); tools only through MCP servers; commands only as skills (`$name`); **no UI of any kind** |
| Preview | the kit draws scenes, `preview-mods.py` | none: OpenTUI draws in a terminal; the desktop app does not load TUI slots (community report) | nothing to draw |
| Test | `claude plugin test` | no official harness: `bun test` with a hand-made `ctx` | none |
| Live check | terminal and desktop | the TUI | CLI and app (the IDE extension loads no plugins) |
| Version | `plugin.json` `version`, semver here | `package.json`, semver; a user pins with `pkg@1.2.0`; `opencode plugin update` | `plugin.json` `version` (the cache key); `codex plugin marketplace upgrade` |
| Publish | `PublishPlugin` → the organization library; a marketplace repo | `npm publish`; users name the package in config; no organization library | a marketplace repository (`.agents/plugins/marketplace.json`; the legacy `.claude-plugin/marketplace.json` is read too); a workspace admin imports it, with per-role install policy, the organization-library equivalent |

**One to one:** Plan, Commit, the version step, the red-proof discipline, and
the pure modules a mod already keeps apart from its hooks (`DEVELOPING.md`
lists them). **Not portable:** `ui.render` panes and bands (OpenCode has
slots, in another component model; Codex has none), the kit and the preview
built on it, hot reload, and the organization library (Codex's admin
marketplace is the nearest; OpenCode has none).

**Where a port lives.** Inside the mod's folder, one subfolder per client
(`opencode/`, `codex/`), so the registry keeps one row and the pure modules
have one copy; `check-mods.py` would need to know the subfolders, and
`install.sh` a link or copy path per client. That needs an amendment to
`ADR-0040` clause 2 and is `B-069` (OpenCode) and `B-070` (Codex), each
*Ready when* a mod is wanted on that client.
