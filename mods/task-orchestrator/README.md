# task-orchestrator

> **Status: experimental.** Every feature of this mod is experimental while ai-toolbox is in its development stage (decided 2026-11-04, issue #5). A feature leaves experimental only through the live-verification gate (#9). Status is recorded in `claude/status.json`.

Turns the session into a lead coordinator. While it is on, the main conversation plans and divides the work and delegates the substantive parts to **real, isolated subagents** (or, when the person asks for sessions, to Code-tab sessions) through a `dispatch` tool: each worker runs under a registered profile whose **model and effort come from a routing table** keyed by task class, inside limits the mod enforces in code (three concurrent workers, workers never delegate, one non-isolated writer at a time, writes only inside allowed files, two retries and one escalation per task). The worker's report comes back through `collect`; `status` shows every task with its **requested** model and effort beside what the runtime **observed**, and the host's overrides that may alter them. Claude Code only, 2.1.308 or later; terminal and desktop.

Workers are subagents by default: each gets its own context and tools, runs in the background and answers once. You can open a worker's transcript from the tasks list, but it is not a conversation of its own. A task the person asks to run as a session is different: a Code-tab session the person can open and talk to (see *Session workers*). With [agent-watch](../agent-watch/README.md) installed, its Agents pane draws the run as an `ORCH` sub-session: each task, queued ones included, with its state and a `TASKS` bar.

## Portability

The mod's Claude Code plugin is `claude/` (`ADR-0054`).

| Harness | Status |
|---|---|
| Claude Code | Supported: `claude/`. |
| OpenCode, Codex | Not yet. The routing and dispatch logic (`routing.ts`, `router.ts`, `ledger.ts`, `contract.ts`: pure, no engine call) is a candidate for a `core/` folder; the hooks, the panels and `register.tsx` stay Claude-only. `core/` is added only when a second harness needs it, and then imports no harness API. |

## Install

Published to the organization plugin library (0.5.4, 2026-11-04; claude.ai ran no security scan on it):

```
/plugin install task-orchestrator@claudeai-organization-library
```

From this checkout, `scripts/install.sh --client claude-code` adds the folder to `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` (runbook, *Loading a mod in development*).

## Activation

While it is on, the status line reads `ORCH BALANCED · 2 RUNNING · 1 QUEUED`, and a finished worker is toasted as `T1 · SCOUT · COMPLETED` (id, role and status, nothing else).

Orchestration starts **off**. `/orchestrate on` turns it on for this project's sessions (the choice is stored per project, keyed by the checkout's path, so another project stays off until it is turned on there; a session whose first prompt is an `# Assignment` header is a worker and stays off whatever the project's choice) and hands the model the coordinator protocol; `/orchestrate off` stops new dispatches, leaves the ledger and every running worker alone, and changes nothing of yours.

## Usage

- `/orchestrate status`: on or off, policy, the coordinator's model and effort (`coordinator: <model> / effort <x>`), every task as `id → worker [agent id] → requested model/effort → observed … → status → next`, blockers, and the overrides in force. In the transcript it draws as SIGMAorbital panels (`ADR-0043`): ORCHESTRATOR with the run and a row per task, its state as glyph and word (queued grey, running cyan, done bright, failed red, blocked or partial amber, a hand-off `⇄ HANDOFF` amber), a second detail line under the row, and OVERRIDES IN FORCE; the model reads the same text as before.
- `/orchestrate theme dark|light|auto`: pins the panels' SIGMAorbital colours (Night ops or Daylight) by hand; `auto` follows the theme setting again, which is the default.
- `/orchestrate policy economy|balanced|quality`: picks the policy; the worker profiles are registered again under it. `balanced` is the brief's table (haiku/low for extraction and lookup, sonnet/medium for exploration, implementation and tests, sonnet/high for review, opus/high for architecture, debugging and risk review); `economy` lowers exploration, documentation, review, architecture and debugging one step, never risk review; `quality` raises lookup, exploration, documentation, implementation, tests and review.
- `/orchestrate routing`: the table under the current policy, with the model ids spawns resolved the aliases to so far, drawn as a ROUTING panel.
- `/orchestrate models`: the alias resolutions seen this session and the models a spawn refused.
- `/orchestrate opt-in high-effort|frontier [off]`: `xhigh`, `max` and the `fable` alias are refused until opted in.
- `/orchestrate providers [enable|disable <id>]`: the external-provider adapters. None is implemented in this version; enabling one is refused and the data-sharing disclosure is shown.
- `/orchestrate cancel [<task>|all]`: cancels queued work, stops running workers through `TaskStop` (a running session through `stop_session`), and withdraws a hand-off still waiting for the coordinator's Agent or `start_session` call, which is then refused if made.
- `/orchestrate reset`: clears the ledger, the refused models and the printed-once record; refused while a task is running or a hand-off waits for the coordinator's call, naming them.

The model drives the rest through four tools: `dispatch` (a task with id, class, objective, inputs, allowed files, prohibited areas, deliverables, acceptance, dependencies, and optional role, model, effort, isolation and `runAs`), `collect` (returns the tasks' reports, and answers on every call. For a subagent task it reports the ledger as it is and returns at once: a subagent's end cannot reach the mod while `collect` runs, so its end note is what to wait for, and one `collect` after it prints the report. It waits only for session tasks, which it reads through the app: a running session, and a queued task whose unfinished dependencies are all running sessions. A queued task behind a subagent, behind the concurrency cap or waiting for the person's turn is listed with its reason and not waited on; a `cancel` that frees a slot starts what queued behind it in the same answer. A hook's ten-second budget bills every sleep, so one call waits about eight seconds at most, `collectTimeoutMs` (default 600000) is a ceiling that the hook's budget caps. If the wait is interrupted, the answer carries what it knows and `collect stopped after N ms (<reason>): call again`. An id it does not know is named beside the known ones, as `no task named <id>`. A task still running says not to poll: each ended task leaves the coordinator a note (its id, role and status, nothing the worker wrote: a worker's words are read through `collect` only, and its `Next:` is kept to one line of at most 200 characters), and it calls `collect` once for it; a report, and a hand-off's assignment, print once, and naming the task's id prints them again), `status` and `cancel`. While orchestration is off the four tools are deferred behind ToolSearch, so a session that never turns it on does not carry their schemas; the coordinator protocol reaches the model once a session, as the context of `/orchestrate on` or of the first prompt of a session that starts on, not inside `dispatch`'s description. A `dispatch` under the id of a task that ended `blocked`, `failed` or `partial` retries it in its place, as retry 1 or 2 of 2; a retry on a bigger model or a higher effort is also an escalation, and a second one is refused; its dependants keep waiting on it. A dependant whose dependency ended without completing stays queued, and `status` and `collect` say which task holds it and how to retry it, rather than leaving it to wait in silence. A cancelled task neither fails the run nor blocks it; a dependant it stalls makes the run `blocked`, naming both. A task handed off to the coordinator's own Agent call (auto mode, below) is `running` to the run, holds its slot against the cap and, as a non-isolated writer, the one-writer rule; its dependants wait for that call and are not told to retry it. The findings of a finished dependency reach the next worker's assignment under a line that names them as quoted data, every line indented, at most 1500 characters.

