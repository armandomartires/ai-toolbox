# Current State

State only (ADR-0033): edit this file, don't append to it. The history is in git: `git log -p .ai/context/CURRENT_STATE.md`. The last full narrative is `git show 6e5c971:.ai/context/CURRENT_STATE.md`.

## Where the project is

- **Roadmap:** Phases 1–10 are complete, and S10 closed 2026-09-26 (`REVIEW-0012`). No sprint is open. Work runs task by task on the human's routing (`TASK-0106` onward).
- **Last delivered:** `task-orchestrator` 0.3.0 (`TASK-0194`): auto mode's classifier gives a plugin's spawn no verdict, so the mod re-issues it once and then hands the task to the coordinator's own Agent call, which it adopts into the task's row; a re-dispatch under a blocked, failed or partial id is a counted retry, and a dependant stuck behind one says so instead of waiting in silence. The hand-off is not yet seen live. Before it: `agent-watch` 0.4.0 (`TASK-0193`, `ADR-0044`): the Agents pane draws this session and its sub-sessions as a tree (the task-orchestrator run read from its ledger, Workflow runs, delegating subagents), one `⬢` per session in a tone of its own with a progress bar, one `■` per subagent in its owner's tone; the gate holds agent-watch's mirror of task-orchestrator's contract to its owner (`check-mods.py` rule 8). Before it: every mod in SIGMAorbital (`TASK-0188`–`TASK-0192`, `ADR-0043`); the last, `switchboard` 0.4.0 (`TASK-0192`): its pane one panel with a cyan `●` or grey `○` per row and an amber `▲` next-session note, and `/switchboard list` drawn as a panel per kind. Before it: `task-orchestrator` 0.2.0 on SIGMAorbital (`TASK-0191`): `/orchestrate status` and `routing` draw as panels (the run, each task's state as glyph and word, the routing table, the overrides) while the model reads the same text; the status line reads `ORCH BALANCED · 2 RUNNING · 1 QUEUED`. Before it: `task-compass` 0.4.0 on SIGMAorbital (`TASK-0190`): statuses on the design's glyphs and colours (review `▲` amber, blocked `◆` red), the sticky note replaced by a square panel on `surface`, the current sprint's `◉` in white, uppercase controls and legend, agent rows with agent-watch's identity glyphs, and `/compass` and `/goals` drawn as panels. Before it: `agent-watch` 0.3.0 on SIGMAorbital (`TASK-0189`): an agent's glyph is its identity and its colour its state; the pane is a `SUBAGENTS` panel, the band a meter with `3/5 STEPS`, the status line and toast uppercase, and `/agent-watch` draws its counts as a panel. Before it: SIGMAorbital for mods (`TASK-0188`, `ADR-0043`): one design module, `mods/_template/hooks/sigma.tsx`, whose byte-identical copies the gate checks (rule 7 of `check-mods.py`); exact hex per theme, picked by the host's `theme` setting; `/hello` in the template draws through it. Before it: `switchboard` 0.3.0 (`TASK-0187`): each row's toggle is a switch-style button (filled with its knob right when on); skills and servers come from the context breakdown, so they are listed under `cc-plugin-sec-default` too; an id-named desktop connector shows its tool names; the desktop app's `ccd_*` servers cannot be turned off. No surface can press an SVG. Before it: `switchboard` 0.2.0 (`TASK-0186`): its pane lists every mod with a hooks module, from `CLAUDE_CODE_PLUGIN_DIRS` and those loading after it, each row with an On/Off button and a note when a mod's change waits for the next session; skills-only and managed plugins are not listed. Before it: `switchboard` 0.1.0 (`TASK-0185`, `ADR-0042`): one mod that turns installed mods, skills and MCP servers off and on per project, from a pane or `/switchboard`; an off one is refused when called, and hidden where the engine allows (not under `cc-plugin-sec-default`, which passes the skill listing on past mods). Before it: `task-orchestrator` 0.1.0 (`TASK-0183`, `ADR-0041`): a mod that makes the session a lead coordinator; worker profiles carry a model and effort per task class, dispatch spawns real subagents under code-enforced limits (3 concurrent, no nesting, one non-isolated writer, writes inside allowed files, 2 retries, 1 escalation), and `status` reports requested against observed settings and the host's overrides; external providers are an interface only. Before it: `agent-watch` 0.2.0 (`TASK-0182`): each running subagent's row says what it is doing (the call in flight, its calls, its tokens), a failed or stopped one is toasted at `SubagentStop`, the band's icons and step are buttons, and the status line counts the running agents. Before it: `.ai/GOALS.md` is the Compass board for this repository: every `TODO.md` item and the open backlog, kept current by the Definition of done (`TASK-0184`). Before it: a second mod, `agent-watch` 0.1.0 (`TASK-0181`): an Agents pane of the session's subagents grouped by running and completed, one theme color and icon per agent pulsing while it runs, and a band above the prompt with the task list's progress bar and the running agents; a session hot-loads a mod through a link in its own mods folder. Before it: the Compass mod keeps its `GOALS.md` under the layout root, `.ai/` by default (`TASK-0180`): a root one is copied there on load and reported as a leftover, since a mod cannot delete; `/goals init` creates it there; nothing is written when none exists. Before it: the Compass pane reads a project-workflow `.ai/` plan, read-only (`TASK-0179`, on the brief `TASK-0178` locked in `docs/design/`); its fixtures are structure-only copies of sigma-infrastructure's, and the gate's private patterns on this host now list that estate's host names. Before it: `claude-mods` merged as the `mods/` kind (`TASK-0177`, `ADR-0040`): `task-compass` and `mods/_template/`, a shape check in the gate, `tests/test-mods.sh` for `claude plugin validate` and `test`; sessions load the mod from this checkout. Before it: unexercised capability is tracked as `Unexercised:` backlog rows, capped at 3 by the gate (`TASK-0175`, `ADR-0039`); Bionic F8 and the OpenCode binding's two post-pilot protections were retired as claims. Before it: `AGENTS.md` holds rules and commands only, 240 → 120 lines, and its budget is gated (`TASK-0174`, `ADR-0033` amended); `.ai-layout.json` names `.ai/README.md`, an existing entrypoint, and the gate checks the declaration. Before it: the gate checks skill frontmatter against the Agent Skills spec's limits: `name` at most 64 characters of `a-z0-9-`, `description` at most 1024, `compatibility` 1–500 (`TASK-0173`); `project-workflow`'s 1062-character description was trimmed. Before it: `loops/unattended-run/` runs on a forge tracker (`TASK-0172`, `ADR-0038`): the lock is a committed snapshot of each queued issue, the commit carries `#<id>`, and the run never touches the forge; its handover lists what the human posts after the push. Before it: each project declares its work tracker in `tracker.conf`: `files`, `gitlab` or `github` (`TASK-0171`, `ADR-0037`). Both planning skills ask at initialization; on a forge, tasks are issues, sprints are milestones, the wiki holds end-user docs, and the dashboard exits as not applicable. This repo is `files`. Before it: GitLab push-mirrors `origin` to `github` (`TASK-0170`, `ADR-0028` amended). Agents push `origin` only and confirm `github` by `ls-remote`; no host holds a GitHub token. Before it: the tracked `secrets.map` maps no secret (`TASK-0169`). `GITLAB_PUSH_TOKEN`, a new project token, is mapped only in the per-host `~/.config/vault/ai-toolbox.map`, because its path names a private mount. The admin `GITLAB_TOKEN` is in no map. Before it: the dashboard publishes to GitLab Pages too (`TASK-0168`): the instance runner now takes the `pages` job, and pipeline schedule 1 rebuilds it daily. Before it: the `repo-inventory` skill (`TASK-0167`): every repository under some roots and what in it is on no remote, read-only and offline. Before it: `origin` re-pointed to `https://`, on the human's decision; `ADR-0028` amended (`TASK-0166`). Before it: pushes to `origin` go over `https://` through a per-command rewrite, `vgit_origin` (`TASK-0163`). Before it: the gate's suites can no longer turn the repository bare when the pre-commit hook runs in a linked worktree (`TASK-0165`). Before it: selective install (`TASK-0164`): `--only` or a gitignored `install.selection`; deselected links and emitted agents leave the client (`ADR-0026` amended, which also fixed its prune for OpenCode). Before it: internal host names out of tracked files, enforced by the gate (`TASK-0162`); history still holds some, by the human's choice. Before it: dashboard rebuild points and the publishing question (`ADR-0035`, `TASK-0159`): the agent rebuilds when an approved plan's files are written and after a confirmed push; `publish-dashboard.sh decision` asks once per project with a remote, and a no is `targets = none`. Before it: a per-project secrets backend (`ADR-0034`, `TASK-0155`–`0158`): `local`, `vault` (own KV v2 mount via `provision`), `gitlab`, `github`. `project-workflow` asks at scaffolding; `project-migration` asks whether to migrate secrets, and `import` moves them.
- **Backlog:** seven open rows (`B-056`–`B-058`, `B-061`–`B-064`). The gate recounts them against the "N items are open" sentence, and caps the `Unexercised:` rows at 3 (`ADR-0039`).
- **Remotes:** `origin` is the intranet GitLab over `https://` (primary), and `github` is the public mirror (`ADR-0028`). Everything committed is world-readable.

## Components

| Kind | Items |
|---|---|
| Skills | `project-migration` 5.0.0, `project-workflow` 7.1.2, `ansible-ops` 1.2.2, `design-flow` 1.0.0, `unattended-ops` 1.4.1, `vault-secrets` 2.3.0, `repo-inventory` 1.0.0 |
| MCP servers | `ansible` (external, pinned, destructive tools human-authorized), `gates` (authored, Python), `graphify` (external) |
| Loops | `project-build`, `design-brief`, `ansible-change`, `release-check`, `unattended-run` |
| Mods | `task-compass` 0.4.0, in SIGMAorbital, whose `GOALS.md` lives under `.ai/`, and which also reads a project-workflow `.ai/` plan, read-only; `agent-watch` 0.4.0, a SIGMAorbital pane of this session and its sub-sessions (the task-orchestrator run, Workflow runs, delegating subagents), each with a progress bar and a colour its subagents share, a pulse and each agent's live activity, failure toasts, and a clickable task-progress band; `task-orchestrator` 0.3.0, a lead-coordinator mode whose `/orchestrate` draws as SIGMAorbital panels, that routes delegated work to subagents by model and effort under enforced limits, and hands a spawn auto mode cannot judge to the coordinator's own Agent call; `switchboard` 0.4.0, a SIGMAorbital pane of on/off switches for mods, skills and connectors, per project (all Claude Code only, `ADR-0040`) |
| Agents | 15 roles, emitted per client (`ADR-0018`); `prompts/` is empty by choice |
| Clients | Claude Code, OpenCode, and Bionic (MCP; its global skills target is manual, `ADR-0020`) |