### Worker roles

| Class | Role | Reads only | Model/effort (balanced) |
|---|---|---|---|
| extraction | utility | yes | haiku/low |
| lookup | scout | yes | haiku/low |
| exploration | investigator | yes | sonnet/medium |
| documentation | documentation | no | haiku/medium |
| implementation | builder | no | sonnet/medium |
| testing | tester | no | sonnet/medium |
| review | reviewer | yes | sonnet/high |
| architecture | planner | yes | opus/high |
| debugging | debugger | no | opus/high |
| risk-review | risk-reviewer | yes | opus/high |
| frontier | frontier-specialist | no | fable/high (opt-in) |

The coordinator picks the class; `dispatch`'s `class` field lists what each one is for and its settings. A `role` named over the class brings that role's own row's model and effort, unless `model` or `effort` is named too. A model a spawn says is not available falls back up the ladder, and the note says it costs more. A model is ranked and gated by its family: `claude-fable-5-1` is gated like `fable`, and a model with no known family passes unchanged when it is available; it is refused when it is unavailable (no rung to fall back from), when escalated, or for a session. A `lookup` or `extraction` task that ends short of completed carries a `misclassified?` note in `collect`, naming the class to re-dispatch it under (`exploration`), which counts as its retry and escalation. Each role's own profile (`task-orchestrator:builder`) holds the table's settings. A task that asks for another model, effort or isolation runs under a profile of its own, `task-orchestrator:builder--sonnet-high` (`-wt` when isolated), so two builders at medium and high never share one registration.

A read-only role gets `Read`, `Grep`, `Glob` and `LS` and nothing else, so it has no shell. A writer role gets those and `Edit`, `Write`, `MultiEdit`, `NotebookEdit`, `Bash` and `TodoWrite` (`WRITER_TOOLS` in `routing.ts`), so no connector's schema rides into its context. Every role is denied `Agent`, `Workflow`, `SendMessage`, `TaskStop`, `EnterWorktree` and `ExitWorktree`. Each worker ends with a fixed report (Status, Findings, Files, Checks actually run, Evidence, Risks, Next) and is told to list checks it did not run under Next, never under Checks. The report parser reads the labels as the worker writes them: as plain lines, bullets, `##` headings or bold, followed by `:` or ` — ` (or ` – `), and `Checks run` or `Checks actually run` both name Checks. The status word must still be `completed`, `partial`, `blocked` or `failed`, else the task ends `partial`. A bullet label inside a filled section is kept as text, not read as a label. A worker is told not to update the person's task board or task list; the coordinator keeps the [task-compass](../task-compass/README.md) board current.

Each role has a turn cap on its profile: utility 10, scout 20, documentation, reviewer and risk-reviewer 30, investigator, planner and tester 40, frontier-specialist 80, builder and debugger 120 (`WRITER_CHANGE_TURNS` in `routing.ts`, sized for a mod change with its tests, a preview, a version step, a brief and the 5-10 minute gate). The assignment tells the worker to keep a tenth of its cap in reserve, at least two turns, and to stop by then with a `partial` report that says what is done, what is left and where its edits are. The engine stops a worker at its cap in the middle of a step, with no report. When a worker ends with no report and its transcript's last entry is a tool result, `collect` says it stopped at its turn cap. It names the worktree and branch, or the session's checkout, with the uncommitted changes and new commits there. It tells the coordinator to resume that agent with `SendMessage` to its agent id, because a fresh retry of an isolated task starts a new worktree at HEAD and loses those edits. The resumed agent's next turn sets the task back to `running` under the same write fence, and its report closes the task. A worker that stopped itself with a `partial` report (the reserve) or a `blocked` one, and is resumed by `SendMessage`, is reopened the same way, through the same admission check (0.7.1, `TASK-0289`).

### Session workers

A task runs as a session only when the person asks for sessions ("run them as sub sessions"). The coordinator then dispatches it with `runAs: "session"`; the default is `subagent`, and every other task stays one. A session is a Code-tab session the person can open and talk to. It runs in its own worktree, and its parent is the coordinator (`parentSessionId`).

- **The dispatch spawns nothing.** Its answer is a hand-off line naming the `start_session` call the coordinator makes: `initiation` "user_asked", `context` "fresh", `name` the task's id, the requested model and effort, `use_worktree` true, `wake_when_done` true, a `background` of over 80 characters, and the assignment as `prompt`, unchanged. The assignment starts with its header, `# Assignment <id> — role …`.
- **Refused above the coordinator.** A model above the coordinator's family, or an effort above its effort, is refused at dispatch with the reason. The app would start the session lower without saying so. The coordinator's effort is read from its own model requests; until one has been seen, it is taken from its settings (`CLAUDE_CODE_EFFORT_LEVEL`, then `modelSettings.<its model>.effortLevel`, then `effortLevel`), and the check is skipped only when none gives a level.
- **Adopted from that call.** The mod matches the coordinator's `start_session` to the task by the assignment header. The call must carry the hand-off's model, its effort and `use_worktree` true; otherwise it is denied with the difference and nothing is sent to the app. A call that passes moves the task to running with the session id the mod reads from the result (`local_<uuid>`). An `Agent` call carrying a session task's header is denied. `status` shows that id in the row's brackets. A refused call leaves the task blocked, with the app's words, until a call that passes. A result with no session id leaves it handed off, and `status` says the id was not found.
- **Only on a turn the person started.** The app starts a session only on a prompt the person typed. The mod hands a session task off only from a call made inside such a turn (the prompt's origin is the composer or the bridge; an `sdk` prompt is not the person's), and forgets the turn when the coordinator's own turn ends. A session task whose dependencies end on any other turn, or when a worker ends, waits as "waiting for the person's turn". The next prompt the person sends hands it off, with its hand-off line attached. This is the mod's own gate; whether the app accepts the call is the app's. The mod raises no proposal card for it: the coordinator asks the person to say go.
- **The limits that hold.** A session counts toward the concurrency cap, and a handed-off one holds its slot. It also counts toward dependencies, retries, escalation and the model and effort gates. The write fence and the one-writer rule do not apply to it: it is its own process in its own worktree, and its work lands by rebase onto `master` (ADR-0023). Its prompt carries the allowed files, the role's prompt and the report shape (a session has no profile to carry them), but the mod does not enforce the files for a session. A model whose family cannot be told from its name is refused for a session rather than passed.
- **Permissions.** A session takes the coordinator's permission mode, since the hand-off names none.
- **collect** reads a running session through the app: `get_session` for whether it is still running, then, once it has ended, `list_events` for its last message. That message is the report, parsed as a worker's is, and it is quoted data from another session. If the events cannot be parsed, the task ends `partial` and says no report was read. A session that ends inside `collect` starts its dependants as a subagent's end does. A task behind a session still waiting for its `start_session` call is reported as waiting for it, not as stalled. The model and effort `get_session` states are recorded as observed (a pattern match, not yet seen on a live answer). If the app refuses either read, `collect` prints the two calls for the coordinator to make and stops waiting on that task.