Index: `docs/registry.md`, generated by `scripts/sync-registry.sh`.

## Gates and automation

- **`tests/validate.sh`** is the commit gate (`.githooks/pre-commit`): offline and hermetic. It checks:
  - component shapes, mods' included (`TASK-0177`), and the registry; skill frontmatter against the Agent Skills spec's limits (`TASK-0173`)
  - template drift, and artifact schemas: v1 frozen in `tests/legacy-schemas/`, v2 from `TASK-0153`/`ADR-0034`
  - backlog closures
  - live-file budgets, `AGENTS.md` included (120 lines), and a valid `.ai-layout.json` (`TASK-0174`)
  - the vault-secrets, worktree, private-names, install, repo-inventory, ci-alert and tracker suites; this repo's `tracker.conf` must say `files`, and the migration scaffold's conf must parse
  - no tracked file names a private host (`TASK-0162`): the `origin` host plus `.git/info/private-patterns`
  - a suite that creates a repository clears `GIT_DIR` first (`TASK-0165`)
- **CI** (`.github/workflows/`) runs `validate`, `bindings` (both unattended-run binding suites, `ADR-0032`), `dashboard` plus `dashboard-daily` (the published page, `ADR-0029`), and `ci-alert`, which opens and closes an issue on red. GitLab CI on `origin` runs only the `pages` job, on the instance runner, on push and on schedule 1 daily (`TASK-0168`).
- **Secrets** come from Vault through `vault_secrets.py exec` (`ADR-0030`). A new project declares its backend in `secrets.conf` (`ADR-0034`). The codebase AppRole is `ai-toolbox` (`ADR-0031`). Pushes go to `origin` only, with `vgit_origin`; GitLab mirrors them to `github` (runbook, *Authenticating a push*).
- **Sessions:** one worktree per concurrent agent session, landing by rebase (`ADR-0023`).

## Open items

Open work lives in `.ai/planning/BACKLOG.md`, its one owner. Rows titled `Unexercised:` are capped at 3 by the gate (`ADR-0039`), and the cap is reached: the next capability task first exercises or retires `B-056` (forge trackers), `B-057` (live secrets backends) or `B-058` (`ansible-ops` PVE snapshot).

Known limitation, not work: **`git add -- .`** cannot be denied at OpenCode's glob layer. Reopen it only if OpenCode's matcher changes.

## Standing decisions

These are not to be re-litigated without a new ADR:
- `ADR-0002`: `CLAUDE.md` is a symlink to `AGENTS.md`.
- `ADR-0004`: this repo is canonical for `project-workflow`.
- `ADR-0007`: trunk-based work, hook-first gating.
- `ADR-0008`: no `SKILL.md` line budget.
- `ADR-0009`: environment-supplied configuration; the gate checks documentation, not presence.
- `ADR-0013`: the two planning skills scaffold different frameworks.
- `ADR-0018`: agent portability per capability.
- `ADR-0021`: third-party extensions are wired, not vendored.
- `ADR-0027`: schemas own artifact shape.
- `ADR-0029`: CI alone builds the published dashboard.
- `ADR-0030`: Vault owns secrets.
- `ADR-0033`: concise artifacts, and git is the record.
- `ADR-0034`: each project declares its secrets backend; a Vault project gets its own mount.
- `ADR-0035`: the dashboard is rebuilt by agent steps, not hooks; publishing is asked once and a no is recorded.
- `ADR-0036`: a vendored skill copy carries a manifest and is verified by its project's gate.
- `ADR-0037`: each project declares its work tracker; the dashboard is for a files tracker only.
- `ADR-0038`: an unattended run on a forge locks a committed issue snapshot and never touches the forge.