Seen live on 2026-11-08 (`TASK-0201`): two session workers side by side, a hand-off started on the next person's turn, and each session nested under the coordinator in the sidebar. Not yet run live: the mod's own reads under auto mode. `ARCHITECTURE.md`, *Observed, not guaranteed*, says what was seen.

### When the person names a model or an effort

A prompt such as "assign the tasks to sonnet 5.5 at medium or high effort by your judgement" outranks the table: the coordinator passes `model` on every dispatch and picks each task's `effort` inside the range; the table fills only what the person left open. Dispatch says nothing of a host effort setting such as `modelSettings.claude-sonnet-5-5.effortLevel`; if a worker's observed effort differs from the requested one, its line in `status` and `collect` carries an `effort mismatch` note naming both and the host setting for that model that likely caused it. A prompt asking for sessions makes the coordinator dispatch with `runAs: "session"`; the mod still starts no session itself.

### Configuring the routing

Without editing the mod, put a JSON file at `~/.claude/task-orchestrator.json` (every project) or `<project>/.claude/task-orchestrator.json` (one project). Any part may be left out; refused values are logged, listed by `status` under `config refused`, and ignored. A file that does not parse is listed there too. The home file is found from `HOME`, else `USERPROFILE`. `maxConcurrent` must be at least 1. The project file may only narrow what is in force: its `optIn` and its `providers` are refused (the opt-in is the person's, from the home file or `/orchestrate opt-in`), and a limit above the one in force is refused, so a cloned repository can neither opt the session into `xhigh`, `max` or `fable` nor raise the caps; its `policy` and `routes` are applied for the session (they can still raise what a class costs, so read a cloned repository's file before turning orchestration on there); nothing from the project file is persisted:

```json
{
  "policy": "balanced",
  "routes": { "review": { "model": "opus", "effort": "high" }, "lookup": { "effort": "medium" } },
  "limits": { "maxConcurrent": 3, "maxRetries": 2, "maxEscalations": 1, "collectTimeoutMs": 600000 },
  "optIn": { "highEffort": false, "frontier": false },
  "providers": { "openai": { "enabled": false }, "grok": { "enabled": false } }
}
```

The choices made with `/orchestrate` (on, policy, opt-ins, providers) are stored per project and win over the home file; the project file is applied last and is never stored. The store entry carries `v: 2` and holds `enabled` and those choices only, not the home file's values, so a later edit to the home file is seen. An older entry is read as `enabled` alone, and `status` lists an earlier-version line under `config refused`. A session task's branch is read from the `start_session` answer only when the word `branch` stands alone and is followed by a name containing `/`, `-` or a digit, or introduced by `named`, `called`, `:` or `=`; otherwise none is recorded.

## Not yet verified

Version 0.7.1 (`TASK-0289`): a resumed self-stopped worker reopened under the fence and the cap. Tested in the mod test kit only; the defect it fixes was seen live on 2026-11-11 (below).

Seen live on 2026-11-11 with 0.7.0 (Claude Code desktop 2.1.318): an isolated documentation worker wrote through the fence in its own worktree; at turn 27 of its 30 it stopped itself with a `partial` report naming the worktree, as the reserve asks. Resumed by `SendMessage` while three workers ran, it was not reopened: it ran as a fourth worker outside the fence, no note was written, and `collect` kept its first report. The engine's mid-step cut-off at a cap, and whether a resumed agent's `turn.start` carries its agent id, were not seen; its `turn.complete` does (its tokens were summed).

Version 0.7.0 (`TASK-0265`): the fence resolved inside a real worktree (what `$.session.cwd()` returns in a worker's hook), a resume the cap refuses, and the branch read from a real `start_session` answer. These are tested in the mod test kit only.

Version 0.6.0 (`TASK-0260`): the turn caps, the reserve in the assignment, and `collect`'s turn-cap report with resume handling. These are tested in the mod test kit, with the engine's git output and an agent transcript stubbed. They have not been seen in a live run: a worker stopped at the 120 cap, `collect` naming its real worktree, and the coordinator's `SendMessage` reopening the task. On 2026-11-08 a resume by `SendMessage` worked by hand, before this version. Whether the engine sends a resumed agent's `turn.start` with its agent id has not been seen live either. Without it, the task stays `partial` and outside the write fence until the resumed run's report closes it.

## What is enforced and what is observed

`ARCHITECTURE.md` has the full split. In short: limits, the no-delegation rule, the write fence and the opt-in gates are code; the model and effort of a worker are set on its registered profile and are **requested** until the worker's first model request shows them, when `status` reports them as **observed**; a host setting such as `modelSettings.<model>.effortLevel` or `CLAUDE_CODE_SUBAGENT_MODEL` is listed by `status` as disclosed (not a prediction), and a mismatch between requested and observed effort is noted on the task; the mod never overrides either. A subagent worker's tokens (input, output and cache, summed from the usage its turns report) are shown on its task line, and the run line in `status` and `collect` sums them; a session worker's are not counted, and the coordinator's own are not either. Cost is not reported.

### What is enforced

- The write fence resolves `..`, case (a drive-letter root only) and drive letter, and confines a writer to its checkout; it does not follow symlinks or junctions or expand 8.3 names. An empty allowed-files list means the whole checkout, not anywhere. A writer whose checkout path is empty or relative has every write refused (`the checkout path is unknown`).
- Every path into `running` (a dispatch, a worker profile taken through the Agent tool, a hand-off adopted, a resume of a turn-capped or self-stopped worker) passes one admission check against the cap and the writer rules. A resume the cap refuses leaves the task as it was (`partial`, or `blocked` for a worker that reported blocked), and a hidden note tells the coordinator to stop the agent with `TaskStop` or let it end. A spawn refused after the Agent call started is stopped with `TaskStop`; if the engine refuses the stop, the note says so, names the agent id, and the worker runs untracked and unfenced until the coordinator stops it.
- `/orchestrate off` keeps running workers fenced.
- `cancel` with no id is refused; the command's bare `cancel` still means all.
- A dependant's stall text names the way out by its root's state: cancelled, cancel it or dispatch a new task; turn-capped, resume with `SendMessage`; otherwise retry n of 2.
- The status line counts a hand-off as running and refreshes on dispatch. A panel row's second line carries the blocker, `retry n/2`, tokens and a session task's branch.
- The run mirror caps each kept report field at 2000 characters, and `/orchestrate reset` deletes it.

### In auto permission mode

Auto mode's classifier judges an action against the model request that produced it. A worker the mod spawns itself has no such request, so in a desktop session in auto mode the spawn was refused with "the auto mode classifier gave no verdict for Agent", while the model's own Agent calls ran. The mod then issues the spawn once more, as the refusal asks. Refused again, the task is `blocked` and handed off: `dispatch` and `collect` print the Agent call to make (the role's own profile as agent type, the model, the effort, and the worktree for an isolated task: a per-settings profile is no Agent type until the next turn, and the call's effort outranks the profile's) and the assignment to pass as its prompt; the assignment's header, `# Assignment T1 — role …`, names the task, since the desktop app's Agent tool takes no name. The coordinator's own Agent call is one the classifier evaluates, and the mod adopts it into the task: same id, same limits, same write fence. Nothing about the call is changed and no permission is added; if the classifier refuses the call, the task stays blocked. In a live desktop session (2026-10-28) the hand-off was printed for every task, and the coordinator's Agent call ran; 0.4.0 matched it by `name`, which that Agent tool does not take, so it ran untracked. 0.4.1 matches by the header. `ARCHITECTURE.md`, *Observed, not guaranteed*, has the details.

## Removal

`/orchestrate off` stops it. To remove the mod: `/plugin uninstall task-orchestrator`, or take the folder out of `CLAUDE_CODE_PLUGIN_DIRS`. Its stored choices and audit rows live in the plugin store under `task-orchestrator:settings:<project path>` and `task-orchestrator:audit`, and the open run under `task-orchestrator:run:<session id>` (one entry per session, so two sessions never write over each other), so a `/reload-plugins --force` does not lose it; nothing is written to the project.