## Environment

- Developed in WSL on a `/mnt/c` checkout. `core.filemode=false`, so set modes with `git update-index --chmod=+x`.
- The gate is green under WSL. Under Git Bash, `test-worktree.sh` and a `check-publish.sh` case fail (`TASK-0148`).
- Skills are installed as junctions to this checkout (`TASK-0160`), so a `git pull` updates every project on the machine; check with `install.sh --status`.
- On Windows, `vault_secrets.py exec` waits for its child (`TASK-0149`). Intranet TLS for Git and curl is set up per the runbook's *Secrets on a new host*.
- Mods need Claude Code 2.1.308+. `/agents` is a name Claude Code ships: a mod registering it has its whole `session.start` hook skipped, and only `claude plugin validate` says so (`TASK-0181`). This host's WSL `claude` and Windows `claude.exe` are both 2.1.310; `tests/test-mods.sh` takes the first new enough of `claude` and `claude.exe`, so the WSL one.
- Ansible: `ansible-core` 2.21.4, and `ansible-lint` reports 53 rules with 0 failures (`TASK-0115`).

## Lessons that keep recurring

1. A check that cannot fail is worse than none. Red-prove every new check.
2. Planning prose is a hypothesis about files. Open the file before acting on a claim, and re-read external sources rather than a quotation of them.
3. A budget or rule nobody measures is not one. Give it a mechanism.
4. A fixture set needs one case drawn from the real subject.
5. An unexercised artifact is the most reliable failure mode. Name at plan time what will exercise it.

## Recent changes

- `TASK-0193`, 2026-10-28: `agent-watch` 0.4.0: sessions and sub-sessions with progress bars, the orchestrator tie-in, gate rule 8 (`ADR-0044`); seen live, raising `B-065` and `B-066`.
- `TASK-0192`, 2026-10-28: `switchboard` 0.4.0 on SIGMAorbital: one panel, state glyphs, `/switchboard list` as panels.
- `TASK-0191`, 2026-10-28: `task-orchestrator` 0.2.0 on SIGMAorbital: `/orchestrate` as panels, an uppercase status line.
- `TASK-0190`, 2026-10-28: `task-compass` 0.4.0 on SIGMAorbital: token statuses, a panel card, `/goals` as a panel.
- `TASK-0189`, 2026-10-28: `agent-watch` 0.3.0 on SIGMAorbital: identity glyphs, state colours, panels.
- `TASK-0188`, 2026-10-28: `mods/_template/hooks/sigma.tsx`, the SIGMAorbital design module every mod copies (`ADR-0043`).
- `TASK-0187`, 2026-10-27: `switchboard` 0.3.0: switch-style toggles, skills from the context breakdown, `ccd_*` protected.
- `TASK-0186`, 2026-10-27: `switchboard` 0.2.0: every mod listed, On/Off buttons, next-session notes.
- `TASK-0185`, 2026-10-27: `mods/switchboard/` 0.1.0, the fourth mod: per-project on/off for mods, skills and connectors (`ADR-0042`).
- `TASK-0183`, 2026-10-27: `mods/task-orchestrator/` 0.1.0, the third mod: routed, fenced delegation to subagents (`ADR-0041`).
- `TASK-0182`, 2026-10-27: `agent-watch` 0.2.0: live activity per subagent, failure toasts at `SubagentStop`, band buttons, a status-line count.
- `TASK-0181`, 2026-10-27: `mods/agent-watch/` 0.1.0, the second mod; the runbook's link route for hot-loading a mod into a running session.
- `TASK-0175`, 2026-10-18: open items became backlog rows `B-056`–`B-063`; at most 3 `Unexercised:` rows open (`ADR-0039`); two retired.
- `TASK-0174`, 2026-10-18: `AGENTS.md` cut to rules and commands, 120 lines, gated; `.ai-layout.json` fixed and gated.
- `TASK-0173`, 2026-10-18: the skill linter enforces the Agent Skills spec's name, description and compatibility limits; `project-workflow` 7.1.1.
- `TASK-0172`, 2026-10-18: both unattended-run drivers read `tracker.conf`; forge runs lock a committed issue snapshot (`ADR-0038`), closing `B-055`.
- `TASK-0171`, 2026-10-18: `tracker.conf` and `tracker.sh`; `project-workflow` 7.0.0 and `project-migration` 5.0.0 ask files, GitLab or GitHub (`ADR-0037`).
